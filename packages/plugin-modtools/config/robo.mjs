// @ts-check

import { Partials } from 'discord.js'

/**
 * @type {import('robo.js').Config}
 **/
export default {
	clientOptions: {
		intents: [
			'AutoModerationConfiguration',
			'AutoModerationExecution',
			'DirectMessages',
			'Guilds',
			'GuildBans',
			'GuildMessages',
			'GuildModeration',
			'MessageContent',
			'GuildMembers'
		],
		partials: [Partials.Channel, Partials.Message, Partials.GuildMember]

	},
	invite: {
		autoPermissions: false,
		permissions: [
			'BanMembers',
			'KickMembers',
			'ManageChannels',
			'ManageMessages',
			'ModerateMembers',
			'ReadMessageHistory',
			'ViewChannel',
			'ViewAuditLog'
		]
	},
	plugins: [],
	type: 'plugin'
}
