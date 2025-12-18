const RustClient = require('./RustClient');
const logger = require('../../core/logger');
const env = require('../../config/env');

/**
 * Manages Rust+ connections
 * Singleton that maintains the connection to the Rust server
 * 
 * CONNECTION OWNERSHIP RULES:
 * ---------------------------
 * 1. Rust connections are LONG-LIVED and OWNED by RustConnectionManager
 * 2. Commands (like /status) must NEVER call connect() directly
 * 3. Only the manager decides when to connect/reconnect/disconnect
 * 4. Services can REQUEST DATA, not manage connection state
 * 
 * CONNECTION STRATEGY: HYBRID
 * ---------------------------
 * - Connect on first Rust command (lazy initialization)
 * - Keep connection alive for subsequent requests
 * - Auto-reconnect on disconnection
 * - This ensures reliability for alarms, chat sync, and real-time features
 */
class RustConnectionManager {
  constructor() {
    this.client = null;
    this.connectionStrategy = 'hybrid'; // lazy connect on first use, then keep alive
    this.autoReconnect = true;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5 seconds
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
    logger.info('Rust connection manager initialized with HYBRID strategy');
    logger.info('Connection will be established on first Rust command and kept alive');
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
   * Ensure connection is established
   * This is the ONLY method that should be called by services
   * It handles the connection lifecycle automatically
   */
  async ensureConnected() {
    const client = this.getClient();
    const status = client.getConnectionStatus();

    // If already connected, return immediately
    if (status.isConnected) {
      return;
    }

    // If currently connecting, wait for it
    if (status.isConnecting) {
      logger.info('Connection already in progress, waiting...');
      // Wait for connection to complete (max 15 seconds)
      const maxWait = 15000;
      const startTime = Date.now();
      while (Date.now() - startTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (client.getConnectionStatus().isConnected) {
          return;
        }
      }
      throw new Error('Connection timeout while waiting for existing connection');
    }

    // Otherwise, establish new connection
    await this.connect();
  }

  /**
   * Connect to the Rust server
   * PRIVATE: Only called internally by ensureConnected()
   */
  async connect() {
    const client = this.getClient();
    await client.connect();
    this.reconnectAttempts = 0; // Reset on successful connection
  }

  /**
   * Disconnect from the Rust server
   */
  disconnect() {
    if (this.client) {
      this.autoReconnect = false; // Disable auto-reconnect on manual disconnect
      this.client.disconnect();
      logger.info('Rust connection manually disconnected');
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

  /**
   * Handle automatic reconnection
   * Called when connection is lost unexpectedly
   */
  async handleReconnect() {
    if (!this.autoReconnect) {
      logger.info('Auto-reconnect disabled, not attempting reconnection');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

    try {
      await this.connect();
      logger.success('Reconnection successful');
    } catch (error) {
      logger.error('Reconnection failed', { error: error.message });
      // Try again
      await this.handleReconnect();
    }
  }
}

// Export singleton instance
module.exports = new RustConnectionManager();
