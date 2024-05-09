import fs from 'fs/promises'
import path from 'path'
import { checkbox, input, select, Separator } from '@inquirer/prompts'
import chalk from 'chalk'
import { fileURLToPath } from 'node:url'
import {
	ESLINT_IGNORE,
	PRETTIER_CONFIG,
	ROBO_CONFIG,
	cmd,
	exec,
	getPackageManager,
	hasProperties,
	prettyStringify,
	sortObjectKeys,
	updateOrAddVariable,
	getPackageExecutor,
	ROBO_CONFIG_APP,
	Indent,
	ExecOptions,
	Space,
	COLYSEUS_CONFIG
} from './utils.js'
import { RepoInfo, downloadAndExtractRepo, getRepoInfo, hasRepo } from './templates.js'
import retry from 'async-retry'
import { logger } from 'robo.js'
// @ts-expect-error - Internal
import { Spinner } from 'robo.js/dist/cli/utils/spinner.js'
import type { CommandOptions } from './index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const roboScripts = {
	build: 'robo build',
	deploy: 'robo deploy',
	dev: `robox dev`,
	doctor: 'sage doctor',
	invite: 'robo invite',
	start: 'robo start',
	upgrade: 'sage upgrade'
}

const pluginScripts = {
	build: 'robo build plugin',
	dev: `robo build plugin --watch`,
	prepublishOnly: 'robo build plugin'
}

const Recommended = chalk.dim('(recommended)')

const optionalFeatures = [
	{
		name: `${chalk.bold('TypeScript')} ${Recommended} - A superset of JavaScript that adds static types.`,
		short: 'TypeScript',
		value: 'typescript',
		checked: true
	},
	{
		name: `${chalk.bold('React')} ${Recommended} - The library for web and native user interfaces.`,
		short: 'React',
		value: 'react',
		checked: true
	},
	{
		name: `${chalk.bold('Prettier')} ${Recommended} - Automatically formats your code for readability.`,
		short: 'Prettier',
		value: 'prettier',
		checked: true
	},
	{
		name: `${chalk.bold('Colyseus')} - Multiplayer Framework for Node.js.`,
		short: 'Colyseus',
		value: 'colyseus',
		checked: false
	},
	{
		name: `${chalk.bold('ESLint')} ${Recommended} - Keeps your code clean and consistent.`,
		short: 'ESLint',
		value: 'eslint',
		checked: false
	},
	{
		name: `${chalk.bold('Extensionless')} - Removes the need for file extensions in imports.`,
		short: 'Extensionless',
		value: 'extensionless',
		checked: false
	}
]

const appPlugins = [
	{
		name: `${chalk.bold(
			'AI'
		)} - Transform your Robo into a personalized AI chatbot! Supports Discord command execution.`,
		short: 'AI',
		value: 'ai'
	},
	{
		name: `${chalk.bold('Sync')} - Real-time state sync across clients. Perfect for multiplayer games and chat apps!`,
		short: 'Sync',
		value: 'sync'
	},
	new Separator('\nRequired for apps:'),
	{
		checked: true,
		name: `${chalk.bold(
			'Web Server'
		)} - Turn your Robo into a web server! Create and manage web pages, APIs, and more.`,
		short: 'Web Server',
		value: 'server'
	}
]

const botPlugins = [
	{
		name: `${chalk.bold(
			'AI'
		)} - Transform your Robo into a personalized AI chatbot! Supports Discord command execution.`,
		short: 'AI',
		value: 'ai'
	},
	{
		name: `${chalk.bold('AI Voice')} - Give your Robo a voice! Command and converse with it in voice channels.`,
		short: 'AI Voice',
		value: 'ai-voice'
	},
	{
		name: `${chalk.bold(
			'Web Server'
		)} - Turn your Robo into a web server! Create and manage web pages, APIs, and more.`,
		short: 'Web Server',
		value: 'server'
	},
	{
		name: `${chalk.bold('Maintenance')} - Add a maintenance mode to your robo.`,
		short: 'Maintenance',
		value: 'maintenance'
	},
	{
		name: `${chalk.bold('Moderation')} - Equip your bot with essential tools to manage and maintain your server.`,
		short: 'Moderation',
		value: 'modtools'
	}
]

interface Choice {
	value: string
	short: string
}

interface PluginData {
	config?: Record<string, unknown>
	keywords: string[]
	package: string
}

const PluginDb: Record<string, PluginData> = {
	ai: {
		config: {
			commands: false,
			openaiKey: 'process.env.OPENAI_API_KEY',
			systemMessage: `You are a helpful Robo named {{name}}.`,
			whitelist: {
				channelIds: []
			}
		},
		keywords: ['ai', 'gpt', 'openai'],
		package: '@robojs/ai'
	},
	'ai-voice': {
		keywords: ['speech', 'voice'],
		package: '@robojs/ai-voice'
	},
	server: {
		config: {
			cors: true
		},
		keywords: ['api', 'http', 'server', 'vite', 'web'],
		package: '@robojs/server'
	},
	sync: {
		keywords: ['multiplayer', 'real-time', 'sync', 'websocket'],
		package: '@robojs/sync'
	},
	maintenance: {
		keywords: ['maintenance'],
		package: '@robojs/maintenance'
	},
	modtools: {
		keywords: ['moderation', 'moderator'],
		package: '@robojs/moderation'
	}
}

interface PackageJson {
	name: string
	description: string
	keywords: string[]
	version: string
	private: boolean
	engines?: {
		node: string
	}
	type: 'module' | 'commonjs'
	main?: string
	license?: string
	author?: string
	contributors?: string[]
	files?: string[]
	repository?: {
		directory: string
		type: string
		url: string
	}
	publishConfig?: {
		access: 'public' | 'restricted'
		registry: string
	}
	scripts: Record<string, string>
	dependencies: Record<string, string>
	devDependencies: Record<string, string>
	peerDependencies?: Record<string, string>
	peerDependenciesMeta?: Record<string, Record<string, unknown>>
}

// TODO: Refactor this mess into a Robo Builder-like circular structure
export default class Robo {
	private readonly _cliOptions: CommandOptions
	private readonly _isApp: boolean
	private readonly _nodeOptions = ['--enable-source-maps']
	private readonly _spinner = new Spinner()

	// Custom properties used to build the Robo project
	private _installFailed: boolean
	private _missingEnv: boolean
	private _name: string
	private _packageJson: PackageJson
	private _selectedFeatures: string[] = []
	private _selectedPlugins: string[] = []
	private _useTypeScript: boolean | undefined
	private _workingDir: string

	// Same as above, but exposed as getters
	private _isPlugin: boolean

	public get installFailed(): boolean {
		return this._installFailed
	}

	public get isPlugin(): boolean {
		return this._isPlugin
	}

	public get missingEnv(): boolean {
		return this._missingEnv
	}

	public get selectedPlugins(): string[] {
		return this._selectedPlugins
	}

	constructor(name: string, cliOptions: CommandOptions, useSameDirectory: boolean) {
		this._cliOptions = cliOptions
		this._isApp = cliOptions.kit === 'app'
		this._isPlugin = cliOptions.plugin
		this._name = name
		this._useTypeScript = cliOptions.typescript
		this._workingDir = useSameDirectory ? process.cwd() : path.join(process.cwd(), name)
	}

	async askIsPlugin() {
		const isPlugin = await select(
			{
				message: chalk.blue('This sounds like a plugin. Would you like to set it up as one?'),
				choices: [
					{ name: 'Yes', value: true },
					{ name: 'No', value: false }
				]
			},
			{
				clearPromptOnDone: true
			}
		)

		this._isPlugin = isPlugin
	}

	public async plugins() {
		logger.log('')
		const pluginChoices = this._isApp ? appPlugins : botPlugins
		const selectedPlugins = await checkbox(
			{
				message: 'Select optional plugins:',
				loop: false,
				choices: pluginChoices
			},
			{
				clearPromptOnDone: true
			}
		)
		this._selectedPlugins = selectedPlugins

		// Print new section
		logger.debug('\n')
		logger.log(Indent, chalk.bold(`🔌 Plugin Power-Ups`))

		// Skip if no plugins are selected
		if (selectedPlugins.length === 0) {
			logger.log(Indent, `   Traveling light, but the quest for plugins awaits!`)
			return
		}

		// You spin me right round, baby, right round
		this._spinner.setText(Indent + '    {{spinner}} Learning skills...\n')
		this._spinner.start()

		if (this._cliOptions.verbose) {
			this._spinner.stop(false)
		}

		// Get the package names for the selected plugins
		const plugins = this._selectedPlugins.map((p) => PluginDb[p])
		const packages = plugins.map((p) => p.package)

		// Add the keywords to the package.json
		const keywords = plugins.flatMap((p) => p.keywords)
		this._packageJson.keywords.push(...keywords)
		this._packageJson.keywords.sort()

		logger.debug(`Updating package.json file...`)
		await fs.writeFile(path.join(this._workingDir, 'package.json'), JSON.stringify(this._packageJson, null, '\t'))

		// Install the selected plugin packages
		const executor = getPackageExecutor()
		const execOptions: ExecOptions = {
			cwd: this._workingDir,
			stdio: this._cliOptions.verbose ? 'pipe' : 'ignore',
			verbose: this._cliOptions.verbose
		}

		try {
			logger.debug(`Installing plugins:`, packages)
			await exec(`${cmd(executor)} robo add ${packages.join(' ')}`, execOptions)

			// Update config files for each plugin with the provided configuration
			const pendingConfigs = plugins
				.filter((p) => p.config)
				.map(async (plugin) => {
					// Replace all {{name}} placeholders with the project name for each config value
					const refinedConfig = JSON.parse(JSON.stringify(plugin.config).replaceAll('{{name}}', this._name))
					await this.createPluginConfig(plugin.package, refinedConfig)
				})
			await Promise.all(pendingConfigs)

			const cleanPlugins = pluginChoices.filter((p) => !(p instanceof Separator)) as Choice[]
			const pluginNames = this._selectedPlugins.map(
				(p) => cleanPlugins.find((plugin) => plugin.value === p)?.short ?? p
			)

			let extra = ''
			extra = `${pluginNames.map((f: string) => chalk.bold.cyan(f)).join(', ')}`

			// Oxford comma 'cause we fancy uwu
			if (selectedPlugins.length > 1) {
				const lastComma = extra.lastIndexOf(',')
				extra = extra.slice(0, lastComma) + ' and' + extra.slice(lastComma + 1)
			}
			if (selectedPlugins.length > 2) {
				extra = extra.replace(' and', ', and')
			}

			// Stahp
			this._spinner.stop(false)
			logger.log(Indent, `   Skill${selectedPlugins.length > 1 ? 's' : ''} acquired: ${extra}.`, Space)
		} catch (error) {
			this._spinner.stop(false)
			logger.log(Indent, chalk.red(`   Could not install plugins!`))
		}

		// If Colyseus is selected, override the /config/plugins/robojs/server.mjs file
		if (this._selectedFeatures.includes('colyseus')) {
			logger.debug(`Overriding Colyseus server config file...`)
			await fs.writeFile(path.join(this._workingDir, 'config', 'plugins', 'robojs', 'server.mjs'), COLYSEUS_CONFIG)
		}
	}

	async downloadTemplate(url: string) {
		logger.debug(`Using template: ${url}`)
		let repoUrl: URL | undefined
		let repoInfo: RepoInfo | undefined
		logger.debug('\n')
		logger.log('\x1B[1A\x1B[K\x1B[1A\x1B[K')
		logger.log(Indent, chalk.bold('🌐 Creating from template'))
		this._spinner.setText(Indent + '    {{spinner}} Downloading template...\n')

		try {
			repoUrl = new URL(url)
		} catch (error) {
			if (hasProperties(error, ['code']) && error.code !== 'ERR_INVALID_URL') {
				logger.error(error)
				process.exit(1)
			}
		}

		if (repoUrl) {
			logger.debug(`Validating template URL:`, repoUrl)
			if (repoUrl.origin !== 'https://github.com') {
				logger.error(
					`Invalid URL: ${chalk.red(
						`"${url}"`
					)}. Only GitHub repositories are supported. Please use a GitHub URL and try again.`
				)
				process.exit(1)
			}

			repoInfo = await getRepoInfo(repoUrl)
			logger.debug(`Found repo info:`, repoInfo)

			if (!repoInfo) {
				logger.error(`Found invalid GitHub URL: ${chalk.red(`"${url}"`)}. Please fix the URL and try again.`)
				process.exit(1)
			}

			const found = await hasRepo(repoInfo)

			if (!found) {
				logger.error(
					`Could not locate the repository for ${chalk.red(
						`"${url}"`
					)}. Please check that the repository exists and try again.`
				)
				process.exit(1)
			}
		}

		const result = await retry(() => downloadAndExtractRepo(this._workingDir, repoInfo), {
			retries: 3
		})
		this._spinner.stop(false)
		logger.log(Indent, `   Bootstraped project successfully from ${chalk.bold.cyan(result?.name ?? 'repository')}.`)
	}

	async getUserInput(): Promise<string[]> {
		// Exclude TypeScript from the optional features if the user has already selected it
		const features =
			this._useTypeScript !== undefined ? optionalFeatures.filter((f) => f.value !== 'typescript') : optionalFeatures

		// Only App developers get the option to use React
		if (!this._isApp) {
			const index = features.findIndex((f) => f.value === 'react')

			if (index >= 0) {
				features.splice(index, 1)
			}
		}

		// Colyseus is only available for activities
		if (!this._isApp) {
			const index = features.findIndex((f) => f.value === 'colyseus')

			if (index >= 0) {
				features.splice(index, 1)
			}
		}

		// Sorry, plugin developers don't get Extensionless as an option
		if (this._isPlugin) {
			const index = features.findIndex((f) => f.value === 'extensionless')

			if (index >= 0) {
				features.splice(index, 1)
			}
		}

		// Prompto! (I'm sorry)
		const selectedFeatures = await checkbox(
			{
				message: 'Select features:',
				loop: false,
				choices: features
			},
			{
				clearPromptOnDone: true
			}
		)
		this._selectedFeatures = selectedFeatures

		// Determine if TypeScript is selected only if it wasn't previously set
		if (this._useTypeScript === undefined) {
			this._useTypeScript = selectedFeatures.includes('typescript')
		}

		return selectedFeatures
	}

	async createPackage(features: string[], plugins: string[]): Promise<void> {
		const { install = true, kit, roboVersion, verbose } = this._cliOptions

		// Find the package manager that triggered this command
		const packageManager = getPackageManager()
		logger.debug(`Using ${chalk.bold(packageManager)} in ${this._workingDir}...`)
		await fs.mkdir(this._workingDir, { recursive: true })

		// Print new section
		logger.debug('\n')
		logger.log(
			Indent,
			chalk.bold(
				`📦 Creating ${chalk.cyan(this._useTypeScript ? 'TypeScript' : 'JavaScript')} ${
					this._isPlugin ? 'plugin' : 'project'
				}`
			)
		)
		this._spinner.setText(Indent + '    {{spinner}} Generating files...\n')
		this._spinner.start()

		// Create a package.json file based on the selected features
		const npmRegistry = {
			access: 'public',
			registry: 'https://registry.npmjs.org/'
		} as const
		const dependencies: string[] = []
		const devDependencies: string[] = []
		this._packageJson = {
			name: this._name,
			description: '',
			version: '1.0.0',
			type: 'module',
			private: !this._isPlugin,
			keywords: ['robo', 'robo.js'],
			main: this._isPlugin ? '.robo/build/index.js' : undefined,
			license: this._isPlugin ? 'MIT' : undefined,
			author: this._isPlugin ? `Your Name <email>` : undefined,
			contributors: this._isPlugin ? [`Your Name <email>`] : undefined,
			files: this._isPlugin ? ['.robo/', 'src/', 'LICENSE', 'README.md'] : undefined,
			publishConfig: this._isPlugin ? npmRegistry : undefined,
			scripts: this._isPlugin ? pluginScripts : roboScripts,
			dependencies: {},
			devDependencies: {}
		}

		// Good SEO is important :3
		if (kit === 'app') {
			this._packageJson.keywords.push('activity', 'discord', 'sdk', 'embed', 'embedded app')
		} else {
			this._packageJson.keywords.push('bot', 'discord', 'discord.js')
		}

		// I heard you like tunnels
		if (this._isApp) {
			this._packageJson.scripts['dev'] += ' --tunnel'
		}

		// Robo.js and Discord.js are normal dependencies, unless this is a plugin
		const roboPkg = 'robo.js'
		const roboDep = roboPkg + (roboVersion ? `@${roboVersion}` : '')

		if (!this._isPlugin) {
			dependencies.push(roboDep)
			dependencies.push(this._isApp ? '@discord/embedded-app-sdk' : 'discord.js')
			if (this._isApp) {
				devDependencies.push('discord.js')
			}
		} else {
			devDependencies.push(roboDep)
			devDependencies.push('discord.js')
			if (this._isApp) {
				devDependencies.push('@discord/embedded-app-sdk')
			}
			this._packageJson.peerDependencies = {
				[roboPkg]: '^0.10.1'
			}
			this._packageJson.peerDependenciesMeta = {
				[roboPkg]: {
					optional: false
				}
			}

			// Clean up undefined fields from packageJson
			Object.keys(this._packageJson).forEach((key) => {
				if (this._packageJson[key as keyof PackageJson] === undefined) {
					delete this._packageJson[key as keyof PackageJson]
				}
			})
		}

		// App developers always get Vite
		logger.debug(`Adding features:`, features)
		if (this._isApp) {
			devDependencies.push('vite')
		}
		if (this._selectedFeatures.includes('react') && this._isPlugin) {
			devDependencies.push('react')
			devDependencies.push('react-dom')
			devDependencies.push('@vitejs/plugin-react-swc')
			devDependencies.push('eslint-plugin-react-hooks')
		} else if (this._selectedFeatures.includes('react')) {
			dependencies.push('react')
			dependencies.push('react-dom')
			devDependencies.push('@vitejs/plugin-react-swc')
			devDependencies.push('eslint-plugin-react-hooks')
		}

		// Colyseus requires more dependencies
		if (features.includes('colyseus')) {
			dependencies.push('@colyseus/core')
			dependencies.push('@colyseus/monitor')
			dependencies.push('@colyseus/schema')
			dependencies.push('@colyseus/ws-transport')
			dependencies.push('@robojs/server')
			dependencies.push('colyseus.js')
			dependencies.push('express')
			devDependencies.push('@types/express')
		}

		// Generate customized documentation
		if (this._isPlugin) {
			logger.debug(`Generating plugin documentation...`)
			let pluginName = this._name
				.replace(/[^a-zA-Z0-9]/g, ' ')
				.split(' ')
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join('')
			pluginName = pluginName.charAt(0).toLowerCase() + pluginName.slice(1)
			if (!pluginName.toLowerCase().includes('plugin')) {
				pluginName += 'Plugin'
			}

			const readme = await fs.readFile(path.join(__dirname, '../docs/plugin-readme.md'), 'utf-8')
			const customReadme = readme
				.replaceAll('{{projectName}}', this._name)
				.replaceAll('{{pluginVariableName}}', pluginName)
			await fs.writeFile(path.join(this._workingDir, 'README.md'), customReadme)

			const development = await fs.readFile(path.join(__dirname, '../docs/plugin-development.md'), 'utf-8')
			const customDevelopment = development.replaceAll('{{projectName}}', this._name)
			await fs.writeFile(path.join(this._workingDir, 'DEVELOPMENT.md'), customDevelopment)
		} else {
			logger.debug(`Generating Robo documentation...`)
			const fileName = this._isApp ? 'robo-readme-app.md' : 'robo-readme.md'
			const readme = await fs.readFile(path.join(__dirname, '../docs/' + fileName), 'utf-8')
			const customReadme = readme.replaceAll('{{projectName}}', this._name)
			await fs.writeFile(path.join(this._workingDir, 'README.md'), customReadme)
		}

		const runPrefix = packageManager === 'npm' ? 'npm run ' : packageManager + ' '
		if (this._useTypeScript) {
			this._packageJson.keywords.push('typescript')
			devDependencies.push('@swc/core')
			devDependencies.push('@types/node')
			devDependencies.push('typescript')
		} else {
			this._packageJson.keywords.push('javascript')
		}

		if (this._useTypeScript && this._selectedFeatures.includes('react')) {
			devDependencies.push('@types/react')
			devDependencies.push('@types/react-dom')
		}

		if (this._selectedFeatures.includes('eslint') && this._selectedFeatures.includes('react')) {
			devDependencies.push('eslint-plugin-react-hooks')
			devDependencies.push('eslint-plugin-react-refresh')
		}

		if (features.includes('eslint')) {
			devDependencies.push('eslint')
			this._packageJson.scripts['lint'] = runPrefix + 'lint:eslint'
			this._packageJson.scripts['lint:eslint'] = 'eslint . --ext js,jsx,ts,tsx'

			const eslintConfig = {
				extends: ['eslint:recommended'],
				env: {
					node: true
				},
				parser: undefined as string | undefined,
				plugins: [] as string[],
				root: true,
				rules: {}
			}
			if (this._useTypeScript) {
				eslintConfig.extends.push('plugin:@typescript-eslint/recommended')
				eslintConfig.parser = '@typescript-eslint/parser'
				eslintConfig.plugins.push('@typescript-eslint')

				devDependencies.push('@typescript-eslint/eslint-plugin')
				devDependencies.push('@typescript-eslint/parser')
			}
			await fs.writeFile(path.join(this._workingDir, '.eslintignore'), ESLINT_IGNORE)
			await fs.writeFile(path.join(this._workingDir, '.eslintrc.json'), JSON.stringify(eslintConfig, null, 2))
		}

		if (features.includes('prettier')) {
			devDependencies.push('prettier')
			this._packageJson.scripts['lint:style'] = 'prettier --write .'

			const hasLintScript = this._packageJson.scripts['lint']
			if (hasLintScript) {
				this._packageJson.scripts['lint'] += ' && ' + runPrefix + 'lint:style'
			}

			// Create the .prettierrc.mjs file
			await fs.writeFile(path.join(this._workingDir, '.prettierrc.mjs'), PRETTIER_CONFIG)
		}

		if (features.includes('extensionless')) {
			dependencies.push('extensionless')
			this._nodeOptions.push('--import=extensionless/register')

			// Replace every "robo" command with "robox"
			for (const [key, value] of Object.entries(this._packageJson.scripts)) {
				this._packageJson.scripts[key] = value.replace('robo ', 'robox ')
			}
		}

		// Create the robo.mjs file
		let roboConfig = this._isApp ? ROBO_CONFIG_APP : ROBO_CONFIG

		if (this._isPlugin) {
			roboConfig = roboConfig.replace(`type: 'robo'`, `type: 'plugin'`)
		}

		logger.debug(`Writing Robo config file...`)
		await fs.mkdir(path.join(this._workingDir, 'config', 'plugins'), { recursive: true })
		await fs.writeFile(path.join(this._workingDir, 'config', 'robo.mjs'), roboConfig)
		logger.debug(`Finished writing Robo config file:\n`, roboConfig)

		// Sort keywords, scripts, dependencies, and devDependencies alphabetically (this is important to me)
		this._packageJson.keywords.sort()
		this._packageJson.scripts = sortObjectKeys(this._packageJson.scripts)
		dependencies.sort()
		devDependencies.sort()

		const writeDependencies = () => {
			dependencies.forEach((dep) => {
				const versionIndex = dep.lastIndexOf('@')

				if (versionIndex > 0) {
					this._packageJson.dependencies[dep.slice(0, versionIndex)] = dep.slice(versionIndex + 1)
				} else {
					this._packageJson.dependencies[dep] = 'latest'
				}
			})
			devDependencies.forEach((dep) => {
				const versionIndex = dep.lastIndexOf('@')

				if (versionIndex > 0) {
					this._packageJson.devDependencies[dep.slice(0, versionIndex)] = dep.slice(versionIndex + 1)
				} else {
					this._packageJson.devDependencies[dep] = 'latest'
				}
			})
		}

		const pureFeatures = features
			.filter((f) => f !== 'typescript')
			.map((f) => {
				return optionalFeatures.find((feature) => feature.value === f)?.short ?? f
			})
		if (!install) {
			writeDependencies()
			this._spinner.stop(false)
			let extra = ''
			if (pureFeatures.length > 0) {
				extra = ` with ${pureFeatures.map((f) => chalk.bold.cyan(f)).join(', ')}`
			}
			logger.log(Indent, `   Project created successfully${extra}.`)
		}

		// Write the package.json file
		logger.debug(`Writing package.json file...`)
		await fs.writeFile(path.join(this._workingDir, 'package.json'), JSON.stringify(this._packageJson, null, '\t'))

		// Install dependencies using the package manager that triggered the command
		if (install) {
			if (verbose) {
				this._spinner.stop()
			}

			try {
				let baseCommand = cmd(packageManager) + ' ' + (packageManager === 'npm' ? 'install' : 'add')
				this._spinner.setText(Indent + '    {{spinner}} Installing dependencies...\n')
				const execOptions: ExecOptions = {
					cwd: this._workingDir,
					stdio: verbose ? 'pipe' : 'ignore',
					verbose: verbose
				}

				await exec(baseCommand + ' ' + dependencies.join(' '), execOptions)
				this._spinner.setText(Indent + '    {{spinner}} Installing dev dependencies...\n')
				baseCommand += packageManager === 'yarn' ? ' --dev' : ' --save-dev'
				await exec(baseCommand + ' ' + devDependencies.join(' '), execOptions)

				// Read updated package.json file
				const packageJsonPath = path.join(this._workingDir, 'package.json')
				this._packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))

				// Stahp it
				this._spinner.stop(false)
				let extra = ''
				if (pureFeatures.length > 0) {
					extra = ` with ${pureFeatures.map((f) => chalk.bold.cyan(f)).join(', ')}`
				}

				// Oxford comma 'cause we fancy uwu
				if (pureFeatures.length > 1) {
					const lastComma = extra.lastIndexOf(',')
					extra = extra.slice(0, lastComma) + ' and' + extra.slice(lastComma + 1)
				}
				if (pureFeatures.length > 2) {
					extra = extra.replace(' and', ', and')
				}

				logger.log(Indent, `   Project created successfully${extra}.`, Space)
			} catch {
				this._spinner.stop(false)
				this._installFailed = true
				logger.log(Indent, chalk.red(`   Could not install dependencies!`))

				writeDependencies()
				logger.debug(`Updating package.json file...`)
				await fs.writeFile(path.join(this._workingDir, 'package.json'), JSON.stringify(this._packageJson, null, '\t'))
			}
		}

		// Install and register the necessary plugins
		if (plugins.length > 0) {
			const executor = getPackageExecutor()

			try {
				await exec(`${cmd(executor)} robo add ${plugins.join(' ')}`, { cwd: this._workingDir })
			} catch (error) {
				logger.error(`Failed to install plugins:`, error)
				logger.warn(`Please add the plugins manually using ${chalk.bold(executor + ' robo add')}`)
			}
		}
	}

	private getTemplate(): string {
		if (this._isApp && this._selectedFeatures.includes('react') && this._selectedFeatures.includes('colyseus')) {
			return this._useTypeScript ? '../templates/activity-ts-colyseus-react' : '../templates/activity-ts-colyseus-react'
		} else if (this._isApp && this._selectedFeatures.includes('react')) {
			return this._useTypeScript ? '../templates/app-ts-react' : '../templates/app-js-react'
		} else if (this._isApp) {
			return this._useTypeScript ? '../templates/app-ts' : '../templates/app-js'
		} else {
			return this._useTypeScript ? '../templates/bot-ts' : '../templates/bot-js'
		}
	}

	async copyTemplateFiles(sourceDir: string): Promise<void> {
		const templateDir = this.getTemplate()
		const sourcePath = path.join(__dirname, templateDir, sourceDir)
		const targetPath = path.join(this._workingDir, sourceDir)

		const items = await fs.readdir(sourcePath)

		for (const item of items) {
			const itemSourcePath = path.join(sourcePath, item)
			const itemTargetPath = path.join(targetPath, item)
			const stat = await fs.stat(itemSourcePath)

			if (stat.isDirectory()) {
				await fs.mkdir(itemTargetPath, { recursive: true })
				await this.copyTemplateFiles(path.join(sourceDir, item))
			} else {
				await fs.copyFile(itemSourcePath, itemTargetPath)
			}
		}
	}

	async askForDiscordCredentials(): Promise<void> {
		const discordPortal = 'Portal:'
		const discordPortalUrl = chalk.bold.blue('https://discord.com/developers/applications')
		const officialGuide = 'Guide:'
		const officialGuideUrl = chalk.bold.blue('https://roboplay.dev/' + (this._isApp ? 'appkey' : 'botkey'))
		logger.log('')
		logger.log(Indent, chalk.bold('🔑 Setting up credentials'))
		logger.log(Indent, '   Get your credentials from the Discord Developer portal.\n')
		logger.log(Indent, `   ${discordPortal} ${discordPortalUrl}`)
		logger.log(Indent, `   ${officialGuide} ${officialGuideUrl}\n`)

		const discordClientId = await input({
			message: 'Enter your Discord Client ID (press Enter to skip):'
		})
		const discordToken = await input({
			message: this._isApp
				? 'Enter your Discord Client Secret (press enter to skip)'
				: 'Enter your Discord Token (press Enter to skip):'
		})

		if (!discordClientId || !discordToken) {
			this._missingEnv = true
		}

		if (this._cliOptions.verbose) {
			logger.log('')
		} else {
			logger.log('\x1B[1A\x1B[K\x1B[1A\x1B[K')
		}
		this._spinner.setText(Indent + '    {{spinner}} Applying credentials...\n')
		this._spinner.start()

		const envFilePath = path.join(this._workingDir, '.env')
		let envContent = ''

		try {
			envContent = await fs.readFile(envFilePath, 'utf8')
		} catch (error) {
			if (hasProperties(error, ['code']) && error.code !== 'ENOENT') {
				throw error
			}
		}

		envContent = updateOrAddVariable(envContent, 'DISCORD_CLIENT_ID', discordClientId ?? '')
		if (this._isApp) {
			envContent = updateOrAddVariable(envContent, 'VITE_DISCORD_CLIENT_ID', discordClientId ?? '')
			envContent = updateOrAddVariable(envContent, 'DISCORD_CLIENT_SECRET', discordToken ?? '')
		} else {
			envContent = updateOrAddVariable(envContent, 'DISCORD_TOKEN', discordToken ?? '')
		}
		envContent = updateOrAddVariable(envContent, 'NODE_OPTIONS', this._nodeOptions.join(' '))

		if (this._selectedPlugins.includes('ai')) {
			envContent = updateOrAddVariable(envContent, 'OPENAI_API_KEY', '')
		}
		if (this._selectedPlugins.includes('ai-voice')) {
			envContent = updateOrAddVariable(envContent, 'AZURE_SUBSCRIPTION_KEY', '')
			envContent = updateOrAddVariable(envContent, 'AZURE_SUBSCRIPTION_REGION', '')
		}
		if (this._selectedPlugins.includes('server')) {
			envContent = updateOrAddVariable(envContent, 'PORT', '3000')
		}

		await fs.writeFile(envFilePath, envContent)
		await this.createEnvTsFile()
		this._spinner.stop()
		logger.log(Indent, '   Manage your credentials in the', chalk.bold.cyan('.env'), 'file.')
	}

	/**
	 * Generates a plugin config file in the config/plugins directory.
	 *
	 * @param pluginName The name of the plugin (e.g. @robojs/ai)
	 * @param config The plugin config
	 */
	private async createPluginConfig(pluginName: string, config: Record<string, unknown>) {
		const pluginParts = pluginName.replace(/^@/, '').split('/')

		// Create parent directory if this is a scoped plugin
		if (pluginName.startsWith('@')) {
			await fs.mkdir(path.join(this._workingDir, 'config', 'plugins', pluginParts[0]), {
				recursive: true
			})
		}

		// Normalize plugin path
		const pluginPath = path.join(this._workingDir, 'config', 'plugins', ...pluginParts) + '.mjs'
		const pluginConfig = prettyStringify(config) + '\n'

		logger.debug(`Writing ${pluginName} config to ${pluginPath}...`)
		await fs.writeFile(pluginPath, `export default ${pluginConfig}`)
	}

	/**
	 * Adds the "env.d.ts" entry to the compilerOptions in the tsconfig.json
	 *
	 */

	private async createEnvTsFile() {
		if (this._useTypeScript) {
			const autoCompletionEnvVar = `export {}\ndeclare global {\n    namespace NodeJS {\n		interface ProcessEnv {\n			DISCORD_CLIENT_ID: string\n			${
				this._isApp ? 'DISCORD_CLIENT_SECRET: string' : 'DISCORD_TOKEN: string'
			}\n		}\n	} \n}`

			const tsconfigPath = path.join(this._workingDir, 'tsconfig.json')

			const tsconfig = await fs
				.access(tsconfigPath)
				.then(() => true)
				.catch(() => false)

			if (tsconfig) {
				await fs.writeFile(path.join(this._workingDir, 'env.d.ts'), autoCompletionEnvVar)
				const parsedTSConfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf-8'))
				const compilerOptions = parsedTSConfig['compilerOptions']
				compilerOptions['typeRoots'] = ['./env.d.ts']

				await fs.writeFile(tsconfigPath, JSON.stringify(parsedTSConfig, null, '\t'))
			}
		}
	}
}
