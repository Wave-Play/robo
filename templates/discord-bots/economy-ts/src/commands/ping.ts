// imports
import type { CommandConfig } from 'robo.js'
import { CommandInteraction } from 'discord.js'

/**
 * @name /ping
 * @description Check the bot's latency!
 */
export const config: CommandConfig = {
	description: "Check the bot's latency!"
}

export default (interaction: CommandInteraction) => {
	return `## 🏓 Latency is \` ${Date.now() - interaction.createdTimestamp}ms \``
}
