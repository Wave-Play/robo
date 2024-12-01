import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type PackageManager = 'npm' | 'bun' | 'pnpm' | 'yarn'

/**
 * Get the package manager used to run this CLI
 * This allows developers to use their preferred package manager seamlessly
 */
export function getPackageManager(): PackageManager {
	const userAgent = process.env.npm_config_user_agent

	if (userAgent?.startsWith('bun')) {
		return 'bun'
	} else if (userAgent?.startsWith('yarn')) {
		return 'yarn'
	} else if (userAgent?.startsWith('pnpm')) {
		return 'pnpm'
	} else {
		return 'npm'
	}
}

/**
 * Get the "npx" or equivalent for the current package manager
 */
export function getPackageExecutor(): string {
	const packageManager = getPackageManager()
	if (packageManager === 'yarn') {
		return 'yarn dlx'
	} else if (packageManager === 'pnpm') {
		return 'pnpx'
	} else if (packageManager === 'bun') {
		return 'bunx'
	} else {
		return 'npx'
	}
}

export const IS_BUN_PM = getPackageManager() === 'bun'
export const IS_BUN_RUNTIME = process.versions.bun

/**
 * Reads the package.json file and returns whether the given dependency is installed.
 */
export async function hasDependency(name: string, dev = false): Promise<boolean> {
	try {
		const packageJsonPath = path.join(process.cwd(), 'package.json')
		const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

		if (dev) {
			return !!packageJson.devDependencies?.[name]
		}

		return !!packageJson.dependencies?.[name]
	} catch {
		return false
	}
}
