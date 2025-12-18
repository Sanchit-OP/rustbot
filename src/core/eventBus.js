const { EventEmitter } = require('events');
const logger = require('./logger');

/**
 * Central event bus for decoupling Discord and Rust layers
 * This allows different parts of the application to communicate without direct dependencies
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20); // Increase max listeners to avoid warnings
  }

  /**
   * Emit an event with logging
   */
  emitEvent(eventName, data = {}) {
    logger.debug(`Event emitted: ${eventName}`, { data });
    this.emit(eventName, data);
  }

  /**
   * Subscribe to an event with logging
   */
  subscribe(eventName, handler) {
    logger.debug(`Subscribed to event: ${eventName}`);
    this.on(eventName, handler);
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(eventName, handler) {
    logger.debug(`Unsubscribed from event: ${eventName}`);
    this.off(eventName, handler);
  }
}

// Export singleton instance
module.exports = new EventBus();
