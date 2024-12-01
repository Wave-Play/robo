// imports
import { MiddlewareData } from 'robo.js'
import type { ChatInputCommandInteraction, Client } from 'discord.js'
import { createPlayerProfile, getPlayerProfile } from '../utils.js'

/**
 * Creates user profile if not there
 */
export default async (data: MiddlewareData) => {
	// get (interaction as as ChatInputCommandInteraction)
	const interaction = data.payload[0]

	if (!(interaction as Client).login) {
		// get player
		const player = (interaction as ChatInputCommandInteraction).user.id

		// not dm
		if (!(interaction as ChatInputCommandInteraction).inGuild()) {
			await (interaction as ChatInputCommandInteraction).reply({
				content: '## ⚠ This bot can only be used in Guilds!'
			})
		}

		// get profile
		const playerProfile = await getPlayerProfile(player, (interaction as ChatInputCommandInteraction).guild!.id)

		// create profile
		if (!playerProfile) createPlayerProfile(player, (interaction as ChatInputCommandInteraction).guild!.id)
	}
}
