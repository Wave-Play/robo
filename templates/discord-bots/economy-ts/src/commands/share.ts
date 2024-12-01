// imports
import type { CommandConfig } from 'robo.js'
import { CommandInteraction } from 'discord.js'
import { sharePlayerMoney } from '../utils.js'

/**
 * @name /share
 * @description Share credits to another user.
 */
export const config: CommandConfig = {
	description: 'Transfer credits to another user.',
	options: [
		{
			name: 'amount',
			description: 'Amount to be sent...',
			type: 'number',
			required: true
		},
		{
			name: 'receiver',
			description: 'Choose account to send money to...',
			type: 'user',
			required: true
		}
	]
}

export default async (interaction: CommandInteraction) => {
	// vars
	const receiver = interaction.options.get('receiver')?.value as any
	const amount = interaction.options.get('amount')?.value as number

	// return
	return await sharePlayerMoney(amount ?? 0, interaction.user.id, receiver, interaction.guild!.id)
}
