const { ChannelType } = require('discord.js');
const logger = require('../../core/logger');
const discordConfig = require('../../config/discord');
const guildConfigStore = require('../../storage/guildConfig.store');
const panelManager = require('../panel/PanelManager');
const panelService = require('../../rust/services/panel.service');

/**
 * Discord ready event
 * Fires when the bot successfully connects to Discord
 */
module.exports = {
  name: 'clientReady',
  once: true,

  async execute(client) {
    logger.success(`Discord bot logged in as ${client.user.tag}`);
    logger.info(`Bot is ready and serving ${client.guilds.cache.size} guilds`);

    // Set bot status
    client.user.setPresence({
      activities: [{ name: 'Rust servers', type: 3 }], // Type 3 = Watching
      status: 'online',
    });

    // Ensure status channel exists in all guilds
    await createStatusChannels(client);

    // Create test-commands-bot channel in all guilds
    await createTestChannels(client);

    // Resume panel auto-updates where enabled
    await resumePanels(client);
  },
};

/**
 * Ensure rust-status channel exists in all guilds
 */
async function createStatusChannels(client) {
  const channelName = discordConfig.STATUS_CHANNEL_NAME;

  for (const [, guild] of client.guilds.cache) {
    try {
      const existingChannel = guild.channels.cache.find(
        channel => channel.name === channelName && channel.type === ChannelType.GuildText
      );

      let statusChannel = existingChannel;

      if (statusChannel) {
        logger.info(`Reusing status channel "${channelName}" in guild: ${guild.name}`);
      } else {
        statusChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          topic: 'Rust status dashboard',
        });

        logger.success(`Created status channel "${channelName}" in guild: ${guild.name}`);
      }

      guildConfigStore.setStatusChannelId(guild.id, statusChannel.id);
      logger.info(
        `Stored status channel for guild: ${guild.name} (${guild.id}) -> ${statusChannel.id}`
      );
    } catch (error) {
      logger.error(`Failed to create status channel in guild: ${guild.name}`, {
        error: error.message,
      });
    }
  }
}

async function resumePanels(client) {
  for (const [, guild] of client.guilds.cache) {
    try {
      // Ensure status channel exists and message is reachable (will recreate if missing)
      const channel = await panelManager.ensureStatusChannel(guild);
      const message = await panelManager.ensurePanelMessage(guild, channel);

      panelManager.startAutoUpdate(
        guild,
        async () => {
          const data = await panelService.getPanelData();
          await panelManager.updatePanel(guild, data);
        },
        discordConfig.DEFAULT_PANEL_INTERVAL_SECONDS
      );

      guildConfigStore.setStatusPanelMessageId(guild.id, message.id);
      guildConfigStore.setPanelEnabled(guild.id, true);

      logger.info(`Resumed/started panel updates for guild: ${guild.name}`);
    } catch (error) {
      logger.error(`Failed to resume panel for guild: ${guild.name}`, { error: error.message });
    }
  }
}

/**
 * Create test-commands-bot channel in all guilds if it doesn't exist
 */
async function createTestChannels(client) {
  const channelName = discordConfig.channels.testCommandsBot;

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      // Check if channel already exists
      const existingChannel = guild.channels.cache.find(
        channel => channel.name === channelName && channel.type === ChannelType.GuildText
      );

      if (existingChannel) {
        logger.info(`Channel "${channelName}" already exists in guild: ${guild.name}`);
        continue;
      }

      // Create the channel
      const newChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        topic: 'Bot commands and testing',
      });

      logger.success(`Created channel "${channelName}" in guild: ${guild.name}`);
    } catch (error) {
      logger.error(`Failed to create channel in guild: ${guild.name}`, {
        error: error.message,
      });
    }
  }
}
