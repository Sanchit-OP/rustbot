const RustClient = require('./RustClient');
const logger = require('../../core/logger');
const env = require('../../config/env');

/**
 * Manages Rust+ connections
 * Singleton that maintains the connection to the Rust server
 */
class RustConnectionManager {
  constructor() {
    this.client = null;
  }

  /**
   * Initialize the Rust client
   */
  initialize() {
    if (this.client) {
      logger.warn('Rust client already initialized');
      return;
    }

    const { serverIp, serverPort, playerId, playerToken } = env.rust;

    this.client = new RustClient(serverIp, serverPort, playerId, playerToken);
    logger.info('Rust connection manager initialized');
  }

  /**
   * Get the Rust client instance
   */
  getClient() {
    if (!this.client) {
      throw new Error('Rust client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Connect to the Rust server
   */
  async connect() {
    const client = this.getClient();
    await client.connect();
  }

  /**
   * Disconnect from the Rust server
   */
  disconnect() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    if (!this.client) {
      return {
        isConnected: false,
        isConnecting: false,
        serverIp: null,
        serverPort: null,
      };
    }
    return this.client.getConnectionStatus();
  }
}

// Export singleton instance
module.exports = new RustConnectionManager();
