const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Manage the Rust status panel'),

  async execute(interaction) {
    await interaction.reply({
      content: 'Panel command placeholder. Functionality coming soon.',
      ephemeral: true,
    });
  },
};
