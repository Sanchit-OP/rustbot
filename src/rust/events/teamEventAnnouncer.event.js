const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const rustConnectionManager = require('../client/RustConnectionManager');

const MIN_SEND_INTERVAL_MS = 4000;

class TeamEventAnnouncer {
  constructor() {
    this.recent = new Map();
    eventBus.subscribe('server:event', (event) => {
      this.handleServerEvent(event).catch((error) => {
        logger.error('Failed to announce server event in team chat', {
          error: error?.error || error?.message || String(error),
          event,
        });
      });
    });
    logger.info('Rust team event announcer enabled');
  }

  async handleServerEvent(event) {
    if (!event || !event.type) {
      return;
    }

    const message = this.formatEvent(event);
    if (!message) {
      return;
    }

    const dedupeKey = this.getDedupeKey(event);
    const now = Date.now();
    const last = this.recent.get(dedupeKey);
    if (last && now - last < MIN_SEND_INTERVAL_MS) {
      return;
    }

    this.recent.set(dedupeKey, now);
    this.prune(now);

    await rustConnectionManager.ensureConnected();
    const client = rustConnectionManager.getClient();
    await client.sendTeamMessage({
      text: message,
      tone: 'announcement',
    });
  }

  formatEvent(event) {
    const grid = event.grid || 'Unknown';

    switch (event.type) {
      case 'CHINOOK_DROP':
        return null;
      case 'CARGO':
        if (event.state === 'ENTERING') {
          return `Cargo incoming from ${event.side || 'UNKNOWN'} at grid ${grid}`;
        }
        if (event.state === 'LEAVING') {
          return `Cargo leaving toward ${event.side || 'UNKNOWN'} from grid ${grid}`;
        }
        return null;
      case 'PATROL_HELI':
        if (event.state === 'IN') {
          return `Heli spawned at grid ${grid}`;
        }
        if (event.state === 'DOWN') {
          return `Heli down at grid ${grid}`;
        }
        return null;
      case 'OIL_RIG':
        if (event.size === 'LARGE') {
          return `Large oil event at grid ${grid}`;
        }
        if (event.size === 'SMALL') {
          return `Small oil event at grid ${grid}`;
        }
        return null;
      default:
        return null;
    }
  }

  getDedupeKey(event) {
    return [
      event.type || '',
      event.state || '',
      event.size || '',
      event.side || '',
      event.grid || '',
    ].join('|');
  }

  prune(now = Date.now()) {
    for (const [key, ts] of this.recent.entries()) {
      if (now - ts > 60000) {
        this.recent.delete(key);
      }
    }
  }
}

module.exports = new TeamEventAnnouncer();
