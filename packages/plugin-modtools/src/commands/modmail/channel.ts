import { ChannelType, CommandInteraction, PermissionFlagsBits } from "discord.js"
import { CommandConfig, CommandResult, Flashcore, client } from "robo.js"

export const config: CommandConfig = {
	defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
	dmPermission: false,
	description: `Set the forum channel in which modmail will send the mails.`,
	options: [
		{
			name: 'modmail',
			description: 'id of the Forum channel for modmail',
			type: 'string',
			required: true
		}
	]
}



export default async (interaction: CommandInteraction): Promise<CommandResult> => {
    const option = interaction.options.get('modmail')?.value


    if(option){
        const channel = await client.channels.fetch(option.toString())

        if(channel && channel.type !== ChannelType.GuildForum){
            return {content: 'Please, input the id of a Forum channel.', ephemeral: true};
        }

        await Flashcore.set<string>('modmail_forum', option.toString());

        return {content: 'Modmail Forum has been correctly set !.', ephemeral: true}
    }

    return {content: 'An error happened while executing the command, please try again or contact an Administrator.'}
}