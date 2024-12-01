import { useMainPlayer } from 'discord-player'
import { client, createCommandConfig, logger } from 'robo.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import type { CommandOptions } from 'robo.js'

export const config = createCommandConfig({
	description: 'Play a song',
	options: [
		{
			description: 'The song to play',
			name: 'query',
			required: true
		}
	]
} as const)

export default async (interaction: ChatInputCommandInteraction, options: CommandOptions<typeof config>) => {
	const { query } = options
	const player = useMainPlayer()
	logger.event('Playing:', query)

	// Fetch the voice channel of the member
	const guild = await client.guilds.fetch(interaction.guildId!)
  const mem = await guild.members.fetch(interaction.member!.user.id)
	const channel = mem.voice.channel

	// Check if the member is in a voice channel
	logger.warn('Channel:', channel)

	if (!channel) {
		return 'You are not connected to a voice channel!'
	}
	//const query = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

	try {
		const { searchResult, track } = await player.play(channel, query, {
			// nodeOptions are the options for guild node (aka your queue in simple word)
			nodeOptions: {
				// We can access this metadata object using queue.metadata later on
				metadata: interaction
			}
		})
		logger.info('Search result:', searchResult.hasTracks, searchResult.tracks.length)
		logger.info('Track:', track.id)
		await new Promise((resolve) => setTimeout(resolve, 2_000))
		logger.info('Returning from play command')

		return `**${track.cleanTitle}** enqueued!`
	} catch (e) {
		logger.error(e)
		return `Something went wrong: ${e}`
	}
}
