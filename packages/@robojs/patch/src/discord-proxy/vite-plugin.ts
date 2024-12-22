import { Plugin } from 'vite'

const PatchScriptPath = 'node_modules/@robojs/patch/.robo/public/discord-proxy-patch.umd.js'
const PatchScriptDest = 'assets/discord-proxy-patch.umd.js'

/**
 * Vite plugin to inject the Discord proxy patch script into the index.html.
 *
 * In development, the script loads synchronously to ensure patch is applied before Vite's HMR runs.
 * In production, the script is bundled into the output and referenced from the index.html.
 *
 * The patch script is equivalent to running:
 * ```js
 * import { DiscordProxy } from '@robojs/patch'
 *
 * DiscordProxy.patch()
 * ```
 */
export function VitePlugin(): Plugin {
	let configCommand: 'build' | 'serve'

	return {
		name: 'discord-proxy-patch',
		enforce: 'pre',
		configResolved(config) {
			configCommand = config.command
		},
		transform(code, id) {
			if (id.includes('/node_modules/@discord/embedded-app-sdk') || id.includes('/deps/@discord_embedded-app-sdk.js')) {
				// Modify the module code
				const modifiedCode = code.replace(
					/function patchUrlMappings\s*\(/,
					'function originalPatchUrlMappings('
				)

				// Append your custom function
				const trackingCode = `
				  globalThis['@robojs/patch'] = { mappings: [] }
          function patchUrlMappings(...args) {
						if (args.length > 0) {
							const prefixes = args[0].map(arg => arg.prefix);
							globalThis['@robojs/patch'].mappings.push(prefixes);
						}

            // Call the original function
            return originalPatchUrlMappings.apply(this, args);
          }
        `

				// Return the modified code
				return modifiedCode + '\n' + trackingCode
			}
		},
		transformIndexHtml(html) {
			const scriptSrc = configCommand === 'build' ? PatchScriptDest : PatchScriptPath
			const result = html.replace('<head>', `<head>\n\t\t<script src="${scriptSrc}"></script>`)

			return result
		},
		async buildStart() {
			// Skip if not building for production
			if (configCommand !== 'build') {
				return
			}

			// Load the patch script and emit it as an asset in production
			const file = await this.load({ id: PatchScriptPath })

			if (file?.code) {
				this.emitFile({
					type: 'asset',
					fileName: PatchScriptDest,
					source: file.code
				})
			} else {
				console.error('Failed to load patch script:', file)
			}
		}
	}
}
