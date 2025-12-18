const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const rustConnectionManager = require('../client/RustConnectionManager');

/**
 * Rust connection event handlers
 * These handlers respond to Rust connection events
 */

// Handle successful connection
eventBus.subscribe('rust:connected', (data) => {
  logger.success('Rust connection established', {
    ip: data.ip,
    port: data.port,
  });
});

// Handle connection failure
eventBus.subscribe('rust:connection_failed', (data) => {
  logger.error('Rust connection failed', {
    ip: data.ip,
    port: data.port,
    error: data.error,
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
