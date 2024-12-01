/* eslint-disable no-var */
import type { FlashcoreAdapter } from '../types/index.js'

declare global {
	var robo: {
		config: Config | null
		flashcore: {
			_adapter: FlashcoreAdapter
		}
		portal: {
			apis: Collection<string, HandlerRecord<Api>>
			commands: Collection<string, HandlerRecord<Command>>
			context: Collection<string, HandlerRecord<Context>>
			events: Collection<string, HandlerRecord<Event>[]>
			middleware: HandlerRecord<Middleware>[]
			moduleKeys: Set<string>
		}
	}
}

export {}
