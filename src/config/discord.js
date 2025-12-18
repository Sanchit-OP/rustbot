const { GatewayIntentBits, Partials } = require('discord.js');

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
    testCommandsBot: 'test-commands-bot',
  },

  // Command configuration
  commands: {
    deployGlobally: false, // Set to true to deploy commands globally instead of per-guild
  },
};

module.exports = discordConfig;
