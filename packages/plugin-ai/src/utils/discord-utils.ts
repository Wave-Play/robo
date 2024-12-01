import { ApplicationCommandType, CommandInteraction, InteractionType } from 'discord.js'
import { client } from 'robo.js'
import type {
	APIInteraction,
	APIMessage,
	GuildMember,
	GuildMemberFlags,
	InteractionReplyOptions,
	Message,
	TextBasedChannel,
	User
} from 'discord.js'

const CHAR_LIMIT = 2000

export function chunkMessage(message: string): string[] {
	const chunks: string[] = []
	let tempStr = ''

	// Split the message into paragraphs
	const paragraphs = message.split('\n\n')

	for (let i = 0; i < paragraphs.length; i++) {
		const paragraph = paragraphs[i]
		const words = paragraph.split(' ')

		for (const word of words) {
			// If adding the next word exceeds the limit, push the tempStr to chunks
			if ((tempStr + word).length + 1 > CHAR_LIMIT) {
				chunks.push(tempStr.trim())
				tempStr = ''
			}
			tempStr += word + ' '
		}

		// Check if adding the next paragraph (including '\n\n') exceeds the limit, if so, push the current tempStr to chunks
		if (i < paragraphs.length - 1 && (tempStr + '\n\n' + paragraphs[i + 1]).length > CHAR_LIMIT) {
			chunks.push(tempStr.trim())
			tempStr = ''
		} else if (i < paragraphs.length - 1) {
			tempStr += '\n\n'
		}
	}

	// Push any remaining string to chunks
	if (tempStr.trim().length > 0) {
		chunks.push(tempStr.trim())
	}

	return chunks.filter(Boolean)
}

export function mockInteraction(
	channel: TextBasedChannel | null | undefined,
	member: GuildMember | null | undefined,
	args: Record<string, string>
) {
	// Create a mock CommandInteraction to pass to the function handler
	let interationMemberData: APIInteraction['member'] = undefined
	if (member) {
		interationMemberData = {
			user: {
				id: member.user.id,
				username: member.user.username,
				discriminator: member.user.discriminator,
				global_name: member.user.username,
				avatar: member.user.avatar
			},
			flags: (member?.flags ?? 0) as unknown as GuildMemberFlags,
			roles: member?.roles?.cache?.map((role) => role.id) ?? [],
			premium_since: member?.premiumSince?.toISOString() ?? null,
			permissions: member?.permissions?.bitfield?.toString() ?? '',
			pending: member?.pending ?? false,
			nick: member?.nickname,
			mute: false,
			joined_at: member?.joinedAt?.toISOString() ?? '',
			deaf: false
		}
	}
	const interactionData: APIInteraction = {
		id: Date.now().toString(),
		application_id: client.user?.id ?? 'mock',
		type: InteractionType.ApplicationCommand,
		app_permissions: member?.permissions?.bitfield?.toString() ?? '',
		channel: {
			id: channel?.id ?? '',
			type: channel?.type ?? 0
		},
		data: {
			type: ApplicationCommandType.ChatInput,
			name: 'mock',
			id: 'mock'
		},
		entitlements: [],
		guild_id: member?.guild?.id,
		channel_id: channel?.id ?? '',
		locale: 'en-US',
		member: interationMemberData,
		token: 'mock', // This should be a valid interaction token, but there's no way to mock this
		version: 1
	}

	// @ts-expect-error - Mock
	const interaction: CommandInteraction = new CommandInteraction(client, interactionData)
	interaction.options = {
		// @ts-expect-error - Mock
		get(key: string) {
			const val = args[key]

			return {
				get channel() {
					const result = member?.guild?.channels?.cache?.find((channel) => {
						return channel.name === val
					})

					// logger.debug(`Got channel for "${key}" value "${val}"`, result)
					return result
				},

				get member() {
					const result = member?.guild?.members?.cache?.find((member) => {
						return member.user.username === val?.replace('@', '')
					})

					// logger.debug(`Got member for "${key}" value "${val}"`, result)
					return result
				},

				get role() {
					const cleanValue = val.replace('@', '')
					const result = member?.guild?.roles?.cache?.find((role) => {
						return role.name === cleanValue
					})

					// logger.debug(`Got role for "${key}" value "${cleanValue}"`, result)
					return result
				},

				get user() {
					const result = member?.guild?.members?.cache?.find((member) => {
						return member.user.username === val?.replace('@', '')
					})?.user

					// logger.debug(`Got user for "${key}" value "${val}"`, result)
					return result
				},

				value: val
			}
		},

		getMember: (key: string) => {
			const userId = args[key].trim().replace(/\D/g, '').replace('@', '')
			return member?.guild?.members?.cache?.get(userId) ?? null
		},

		getUser: (key: string) => {
			const userId = args[key].trim().replace(/\D/g, '').replace('@', '')
			return member?.guild?.members?.cache?.get(userId)?.user as User
		}
	}

	let replyResolve: (content: string | InteractionReplyOptions) => void
	const replyPromise = new Promise((resolve) => {
		replyResolve = resolve
	})
	// @ts-expect-error - Mock
	interaction.deferReply = async () => {
		return mockMessage('', channel)
	}
	// @ts-expect-error - Mock
	interaction.reply = async (content: string | InteractionReplyOptions) => {
		replyResolve(content)
		return mockMessage(content, channel)
	}
	interaction.editReply = async (content: string | InteractionReplyOptions) => {
		replyResolve(content)
		return mockMessage(content, channel)
	}

	return { interaction, replyPromise }
}

export function mockMessage(
	content: string | InteractionReplyOptions,
	channel: TextBasedChannel | null | undefined
): Message {
	const messageData: APIMessage = {
		id: Date.now().toString(),
		type: 0,
		channel_id: channel?.id ?? '',
		content: typeof content === 'string' ? content : content.content ?? '',
		timestamp: new Date().toISOString(),
		edited_timestamp: null,
		tts: false,
		mention_everyone: false,
		mention_roles: [],
		mentions: [],
		pinned: false,
		attachments: [],
		embeds: [],
		author: {
			id: client.user?.id ?? 'mock',
			username: client.user?.username ?? 'mock',
			discriminator: client.user?.discriminator ?? '0',
			global_name: client.user?.username ?? 'mock',
			avatar: client.user?.avatar ?? 'mock'
		}
	}

	// @ts-expect-error - Private constructor
	return new Message(client, messageData)
}

export function replaceUsernamesWithIds(text: string, map: Record<string, string>): string {
	let result = ''
	let buffer = ''

	for (let i = 0; i < text.length; ++i) {
		if (text[i] === '@') {
			if (buffer in map) {
				result += `<@${map[buffer]}>`
			} else {
				result += buffer
			}
			buffer = ''
		} else if (text[i].match(/\b/)) {
			buffer += text[i]
		} else {
			if (buffer in map) {
				result += `<@${map[buffer]}>`
			} else {
				result += buffer
			}
			buffer = text[i]
		}
	}

	if (buffer in map) {
		result += `<@${map[buffer]}>`
	} else {
		result += buffer
	}

	return result
}
