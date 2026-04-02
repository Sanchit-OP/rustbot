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
    this.reconnectDelay = 5000; // Base delay in ms (backoff applied)
    this.maxReconnectDelay = 30000;
    this.connectPromise = null;
    this.reconnectLoopPromise = null;
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
    this.autoReconnect = true;
    this.reconnectAttempts = 0;
    this.connectPromise = null;
    this.reconnectLoopPromise = null;
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

    await this.connectWithSingleflight('ensureConnected');
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
   * Ensure only one connect attempt is in flight at any time.
   */
  async connectWithSingleflight(reason = 'unspecified') {
    if (this.connectPromise) {
      logger.info('Rust connection attempt already in flight; awaiting existing attempt', {
        reason,
      });
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      await this.connect();
    })().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  /**
   * Disconnect from the Rust server
   */
  disconnect() {
    if (this.client) {
      this.autoReconnect = false; // Disable auto-reconnect on manual disconnect
      this.reconnectAttempts = 0;
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

    if (this.reconnectLoopPromise) {
      logger.info('Reconnect loop already active; skipping duplicate trigger');
      return this.reconnectLoopPromise;
    }

    this.reconnectLoopPromise = this.runReconnectLoop().finally(() => {
      this.reconnectLoopPromise = null;
    });

    return this.reconnectLoopPromise;
  }

  async runReconnectLoop() {
    while (this.autoReconnect) {
      const status = this.getStatus();
      if (status.isConnected) {
        return;
      }

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
        return;
      }

      this.reconnectAttempts++;
      const attempt = this.reconnectAttempts;
      const delay = Math.min(
        this.reconnectDelay * 2 ** Math.max(0, attempt - 1),
        this.maxReconnectDelay
      );

      logger.info(`Attempting to reconnect (${attempt}/${this.maxReconnectAttempts})...`, {
        delayMs: delay,
      });

      await sleep(delay);

      if (!this.autoReconnect) {
        return;
      }

      try {
        await this.connectWithSingleflight('reconnect');
        logger.success('Reconnection successful');
        return;
      } catch (error) {
        if (isNonRetryableConnectionError(error)) {
          logger.error('Reconnection aborted due to non-retryable configuration/network mismatch', {
            attempt,
            error: getErrorMessage(error),
          });
          return;
        }

        logger.error('Reconnection failed', {
          attempt,
          error: getErrorMessage(error),
        });
      }
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isNonRetryableConnectionError(error) {
  const message = getErrorMessage(error).toLowerCase();
  if (!message) return false;

  // Usually means HTTP/game/query port was used instead of Rust+ app port.
  if (message.includes('parse error: expected http/')) {
    return true;
  }

  // Usually means player credentials are not valid for this server pairing.
  if (message.includes('not_found')) {
    return true;
  }

  return false;
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

// Export singleton instance
module.exports = new RustConnectionManager();
