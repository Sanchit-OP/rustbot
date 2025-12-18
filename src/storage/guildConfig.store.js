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
   * Set configuration for a guild
   */
  setConfig(guildId, config) {
    this.configs.set(guildId, { ...this.getDefaultConfig(), ...config });
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      prefix: '!',
      rustServerEnabled: true,
      notificationChannel: null,
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
