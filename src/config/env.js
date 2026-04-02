const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function parseCsv(input) {
  if (!input) return [];
  return input
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

/**
 * Central environment configuration
 * All environment variables are accessed through this module
 */
const env = {
  // Node environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Discord configuration
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
  },

  // Rust+ configuration
  rust: {
    serverIp: process.env.RUST_SERVER_IP,
    serverPort: parseInt(process.env.RUST_SERVER_PORT, 10),
    playerId: process.env.RUST_PLAYER_ID,
    playerToken: parseInt(process.env.RUST_PLAYER_TOKEN, 10),
    chatCommandPrefix: process.env.RUST_CHAT_COMMAND_PREFIX || '!',
    chatAllowedSteamIds: parseCsv(process.env.RUST_CHAT_ALLOWED_STEAM_IDS),
    mapMarkersPollSeconds: parseInt(process.env.RUST_MAP_MARKERS_POLL_SECONDS || '12', 10),
  },

  // Validation
  validate() {
    const required = [
      { key: 'DISCORD_BOT_TOKEN', value: this.discord.botToken },
      { key: 'DISCORD_CLIENT_ID', value: this.discord.clientId },
      { key: 'RUST_SERVER_IP', value: this.rust.serverIp },
      { key: 'RUST_SERVER_PORT', value: this.rust.serverPort },
      { key: 'RUST_PLAYER_ID', value: this.rust.playerId },
      { key: 'RUST_PLAYER_TOKEN', value: this.rust.playerToken },
    ];

    const missing = required.filter(({ value }) => !value);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.map(({ key }) => key).join(', ')}`
      );
    }

    return true;
  },
};

module.exports = env;
