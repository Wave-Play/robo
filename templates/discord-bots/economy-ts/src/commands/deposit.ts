// imports
import type { CommandConfig } from 'robo.js'
import { CommandInteraction } from 'discord.js'
import { depositPlayerMoney } from '../utils.js'

/**
 * @name /deposit
 * @description Deposit credits from your wallet into your bank.
 */
export const config: CommandConfig = {
	description: 'Deposit credits from your wallet into your bank.',
	options: [
		{
			name: 'amount',
			description: 'Amount to be deposited',
			type: 'number',
			required: true
		}
	]
}

export default async (interaction: CommandInteraction) => {
	const amount = interaction.options.get('amount')?.value as number
	return await depositPlayerMoney(amount ?? 0, interaction.user.id, interaction.guild!.id)
}
