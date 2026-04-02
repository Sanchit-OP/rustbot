const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const statusService = require('../../rust/services/status.service');
const logger = require('../../core/logger');
const {
  safeDeferReply,
  safeEditReply,
  safeReply,
} = require('../utils/interactionResponse');

/**
 * /status command
 * Checks the status of the Rust server
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check the status of the Rust server'),

  async execute(interaction) {
    try {
      // Defer reply since this might take a moment
      await safeDeferReply(interaction, undefined, 'status.command.defer');

      logger.info(`Status command executed by ${interaction.user.tag}`);

      // Get server status from the service layer
      const status = await statusService.checkServerStatus();

      if (status.success) {
        // Create embed for successful status
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('Rust Server Status')
          .setDescription(`**${status.serverName}**`)
          .addFields(
            { name: 'Players', value: status.players, inline: true },
            { name: 'Map', value: status.map, inline: true },
            { name: 'Map Size', value: `${status.mapSize}`, inline: true },
            { name: 'Game Time', value: status.gameTime, inline: true },
            { name: 'Last Wipe', value: status.wipeTime, inline: true },
            { name: 'Server', value: `${status.serverIp}:${status.serverPort}`, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Rust+ Bot' });

        await safeEditReply(interaction, { embeds: [embed] }, 'status.command.success');
      } else {
        // Create embed for failed status
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('Connection Failed')
          .setDescription(status.message || 'Failed to connect to Rust server')
          .addFields(
            { name: 'Error', value: status.error || 'Unknown error' }
          )
          .setTimestamp()
          .setFooter({ text: 'Rust+ Bot' });

        await safeEditReply(interaction, { embeds: [embed] }, 'status.command.failure');
      }
    } catch (error) {
      logger.error('Error executing status command', { error: error.message });

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('Error')
        .setDescription('An error occurred while checking server status')
        .addFields(
          { name: 'Error', value: error.message }
        )
        .setTimestamp();

      if (interaction.deferred || interaction.replied) {
        await safeEditReply(interaction, { embeds: [errorEmbed] }, 'status.command.catch');
      } else {
        await safeReply(
          interaction,
          { embeds: [errorEmbed], flags: MessageFlags.Ephemeral },
          'status.command.catch'
        );
      }
    }
  },
};
