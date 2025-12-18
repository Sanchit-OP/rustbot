const { GatewayIntentBits, Partials } = require('discord.js');

const STATUS_CHANNEL_NAME = 'rust-status';
const DEFAULT_PANEL_INTERVAL_SECONDS = 60;

/**
 * Discord client configuration
 */
const discordConfig = {
  // Client options for Discord.js
  clientOptions: {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  },

  // Channel configuration
  channels: {
    status: STATUS_CHANNEL_NAME,
    testCommandsBot: 'test-commands-bot',
  },

  // Command configuration
  commands: {
    deployGlobally: false, // Set to true to deploy commands globally instead of per-guild
  },
};

module.exports = {
  ...discordConfig,
  STATUS_CHANNEL_NAME,
  DEFAULT_PANEL_INTERVAL_SECONDS,
};
