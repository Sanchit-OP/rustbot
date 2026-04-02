const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const env = require('../../config/env');
const { posToGrid, inferSide, DEFAULT_MAP_SIZE } = require('../../core/utils/grid');

const MARKER_TYPES = {
  CH47: 4,
  CARGO_SHIP: 5,
  PATROL_HELI: 8,
  GENERIC_RADIUS: 7,
};

const DEDUPE_WINDOW_MS = 45000;

class ServerEventsInterpreter {
  constructor() {
    this.mapSize = DEFAULT_MAP_SIZE;
    this.markers = new Map(); // id -> marker
    this.activeCargo = null; // { id, x, y }
    this.activeHeli = null; // { id, x, y }
    this.recentEvents = new Map(); // key -> timestamp

    this.subscribe();
  }

  subscribe() {
    eventBus.subscribe('rust:map_markers', markers => this.handleMapMarkers(markers));
    eventBus.subscribe('rust:entity_update', entity => this.handleEntityUpdate(entity));
    eventBus.subscribe('rust:entity_spawn', entity => this.handleEntitySpawn(entity));
    eventBus.subscribe('rust:entity_death', entity => this.handleEntityDeath(entity));
    eventBus.subscribe('rust:raw_message', msg => this.handleRawMessage(msg));
  }

  handleRawMessage(msg) {
    try {
      const info = msg?.response?.info;
      const map = msg?.response?.map;
      if (info?.mapSize) {
        this.mapSize = info.mapSize;
      } else if (map?.width && map?.height) {
        this.mapSize = Math.round((map.width + map.height) / 2);
      }
    } catch (error) {
      logger.debug('Failed to update mapSize from raw message', { error: error.message });
    }
  }

  handleMapMarkers(markers = []) {
    const seenIds = new Set();

    markers.forEach(marker => {
      if (!marker || typeof marker.id === 'undefined') return;
      seenIds.add(marker.id);
      this.markers.set(marker.id, marker);

      switch (marker.type) {
        case MARKER_TYPES.CH47:
          this.emitChinook(marker);
          break;
        case MARKER_TYPES.CARGO_SHIP:
          this.handleCargo(marker);
          break;
        case MARKER_TYPES.PATROL_HELI:
          this.handleHeli(marker);
          break;
        case MARKER_TYPES.GENERIC_RADIUS:
          this.handleOilRig(marker);
          break;
        default:
          break;
      }
    });

    // Detect removed markers for cargo/heli
    if (this.activeCargo && !seenIds.has(this.activeCargo.id)) {
      this.emitCargoLeaving(this.activeCargo);
      this.activeCargo = null;
    }

    if (this.activeHeli && !seenIds.has(this.activeHeli.id)) {
      this.emitHeliDown(this.activeHeli);
      this.activeHeli = null;
    }
  }

  handleEntityUpdate(entity) {
    this.updateHeliPosition(entity);
    this.updateCargoPosition(entity);
  }

  handleEntitySpawn(entity) {
    this.updateHeliPosition(entity);
    this.updateCargoPosition(entity);
  }

  handleEntityDeath(entity) {
    if (this.activeHeli && entity?.entityId === this.activeHeli.id) {
      this.emitHeliDown(this.activeHeli);
      this.activeHeli = null;
    }
  }

  handleCargo(marker) {
    const grid = this.toGrid(marker);
    const side = inferSide(marker.x, marker.y, this.mapSize);

    if (!this.activeCargo || this.activeCargo.id !== marker.id) {
      this.emitEvent({
        type: 'CARGO',
        state: 'ENTERING',
        side,
        grid,
      });
    }

    this.activeCargo = { id: marker.id, x: marker.x, y: marker.y };
  }

  handleHeli(marker) {
    const grid = this.toGrid(marker);
    if (!this.activeHeli || this.activeHeli.id !== marker.id) {
      this.emitEvent({
        type: 'PATROL_HELI',
        state: 'IN',
        grid,
      });
    }
    this.activeHeli = { id: marker.id, x: marker.x, y: marker.y };
  }

  handleOilRig(marker) {
    const name = (marker.name || '').toLowerCase();
    let size = null;
    if (name.includes('oilrigai2')) {
      size = 'LARGE';
    } else if (name.includes('oilrigai')) {
      size = 'SMALL';
    }
    if (!size) return;

    const grid = this.toGrid(marker);
    this.emitEvent({
      type: 'OIL_RIG',
      size,
      grid,
    });
  }

  emitChinook(marker) {
    const grid = this.toGrid(marker);
    this.emitEvent({ type: 'CHINOOK_DROP', grid });
  }

  emitCargoLeaving(cargo) {
    if (!cargo) return;
    const grid = this.toGrid(cargo);
    const side = inferSide(cargo.x, cargo.y, this.mapSize);
    this.emitEvent({
      type: 'CARGO',
      state: 'LEAVING',
      side,
      grid,
    });
  }

  emitHeliDown(heli) {
    if (!heli) return;
    const grid = this.toGrid(heli);
    this.emitEvent({
      type: 'PATROL_HELI',
      state: 'DOWN',
      grid,
    });
  }

  updateHeliPosition(entity) {
    if (!this.activeHeli || !entity) return;
    if (entity.entityId === this.activeHeli.id && Number.isFinite(entity.x) && Number.isFinite(entity.y)) {
      this.activeHeli = { ...this.activeHeli, x: entity.x, y: entity.y };
    }
  }

  updateCargoPosition(entity) {
    if (!this.activeCargo || !entity) return;
    if (entity.entityId === this.activeCargo.id && Number.isFinite(entity.x) && Number.isFinite(entity.y)) {
      this.activeCargo = { ...this.activeCargo, x: entity.x, y: entity.y };
    }
  }

  toGrid(pos) {
    return posToGrid(pos.x, pos.y, this.mapSize);
  }

  emitEvent(payload) {
    const timestamp = new Date().toISOString();
    const grid = payload.grid || 'Unknown';
    const state = payload.state || '';
    const size = payload.size || '';
    const side = payload.side || '';
    const dedupeKey = [payload.type, state, size, side, grid].filter(Boolean).join('|');

    const now = Date.now();
    const last = this.recentEvents.get(dedupeKey);
    if (last && now - last < DEDUPE_WINDOW_MS) {
      return;
    }

    this.recentEvents.set(dedupeKey, now);

    const eventPayload = {
      ...payload,
      grid,
      timestamp,
      guildId: env.discord.guildId || undefined,
    };
    eventBus.emitEvent('server:event', eventPayload);
    logger.info('Server event emitted', eventPayload);
  }
}

module.exports = new ServerEventsInterpreter();
