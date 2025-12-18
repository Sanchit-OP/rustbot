const logger = require('../../core/logger');
const discordClient = require('../client');
const guildConfigStore = require('../../storage/guildConfig.store');
const statusChannelGuard = require('../guards/statusChannel.guard');

/**
 * Discord interactionCreate event
 * Handles slash command interactions
 */
module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction) {
    // Only handle slash commands
    if (!interaction.isChatInputCommand()) return;

    const command = discordClient.getCommand(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      const guildConfig = interaction.guildId
        ? guildConfigStore.getConfig(interaction.guildId)
        : null;

      const allowed = await statusChannelGuard(interaction, guildConfig);
      if (!allowed) {
        return;
      }

      logger.info(`Executing command: ${interaction.commandName}`, {
        user: interaction.user.tag,
        guild: interaction.guild?.name || 'DM',
      });

      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command: ${interaction.commandName}`, {
        error: error.message,
        stack: error.stack,
      });

      const errorMessage = {
        content: 'There was an error executing this command!',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};
