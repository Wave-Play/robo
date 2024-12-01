import { Player } from 'discord-player'
import { client, portal } from 'robo.js'
import type { HandlerRecord } from 'robo.js'

export default async () => {
	const player = new Player(client)
	// @ts-expect-error - Add player to client
	client.player = player

	await player.extractors.loadDefault()
	portal.events.forEach((handlers: HandlerRecord[], event: string) => {
		// @ts-expect-error - Portal events can be arbitrary; filter if needed
		player.events.on(event, (...args: unknown[]) => {
			// @ts-expect-error - Handlers are arbitrary, but default is always present in events
			handlers.forEach((handler) => handler.handler.default(...args))
		})
	})
}
