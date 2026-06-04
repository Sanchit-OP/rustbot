const logger = require('../../core/logger');
const rustConnectionManager = require('../client/RustConnectionManager');
const eventBus = require('../../core/eventBus');

let activeClient = null;
let activeHandlers = null;

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

  if (activeClient === rustPlusClient) {
    logger.debug('Rust world listeners already attached for current client');
    return;
  }

  if (activeClient && activeHandlers) {
    detachWorldListeners(activeClient, activeHandlers);
  }

  const handlers = {
    onMessage: (msg) => {
      try {
        logger.debug('Rust message received', {
          keys: Object.keys(msg.response || msg.broadcast || {}),
        });
        eventBus.emitEvent('rust:raw_message', msg);
      } catch (error) {
        // Swallow proto decode errors — a missing field in one message
        // should not crash the bot or interrupt the event stream.
        if (error.name === 'ProtocolError' || (error.message && error.message.includes('missing required'))) {
          logger.warn('Skipping malformed Rust+ message (missing required proto field)', {
            message: error.message,
          });
          return;
        }
        throw error;
      }
    },
    onMapMarkers: (markers) => {
      logger.debug('Rust map markers update received', { count: markers?.length });
      eventBus.emitEvent('rust:map_markers', markers);
    },
    onEntityUpdate: (entity) => {
      logger.debug('Rust entity update received', { entityId: entity?.entityId });
      eventBus.emitEvent('rust:entity_update', entity);
    },
    onEntitySpawn: (entity) => {
      logger.debug('Rust entity spawn received', { entityId: entity?.entityId });
      eventBus.emitEvent('rust:entity_spawn', entity);
    },
    onEntityDeath: (entity) => {
      logger.debug('Rust entity death received', { entityId: entity?.entityId });
      eventBus.emitEvent('rust:entity_death', entity);
    },
  };

  rustPlusClient.on('message', handlers.onMessage);
  rustPlusClient.on('mapMarkers', handlers.onMapMarkers);
  rustPlusClient.on('entityUpdate', handlers.onEntityUpdate);
  rustPlusClient.on('entitySpawn', handlers.onEntitySpawn);
  rustPlusClient.on('entityDeath', handlers.onEntityDeath);

  activeClient = rustPlusClient;
  activeHandlers = handlers;
}

function detachWorldListeners(rustPlusClient, handlers) {
  if (!rustPlusClient || !handlers) {
    return;
  }

  rustPlusClient.off('message', handlers.onMessage);
  rustPlusClient.off('mapMarkers', handlers.onMapMarkers);
  rustPlusClient.off('entityUpdate', handlers.onEntityUpdate);
  rustPlusClient.off('entitySpawn', handlers.onEntitySpawn);
  rustPlusClient.off('entityDeath', handlers.onEntityDeath);
}

eventBus.subscribe('rust:disconnected', () => {
  if (activeClient && activeHandlers) {
    detachWorldListeners(activeClient, activeHandlers);
    activeClient = null;
    activeHandlers = null;
  }
});

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
