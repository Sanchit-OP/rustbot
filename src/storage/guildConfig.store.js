/**
 * Guild configuration storage
 * This is a placeholder for future persistence layer
 * Can be extended to store guild-specific settings in a database
 */

class GuildConfigStore {
  constructor() {
    // In-memory storage for now
    // In the future, this could be replaced with a database
    this.configs = new Map();
  }

  /**
   * Get configuration for a guild
   */
  getConfig(guildId) {
    return this.configs.get(guildId) || this.getDefaultConfig();
  }

  /**
   * Get status channel id for a guild
   */
  getStatusChannelId(guildId) {
    return this.getConfig(guildId).statusChannelId;
  }

  /**
   * Set configuration for a guild
   */
  setConfig(guildId, config) {
    const currentConfig = this.getConfig(guildId);
    this.configs.set(guildId, { ...currentConfig, ...config });
  }

  /**
   * Set status channel id for a guild
   */
  setStatusChannelId(guildId, statusChannelId) {
    const currentConfig = this.getConfig(guildId);
    this.setConfig(guildId, { ...currentConfig, statusChannelId });
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      prefix: '!',
      rustServerEnabled: true,
      notificationChannel: null,
      statusChannelId: null,
    };
  }

  /**
   * Clear all configurations
   */
  clear() {
    this.configs.clear();
  }
}

// Export singleton instance
module.exports = new GuildConfigStore();
