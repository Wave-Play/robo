import { exec } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { color, Env, logger } from 'robo.js'

const execAsync = promisify(exec)

// Prepare the environment (good for testing)
Env.loadSync()
const env = new Env({
	b2: {
		bucket: {
			default: 'robo-templates',
			env: 'B2_BUCKET'
		}
	},
	forceTemplates: {
		default: 'false',
		env: 'FORCE_TEMPLATES'
	},
	github: {
		pushObject: {
			env: 'GH_PUSH'
		},
		repo: {
			default: 'Wave-Play/robo.js',
			env: 'REPO_DATA'
		},
		token: {
			env: 'GH_TOKEN'
		}
	},
	robo: {
		logLevel: {
			default: 'info',
			env: 'ROBO_LOG_LEVEL'
		}
	}
})

const Exclude = `'.robo/**' 'node_modules/**' '.DS_Store' '.env'`
const Repo = {
	Owner: env.get('github.repo').split('/')[0],
	Name: env.get('github.repo').split('/')[1]
}
const RootDir = path.join(process.cwd(), '..')

start()
	.then((result) => {
		const { failed, success, time } = result

		if (success.length > 0) {
			logger.ready(success.length, `template${success.length === 1 ? '' : 's'} zipped and uploaded to B2 in ${time}ms`)
		}
		if (failed.length > 0) {
			logger.error(`Failed to zip ${failed.length} templates:`, failed)
		}
		if (success.length === 0 && failed.length === 0) {
			logger.warn('No templates zipped')
		}
	})
	.catch((error) => {
		logger.error(error)
		process.exit(1)
	})

async function start() {
	logger({
		level: env.get('robo.logLevel')
	}).event('Zipping template projects...')
	const startTime = Date.now()
	const success: string[] = []
	const failed: string[] = []

	// Get the commits from the push object
	const { commits } = JSON.parse(env.get('github.pushObject')) as CommitData
	const templates = await getAllTemplates()
	logger.debug('Commits:', commits)
	logger.debug('Templates:', templates)
	logger.info('Checking', commits.length, 'commits...')

	await Promise.all(
		commits.map(async (commit) => {
			// Get the committed files and determine which templates to zip
			const id = commit.id
			const committedFiles = await getCommittedFiles(id)

			if (committedFiles.length < 1) {
				logger.warn(`No committed files found for commit ${id}. Skipping...`)
				return
			}

			// Filter the templates to zip
			const templatesToZip: Set<string> = new Set(
				env.get('forceTemplates') === 'true'
					? templates
					: committedFiles.flatMap((file) => templates.filter((template) => file.filename.includes(template)))
			)
			logger.debug(`Zipping ${templatesToZip.size} templates:`, templatesToZip)

			await Promise.all(
				[...templatesToZip].map(async (template) => {
					try {
						const templateChunks = template.split('/')
						const templateName = templateChunks.pop()
						const templatePath = path.join(RootDir, template)
						const outputDir = path.join(RootDir, 'temp', 'zip', templateChunks.join(path.sep))
						const outputZip = path.join(outputDir, `${templateName}.zip`)

						if (!existsSync(outputDir)) {
							await mkdir(outputDir, { recursive: true })
						}

						// we are using the zip package from ubuntu (easier to deal with)
						logger.info(`Zipping ${templatePath} into ${outputZip}`)
						const command = `zip -r ${outputZip} . -x ${Exclude}`
						logger.debug(color.bold(`> ${command}`))
						const { stderr, stdout } = await execAsync(command, { cwd: templatePath })

						if (stderr) {
							throw new Error(stderr)
						}

						logger.debug(stdout)
						success.push(template)
					} catch (error) {
						logger.error(error)
						failed.push(template)
					}
				})
			)
		})
	)

	// Upload the zipped templates to B2
	// We're using b2 because it is fast and the CLI is just too good
	if (success.length > 0) {
		logger.info(`Uploading to B2...`)
		const { stderr, stdout } = await execAsync(`b2 sync ../temp/zip/templates b2://${env.get('b2.bucket')}/`)
		logger.debug(stdout)

		if (stderr) {
			logger.error(stderr)
		} else {
			logger.info('Successfully uploaded to B2')
		}
	}

	return {
		failed: failed,
		success: success,
		time: Date.now() - startTime
	}
}

async function getAllTemplates() {
	const paths = ['discord-activities', 'discord-bots', 'plugins', 'web-apps']
	const templates: string[] = []

	for (const path of paths) {
		const url = `https://api.github.com/repos/${Repo.Owner}/${Repo.Name}/contents/templates/${path}`
		const response = await fetch(url, {
			headers: {
				Authorization: `token ${env.get('github.token')}`
			}
		})
		const data: Template[] = await response.json()
		logger.debug('Template path data:', data)
		templates.push(...data.filter((item) => item.type === 'dir').map((folder) => folder.path))
	}

	return templates
}

interface CommitData {
	commits: Array<{
		author: {
			email: string
			name: string
			username: string
		}
		committer: {
			email: string
			name: string
			username: string
		}
		distinct: boolean
		id: string
		message: string
		timestamp: string
		tree_id: string
		url: string
	}>
}

interface CommittedFile {
	additions: number
	blob_url: string
	changes: number
	contents_url: string
	deletions: number
	filename: string
	patch?: string
	raw_url: string
	sha: string
	status: string
}

interface Template {
	_links: {
		git: string
		html: string
		self: string
	}
	download_url: string | null
	git_url: string
	html_url: string
	name: string
	path: string
	sha: string
	size: number
	type: string
	url: string
}

async function getCommittedFiles(id: string) {
	const url = `https://api.github.com/repos/${Repo.Owner}/${Repo.Name}/commits/${id}`
	const response = await fetch(url, {
		headers: {
			Authorization: `token ${env.get('github.token')}`
		}
	})

	const json = await response.json()
	const files: CommittedFile[] = json.files
	logger.debug('Committed files:', files)

	return files.filter((file) => {
		return file.filename.startsWith('templates')
	})
}
