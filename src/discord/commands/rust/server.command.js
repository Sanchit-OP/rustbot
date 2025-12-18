const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Show Rust server information'),

  async execute(interaction) {
    await interaction.reply({
      content: 'Server command placeholder. Functionality coming soon.',
      ephemeral: true,
    });
  },
};
