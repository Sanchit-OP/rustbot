const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const rustConnectionManager = require('../client/RustConnectionManager');

/**
 * Rust connection event handlers
 * These handlers respond to Rust connection events
 */

// Handle successful connection — fetch server info to get live mapSize
eventBus.subscribe('rust:connected', async (data) => {
  logger.success('Rust connection established', {
    ip: data.ip,
    port: data.port,
  });

  try {
    const client = rustConnectionManager.getClient();
    const info = await client.getInfo();
    const mapSize = info?.mapSize || info?.size;
    if (mapSize && Number.isFinite(mapSize) && mapSize > 0) {
      eventBus.emitEvent('rust:server_info', { mapSize });
      logger.info(`Map size fetched from server: ${mapSize}`);
    }
  } catch (error) {
    logger.warn('Could not fetch server info for map size', { error: error?.message || String(error) });
  }
});

// Handle connection failure
eventBus.subscribe('rust:connection_failed', (data) => {
  logger.error('Rust connection failed', {
    ip: data.ip,
    port: data.port,
    error: data.error,
  });

  // Initial connect failures should also enter the reconnect loop.
  logger.info('Initiating auto-reconnect after connection failure...');
  rustConnectionManager.handleReconnect().catch((error) => {
    logger.error('Auto-reconnect failed after connection failure', { error: error.message });
  });
});

// Handle disconnection - trigger auto-reconnect
eventBus.subscribe('rust:disconnected', (data) => {
  logger.warn('Rust connection lost', {
    ip: data.ip,
    port: data.port,
  });
  
  // Trigger auto-reconnect (manager will handle retry logic)
  logger.info('Initiating auto-reconnect...');
  rustConnectionManager.handleReconnect().catch((error) => {
    logger.error('Auto-reconnect failed', { error: error.message });
  });
});

// Handle errors
eventBus.subscribe('rust:error', (data) => {
  logger.error('Rust client error', {
    ip: data.ip,
    port: data.port,
    error: data.error,
  });
});

logger.info('Rust connection event handlers registered');
