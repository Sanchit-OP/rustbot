/**
 * Guild configuration storage
 * This is a placeholder for future persistence layer
 * Can be extended to store guild-specific settings in a database
 */

const fs = require('fs');
const path = require('path');

class GuildConfigStore {
  constructor() {
    this.configs = new Map();
    this.storagePath = path.resolve(__dirname, '../../data/guildConfig.json');
    this.loadFromDisk();
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
   * Get status panel message id for a guild
   */
  getStatusPanelMessageId(guildId) {
    return this.getConfig(guildId).statusPanelMessageId;
  }

  /**
   * Get panel enabled flag for a guild
   */
  isPanelEnabled(guildId) {
    return Boolean(this.getConfig(guildId).panelEnabled);
  }

  /**
   * Set configuration for a guild
   */
  setConfig(guildId, config) {
    const currentConfig = this.getConfig(guildId);
    this.configs.set(guildId, { ...currentConfig, ...config });
    this.saveToDisk();
  }

  /**
   * Set status channel id for a guild
   */
  setStatusChannelId(guildId, statusChannelId) {
    const currentConfig = this.getConfig(guildId);
    this.setConfig(guildId, { ...currentConfig, statusChannelId });
  }

  /**
   * Set status panel message id for a guild
   */
  setStatusPanelMessageId(guildId, statusPanelMessageId) {
    const currentConfig = this.getConfig(guildId);
    this.setConfig(guildId, { ...currentConfig, statusPanelMessageId });
  }

  /**
   * Set panel enabled flag for a guild
   */
  setPanelEnabled(guildId, panelEnabled) {
    const currentConfig = this.getConfig(guildId);
    this.setConfig(guildId, { ...currentConfig, panelEnabled });
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
      statusPanelMessageId: null,
      panelEnabled: false,
    };
  }

  loadFromDisk() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(this.storagePath)) {
        return;
      }
      const raw = fs.readFileSync(this.storagePath, 'utf-8');
      const data = JSON.parse(raw);
      Object.entries(data || {}).forEach(([guildId, config]) => {
        this.configs.set(guildId, { ...this.getDefaultConfig(), ...config });
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load guild config store from disk', error.message);
    }
  }

  saveToDisk() {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const serializable = {};
      for (const [guildId, config] of this.configs.entries()) {
        serializable[guildId] = config;
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(serializable, null, 2), 'utf-8');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to save guild config store to disk', error.message);
    }
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
