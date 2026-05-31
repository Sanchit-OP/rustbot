const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const env = require('../../config/env');
const { posToGrid, inferSide, DEFAULT_MAP_SIZE } = require('../../core/utils/grid');

const MARKER_TYPES = {
  CH47: 4,
  CARGO_SHIP: 5,
  CRATE: 6,       // locked crate dropped by chinook
  GENERIC_RADIUS: 7,
  PATROL_HELI: 8,
};

const DEDUPE_WINDOW_MS = 45000;

class ServerEventsInterpreter {
  constructor() {
    // Priority: env override → server-provided (via rust:server_info) → default
    this.mapSize = env.rust.mapSize || DEFAULT_MAP_SIZE;
    this.mapSizeSource = env.rust.mapSize ? 'env' : 'default';

    this.markers = new Map(); // id -> marker
    this.activeCargo = null; // { id, x, y }
    this.activeHeli = null; // { id, x, y }
    this.activeOilRigs = new Map(); // id -> { id, x, y, size }
    this.seenCrateIds = new Set(); // crate marker IDs already announced
    this.recentEvents = new Map(); // key -> timestamp

    this.subscribe();
    logger.info(`ServerEventsInterpreter using map size: ${this.mapSize} (${this.mapSizeSource})`);
  }

  subscribe() {
    eventBus.subscribe('rust:map_markers', markers => this.handleMapMarkers(markers));
    eventBus.subscribe('rust:server_info', info => this.handleServerInfo(info));
  }

  handleServerInfo(info) {
    // Don't override a manually set env value
    if (this.mapSizeSource === 'env') return;
    const size = info?.mapSize;
    if (size && Number.isFinite(size) && size > 0 && size !== this.mapSize) {
      this.mapSize = size;
      this.mapSizeSource = 'server';
      logger.info(`Map size updated from server: ${this.mapSize}`);
    }
  }

  handleMapMarkers(markers = []) {
    const seenIds = new Set();

    markers.forEach(marker => {
      if (!marker || typeof marker.id === 'undefined') return;
      seenIds.add(marker.id);
      this.markers.set(marker.id, marker);

      switch (marker.type) {
        case MARKER_TYPES.CARGO_SHIP:
          this.handleCargo(marker);
          break;
        case MARKER_TYPES.PATROL_HELI:
          this.handleHeli(marker);
          break;
        case MARKER_TYPES.CRATE:
          this.handleCrate(marker);
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

    // Detect disappeared oil rigs
    for (const [id] of this.activeOilRigs) {
      if (!seenIds.has(id)) {
        this.activeOilRigs.delete(id);
      }
    }

    // Prune gone crate IDs so re-drops of a new crate are announced
    for (const id of this.seenCrateIds) {
      if (!seenIds.has(id)) {
        this.seenCrateIds.delete(id);
      }
    }

    // Prune stale dedupe entries older than 5 minutes
    const now = Date.now();
    for (const [key, ts] of this.recentEvents) {
      if (now - ts > 300000) this.recentEvents.delete(key);
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

    // Only emit once when the oil rig first appears, not every poll cycle
    if (!this.activeOilRigs.has(marker.id)) {
      const grid = this.toGrid(marker);
      this.emitEvent({ type: 'OIL_RIG', size, grid });
    }

    this.activeOilRigs.set(marker.id, { id: marker.id, x: marker.x, y: marker.y, size });
  }

  handleCrate(marker) {
    if (this.seenCrateIds.has(marker.id)) return;
    this.seenCrateIds.add(marker.id);
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

  getMapSize() {
    return this.mapSize;
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
