#!/usr/bin/env node
import { Highlight, HighlightBlue, HighlightGreen, HighlightMagenta, HighlightRed, Indent } from './core/constants.js'
import Robo from './robo.js'
import { IS_BUN_RUNTIME, getPackageManager, packageJson } from './utils.js'
import path from 'node:path'
import { input, select } from '@inquirer/prompts'
import { color, logger } from 'robo.js'
import { Command } from 'robo.js/cli.js'

export interface CommandOptions {
	features?: string
	install?: boolean
	'no-install'?: boolean
	javascript?: boolean
	kit?: 'activity' | 'app' | 'bot' | 'web'
	plugin?: boolean
	plugins?: string[]
	template?: string
	typescript?: boolean
	verbose?: boolean
	roboVersion?: string
	update?: boolean
	'no-update'?: boolean
	creds?: boolean
	'no-creds'?: boolean
	version?: boolean
}

new Command('create-robo <projectName>')
	.description('Launch epic projects instantly with Robo.js — effortless, powerful, complete!')
	.version(packageJson.version)
	.positionalArgs(true)
	.option('-f', '--features', 'comma-separated list of features to include')
	.option('-js', '--javascript', 'create a Robo using JavaScript')
	.option('-p', '--plugins', 'pre-install plugins along with the project')
	.option('-P', '--plugin', 'create a Robo plugin instead of a bot')
	.option('-ni', '--no-install', 'skips the installation of dependencies')
	.option('-nu', '--no-update', 'skips the update check')
	.option('-t', '--template', 'create a Robo from an online template')
	.option('-ts', '--typescript', 'create a Robo using TypeScript')
	.option('-v', '--verbose', 'print more information for debugging')
	.option('-rv', '--robo-version', 'specify a Robo.js version to use')
	.option('-k', '--kit', 'choose a kit to start off with your Robo')
	.option('-nc', '--no-creds', 'Skips asking for the credentials')
	.handler(async (args: string[], options: CommandOptions) => {
		logger({
			level: options.verbose ? 'debug' : 'info'
		}).debug(`Creating new Robo.js ${options.plugin ? 'plugin' : 'project'}...`)
		logger.debug(`Using options: ${JSON.stringify(options)}`)
		logger.debug(`Using args: ${JSON.stringify(args)}`)
		logger.debug(`Package manager:`, getPackageManager())
		logger.debug(`create-robo version:`, packageJson.version)
		logger.debug(`Current working directory:`, process.cwd())

		// Just return the version if requested
		if (options.version) {
			const version = color.cyan('v' + packageJson.version)

			logger.log()
			logger.log(Indent, '⚡', color.bold('Create Robo ' + version))
			logger.log(Indent, '  ', packageJson.description)
			logger.log()
			logger.log(Indent, '   Learn more:', HighlightBlue('https://robojs.dev/create-robo'))
			logger.log()

			return
		}

		// Verify option types for better Commander API compatibility
		if (typeof options.plugins === 'string') {
			// @ts-expect-error - This is a valid check
			options.plugins = options.plugins.split(' ')
		} else if (options.kit?.includes(' ')) {
			// Bypasses current bug in CLi handler causing kit to be read as arg
			// e.g. `npx create-robo -k activity myProject` reads `activity myProject` as the kit
			// TODO: https://github.com/Wave-Play/robo.js/issues/331
			const tokens = options.kit.split(' ')
			options.kit = tokens.shift() as 'activity' | 'app' | 'bot' | 'web'
			args.push(...tokens)
		}

		// Set default values
		if (options.creds === undefined) {
			options.creds = true
		}
		if (options['no-creds']) {
			options.creds = false
		}
		if (options.install === undefined) {
			options.install = true
		}
		if (options['no-install']) {
			options.install = false
		}
		if (options.update === undefined) {
			options.update = true
		}
		if (options['no-update']) {
			options.update = false
		}

		// `activity` is an alias for `app`
		if (options.kit === 'activity') {
			options.kit = 'app'
		}

		// No kit specified, prompt the user to choose an adventure: bot or activity or webapp
		if (!options.kit && !options.template) {
			logger.log()
			options.kit = await select<'app' | 'bot' | 'web'>(
				{
					message: color.blue('Choose your adventure:'),
					choices: [
						{ name: 'Discord Activity', value: 'app' as const },
						{ name: 'Discord Bot', value: 'bot' as const },
						{ name: 'Web Application', value: 'web' as const }
					]
				},
				{
					clearPromptOnDone: true
				}
			)
		}

		// Ensure correct kit is selected (bot or app or web)
		if (options.kit && !['bot', 'app', 'web'].includes(options.kit)) {
			logger.error('Only bot (default), activity and web kits are available at the moment.')
			return
		}

		// Check for updates
		if (options.update) {
			await checkUpdates()
		}

		// Infer project name from current directory if it was not provided
		let projectName = args[0]
		let useSameDirectory = false

		if (!projectName) {
			projectName = process.cwd().split(path.sep).pop()
			useSameDirectory = true
		}
		logger.debug(`Project name: ${projectName}`)

		// Ask the user for Robo name directly as a fallback
		if (!projectName) {
			logger.debug(`Project name not provided, asking user...`)
			projectName = await input({
				message: `What would you like to call your Robo?`,
				validate: (input) => {
					if (input.trim().length < 1) {
						return 'Oops! Please enter a name for your Robo before continuing.'
					}
					return true
				}
			})
			useSameDirectory = true
		}

		// Print introduction section
		const kitName = options.kit === 'web' ? 'Web App' : options.kit === 'app' ? 'Discord Activity' : 'Discord Bot'
		logger.log('')
		logger.log(Indent, color.bold('✨ Welcome to Robo.js!'))
		logger.log(Indent, `   Spawning ${Highlight(projectName)} as a ${Highlight(kitName)}...`)

		const metadata: Array<{ key: string; value: string }> = []
		if (options.plugin) {
			metadata.push({ key: 'Type', value: 'Plugin' })
		}
		if (options.javascript || options.typescript) {
			metadata.push({ key: 'Language', value: options.typescript ? 'TypeScript' : 'JavaScript' })
		}
		if (options.features) {
			metadata.push({ key: 'Features', value: options.features })
		}
		if (options.plugins) {
			metadata.push({ key: 'Plugins', value: options.plugins.join(', ') })
		}
		if (options.install === false) {
			metadata.push({ key: 'Install dependencies', value: 'No' })
		}
		if (options.roboVersion) {
			metadata.push({ key: 'Robo version', value: options.roboVersion })
		}

		if (metadata.length > 0) {
			logger.log('')
			logger.log(Indent, color.bold('   Specs:'))
			metadata.forEach(({ key, value }) => {
				logger.log(Indent, `   - ${key}:`, Highlight(value))
			})
		}

		// Create a new Robo project prototype
		logger.debug(`Creating Robo prototype...`)
		const robo = new Robo(projectName, options, useSameDirectory)
		const plugins = options.plugins ?? []
		logger.log('')

		let selectedFeaturesOrDefaults: string[] = []
		if (options.template) {
			logger.debug(`Downloading template: ${options.template}`)
			await robo.downloadTemplate(options.template)
		} else {
			// Verify plugin status if it sounds like one
			if (!robo.isPlugin && projectName.toLowerCase().includes('plugin')) {
				await robo.askIsPlugin()
			}

			// Get user input to determine which features to include or use the recommended defaults
			selectedFeaturesOrDefaults = options.features?.split(',') ?? (await robo.getUserInput())
			await robo.createPackage(selectedFeaturesOrDefaults, plugins)

			// Determine if TypeScript is selected and copy the corresponding template files
			logger.debug(`Copying template files...`)
			await robo.copyTemplateFiles('')
			logger.debug(`Finished copying template files!`)
		}

		// Want some plugins?
		// if there are plugins specified with the command we skip asking for more.
		if (!options.template && (options.plugins === undefined || options.plugins.length <= 0)) {
			await robo.plugins()
		}

		// Ask the user for their Discord credentials (token and client ID) and store them for later use
		// Skip this step if the user is creating a plugin or using web kit
		if (!robo.isPlugin && options.kit !== 'web') {
			logger.debug(`Asking for Discord credentials...`)
			await robo.askForDiscordCredentials()
		}

		// Bun is special
		// if executed with with `bunx --bun create-robo`
		// it will use it as runtime, hence:
		if (IS_BUN_RUNTIME) {
			await robo.bun()
		}

		const packageManager = getPackageManager()
		logger.log(Indent.repeat(15))
		logger.log(Indent, '🚀', HighlightGreen('Your Robo is ready!'))
		logger.log(Indent, '   Say hello to this world,', color.bold(projectName) + '.')
		logger.log('')

		// What's next?
		logger.log(Indent, '   ' + color.bold('Next steps'))
		if (!useSameDirectory) {
			logger.log(Indent, '   - Change directory:', Highlight(`cd ${projectName}`))
		}
		if (!options.install || robo.shouldInstall) {
			logger.log(Indent, '   - Install dependencies:', Highlight(packageManager + ' install'))
		}
		if (robo.missingEnv) {
			logger.log(Indent, '   - Add missing variables:', Highlight('.env'))
		}
		logger.log(Indent, '   - Develop locally:', Highlight(packageManager + ' run dev'))
		logger.log(Indent, '   - Deploy to the cloud:', Highlight(packageManager + ' run deploy'))

		// Show what failed and how to resolve
		if (robo.installFailed) {
			logger.log('')
			logger.log(Indent, '   ' + HighlightRed('Resolve these issues'))
			logger.log(Indent, '   - Install dependencies manually:', Highlight(packageManager + ' install <packages>'))
		}

		// Link to common resources
		if (options.kit === 'app') {
			logger.log('')
			logger.log(Indent, '  ', color.bold('Learn more'))
			logger.log(Indent, '   - Documentation:', HighlightBlue('https://robojs.dev/discord-activities'))
			logger.log(
				Indent,
				'   - Authenticating users:',
				HighlightBlue('https://robojs.dev/discord-activities/authentication')
			)
			logger.log(
				Indent,
				'   - Multiplayer features:',
				HighlightBlue('https://robojs.dev/discord-activities/multiplayer')
			)
			logger.log(Indent, '   - ✨🎃 Hacktoberfest:', HighlightMagenta('https://robojs.dev/hacktoberfest'))
		} else if (options.kit === 'bot') {
			logger.log('')
			logger.log(Indent, '  ', color.bold('Learn more'))
			logger.log(Indent, '   - Documentation:', HighlightBlue('https://robojs.dev/discord-bots'))
			logger.log(Indent, '   - Context commands:', HighlightBlue('https://robojs.dev/discord-bots/context-menu'))
			logger.log(Indent, '   - Slash commands:', HighlightBlue('https://robojs.dev/discord-bots/commands'))
			logger.log(Indent, '   - ✨🎃 Hacktoberfest:', HighlightMagenta('https://robojs.dev/hacktoberfest'))
		}

		logger.log('')
	})
	.parse()

async function checkUpdates() {
	// Check NPM registry for updates
	logger.debug(`Checking for updates...`)
	const response = await fetch(`https://registry.npmjs.org/${packageJson.name}/latest`)
	const latestVersion = (await response.json()).version
	logger.debug(`Latest version on NPM Registry: ${latestVersion}`)

	// Compare versions
	if (packageJson.version !== latestVersion) {
		// Prepare commands
		const packageManager = getPackageManager()
		let commandName = 'npx'
		if (packageManager === 'yarn') {
			commandName = 'yarn dlx'
		} else if (packageManager === 'pnpm') {
			commandName = 'pnpx'
		} else if (packageManager === 'bun') {
			commandName = 'bunx'
		}
		const command = `${commandName} ${packageJson.name}@latest`
		const args = process.argv.slice(2).join(' ')

		// Print update message
		logger.log('')
		logger.log(
			Indent,
			HighlightGreen(`💡 Update available!`),
			color.dim(`(v${packageJson.version} → v${latestVersion})`)
		)
		logger.log(Indent, `   Run this instead to get the latest updates:`)
		logger.log(Indent, '   ' + Highlight(command + ' ' + args))
	}
}
