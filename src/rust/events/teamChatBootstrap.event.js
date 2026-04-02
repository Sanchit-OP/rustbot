const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const rustConnectionManager = require('../client/RustConnectionManager');

/**
 * Ensures team chat stream is primed after Rust connection.
 * Some servers only start emitting team chat broadcasts after getTeamChat is requested.
 */
eventBus.subscribe('rust:connected', async () => {
  try {
    const client = rustConnectionManager.getClient();
    await client.getTeamChat();
    logger.info('Rust team chat bootstrap completed');
  } catch (error) {
    logger.warn('Rust team chat bootstrap failed', {
      error: error?.error || error?.message || String(error),
    });
  }
});

module.exports = {};
