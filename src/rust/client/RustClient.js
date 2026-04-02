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
    this.connectPromise = null;
    this.clientEventHandlers = new WeakMap();
  }

  /**
   * Connect to the Rust server
   */
  async connect() {
    if (this.isConnected) {
      logger.debug('Rust client already connected');
      return;
    }

    if (this.connectPromise) {
      logger.info('Rust connect() called while a connection attempt is already in flight');
      return this.connectPromise;
    }

    this.connectPromise = this.connectInternal().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  async connectInternal() {
    this.isConnecting = true;
    this.isConnected = false;

    const previousClient = this.client;
    if (previousClient) {
      this.cleanupClient(previousClient, { shouldDisconnect: true, clearCurrent: true });
    }

    const nextClient = new RustPlus(
      this.serverIp,
      this.serverPort,
      this.playerId,
      this.playerToken
    );

    this.client = nextClient;
    this.setupEventListeners(nextClient);

    try {
      logger.info('Connecting to Rust server...', {
        ip: this.serverIp,
        port: this.serverPort,
      });

      await this.awaitInitialConnection(nextClient);

      this.isConnected = true;
      logger.success('Connected to Rust server');
      eventBus.emitEvent('rust:connected', {
        ip: this.serverIp,
        port: this.serverPort,
      });
    } catch (error) {
      this.isConnected = false;
      const hint = getConnectionHint(error);
      const message = getErrorMessage(error);
      logger.error('Failed to connect to Rust server', {
        error: message,
        hint: hint || undefined,
      });
      eventBus.emitEvent('rust:connection_failed', {
        ip: this.serverIp,
        port: this.serverPort,
        error: message,
        hint: hint || undefined,
      });

      if (this.client === nextClient) {
        this.cleanupClient(nextClient, { shouldDisconnect: true, clearCurrent: true });
      }

      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  awaitInitialConnection(clientInstance) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        finalize(new Error('Connection timeout'));
      }, 10000);

      const onConnected = () => {
        finalize(null);
      };

      const onError = (error) => {
        finalize(error);
      };

      const finalize = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        clientInstance.off('connected', onConnected);
        clientInstance.off('error', onError);
        if (error) {
          reject(error);
          return;
        }
        resolve();
      };

      clientInstance.once('connected', onConnected);
      clientInstance.once('error', onError);
      clientInstance.connect();
    });
  }

  /**
   * Set up event listeners for the Rust client
   */
  setupEventListeners(clientInstance) {
    if (!clientInstance) return;

    const onConnected = () => {
      if (clientInstance !== this.client) return;
      logger.info('Rust client connected event received');
    };

    const onDisconnected = () => {
      if (clientInstance !== this.client) return;
      this.isConnected = false;
      logger.warn('Disconnected from Rust server');
      eventBus.emitEvent('rust:disconnected', {
        ip: this.serverIp,
        port: this.serverPort,
      });
    };

    const onError = (error) => {
      if (clientInstance !== this.client) return;
      const message = getErrorMessage(error);
      logger.error('Rust client error', { error: message });
      eventBus.emitEvent('rust:error', {
        ip: this.serverIp,
        port: this.serverPort,
        error: message,
      });
    };

    this.clientEventHandlers.set(clientInstance, {
      onConnected,
      onDisconnected,
      onError,
    });

    clientInstance.on('connected', onConnected);
    clientInstance.on('disconnected', onDisconnected);
    clientInstance.on('error', onError);
  }

  cleanupClient(clientInstance, { shouldDisconnect = true, clearCurrent = false } = {}) {
    if (!clientInstance) return;

    const handlers = this.clientEventHandlers.get(clientInstance);
    if (handlers) {
      clientInstance.off('connected', handlers.onConnected);
      clientInstance.off('disconnected', handlers.onDisconnected);
      clientInstance.off('error', handlers.onError);
      this.clientEventHandlers.delete(clientInstance);
    }

    if (shouldDisconnect) {
      try {
        clientInstance.disconnect();
      } catch (error) {
        logger.warn('Failed to disconnect stale Rust client instance cleanly', {
          error: getErrorMessage(error),
        });
      }
    }

    if (clearCurrent && this.client === clientInstance) {
      this.client = null;
    }
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
      logger.error('Failed to get server info', { error: getErrorMessage(error) });
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
      logger.error('Failed to get server time', { error: getErrorMessage(error) });
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
      logger.warn('Failed to get team info; returning null', { error: getErrorMessage(error) });
      return null;
    }
  }

  /**
   * Send a message to Rust team chat.
   */
  async sendTeamMessage(message) {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to Rust server');
    }

    const text = String(message || '').trim();
    if (!text) {
      return;
    }

    try {
      await this.client.sendRequestAsync(
        {
          sendTeamMessage: {
            message: text.slice(0, 200),
          },
        },
        10000
      );
    } catch (error) {
      logger.error('Failed to send Rust team chat message', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Disconnect from the Rust server
   */
  disconnect() {
    if (this.client) {
      const activeClient = this.client;
      this.cleanupClient(activeClient, {
        shouldDisconnect: true,
        clearCurrent: true,
      });
      this.isConnected = false;
      this.isConnecting = false;
      this.connectPromise = null;
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

function getConnectionHint(error) {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes('parse error: expected http/')) {
    return 'Likely wrong port/protocol. Configure RUST_SERVER_PORT to Rust+ app.port, not the game/query port.';
  }

  return null;
}

function getErrorMessage(error) {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.error && typeof error.error === 'string') {
    return error.error;
  }

  if (error?.message && typeof error.message === 'string') {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch (jsonError) {
    return String(error);
  }
}
