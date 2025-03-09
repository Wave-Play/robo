import { ModalSubmitInteraction, } from 'discord.js';
import { Flashcore } from 'robo.js';
import { ModalProperties } from '../../types';

export default async (interaction: ModalSubmitInteraction) => {

    if (!interaction.isModalSubmit()) return;
    if (interaction.customId === 'modmail_modal_chatting') {
        const title = interaction.fields.getTextInputValue('title');
        const footer = interaction.fields.getTextInputValue('footer');

       await Flashcore.set<ModalProperties>('modmail_modal_custom_message', {
        title,
        footer,
       })
       return await interaction.reply({content: 'Custom embed for the modmail message has been defined.', ephemeral: true})
    }
    if (interaction.customId === 'modmail_modal_intro') {
        const title = interaction.fields.getTextInputValue('title');
        const footer = interaction.fields.getTextInputValue('footer');
        const description = interaction.fields.getTextInputValue('description')

       await Flashcore.set<ModalProperties>('modmail_modal_custom_intro', {
        title,
        description,
        footer,
       })

       return await interaction.reply({content: 'Custom embed for the intro modmail message has been defined.', ephemeral: true})
    }

}