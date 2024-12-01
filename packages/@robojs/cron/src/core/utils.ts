export type PackageManager = 'npm' | 'bun' | 'pnpm' | 'yarn'

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

export const IS_BUN_PM = getPackageManager() === 'bun'
export const IS_BUN_RUNTIME = process.versions.bun
