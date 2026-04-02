const logger = require('../../core/logger');
const rustConnectionManager = require('../client/RustConnectionManager');
const eventBus = require('../../core/eventBus');

/**
 * Low-level Rust world event listener.
 * Subscribes to Rust+ client events (map markers, entity updates) and forwards raw data.
 * No Discord references, no interpretation.
 */
function registerWorldListeners(rustPlusClient) {
  if (!rustPlusClient || typeof rustPlusClient.on !== 'function') {
    logger.warn('Cannot register world listeners: Rust+ client not available');
    return;
  }

  rustPlusClient.on('message', (msg) => {
    // Raw AppMessage from Rust+
    logger.debug('Rust message received', { keys: Object.keys(msg.response || msg.broadcast || {}) });
    eventBus.emitEvent('rust:raw_message', msg);
  });

  rustPlusClient.on('mapMarkers', (markers) => {
    logger.debug('Rust map markers update received', { count: markers?.length });
    eventBus.emitEvent('rust:map_markers', markers);
  });

  rustPlusClient.on('entityUpdate', (entity) => {
    logger.debug('Rust entity update received', { entityId: entity?.entityId });
    eventBus.emitEvent('rust:entity_update', entity);
  });

  rustPlusClient.on('entitySpawn', (entity) => {
    logger.debug('Rust entity spawn received', { entityId: entity?.entityId });
    eventBus.emitEvent('rust:entity_spawn', entity);
  });

  rustPlusClient.on('entityDeath', (entity) => {
    logger.debug('Rust entity death received', { entityId: entity?.entityId });
    eventBus.emitEvent('rust:entity_death', entity);
  });
}

// Hook into existing Rust client once connection is established
eventBus.subscribe('rust:connected', () => {
  try {
    const wrapper = rustConnectionManager.getClient();
    const rustPlusClient = wrapper?.client;
    registerWorldListeners(rustPlusClient);
    logger.info('Rust world event listeners registered');
  } catch (error) {
    logger.error('Failed to register world event listeners', { error: error.message });
  }
});

module.exports = {};
