import { Config } from '../types/index.js'
import { Mode } from './mode.js'
import { Compiler } from '../cli/utils/compiler.js'
import { Globals } from './globals.js'
import { logger } from './logger.js'
import fs, { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Global config reference
let _config: Config = null
const _configPaths: Set<string> = new Set()

/**
 * Returns the currently loaded configuration.
 * May return null if config has yet to load. Use {@link loadConfig} to load it first.
 */
export function getConfig(): Config | null {
	return Globals.getConfig() ?? _config
}

/**
 * Returns the paths to all loaded configuration files.
 */
export function getConfigPaths(): Set<string> {
	return _configPaths
}

export async function loadConfig(file = 'robo', compile = false): Promise<Config> {
	const configPath = await loadConfigPath(file)
	let config: Config

	if (configPath) {
		config = await readConfig<Config>(configPath, compile)
		_configPaths.add(configPath)

		// Load plugin files when using "/config" directory
		if (configPath.includes(path.sep + 'config' + path.sep)) {
			logger.debug('Scanning for plugin files...')
			config.plugins = config.plugins ?? []

			await scanPlugins(configPath, compile, (plugin, pluginConfig, pluginPath) => {
				// Remove existing plugin config if it exists
				const existingIndex = config.plugins?.findIndex((p) => p === plugin || p[0] === plugin)
				if (existingIndex !== -1) {
					config.plugins?.splice(existingIndex, 1)
				}

				config.plugins?.push([plugin, pluginConfig])
				_configPaths.add(pluginPath)
			})
		}
	} else {
		config = {
			clientOptions: {
				intents: []
			}
		}
	}

	_config = config
	Globals.registerConfig(config)
	logger.debug(`Loaded configuration file:`, config)
	return config
}

/**
 * Looks for the config file in the current project.
 * Will look for the following files in order:
 * - config/robo.ts
 * - config/robo.mjs
 * - config/robo.cjs
 * - config/robo.json
 * - .config/robo.ts
 * - .config/robo.mjs
 * - .config/robo.cjs
 * - .config/robo.json
 *
 * If a mode is set, it will prioritize the mode-specific config file.
 * - config/robo.{mode}.ts
 * - config/robo.{mode}.mjs
 * - config/robo.{mode}.cjs
 * - config/robo.{mode}.json
 *
 * @param file The name of the config file to look for. Defaults to "robo".
 * @returns The path to the config file, or null if it could not be found.
 */
export async function loadConfigPath(file = 'robo'): Promise<string> {
	const extensions = ['.ts', '.mjs', '.cjs', '.json']
	const prefixes = ['config', '.config']

	for (const prefix of prefixes) {
		const pathBase = path.join(process.cwd(), prefix)

		for (const ext of extensions) {
			let fullPath = path.join(pathBase, `${file}.${Mode.get()}${ext}`)

			try {
				if (fs.existsSync(fullPath)) {
					// Convert to file URL to allow for dynamic import()
					logger.debug(`Found configuration file at`, fullPath)
					return fullPath
				}
			} catch (ignored) {
				// empty
			}

			try {
				fullPath = path.join(pathBase, `${file}${ext}`)
				if (fs.existsSync(fullPath)) {
					// Convert to file URL to allow for dynamic import()
					logger.debug(`Found configuration file at`, fullPath)
					return fullPath
				}
			} catch (ignored) {
				// empty
			}
		}
	}

	// If no config file was found, return null
	return null
}

/**
 * Scans the /plugins config subdirectory for plugins.
 *
 * @param callback A callback function to be called for each plugin found. The plugin name will be passed as the first argument, including the scoped organization if applicable. Second parameter is the plugin config object.
 */
async function scanPlugins(
	configPath: string,
	compile: boolean,
	callback: (plugin: string, pluginConfig: unknown, pluginPath: string) => void
) {
	// Look for plugins in the same directory as the config file
	const pluginsPath = path.join(path.dirname(configPath), 'plugins')

	if (!fs.existsSync(pluginsPath)) {
		return
	}

	// For each file in the plugins directory, import it and add it to the config
	const plugins = fs.readdirSync(pluginsPath)
	const pluginData: Array<{ mode: string; name: string; path: string }> = []

	for (const plugin of plugins) {
		const pluginPath = path.join(pluginsPath, plugin)

		// Load subdirectories as scoped plugins
		if (fs.statSync(pluginPath).isDirectory()) {
			const scopedPlugins = fs.readdirSync(pluginPath)

			for (const scopedPlugin of scopedPlugins) {
				// Compute the file name, keeping the base path in mind for scoped config files
				const scopedPath = path.join(pluginPath, scopedPlugin)
				const resolvedPath = path.relative(pluginsPath, scopedPath)
				const parts = resolvedPath.split('.')
				const pluginName = '@' + parts[0]
				let mode = undefined
				if (parts.length > 2) {
					mode = parts[1]
				}

				pluginData.push({ mode, name: pluginName, path: scopedPath })
			}
		} else {
			// Compute the file name, keeping the base path in mind for scoped config files
			const resolvedPath = path.relative(pluginsPath, pluginPath)
			const parts = resolvedPath.split('.')
			const pluginName = parts[0]
			let mode = undefined
			if (parts.length > 2) {
				mode = parts[1]
			}

			pluginData.push({ mode, name: pluginName, path: pluginPath })
		}
	}

	// Load all plugins in parallel
	await Promise.all(
		pluginData.map(async (plugin) => {
			// Skip plugins without mode unless mode file is not found
			if (!plugin.mode) {
				const modeVariant = pluginData.find((p) => p.mode === Mode.get() && p.name === plugin.name)

				if (existsSync(modeVariant?.path)) {
					return
				}
			}

			// Skip if this plugin's mode is not the current mode
			if (plugin.mode && plugin.mode !== Mode.get()) {
				return
			}

			const pluginConfig = await readConfig(plugin.path, compile)
			callback(plugin.name, pluginConfig, plugin.path)
		})
	)
}

async function readConfig<T = unknown>(configPath: string, compile = false): Promise<T> {
	try {
		if (configPath.endsWith('.json')) {
			// If the file is a JSON file, handle it differently
			const rawData = fs.readFileSync(configPath, 'utf8')
			const pluginConfig = JSON.parse(rawData)
			return pluginConfig ?? {}
		} else if (configPath.endsWith('.ts')) {
			const configDir = path.dirname(configPath)

			if (compile) {
				// Compile into .robo/config
				logger.debug('Compiling TypeScript config...')
				await Compiler.buildCode({
					clean: false,
					copyOther: false,
					distDir: path.join('.robo', path.relative(process.cwd(), configDir)),
					distExt: '.mjs',
					files: [configPath.replace(process.cwd(), '')],
					parallel: 1,
					srcDir: configDir
				})
			} else {
				// Assume config file is already compiled
				logger.debug('Loading existing TypeScript config...')
			}
			configPath = path.join(
				process.cwd(),
				'.robo',
				configDir.replace(process.cwd(), ''),
				path.basename(configPath).replace(/\.ts$/, '.mjs')
			)

			const imported = await import(pathToFileURL(configPath).toString())
			const pluginConfig = imported.default ?? imported
			return pluginConfig ?? ({} as T)
		} else {
			// Convert to file URL to allow for a seamless dynamic import()
			const imported = await import(pathToFileURL(configPath).toString())
			const pluginConfig = imported.default ?? imported
			return pluginConfig ?? {}
		}
	} catch (e) {
		logger.error('Failed to load configuration file:', e, configPath)
		return {} as T
	}
}
