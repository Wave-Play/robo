import { Channel, ChannelType , EmbedBuilder, ForumChannel, Message, MessagePayload, ThreadChannel } from "discord.js";
import { Flashcore, client, logger } from "robo.js";
import { ModalProperties } from "../types";

export default async (message: Message) => {
    if(message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.PrivateThread){
        if(message.author.bot){
            return;
        }
        const threadUserData = await retrieveModmailDataFromFlashcore(message.channelId, "")

        if(threadUserData){
            const modalOptions = await Flashcore.get<ModalProperties>('modmail_modal_custom_message');

            const embedded = new EmbedBuilder()
                .setTitle(modalOptions?.title ? modalOptions.title : 'Moderation')
                .setColor("Blue")
                .setDescription(message.content.length > 0 ? message.content : ' ')                
                .setFooter({
                     text: modalOptions?.footer ? modalOptions?.footer : "The lovely moderation team ^.^"
                })

                
                const user = await client.users.fetch(threadUserData.userId)
                if(user){
                    user.send({embeds: [embedded], files: [...message.attachments.map((attach) => attach.url)]});
                }
        }
        return;
    }
    if(message.channel.type === ChannelType.DM && !message.author.bot){
        const modmailChannel = await Flashcore.get<string>('modmail_forum');

        if(!modmailChannel) {
            return message.reply({content: 'Please contact the adminstrators of the server to set a modmail channel using the /modmail channel command.', options: {ephemeral: true}})
        }

        const ForumMail = await client.channels.fetch(modmailChannel);
        if(ForumMail && ForumMail.type === ChannelType.GuildForum){
            const hasAlreadyAThread = await createOrFetchThreadChannel(message, ForumMail);

            if(!hasAlreadyAThread){
                const modalOptions = await Flashcore.get<ModalProperties>('modmail_modal_custom_intro');

                const embedded = new EmbedBuilder()
                .setTitle(modalOptions?.title ? modalOptions?.title : 'Thread created')
                .setColor("Blue")
                .setDescription(modalOptions?.description ? modalOptions.description : 'Please state your issues.')
                .setFooter({
                     text: modalOptions?.footer ? modalOptions?.footer : "The lovely moderation team ^.^"
                })
                return message.reply({embeds: [embedded]})
            } else {
                if(hasAlreadyAThread instanceof ThreadChannel){
                    return hasAlreadyAThread.send({
                        content: message.content.length > 0 ? message.content : ' ',
                        files: [...message.attachments.map((attach) => attach.url)]
                    })
                }
            }
        }
        
    }

}

const createOrFetchThreadChannel = async (message: Message, Forum: any): Promise<ThreadChannel | boolean> => {
    const user = await retrieveModmailDataFromFlashcore("", message.author.id)

    if(!user){
        const newThread = await Forum.threads.create({  
            name: message.author.displayName,
            message: {content: message.content}
         })
         await saveModmailDataToFlashcore(newThread.id, message.author.id)
         return false;
    } else {
        const threads = (await Forum.threads.fetch()).threads
        const userThread = threads.find((thread: ThreadChannel) => thread.id === user.threadId)
        return userThread;
    }
}



type ModMailUserData = {
    threadId: string,
    userId: string
}

const retrieveModmailDataFromFlashcore = async (thread: string, userId: string) => {
    const user = await Flashcore.get<ModMailUserData>(thread ? thread : userId, {
        namespace: 'modmail_thread'
    })

    return user;
}


const saveModmailDataToFlashcore = async (threadId: string, userId: string) => {
    await Flashcore.set<ModMailUserData>(threadId, {
        threadId: threadId,
        userId: userId
     }, {
        namespace: 'modmail_thread'
     })
     await Flashcore.set<ModMailUserData>(userId, {
        threadId: threadId,
        userId: userId
     }, {
        namespace: 'modmail_thread'
     })

}