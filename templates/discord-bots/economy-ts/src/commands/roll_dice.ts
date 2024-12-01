// imports
import type { CommandConfig } from 'robo.js'
import { CommandInteraction } from 'discord.js'
import { rollDiceGame } from '../utils.js'

/**
 * @name /roll_dice
 * @description Roll a dice to test your luck and win or lose credits.
 */
export const config: CommandConfig = {
	description: 'Roll a dice to test your luck and win or lose credits.',
	options: [
		{
			name: 'number',
			description: 'Choose any number from 1-6 to bet on...',
			type: 'number',
			required: true,
			min: 1,
			max: 6
		},
		{
			name: 'amount',
			description: 'Choose amount to bet on... Default amount = $100',
			type: 'number',
			required: false,
			min: 5
		}
	]
}

export default async (interaction: CommandInteraction) => {
	const num = interaction.options.get('number')?.value ?? '3'
	const amount = (interaction.options.get('amount')?.value as number) ?? 100
	return await rollDiceGame(num.toString(), amount, interaction.user.id, interaction.guild!.id)
}
