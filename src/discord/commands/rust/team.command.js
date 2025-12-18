const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('Show Rust team information'),

  async execute(interaction) {
    await interaction.reply({
      content: 'Team command placeholder. Functionality coming soon.',
      ephemeral: true,
    });
  },
};
