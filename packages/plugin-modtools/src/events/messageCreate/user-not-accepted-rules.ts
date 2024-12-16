import { ChannelType, GuildMember, Message, TextBasedChannel } from 'discord.js'
import { client, Flashcore, logger } from 'robo.js'

export default async (interaction: Message) => {
	if (interaction.author.bot || interaction.channel.type === ChannelType.DM) {
		return
	}

	const member = interaction.member as GuildMember
	const rolestring = await Flashcore.get(`member-role`, { namespace: interaction.guild!.id })

	if (!rolestring) {
		return 
	}

	if (!interaction.guild.roles.cache.some((role) => role.name === rolestring)) {
		logger.warn(`can not find role "${rolestring}". try running the set-member-role command`)
	}

	if (member.roles.cache.some((role) => role.name === rolestring) || member.permissions.has('Administrator')) {
		return
	} else {
		const guild = interaction.guild
		const channelId = interaction.channel.id
		const channel = guild!.channels.cache.get(channelId) as TextBasedChannel
		const rulesChannelId = await Flashcore.get<string>(`rules-channel`, { namespace: interaction.guild!.id })
		const channel1 = guild!.channels.cache.get(rulesChannelId) as TextBasedChannel

		if (!channel1 || !channel1.isTextBased) {
			logger.debug('Rules channel not found or is not a text channel')
			return
		}
		try {
			await client.users.send(
				interaction.author.id,
				`You cant send messages untill you accept the rules! go here to accept ${channel1}`
			)
		} catch (error) {
			logger.warn(`DM'ing the user failed:`, error)
		}

		const message = await channel.messages.fetch(interaction.id)
		message
			.delete()
			.then((msg) => logger.debug(`Deleted message from ${msg.author.username}`))
			.catch(logger.error)

		return
	}
}
