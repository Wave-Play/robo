import { ActionRowBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { CommandConfig, CommandResult } from "robo.js";

export const config: CommandConfig = {
    description: "Customise the Title and Footer of mod DMs",
    sage: {
        defer: false
    }
};

export default async (interaction: ChatInputCommandInteraction): Promise<CommandResult> => {
    if (interaction.guild === null) return;
    
    const modal = new ModalBuilder()
    .setCustomId('modmail_modal_chatting')

    const one = new TextInputBuilder()
        .setCustomId('title')
        .setLabel("The Title")
        .setMaxLength(100)
        .setPlaceholder('Title of the embed that get sent')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);

    const two = new TextInputBuilder()
        .setCustomId('footer')
        .setLabel("The Footer")
        .setMaxLength(100)
        .setPlaceholder('footer of embeds that get sent')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);


    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(one);
    const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(two);


    modal.addComponents(firstActionRow, secondActionRow);
    await interaction.showModal(modal);
}