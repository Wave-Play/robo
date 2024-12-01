// imports
import type { CommandConfig } from 'robo.js'
import { CommandInteraction } from 'discord.js'
import { withdrawPlayerMoney } from '../utils.js'

/**
 * @name /withdraw
 * @description Withdraw credits from your bank to your wallet.
 */
export const config: CommandConfig = {
	description: 'Withdraw credits from your bank to your wallet.',
	options: [
		{
			name: 'amount',
			description: 'Amount to be withdrawn',
			type: 'number',
			required: true
		}
	]
}

export default async (interaction: CommandInteraction) => {
	const amount = interaction.options.get('amount')?.value as number
	return await withdrawPlayerMoney(amount ?? 0, interaction.user.id, interaction.guild!.id)
}
