import { _PREFIX, packageJson } from '@/core/constants.js'
import { logger } from '@/core/logger.js'
import { BaseEngine } from '@/engines/base.js'
import { CreateThreadOptions, openai } from '@/engines/openai/api.js'
import { options as pluginOptions } from '@/events/_start.js'
import fs from 'node:fs/promises'
import { compare, hasProperties } from '@/utils/other-utils.js'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { Assistant } from '@/engines/openai/assistant.js'
import { Flashcore, color, getState, portal, setState } from 'robo.js'
import type {
	ChatFunction,
	ChatFunctionParameters,
	ChatFunctionProperty,
	ChatMessage,
	ChatOptions,
	ChatResult,
	GenerateImageOptions,
	GenerateImageResult
} from '@/engines/base.js'
import type { AssistantData } from '@/engines/openai/assistant.js'
import type { File, Message } from '@/engines/openai/types.js'
import type { Command, CommandEntry } from 'robo.js'

const DEFAULT_MODEL = 'gpt-4o'

/**
 * AI engine powered by OpenAI.
 * You must have an OpenAI API key in order to use this engine.
 */
export class OpenAiEngine extends BaseEngine {
	private _assistant?: Assistant | null
	private _gptFunctions: ChatFunction[] = []
	private _gptFunctionHandlers: Record<string, Command> = {}

	/**
	 * Prepares the Assistant instance and optimizes commands for GPT Functions.
	 */
	public async init() {
		const { functions, functionHandlers } = await loadFunctions()
		this._gptFunctions = functions
		this._gptFunctionHandlers = functionHandlers
		this._assistant = await loadAssistant(functions)
	}

	public async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
		const {
			functions = this._gptFunctions,
			model = pluginOptions?.model ?? DEFAULT_MODEL,
			temperature = pluginOptions?.temperature,
			threadId,
			userId
		} = options ?? {}
		const { pollDelay = 1_000 } = pluginOptions

		// Use the assistant if it's available
		if (this._assistant && threadId) {
			// Prepare only the most recent message for the thread
			const mostRecentMessage = messages[messages.length - 1]
			const threadMessage: NonNullable<CreateThreadOptions['messages']>[number] = {
				role: 'user' as const,
				content: mostRecentMessage.content as string, // TODO: Account for images
				metadata: userId ? { userId } : undefined
			}

			// Get the prepared thread data
			const { thread, threadCreated } = await this._assistant.thread({ messages, threadId, threadMessage, userId })

			// Wait thread runs to complete before continuing
			const activeRun = getState<Promise<unknown>>('run', {
				namespace: _PREFIX + '/thread/' + thread.id
			})
			if (activeRun) {
				logger.debug(`Waiting for active run to complete...`)
				await activeRun
				logger.debug(`Active run completed.`)
			}

			// Add the messages to the thread unless it was just created
			if (!threadCreated) {
				try {
					await openai.createMessage({
						...threadMessage,
						thread_id: thread.id
					})
					logger.debug(`Added message to thread "${color.bold(thread.id)}":`, threadMessage)
				} catch (e) {
					logger.debug(`Failed to add message to thread "${color.bold(thread.id)}":`, threadMessage)

					// List most recent runs for this thread
					const runs = await openai.listRuns({
						thread_id: thread.id
					})
					logger.debug(`Runs for thread "${color.bold(thread.id)}":`, runs?.data?.length)

					// Cancel any active runs
					const activeRuns = runs?.data?.filter((run) => ['in_progress', 'requires_action'].includes(run.status))
					logger.debug(`Cancelling ${activeRuns?.length} active runs...`)

					await Promise.all(
						activeRuns?.map(async (run) => {
							await openai.cancelRun({
								run_id: run.id,
								thread_id: thread.id
							})
							logger.debug(`Cancelled run "${color.bold(run.id)}"`)
						}) ?? []
					)

					await openai.createMessage({
						...threadMessage,
						thread_id: thread.id
					})
					logger.debug(`Added message to thread "${color.bold(thread.id)}":`, threadMessage)
				}
			}

			// Run the assistant until we get something back!
			logger.debug(
				`Running assistant "${color.bold(this._assistant.data.id)}" for OpenAI thread "${color.bold(thread.id)}"`
			)
			let run = await openai.createRun({
				assistant_id: this._assistant.data.id,
				thread_id: thread.id
			})
			let runResolve = (value: unknown) => value
			const runPromise = new Promise((resolve) => {
				runResolve = resolve
			})
			let response: Message | null = null
			setState('run', runPromise, {
				namespace: _PREFIX + '/thread/' + thread.id
			})

			// Wait for the run to complete
			try {
				while (['queued', 'in_progress'].includes(run.status)) {
					await new Promise((resolve) => setTimeout(resolve, pollDelay))
					run = await openai.getRun({
						run_id: run.id,
						thread_id: thread.id
					})
					logger.debug(`Run status for "${color.bold(run.id)}":`, run?.status)
					if (run?.status && run.status !== 'in_progress') {
						logger.debug(`Run details for "${color.bold(run.id)}":`, run)
					}

					if (run.status === 'completed') {
						// TODO: Paginate via "before" cursor + message cache
						const threadMessages = await openai.getThreadMessages({
							thread_id: thread.id,
							limit: 1
						})

						response = threadMessages?.data?.[0]
						return {
							finish_reason: 'stop', // TODO: Abstract this
							message: {
								role: response?.role,
								// @ts-expect-error - // TODO: Abstract this
								content: response?.content?.[0]?.text?.value
							}
						}
					} else if (run.status === 'failed') {
						logger.error(`Run failed:`, run)
						throw new Error(`Run failed: ${run}`)
					} else if (run.status === 'requires_action') {
						const functionCall = run.required_action?.submit_tool_outputs.tool_calls[0]
						if (!functionCall) {
							throw new Error(`No function call found for ${run.id}`)
						}

						return {
							finish_reason: 'function_call',
							message: {
								role: 'assistant',
								function_call: {
									name: functionCall.function.name,
									arguments: convertToJSON(functionCall.function.arguments)
								},
								content: []
							}
						}
					}
				}
			} finally {
				setState('run', null, {
					namespace: _PREFIX + '/thread/' + thread.id
				})
				runResolve?.(response)
				logger.debug(`Assistant response:`, response)
			}
		}

		const response = await openai.chat({
			max_tokens: pluginOptions?.maxTokens,
			model: model,
			messages: messages,
			functions: functions,
			temperature: temperature
		})
		logger.debug(`GPT Response:`, response)

		const reply = response?.choices?.[0]
		let replyFunction = undefined
		if (reply?.message?.function_call) {
			replyFunction = {
				name: reply?.message?.function_call?.name,
				arguments: JSON.parse((reply?.message?.function_call?.arguments as unknown as string) ?? '{}')
			}
		}
		return {
			finish_reason: reply?.finish_reason,
			message: {
				...reply?.message,
				function_call: replyFunction
			}
		}
	}

	public async generateImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
		const { model = 'dall-e-3', prompt } = options

		const response = await openai.createImage({
			model,
			prompt
		})
		logger.debug(`GPT Image Response:`, response)

		return {
			images: response?.data
		}
	}

	public getFunctionHandlers(): Record<string, Command> {
		return this._gptFunctionHandlers
	}

	public getInfo() {
		return {
			name: 'OpenAI',
			version: packageJson.version
		}
	}
}

/**
 * Loads an Assistant instance to be used for certain interactions.
 *
 * @returns The Assistant instance, or null if the feature is disabled.
 */
async function loadAssistant(functions?: ChatFunction[]): Promise<Assistant | null | undefined> {
	// No need to load the assistant if Insight feature is disabled
	if (!pluginOptions.insight) {
		logger.debug('Insight is disabled. Skipping assistant initialization.')
		return null
	}

	// Prepare expected assistant data
	const roboPackageJsonFile = await readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
	const roboPackageJson = JSON.parse(roboPackageJsonFile) ?? {}
	const assistantData: Omit<AssistantData, 'created_at' | 'id' | 'object'> = {
		description: roboPackageJson.description ?? '',
		file_ids: [],
		instructions: pluginOptions?.systemMessage ?? '',
		metadata: {
			pluginVersion: packageJson.version,
			roboVersion: roboPackageJson.dependencies?.['robo.js'] ?? 'unknown',
			version: roboPackageJson.version ?? 'unknown'
		},
		model: pluginOptions?.model ?? DEFAULT_MODEL,
		name: roboPackageJson?.name ?? path.basename(process.cwd()),
		tools: []
	}

	// TODO: Add support for Assistants v2
	if (assistantData.model === 'gpt-4o') {
		assistantData.model = 'gpt-4'
		logger.debug('Model', color.bold('gpt-4o'), 'is not supported yet. Using', color.bold('gpt-4'), 'instead.')
	}

	// See if we've already created an assistant for this Robo
	let assistant: Assistant | undefined | null = null
	const assistantId = await Flashcore.get<string>('assistantId', {
		namespace: _PREFIX
	})
	if (assistantId) {
		assistant = await openai.getAssistant({ assistant_id: assistantId })
		logger.debug(`Found assistant ${color.bold(assistantId)}:`, assistant)
	}

	// Assistant not found via ID? See if it's in the list of assistants in case Flashcore was reset
	if (!assistant) {
		const assistants = await openai.listAssistants()
		assistant = assistants?.find((assistant) => assistant.data.name === assistantData.name)

		if (assistant) {
			logger.debug(`Found assistant from previous list: ${assistant}`)
		}
	}

	// Still no assistant? Create one!
	if (!assistant) {
		logger.debug(`Creating assistant:`, assistantData)
		assistant = await openai.createAssistant(assistantData)
		logger.info(`Created assistant ${color.bold(assistant.data.id)}`)
	}

	// Set the assistant ID if we didn't already have it
	if (!assistantId) {
		await Flashcore.set('assistantId', assistant.data.id, {
			namespace: _PREFIX
		})
	}

	// Check if the /documents directory has files
	const documentsDir = path.join(process.cwd(), 'documents')
	const documents: string[] = []

	try {
		const documentStats = await fs.stat(documentsDir)
		if (documentStats.isDirectory()) {
			const dirs = await fs.readdir(documentsDir)
			documents.push(...(dirs ?? []))
			logger.debug(`Validating documents:`, documents)

			assistantData.tools.push({
				type: 'retrieval'
			})
		}
	} catch (e) {
		if (hasProperties<{ code: unknown }>(e, ['code']) && e.code !== 'ENOENT') {
			throw e
		}
	}

	// Upload documents if they exist
	const documentResults: Record<string, string> = {}
	await Promise.all(
		documents.map(async (document) => {
			try {
				const filePath = path.join(documentsDir, document)
				const fileStats = await fs.stat(filePath)

				// Skip directories
				if (fileStats.isDirectory()) {
					logger.warn(`Directories are not supported. Skipping ${color.bold(document)}`)
					return
				}

				// Check if the file has already been uploaded and skip if it has
				const cachedFile = await Flashcore.get<File>(document, {
					namespace: _PREFIX + '/files'
				})

				if (cachedFile && cachedFile.bytes === fileStats.size) {
					assistantData.file_ids.push(cachedFile.id)
					logger.debug(`Using cached document ${color.bold(document)}:`, cachedFile)
					return
				}

				// Upload the file if it doesn't exist
				const fileBlob = new Blob([await fs.readFile(filePath, 'utf-8')])
				const file = await openai.uploadFile({
					purpose: 'assistants',
					file: fileBlob,
					fileName: document
				})
				assistantData.file_ids.push(file.id)
				documentResults[document] = file.id
				logger.debug(`Uploaded document ${color.bold(document)}:`, file)

				// Cache the file ID for  later use
				await Flashcore.set<File>(
					document,
					{
						id: file.id,
						bytes: fileStats.size
					},
					{
						namespace: _PREFIX + '/files'
					}
				)

				// Update the list of cached file IDs
				await Flashcore.set(
					'files',
					(files: Record<string, string>) => {
						if (!files) {
							files = {}
						}
						if (!files[document]) {
							files[document] = file.id
						}

						return files
					},
					{
						namespace: _PREFIX
					}
				)
			} catch (e) {
				logger.error(`Error uploading document ${color.bold(document)}:`, e)
			}
		})
	)

	const uploadedDocuments = Object.keys(documentResults)
	if (uploadedDocuments.length > 0) {
		logger.debug(documentResults)
		logger.info(`Uploaded ${uploadedDocuments.length} documents:`, uploadedDocuments)
	}

	// Got any functions? Add them to the assistant
	functions?.forEach((fun) => {
		assistantData.tools.push({
			type: 'function',
			function: fun
		})
	})

	// Make sure the assistant is up to date on OpenAI's end
	const differences = compare(assistant.data as unknown as Record<string, unknown>, assistantData, [
		'description',
		'file_ids',
		'instructions',
		'metadata',
		'model',
		'name',
		'tools'
	])
	logger.debug(`Found ${differences.length} assistant differences:`, differences)
	if (differences.length > 0) {
		logger.debug(`Updating assistant ${color.bold(assistant.data.id)} with:`, assistantData)
		assistant = await openai.modifyAssistant({
			assistant_id: assistant.data.id,
			description: assistantData.description,
			file_ids: assistantData.file_ids,
			instructions: assistantData.instructions,
			metadata: assistantData.metadata,
			model: assistantData.model,
			name: assistantData.name,
			retries: 0,
			tools: assistantData.tools
		})
	}

	// Get the list of cached file IDs and make sure they exist
	const cachedFiles =
		(await Flashcore.get<Record<string, string>>('files', {
			namespace: _PREFIX
		})) ?? {}
	const cachedFileNames = Object.keys(cachedFiles)
	logger.debug(`Found ${cachedFileNames.length} cached files:`, cachedFileNames)

	// Remove any cached files that don't exist anymore
	if (cachedFileNames.length > 0) {
		const files = await openai.listFiles()
		const fileNamesToRemove = cachedFileNames.filter((fileName) => {
			const fileExists = documents?.find((file) => file === fileName)
			return !fileExists
		})
		logger.debug(`Removing ${fileNamesToRemove.length} cached files:`, fileNamesToRemove)

		// Only if also in OpenAI's list of files
		const fileIdsToRemove = fileNamesToRemove
			.map((fileName) => cachedFiles[fileName])
			.filter((fileId) => {
				const fileExists = files?.data?.find((file) => file.id === fileId)
				return !!fileExists
			})
		logger.debug(`Removing ${fileIdsToRemove.length} cached file IDs:`, fileIdsToRemove)

		await Promise.all(
			fileIdsToRemove.map(async (cachedFileId) => {
				await openai.deleteFile({
					file_id: cachedFileId
				})
				const fileName = Object.keys(cachedFiles).find((fileName) => cachedFiles[fileName] === cachedFileId)
				if (fileName) {
					await Flashcore.delete(fileName, {
						namespace: _PREFIX + '/files'
					})
					await Flashcore.set(
						'files',
						(files: Record<string, string>) => {
							delete files[fileName]
							return files
						},
						{
							namespace: _PREFIX
						}
					)
				}
			})
		)
		logger.debug(`Successfully removed ${fileNamesToRemove.length} cached files.`)
	}

	return assistant
}

/**
 * Generates an optimized array of GPT functions based on the commands this Robo has available.
 *
 * @returns An object containing the functions and their handlers.
 */
async function loadFunctions() {
	const functions: ChatFunction[] = []
	const functionHandlers: Record<string, Command> = {}

	// Normalize key to allow formats like "/ai ask", "ai/ask", and "ai ask"
	let whitelistedCommands = Array.isArray(pluginOptions.commands) ? pluginOptions.commands : []
	whitelistedCommands = whitelistedCommands.map((command) => {
		let key = command
		if (key.at(0) === '/') {
			key = key.slice(1)
		}
		key = key.replaceAll('/', ' ')

		return key
	})

	portal?.commands
		.filter((command: CommandEntry) => {
			// Only allow commands enabled in the plugin options
			if (Array.isArray(pluginOptions.commands)) {
				return whitelistedCommands.includes(command.key.replaceAll('/', ' '))
			} else {
				return !!pluginOptions.commands
			}
		})
		.forEach((command: CommandEntry) => {
			const commandParameters: ChatFunctionParameters = {
				type: 'object',
				required: [],
				properties: {}
			}

			// Convert Discord command options to GPT function parameters
			commandParameters.properties =
				command.handler.config?.options?.reduce((properties, option) => {
					properties[option.name] = {
						type: 'string',
						description: option.description ?? ''
					}
					if (option.required) {
						commandParameters.required?.push(option.name)
					}
					return properties
				}, {} as Record<string, ChatFunctionProperty>) ?? {}

			// Add the GPT function to the list
			const functionName = command.key.replaceAll('/', '_')
			functions.push({
				name: functionName,
				description: command.description ?? '',
				parameters: commandParameters
			})
			functionHandlers[functionName] = command.handler
		})
	logger.debug(`Loaded ${functions.length} GPT functions:`, functions)

	return {
		functions,
		functionHandlers
	}
}

/**
 * Converts a function call to a JSON string like the older API.
 */
function convertToJSON(input: string): Record<string, string> {
	// If the input is already JSON, return it
	try {
		const json = JSON.parse(input)
		logger.debug(`Function call is already JSON:`, json)
		return json
	} catch {
		// Do nothing, this is fine
	}

	// Extract the function name and parameters
	const match = input.match(/^(\w+)\((.*)\)$/)
	if (!match) {
		throw new Error('Invalid input format')
	}

	// Split parameters into key-value pairs
	const params = match[2].split(',').map((param) => param.trim())

	// Construct an object from the key-value pairs
	const result = params.reduce((obj, param) => {
		const [key, value] = param.split('=').map((p) => p.trim())

		// Remove leading and trailing single quotes and @ symbol from value
		const formattedValue = value.replace(/^'@?|'$/g, '')

		// Capitalize the first letter of the value if it's not a number
		obj[key] = isNaN(formattedValue as unknown as number)
			? formattedValue.charAt(0).toUpperCase() + formattedValue.slice(1)
			: formattedValue
		return obj
	}, {} as Record<string, string>)
	logger.debug(`Converted function call to JSON:`, result)

	// Convert the object to a JSON string
	return result
}
