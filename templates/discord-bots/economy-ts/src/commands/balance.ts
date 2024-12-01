// imports
import type { CommandConfig } from 'robo.js'
import { CommandInteraction } from 'discord.js'
import { type PlayerProfile, getPlayerProfile } from '../utils.js'

/**
 * @name /balance
 * @description Check your or others account balance.
 */
export const config: CommandConfig = {
	description: 'Check your or others account balance.',
	options: [
		{
			name: 'user',
			description: 'Check balance of any other user!',
			type: 'user',
			required: false
		}
	]
}

export default async (interaction: CommandInteraction) => {
	// get user
	const user = interaction.options.get('user')?.value as any

	// get profile
	const player: PlayerProfile = await getPlayerProfile(user ?? interaction.user.id, interaction.guild!.id)

	// if no profile
	if (!player) {
		return "This User haven't created their player profile yet :("
	}

	// return
	return `>>> Wallet Balance: **$${player.wallet}** credits\nBank Balance: **$${
		player.bank
	}** credits\nTotal Balance: **$${player.bank + player.wallet}** credits`
}
