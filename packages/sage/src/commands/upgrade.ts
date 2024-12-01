import { PackageJson } from './../core/types.js'
import { findPackagePath } from 'robo.js/dist/cli/utils/utils.js'
import { Command } from 'commander'
import { logger } from '../core/logger.js'
import { checkSageUpdates, checkUpdates, exec, getPackageManager, IS_WINDOWS } from '../core/utils.js'
import { loadConfig } from 'robo.js/dist/core/config.js'
import { prepareFlashcore } from 'robo.js/dist/core/flashcore.js'
import { color, composeColors } from '../core/color.js'
import fs from 'node:fs'
import path from 'node:path'
import { checkbox, select, Separator } from '@inquirer/prompts'
import { readFile } from 'node:fs/promises'
import { Config, Plugin } from 'robo.js'

const command = new Command('upgrade')
	.description('Upgrades your Robo to the latest version')
	.option('-y --yes', 'installs updates without showing changelogs')
	.option('-f --force', 'forcefully install')
	.option('-ns --no-self-check', 'do not check for updates to Sage CLI')
	.option('-s --silent', 'do not print anything')
	.option('-v --verbose', 'print more information for debugging')
	.action(upgradeAction)
export default command

interface UpgradeOptions {
	autoAccept?: boolean
	force?: boolean
	selfCheck?: boolean
	silent?: boolean
	verbose?: boolean
}

// TODO:
// - Auto accept option for ci
async function upgradeAction(options: UpgradeOptions) {
	// Create a logger
	logger({
		enabled: !options.silent,
		level: options.verbose ? 'debug' : 'info'
	}).info(`Checking for updates...`)
	logger.debug(`CLI Options:`, options)
	logger.debug(`Package manager:`, getPackageManager())
	logger.debug(`Current working directory:`, process.cwd())
	if (options.selfCheck) {
		await checkSageUpdates()
	}

	const config = await loadConfig()
	await prepareFlashcore()
	const plugins = config.plugins
	plugins.push(['robo.js', {}])

	// Check NPM registry for updates
	const packageJsonPath = path.join(await findPackagePath('robo.js', process.cwd()), 'package.json')
	logger.debug(`Package JSON path:`, packageJsonPath)
	const packageJson: PackageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
	logger.debug(`Package JSON:`, packageJson)
	const update = await checkUpdates(packageJson, config, true)
	logger.debug(`Update payload:`, update)

	await updateRobo(plugins, config, options.autoAccept)
}

interface Changelog {
	version: string
	patch: string[]
	major: string[]
	minor: string[]
}

async function getChangelog(url: string): Promise<Changelog | null> {
	try {
		const response = await fetch(url)

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`)
		}

		const data = await response.text()
		let currentChangelog: Changelog | null = null
		let currentChangeType: 'patch' | 'minor' | 'major' | null = null

		for (const line of data.split('\n')) {
			const versionMatch = line.match(/^## (\d+\.\d+\.\d+)/)

			if (versionMatch) {
				if (currentChangelog) break
				currentChangelog = { version: versionMatch[1], patch: [], major: [], minor: [] }
				continue
			}

			const changeTypeMatch = line.match(/^### (Patch|Minor|Major) Changes/)
			if (changeTypeMatch) {
				currentChangeType = changeTypeMatch[1].toLowerCase() as 'patch' | 'minor' | 'major'
				continue
			}

			if (currentChangelog && currentChangeType) {
				const changeMatch = line.match(/^- [a-f0-9]+: (.+)/)
				if (changeMatch) {
					currentChangelog[currentChangeType].push(changeMatch[1])
				}
			}
		}

		return currentChangelog
	} catch (error) {
		logger.error('Failed to fetch and process the changelog', error)
		return null
	}
}

function printChangelog(changelog: Changelog) {
	logger.log(composeColors(color.bold, color.blue, color.underline)(`Version: ${changelog.version}`))

	if (changelog.major.length > 0) {
		logger.log(composeColors(color.red, color.bold)('Major Changes:'))
		changelog.major.forEach((change) => logger.log(`- ${change}`))
	}

	if (changelog.minor.length > 0) {
		logger.log(composeColors(color.bold, color.yellow)('Minor Changes:'))
		changelog.minor.forEach((change) => logger.log(`- ${change}`))
	}

	if (changelog.patch.length > 0) {
		logger.log(composeColors(color.bold, color.green)('Patch Changes:'))
		changelog.patch.forEach((change) => logger.log(`- ${change}`))
	}

	logger.log('\n')
}

export interface Change {
	id: number
	name: string
	description: string
}

export interface CheckResult {
	breaking: Change[]
	suggestions: Change[]
}

let _id = 0

const CHANGES: Record<string, Change> = {
	configDirectory: {
		id: ++_id,
		name: 'Config directory',
		description: 'The config directory has been renamed from `.config` to `config`.'
	}
}

/**
 * Checks for any changes between current and target version.
 *
 * This is to be called after the upgrade has been installed, but before
 * executing this upgrade script. This is to ensure that the user is able
 * to select which changes they want to apply and why.
 *
 * @param name The name of the package being upgraded
 * @param version The target version being upgraded to
 * @param config The current Robo config
 * @param manifest The current Robo manifest
 */
async function check(name: string, version: string): Promise<CheckResult> {
	logger.info(`Checking version ${version}...`)
	const breaking: Change[] = []
	const suggestions: Change[] = []

	// Only support Robo.js for now
	if (name !== 'robo.js') {
		logger.debug(`No changes to check for`, name)
		return { breaking, suggestions }
	}

	// Check for breaking changes
	if (fs.existsSync(path.join(process.cwd(), '.config'))) {
		breaking.push(CHANGES.configDirectory)
	}

	return { breaking, suggestions }
}

/**
 * Executes the changes selected by the user.
 *
 * @param changes The changes selected by the user
 * @param config The current Robo config
 * @param manifest The current Robo manifest
 */
async function execute(changes: Change[]) {
	logger.info(`Applying changes:`, changes.map((change) => change.name).join(', '))

	for (const change of changes) {
		if (change.id === CHANGES.configDirectory.id) {
			logger.debug(`Renaming config directory...`)
			fs.renameSync(path.join(process.cwd(), '.config'), path.join(process.cwd(), 'config'))
		}
	}

	logger.info(`Successfully applied changes!`)
}

type Choice<Value> = {
	value: Value
	name?: string
	description?: string
	disabled?: boolean | string
	short?: string
	type?: never
}

type ChangelogUpdate = {
	changelogUrl: string
	currentVersion: string
	hasUpdate: boolean
	latestVersion: string
	name: string
}

type PluginToUpdate = { data: { name: string; extra: ChangelogUpdate } }

const CustomSeparator = '----- 🎉 -----'

async function updateRobo(plugins: Plugin[], config: Config, autoAccept?: boolean) {
	const u_options: Array<Separator | Choice<string>> = []
	const hasUpdate: (string | PluginToUpdate)[] = []

	for (const plugin of plugins) {
		const plugingName = IS_WINDOWS ? plugin[0].replaceAll('\\', '/') : plugin[0]
		const packagePath = await findPackagePath(plugingName, process.cwd())
		logger.debug('Checking updates for', color.bold(plugingName), 'at path', color.bold(packagePath))

		// Check this package for updates
		const packageJsonPath = path.join(packagePath, 'package.json')
		const packageJson: PackageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
		const update = await checkUpdates(packageJson, config, true)
		logger.debug(`Update payload for ${plugingName}:`, update)

		const pluginOnRegistry = await fetch(`https://registry.npmjs.org/${packageJson.name}/latest`)
		if (!pluginOnRegistry.ok) {
			logger.info(
				composeColors(
					color.yellowBright,
					color.bold
				)(`Skipping ${plugingName}, not found on registry, probably local plugin!`)
			)
			continue
		}

		// Skip if no updates
		if (!update.hasUpdate) {
			logger.info(composeColors(color.green, color.bold)(`${plugingName} is up to date!`))
			continue
		}

		if (autoAccept && update.hasUpdate) {
			hasUpdate.push({ data: { name: plugingName, extra: { ...update, name: '' } } })
			continue
		}

		// Show changelog if available
		const upgradeOptions = [
			{ name: plugingName, value: JSON.stringify({ data: { name: plugingName, extra: update } }), short: 'pl' }
		]

		if (update.changelogUrl) {
			upgradeOptions.splice(1, 0, {
				name: 'Read changelog',
				value: JSON.stringify({
					...update,
					name: plugingName
				}),
				short: 'cl'
			})
			hasUpdate.push(
				JSON.stringify({
					...update,
					name: plugingName
				})
			)
		}

		u_options.push(new Separator(plugingName))
		u_options.push(...upgradeOptions)

		logger.info(
			composeColors(color.green, color.bold)(`A new version of ${plugingName} is available!`),
			color.dim(`(v${update.currentVersion} -> v${update.latestVersion})`)
		)
		logger.log('')
	}

	if (autoAccept) {
		await upgradeSelectedPlugins(hasUpdate as PluginToUpdate[])
		logger.info(composeColors(color.green, color.bold)(`Your Robo is up to date!`))
		return
	}

	if (u_options.length > 0) {
		await showListOfPlugins(u_options, hasUpdate as string[])
	} else {
		logger.info(composeColors(color.green, color.bold)(`Your Robo is up to date!`))
	}
}

async function showListOfPlugins(u_options: Array<Separator | Choice<string>>, hasUpdate: string[]) {
	const selectedPlugins = await checkbox(
		{
			message: 'Select plugins that you want to update:',
			choices: u_options.filter((option) => option instanceof Separator === false && option.short !== 'cl'),
			loop: false
		},
		{
			clearPromptOnDone: false
		}
	)

	if (selectedPlugins.length > 0) {
		u_options.push(new Separator(CustomSeparator))
		u_options.push({ name: 'Proceed update', value: 'update' })
		u_options.push({ name: 'Cancel', value: 'abort' })
		await showChangelogList(selectedPlugins, u_options, hasUpdate)
	}
}

async function showChangelogList(
	pluginData: string[],
	u_options: Array<Separator | Choice<string>>,
	hasUpdate: string[]
) {
	console.clear()
	const pluginNames = (pluginData as string[]).map((plugin: string) => {
		const parsed = JSON.parse(plugin)
		if (isValidPlugin(parsed)) {
			return parsed.data.name
		}
	})

	const selectedChangelog = await select(
		{
			message: 'See the change logs for the plug-ins you selected or proceed with the upgrade',
			choices: u_options.filter((option) => {
				if (option instanceof Separator) {
					if (option.separator === CustomSeparator) {
						return option
					}

					if (pluginNames.includes(option.separator)) {
						return {
							...option,
							separate: option.separator + ':'
						}
					}
				}

				if (option instanceof Separator === false) {
					if (option.value === 'abort' || option.value === 'update') {
						return option
					}

					if (option.short === 'cl') {
						const value = JSON.parse(option.value as string)
						if (pluginNames.includes(value.name)) {
							return option
						}
					}
				}
			}),
			loop: false
		},
		{
			clearPromptOnDone: false
		}
	)

	if (typeof selectedChangelog === 'string' && hasUpdate.includes(selectedChangelog)) {
		const JSONParseChangeLog = JSON.parse(selectedChangelog) as ChangelogUpdate
		const changelog = await getChangelog(JSONParseChangeLog.changelogUrl)
		printChangelog(changelog)

		// Let user choose whether to upgrade or not
		const upgrade = await select(
			{
				message: ``,
				choices: [{ name: 'back', value: false }],
				loop: false
			},
			{
				clearPromptOnDone: true
			}
		)

		logger.log('')
		// Exit if user cancels
		if (!upgrade) {
			await showChangelogList(pluginData, u_options, hasUpdate)
			return
		}
	}

	if (selectedChangelog === 'update') {
		if (Array.isArray(pluginData)) {
			const map = pluginData.map((plugin) => {
				if (typeof plugin === 'string') {
					const parsed = JSON.parse(plugin)
					if (isValidPlugin(parsed)) return parsed
				}
			})
			await upgradeSelectedPlugins(map)
			return
		}
		logger.error('An error happened while treating the data...')
		return
	}

	if (selectedChangelog === 'abort') {
		logger.info('Aborting plugin upgrade!')
		return
	}
}

async function upgradeSelectedPlugins(selectedPlugins: Array<PluginToUpdate>, autoAccept?: boolean) {
	const packageManager = getPackageManager()
	const command = packageManager === 'npm' ? 'install' : 'add'
	logger.debug(`Package manager:`, packageManager)

	const pluginStringFromArray = selectedPlugins
		.map((plugin) => `${plugin.data.name}@${plugin.data.extra.latestVersion}`)
		.join(' ')

	await exec(`${packageManager} ${command} ${pluginStringFromArray}`)

	// Check what needs to be changed

	for (const plugin of selectedPlugins) {
		const { extra, name } = plugin.data
		const data = await check(name, extra.latestVersion)
		logger.debug(`Check data:`, data)

		if (data.breaking.length > 0 || (data.suggestions.length > 0 && !autoAccept)) {
			// Let user choose which changes to apply
			const changes = await checkbox({
				message: 'Which changes would you like to apply?',
				choices: [
					...data.breaking.map((change) => ({ name: change.name, value: change })),
					new Separator(),
					...data.suggestions.map((change) => ({ name: change.name, value: change }))
				]
			})
			logger.log('')

			await execute(changes)
		}

		logger.ready(`Successfully upgraded ${name} to v${extra.latestVersion}! 🎉`)
	}
}

function isValidPlugin(plugin: PluginToUpdate): plugin is PluginToUpdate {
	if (plugin?.data !== undefined) {
		return true
	}
}
