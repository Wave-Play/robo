import fs from 'fs/promises'
import path from 'path'
import { copyDir, hasProperties, replaceSrcWithBuildInRecord } from './utils.js'
import { logger } from '../../core/logger.js'
import { env } from '../../core/env.js'
import { IS_BUN_RUNTIME } from './runtime-utils.js'
import { getManifest, useManifest } from '../compiler/manifest.js'
import { buildSeed, hasSeed, useSeed } from '../compiler/seed.js'
import { buildDeclarationFiles, getTypeScriptCompilerOptions, isTypescriptProject } from '../compiler/typescript.js'
import type { default as Typescript, CompilerOptions } from 'typescript'
import type { transform as SwcTransform } from '@swc/core'

const SrcDir = path.join(process.cwd(), 'src')

// Load Typescript compiler in a try/catch block
// This is to maintain compatibility with JS-only projects
export let ts: typeof Typescript
export let transform: typeof SwcTransform

async function preloadTypescript() {
	try {
		// Disable Typescript compiler(s) if using Bun, unless for plugin builds
		// This is because plugins may be used in any runtime environment (not just Bun)
		if (!IS_BUN_RUNTIME) {
			logger.debug(`Preloading Typescript compilers...`)
			const [typescript, swc] = await Promise.all([import('typescript'), import('@swc/core')])
			ts = typescript.default
			transform = swc.transform
		}
	} catch {
		// Ignore
	}
}
await preloadTypescript()

export const Compiler = {
	buildCode,
	buildDeclarationFiles,
	buildSeed,
	getManifest,
	hasSeed,
	isTypescriptProject,
	useManifest,
	useSeed
}

/**
 * Recursively traverse a directory and transform TypeScript files using SWC
 *
 * @param dir
 * @param compilerOptions
 */
export async function traverse(
	dir: string,
	distDir: string,
	options: BuildCodeOptions,
	compilerOptions: CompilerOptions,
	transform: typeof SwcTransform
) {
	const { distExt = '.js', excludePaths = [], parallel = 20, srcDir = SrcDir } = options
	const isIncremental = options.files?.length > 0

	// Read directory contents
	let files
	try {
		if (isIncremental) {
			files = options.files.map((file) => path.join(process.cwd(), file))
			logger.debug(`Incrementally compiling:`, files)
		} else {
			files = await fs.readdir(dir)
		}
	} catch (e) {
		if (hasProperties<{ code: unknown }>(e, ['code']) && e.code === 'ENOENT') {
			logger.debug(`Directory ${dir} does not exist, skipping traversal.`)
			return
		} else {
			throw e
		}
	}
	const tasks = []

	for (const file of files) {
		const filePath = isIncremental ? file : path.join(dir, file)
		const relativePath = '/' + path.relative(process.cwd(), filePath)
		const stat = await fs.stat(filePath)

		// Recursively traverse subdirectories, only if no files are specified
		if (stat.isDirectory() && !isIncremental) {
			tasks.push(traverse(filePath, distDir, options, compilerOptions, transform))
		} else if (/\.(js|ts|tsx)$/.test(file) && !excludePaths.some((p) => relativePath.startsWith(p))) {
			// Queue up a task to transform the file
			tasks.push(
				(async () => {
					const fileContents = await fs.readFile(filePath, 'utf-8')
					const compileResult = await transform(fileContents, {
						filename: filePath,
						module: {
							type: 'es6',
							strict: false,
							strictMode: true,
							lazy: false,
							noInterop: false,
							// @ts-expect-error - works but not in SWC types
							// Necessary to ensure "/index.js" imports compile correctly in Linux
							resolveFully: true
						},
						sourceMaps: env.get('nodeEnv') === 'production' ? false : 'inline',
						jsc: {
							target: 'esnext',
							baseUrl: options.baseUrl,
							paths: options.paths,
							parser: {
								syntax: 'typescript',
								tsx: filePath.endsWith('.tsx'),
								dynamicImport: true,
								decorators: compilerOptions.experimentalDecorators ?? true
							},
							transform: {
								legacyDecorator: compilerOptions.experimentalDecorators ?? true,
								useDefineForClassFields: compilerOptions.useDefineForClassFields ?? false
							}
						}
					})

					// Write transformed code to destination directory
					const distPath = path.join(distDir, path.relative(srcDir, filePath.replace(/\.(js|ts|tsx)$/, distExt)))
					await fs.mkdir(path.dirname(distPath), { recursive: true })
					await fs.writeFile(distPath, compileResult.code)
				})()
			)
		}
		if (tasks.length >= parallel) {
			// Wait for the currently running tasks to complete
			await Promise.all(tasks)
			tasks.length = 0
		}
	}

	// Wait for any remaining tasks to complete
	await Promise.all(tasks)
}

interface BuildCodeOptions {
	baseUrl?: string
	clean?: boolean
	copyOther?: boolean
	distDir?: string
	distExt?: string
	excludePaths?: string[]
	files?: string[]
	parallel?: number
	paths?: Record<string, string[]>
	plugin?: boolean
	srcDir?: string
}

async function buildCode(options?: BuildCodeOptions) {
	const { clean = true, copyOther = true, srcDir = SrcDir } = options ?? {}
	const startTime = Date.now()
	const distDir = options.distDir
		? path.join(process.cwd(), options.distDir)
		: path.join(process.cwd(), '.robo', 'build')

	// Force load compilers for Bun in plugin builds
	if (IS_BUN_RUNTIME && options?.plugin) {
		await preloadTypescript()
	}

	// Just copy the source directory if not a Typescript project
	if (!Compiler.isTypescriptProject()) {
		if (clean) {
			await fs.rm(distDir, { recursive: true, force: true })
		}
		logger.debug(`Not a TypeScript project. Copying source without compiling...`)
		await copyDir(srcDir, distDir, [], options.excludePaths ?? [])

		return Date.now() - startTime
	}

	// Clear the destination directory before compiling if not an incremental build
	if (clean && !options?.files?.length) {
		logger.debug(`Cleaning ${distDir}...`)
		await fs.rm(distDir, { recursive: true, force: true })
	}

	// Traverse the source directory and transform files
	logger.debug(`Compiling ${srcDir} to ${distDir}...`)
	const tsOptions = await getTypeScriptCompilerOptions()
	const baseUrl = tsOptions.baseUrl ?? process.cwd()
	const compileOptions = {
		baseUrl: baseUrl,
		paths: replaceSrcWithBuildInRecord(tsOptions.paths ?? {}),
		...(options ?? {})
	}
	logger.debug(`Compiler options:`, compileOptions)

	await traverse(srcDir, distDir, compileOptions, tsOptions, transform)
	await fs.rm(path.join(process.cwd(), '.swc'), { recursive: true, force: true })

	// Copy any non-TypeScript files to the destination directory
	if (copyOther) {
		logger.debug(`Copying additional non-TypeScript files from ${srcDir} to ${distDir}...`)
		await copyDir(srcDir, distDir, ['.ts', '.tsx'], options.excludePaths ?? [])
	}

	// Generate declaration files for plugins
	if (options?.plugin) {
		const declarationTime = Date.now()
		logger.debug(`Generating declaration files for plugins...`)
		Compiler.buildDeclarationFiles(tsOptions)
		logger.debug(`Generated declaration files in ${Date.now() - declarationTime}ms`)
	}

	logger.debug(`Compiled successfully!`)
	return Date.now() - startTime
}
