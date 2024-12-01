// imports
import type { CommandConfig } from 'robo.js'
import { CommandInteraction } from 'discord.js'
import { claimDailyPlayer } from '../utils.js'

/**
 * @name /daily
 * @description Claim your daily credits.
 */
export const config: CommandConfig = {
	description: 'Claim your daily credits.'
}

export default async (interaction: CommandInteraction) => {
	return await claimDailyPlayer(interaction.user.id, interaction.guild!.id)
}
