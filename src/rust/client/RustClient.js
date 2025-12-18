const RustPlus = require('@liamcottle/rustplus.js');
const logger = require('../../core/logger');
const eventBus = require('../../core/eventBus');

/**
 * Wrapper around RustPlus client
 * Handles connection to a single Rust server
 */
class RustClient {
  constructor(serverIp, serverPort, playerId, playerToken) {
    this.serverIp = serverIp;
    this.serverPort = serverPort;
    this.playerId = playerId;
    this.playerToken = playerToken;
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * Connect to the Rust server
   */
  async connect() {
    if (this.isConnected || this.isConnecting) {
      logger.warn('Already connected or connecting to Rust server');
      return;
    }

    this.isConnecting = true;

    try {
      logger.info('Connecting to Rust server...', {
        ip: this.serverIp,
        port: this.serverPort,
      });

      this.client = new RustPlus(
        this.serverIp,
        this.serverPort,
        this.playerId,
        this.playerToken
      );

      // Set up event listeners
      this.setupEventListeners();

      // Connect to the server and wait for 'connected' event
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.client.once('connected', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.isConnecting = false;
          resolve();
        });

        this.client.once('error', (error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.isConnected = false;
          reject(error);
        });

        this.client.connect();
      });

      logger.success('Connected to Rust server');
      eventBus.emitEvent('rust:connected', {
        ip: this.serverIp,
        port: this.serverPort,
      });
    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      logger.error('Failed to connect to Rust server', { error: error.message });
      eventBus.emitEvent('rust:connection_failed', {
        ip: this.serverIp,
        port: this.serverPort,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Set up event listeners for the Rust client
   */
  setupEventListeners() {
    if (!this.client) return;

    this.client.on('connected', () => {
      logger.info('Rust client connected event received');
    });

    this.client.on('disconnected', () => {
      this.isConnected = false;
      logger.warn('Disconnected from Rust server');
      eventBus.emitEvent('rust:disconnected', {
        ip: this.serverIp,
        port: this.serverPort,
      });
    });

    this.client.on('error', (error) => {
      logger.error('Rust client error', { error: error.message });
      eventBus.emitEvent('rust:error', {
        ip: this.serverIp,
        port: this.serverPort,
        error: error.message,
      });
    });
  }

  /**
   * Get server info
   */
  async getInfo() {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to Rust server');
    }

    try {
      const response = await this.client.sendRequestAsync({
        getInfo: {}
      }, 10000);
      return response.info;
    } catch (error) {
      logger.error('Failed to get server info', { error: error.message });
      throw error;
    }
  }

  /**
   * Get server time
   */
  async getTime() {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to Rust server');
    }

    try {
      const response = await this.client.sendRequestAsync({
        getTime: {}
      }, 10000);
      return response.time;
    } catch (error) {
      logger.error('Failed to get server time', { error: error.message });
      throw error;
    }
  }

  /**
   * Get team information
   */
  async getTeamInfo() {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to Rust server');
    }

    try {
      const response = await this.client.sendRequestAsync(
        {
          getTeamInfo: {},
        },
        10000
      );
      return response.teamInfo;
    } catch (error) {
      // Some servers may not have team info; return null instead of crashing.
      logger.warn('Failed to get team info; returning null', { error: error.message });
      return null;
    }
  }

  /**
   * Disconnect from the Rust server
   */
  disconnect() {
    if (this.client) {
      this.client.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from Rust server');
    }
  }

  /**
   * Check if connected
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      serverIp: this.serverIp,
      serverPort: this.serverPort,
    };
  }
}

module.exports = RustClient;
