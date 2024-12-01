import type {
	Api,
	Command,
	Config,
	Context,
	Event,
	FlashcoreAdapter,
	HandlerRecord,
	Middleware
} from '../types/index.js'
import type { Collection } from 'discord.js'

const instanceId = Math.random().toString(36).slice(2)

export const Globals = {
	getConfig: () => {
		if (!globalThis.robo) {
			Globals.init()
		}

		return globalThis.robo.config
	},
	getFlashcoreAdapter: () => {
		if (!globalThis.robo) {
			Globals.init()
		}

		return globalThis.robo.flashcore._adapter
	},
	getPortalValues: () => {
		if (!globalThis.robo) {
			Globals.init()
		}

		return {
			apis: globalThis.robo.portal.apis,
			commands: globalThis.robo.portal.commands,
			context: globalThis.robo.portal.context,
			events: globalThis.robo.portal.events,
			middleware: globalThis.robo.portal.middleware,
			moduleKeys: globalThis.robo.portal.moduleKeys
		}
	},
	init: () => {
		globalThis.robo = {
			config: null,
			flashcore: {
				_adapter: null
			},
			portal: {
				apis: null,
				commands: null,
				context: null,
				events: null,
				middleware: [],
				moduleKeys: new Set()
			}
		}
	},
	instanceId,
	registerConfig: (config: Config) => {
		if (!globalThis.robo) {
			Globals.init()
		}

		globalThis.robo.config = config
	},
	registerFlashcore: (adapter: FlashcoreAdapter) => {
		if (!globalThis.robo) {
			Globals.init()
		}

		globalThis.robo.flashcore._adapter = adapter
	},
	registerPortal: (
		apis: Collection<string, HandlerRecord<Api>>,
		commands: Collection<string, HandlerRecord<Command>>,
		context: Collection<string, HandlerRecord<Context>>,
		events: Collection<string, HandlerRecord<Event>[]>,
		middleware: HandlerRecord<Middleware>[]
	) => {
		if (!globalThis.robo) {
			Globals.init()
		}

		globalThis.robo.portal.apis = apis
		globalThis.robo.portal.commands = commands
		globalThis.robo.portal.context = context
		globalThis.robo.portal.events = events
		globalThis.robo.portal.middleware = middleware

		// Generate module keys based off of entries then sort alphabetically
		const moduleKeys = new Set<string>()
		apis.forEach((api) => {
			if (api.module) {
				moduleKeys.add(api.module)
			}
		})
		commands.forEach((command) => {
			if (command.module) {
				moduleKeys.add(command.module)
			}
		})
		context.forEach((context) => {
			if (context.module) {
				moduleKeys.add(context.module)
			}
		})
		events.forEach((event) => {
			event.forEach((handler) => {
				if (handler.module) {
					moduleKeys.add(handler.module)
				}
			})
		})
		middleware.forEach((middleware) => {
			if (middleware.module) {
				moduleKeys.add(middleware.module)
			}
		})
		globalThis.robo.portal.moduleKeys = new Set([...moduleKeys].sort())
	}
}
