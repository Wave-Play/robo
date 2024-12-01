import fs, { readFile, rename } from 'node:fs/promises'
import path from 'path'
import { checkbox, input, select, Separator } from '@inquirer/prompts'
import { fileURLToPath } from 'node:url'
import { Highlight, HighlightBlue } from './core/constants.js'
import {
	PRETTIER_CONFIG,
	ROBO_CONFIG,
	exec,
	getPackageManager,
	hasProperties,
	prettyStringify,
	sortObjectKeys,
	getPackageExecutor,
	ROBO_CONFIG_APP,
	Indent,
	ExecOptions,
	Space,
	EslintConfig,
	EslintConfigTypescript
} from './utils.js'
import { RepoInfo, downloadAndExtractRepo, getRepoInfo, hasRepo } from './templates.js'
import retry from 'async-retry'
import { color, logger } from 'robo.js'
import { Spinner } from 'robo.js/dist/cli/utils/spinner.js'
import { existsSync } from 'node:fs'
import { Env } from './env.js'
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

const Recommended = color.dim('(recommended)')

const optionalFeatures = [
	{
		name: `${color.bold('TypeScript')} ${Recommended} - A superset of JavaScript that adds static types.`,
		short: 'TypeScript',
		value: 'typescript',
		checked: true
	},
	{
		name: `${color.bold('React')} ${Recommended} - The library for web and native user interfaces.`,
		short: 'React',
		value: 'react',
		checked: true
	},
	{
		name: `${color.bold('Prettier')} ${Recommended} - Automatically formats your code for readability.`,
		short: 'Prettier',
		value: 'prettier',
		checked: true
	},
	{
		name: `${color.bold('ESLint')} ${Recommended} - Keeps your code clean and consistent.`,
		short: 'ESLint',
		value: 'eslint',
		checked: false
	},
	{
		name: `${color.bold('Extensionless')} - Removes the need for file extensions in imports.`,
		short: 'Extensionless',
		value: 'extensionless',
		checked: false
	}
]

const appPlugins = [
	{
		name: `${color.bold(
			'AI'
		)} - Transform your Robo into a personalized AI chatbot! Supports Discord command execution.`,
		short: 'AI',
		value: 'ai'
	},
	{
		name: `${color.bold('Analytics')} - Track user interactions and server activity with ease.`,
		short: 'Analytics',
		value: 'analytics'
	},
	{
		name: `${color.bold('Sync')} - Real-time state sync across clients. Perfect for multiplayer games and chat apps!`,
		short: 'Sync',
		value: 'sync'
	},
	new Separator(color.dim('\nRequired for apps:')),
	{
		checked: true,
		name: color.dim(`${color.bold('Patches')} - A collection of patches optimized for Robo.js projects.`),
		short: 'Patches',
		value: 'patch'
	},
	{
		checked: true,
		name: color.dim(
			`${color.bold('Web Server')} - Turn your Robo into a web server! Create and manage web pages, APIs, and more.`
		),
		short: 'Web Server',
		value: 'server'
	}
]

const botPlugins = [
	{
		name: `${color.bold(
			'AI'
		)} - Transform your Robo into a personalized AI chatbot! Supports Discord command execution.`,
		short: 'AI',
		value: 'ai'
	},
	{
		name: `${color.bold('Analytics')} - Track user interactions and server activity with ease.`,
		short: 'Analytics',
		value: 'analytics'
	},
	/*{
		name: `${color.bold('Maintenance')} - Add a maintenance mode to your robo.`,
		short: 'Maintenance',
		value: 'maintenance'
	},*/
	{
		name: `${color.bold('Moderation')} - Equip your bot with essential tools to manage and maintain your server.`,
		short: 'Moderation',
		value: 'modtools'
	},
	{
		name: `${color.bold(
			'Web Server'
		)} - Turn your Robo into a web server! Create and manage web pages, APIs, and more.`,
		short: 'Web Server',
		value: 'server'
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
	analytics: {
		keywords: ['analytics', 'data', 'statistics', 'tracking'],
		package: '@robojs/analytics'
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
	},
	patch: {
		keywords: [],
		package: '@robojs/patch'
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
	private readonly _nodeOptions = ['--enable-source-maps']
	private readonly _spinner = new Spinner()

	// Custom properties used to build the Robo project
	private _installFailed: boolean
	private _isApp: boolean
	private _missingEnv: boolean
	private _name: string
	private _packageJson: PackageJson
	private _selectedFeatures: string[] = []
	private _selectedPlugins: string[] = []
	private _shouldInstall: boolean
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

	public get shouldInstall(): boolean {
		return this._shouldInstall
	}

	constructor(name: string, cliOptions: CommandOptions, useSameDirectory: boolean) {
		this._cliOptions = cliOptions
		this._isApp = cliOptions.kit === 'app' || cliOptions.kit === 'web'
		this._isPlugin = cliOptions.plugin
		this._name = name
		this._useTypeScript = cliOptions.typescript
		this._workingDir = useSameDirectory ? process.cwd() : path.join(process.cwd(), name)
	}

	async askIsPlugin() {
		const isPlugin = await select(
			{
				message: color.blue('This sounds like a plugin. Would you like to set it up as one?'),
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
		logger.log(Indent, color.bold(`🔌 Plugin Power-Ups`))

		// Skip if no plugins are selected
		if (selectedPlugins.length === 0) {
			logger.log(Indent, `   Traveling light, but the quest for plugins awaits!`)
			logger.log()
			logger.log(Indent, `   Find more:`, HighlightBlue('https://robojs.dev/plugins'))
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
		await fs.writeFile(
			path.join(this._workingDir, 'package.json'),
			JSON.stringify(this._packageJson, null, '\t'),
			'utf-8'
		)

		// Install the selected plugin packages
		const executor = getPackageExecutor()
		const execOptions: ExecOptions = {
			cwd: this._workingDir,
			stdio: this._cliOptions.verbose ? 'pipe' : 'ignore',
			verbose: this._cliOptions.verbose
		}

		try {
			logger.debug(`Installing plugins:`, packages)
			await exec(`${executor} robo add ${packages.join(' ')} -y`, execOptions)

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
			extra = `${pluginNames.map((f: string) => Highlight(f)).join(', ')}`

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
			logger.log(Indent, color.red(`   Could not install plugins!`))
		}

		logger.log()
		logger.log(Indent, `   Find more:`, HighlightBlue('https://robojs.dev/plugins'))
	}

	async downloadTemplate(url: string) {
		const { install, template, verbose } = this._cliOptions
		let repoUrl: URL | undefined
		let repoInfo: RepoInfo | undefined
		logger.debug(`Using template: ${url}`)

		// Adjust to be relative to main monorepo if not a URL
		let isOfficial = false

		if (!url.toLowerCase().startsWith('https://')) {
			isOfficial = true
			url = `https://github.com/Wave-Play/robo.js/tree/main/templates/${url}`
			logger.debug(`Adjusted template URL: ${url}`)
		}

		// Print new section
		logger.debug('\n')
		logger.log(Indent, color.bold('🌐 Creating from template'))
		this._spinner.setText(Indent + '    {{spinner}} Downloading template...\n')
		this._spinner.start()

		if (verbose) {
			this._spinner.stop(false)
		}

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
					`Invalid URL: ${color.red(
						`"${url}"`
					)}. Only GitHub repositories are supported. Please use a GitHub URL and try again.`
				)
				process.exit(1)
			}

			repoInfo = await getRepoInfo(repoUrl)
			logger.debug(`Found repo info:`, repoInfo)

			if (!repoInfo) {
				logger.error(`Found invalid GitHub URL: ${color.red(`"${url}"`)}. Please fix the URL and try again.`)
				process.exit(1)
			}

			const found = await hasRepo(repoInfo)

			if (!found) {
				logger.error(
					`Could not locate the repository for ${color.red(
						`"${url}"`
					)}. Please check that the repository exists and try again.`
				)
				process.exit(1)
			}
		}

		const result = await retry(() => downloadAndExtractRepo(this._workingDir, repoInfo), {
			retries: 3
		})
		const name = isOfficial ? template : result?.name
		this._spinner.stop(false)
		logger.log(Indent, `   Bootstraped project successfully from ${Highlight(name ?? 'repository')}.`)

		// If the template includes a `example.env` file, copy it to `.env`
		const exampleEnvPath = path.join(this._workingDir, 'example.env')
		const envPath = path.join(this._workingDir, '.env')

		try {
			if (existsSync(exampleEnvPath)) {
				await rename(exampleEnvPath, envPath)
				logger.debug(`Copied example.env to .env`)
			}
		} catch {
			logger.debug(`No example.env file found.`)
		}

		// Read the package.json file
		const packageJsonPath = path.join(this._workingDir, 'package.json')
		this._packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
		logger.debug(`Found package.json file:`, this._packageJson)

		// Determine if the project is typescript based on the package.json
		this._useTypeScript = this._packageJson.devDependencies?.typescript !== undefined

		// Determine app kit based on the package.json
		if (this._packageJson.dependencies['@discord/embedded-app-sdk'] !== undefined) {
			this._cliOptions.kit = 'app'
			this._isApp = true
			logger.debug(`Detected app kit from package.json.`)
		} else if (this._packageJson.dependencies['discord.js'] !== undefined) {
			this._cliOptions.kit = 'bot'
			this._isApp = false
			logger.debug(`Detected bot kit from package.json.`)
		}

		// Install dependencies
		if (install && isOfficial) {
			logger.debug('\n')
			logger.log()
			logger.log(
				Indent,
				color.bold(
					`📦 Preparing ${color.cyan(this._useTypeScript ? 'TypeScript' : 'JavaScript')} ${
						this._isPlugin ? 'plugin' : 'project'
					}`
				)
			)

			try {
				const packageManager = getPackageManager()
				logger.debug(`Using ${color.bold(packageManager)} in ${this._workingDir}...`)

				const command = packageManager + ' install'
				this._spinner.setText(Indent + '    {{spinner}} Installing dependencies...\n')
				this._spinner.start()

				if (verbose) {
					this._spinner.stop(false)
				}

				await exec(command, {
					cwd: this._workingDir,
					stdio: verbose ? 'pipe' : 'ignore',
					verbose: verbose
				})

				// Stahp it
				this._spinner.stop(false)
				logger.log(Indent, `   Successfully installed dependencies.`, Space)
			} catch {
				this._spinner.stop(false)
				this._installFailed = true
				logger.log(Indent, color.red(`   Could not install dependencies!`))
				logger.debug(`Updating package.json file...`)
			}
		} else {
			logger.debug(`Skipping dependency installation.`)
			this._shouldInstall = true
		}
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
		logger.debug(`Using ${color.bold(packageManager)} in ${this._workingDir}...`)
		await fs.mkdir(this._workingDir, { recursive: true })

		// Print new section
		logger.debug('\n')
		logger.log(
			Indent,
			color.bold(
				`📦 Creating ${color.cyan(this._useTypeScript ? 'TypeScript' : 'JavaScript')} ${
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
		} else if (kit === 'web') {
			this._packageJson.keywords.push('web', 'server', 'http', 'vite')
		} else {
			this._packageJson.keywords.push('bot', 'discord', 'discord.js')
		}

		// I heard you like tunnels
		if (this._isApp) {
			this._packageJson.scripts['dev'] += ' --tunnel'
			this._packageJson.scripts['tunnel'] = '.robo/bin/cloudflared tunnel --url http://localhost:3000'
		}

		// Prepare config directory
		await fs.mkdir(path.join(this._workingDir, 'config', 'plugins'), { recursive: true })

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
			await fs.writeFile(path.join(this._workingDir, 'README.md'), customReadme, 'utf-8')

			const development = await fs.readFile(path.join(__dirname, '../docs/plugin-development.md'), 'utf-8')
			const customDevelopment = development.replaceAll('{{projectName}}', this._name)
			await fs.writeFile(path.join(this._workingDir, 'DEVELOPMENT.md'), customDevelopment, 'utf-8')
		} else {
			logger.debug(`Generating Robo documentation...`)
			const fileName = this._isApp ? 'robo-readme-app.md' : 'robo-readme.md'
			const readme = await fs.readFile(path.join(__dirname, '../docs/' + fileName), 'utf-8')
			const customReadme = readme.replaceAll('{{projectName}}', this._name)
			await fs.writeFile(path.join(this._workingDir, 'README.md'), customReadme, 'utf-8')
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

		const ext = this._useTypeScript ? 'ts' : 'mjs'

		if (features.includes('eslint')) {
			devDependencies.push('eslint@9')
			devDependencies.push('@eslint/js')
			devDependencies.push('globals')
			this._packageJson.scripts['lint'] = runPrefix + 'lint:eslint'
			this._packageJson.scripts['lint:eslint'] = `eslint -c config/eslint.${ext} .`
			let eslintConfig = EslintConfig

			if (this._useTypeScript) {
				eslintConfig = EslintConfigTypescript
				devDependencies.push('typescript-eslint')
			}
			await fs.writeFile(path.join(this._workingDir, 'config', `eslint.${ext}`), eslintConfig, 'utf-8')
		}

		if (features.includes('prettier')) {
			devDependencies.push('prettier')
			this._packageJson.scripts['lint:style'] = 'prettier --write .'

			const hasLintScript = this._packageJson.scripts['lint']
			if (hasLintScript) {
				this._packageJson.scripts['lint'] += ' && ' + runPrefix + 'lint:style'
			}

			// Create the .prettierrc.mjs file
			await fs.writeFile(path.join(this._workingDir, '.prettierrc.mjs'), PRETTIER_CONFIG, 'utf-8')
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

		if (this._useTypeScript) {
			const configContent = roboConfig.split('export default {')[1]
			roboConfig = `import type { Config } from 'robo.js'\n\nexport default <Config>{` + configContent
		}

		logger.debug(`Writing Robo config file...`)
		await fs.writeFile(path.join(this._workingDir, 'config', `robo.${ext}`), roboConfig, 'utf-8')
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
				extra = ` with ${pureFeatures.map((f) => Highlight(f)).join(', ')}`
			}
			logger.log(Indent, `   Project created successfully${extra}.`)
		}

		// Write the package.json file
		logger.debug(`Writing package.json file...`)
		await fs.writeFile(
			path.join(this._workingDir, 'package.json'),
			JSON.stringify(this._packageJson, null, '\t'),
			'utf-8'
		)

		// Install dependencies using the package manager that triggered the command
		if (install) {
			if (verbose) {
				this._spinner.stop()
			}

			try {
				let baseCommand = packageManager + ' ' + (packageManager === 'npm' ? 'install' : 'add')
				this._spinner.setText(Indent + '    {{spinner}} Installing dependencies...\n')
				const execOptions: ExecOptions = {
					cwd: this._workingDir,
					stdio: verbose ? 'pipe' : 'ignore',
					verbose: verbose
				}

				await exec(baseCommand + ' ' + dependencies.join(' '), execOptions)
				this._spinner.setText(Indent + '    {{spinner}} Installing dev dependencies...\n')
				baseCommand += ['bun', 'yarn'].includes(packageManager) ? ' --dev' : ' --save-dev'
				if (features.includes('eslint') && this._useTypeScript) {
					// TODO: Remove once merged: https://github.com/typescript-eslint/typescript-eslint/pull/9119
					await fs.writeFile(path.join(this._workingDir, '.npmrc'), 'legacy-peer-deps=true\n', 'utf-8')
				}
				await exec(baseCommand + ' ' + devDependencies.join(' '), execOptions)

				// Read updated package.json file
				const packageJsonPath = path.join(this._workingDir, 'package.json')
				this._packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))

				// Stahp it
				this._spinner.stop(false)
				let extra = ''
				if (pureFeatures.length > 0) {
					extra = ` with ${pureFeatures.map((f) => Highlight(f)).join(', ')}`
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
				logger.log(Indent, color.red(`   Could not install dependencies!`))

				writeDependencies()
				logger.debug(`Updating package.json file...`)
				await fs.writeFile(
					path.join(this._workingDir, 'package.json'),
					JSON.stringify(this._packageJson, null, '\t'),
					'utf-8'
				)
			}
		}

		// Install and register the necessary plugins
		if (plugins.length > 0) {
			const executor = getPackageExecutor()

			try {
				await exec(`${executor} robo add ${plugins.join(' ')}`, { cwd: this._workingDir })
			} catch (error) {
				logger.error(`Failed to install plugins:`, error)
				logger.warn(`Please add the plugins manually using ${color.bold(executor + ' robo add')}`)
			}
		}
	}

	private getTemplate(): string {
		if (this._cliOptions.kit === 'web') {
			return this._useTypeScript ? '../templates/webapp-ts-react' : '../templates/webapp-js-react'
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
				logger.debug(`Creating directory`, color.bold(itemTargetPath))
				await fs.mkdir(itemTargetPath, { recursive: true })
				await this.copyTemplateFiles(path.join(sourceDir, item))
			} else {
				logger.debug(`Copying`, color.bold(item), `to`, color.bold(itemTargetPath))
				await fs.copyFile(itemSourcePath, itemTargetPath, fs.constants.COPYFILE_FICLONE)
			}
		}
	}

	async askForDiscordCredentials(): Promise<void> {
		const discordPortal = 'Portal:'
		const discordPortalUrl = HighlightBlue('https://discord.com/developers/applications')
		const officialGuide = 'Docs:'
		const officialGuideUrl = HighlightBlue(
			`https://robojs.dev/${this._isApp ? 'discord-activities' : 'discord-bots'}/credentials`
		)

		let discordClientId = ''
		let discordToken = ''
		logger.log('')
		logger.log(Indent, color.bold('🔑 Setting up credentials'))
		logger.log(Indent, '   Get your credentials from the Discord Developer portal.\n')
		logger.log(Indent, `   ${discordPortal} ${discordPortalUrl}`)
		logger.log(Indent, `   ${officialGuide} ${officialGuideUrl}\n`)

		if (this._cliOptions.creds) {
			discordClientId = await input({
				message: 'Enter your Discord Client ID (press Enter to skip):'
			})
			discordToken = await input({
				message: this._isApp
					? 'Enter your Discord Client Secret (press enter to skip)'
					: 'Enter your Discord Token (press Enter to skip):'
			})
		}

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

		// Construct the .env file, starting with defaults for all Robo projects
		const env = await new Env('.env', this._workingDir).load()
		env.set('NODE_OPTIONS', this._nodeOptions.join(' '), 'Enable source maps for easier debugging')

		// Discord-specific credentials
		env.set(
			'DISCORD_CLIENT_ID',
			discordClientId,
			'Find your credentials in the Discord Developer portal - https://discord.com/developers/applications'
		)

		if (this._isApp) {
			env.set('DISCORD_CLIENT_SECRET', discordToken)
			env.set('VITE_DISCORD_CLIENT_ID', discordClientId)
		} else {
			env.set('DISCORD_TOKEN', discordToken)
		}

		// Plugin-specific variables
		if (this._selectedPlugins.includes('ai')) {
			env.set('OPENAI_API_KEY', '', 'Get your OpenAI API key - https://platform.openai.com/api-keys')
		}
		if (this._selectedPlugins.includes('ai-voice')) {
			env.set('AZURE_SUBSCRIPTION_KEY', '')
			env.set('AZURE_SUBSCRIPTION_REGION', '')
		}
		if (this._selectedPlugins.includes('analytics')) {
			env.set('GOOGLE_ANALYTICS_MEASURE_ID', '', 'Analytics')
			env.set('GOOGLE_ANALYTICS_SECRET', '')
			env.set('PLAUSIBLE_DOMAIN', '')
		}
		if (this._selectedPlugins.includes('server')) {
			env.set('PORT', '3000', 'Change this port number if needed')
		}

		// Save the .env file
		await env.commit(this._useTypeScript)
		this._spinner.stop()
		logger.log(Indent, '   Manage your credentials in the', Highlight('.env'), 'file.')
	}

	/**
	 * Bun is special. Bun is love. Bun is life.
	 * Bun requires `bun --bun` as a prefix before every `robo` and `sage` command.
	 */
	public async bun(): Promise<void> {
		// Go over every script in the package.json and add `bun --bun ` before it
		const scripts = Object.entries(this._packageJson.scripts)
		logger.debug(`Adapting ${scripts.length} scripts for Bun...`)

		for (const [key, value] of scripts) {
			if (value.startsWith('robo') || value.startsWith('sage')) {
				this._packageJson.scripts[key] = `bun --bun ${value}`
			}
		}

		// Update package.json
		logger.debug(`Updating package.json file...`)
		await fs.writeFile(
			path.join(this._workingDir, 'package.json'),
			JSON.stringify(this._packageJson, null, '\t'),
			'utf-8'
		)
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
		const pluginPath =
			path.join(this._workingDir, 'config', 'plugins', ...pluginParts) + this._useTypeScript ? '.ts' : '.mjs'
		const pluginConfig = prettyStringify(config) + '\n'

		logger.debug(`Writing ${pluginName} config to ${pluginPath}...`)
		await fs.writeFile(pluginPath, `export default ${pluginConfig}`, 'utf-8')
	}
}
