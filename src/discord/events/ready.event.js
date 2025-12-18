const { ChannelType } = require('discord.js');
const logger = require('../../core/logger');
const discordConfig = require('../../config/discord');

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

    // Create test-commands-bot channel in all guilds
    await createTestChannels(client);
  },
};

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
