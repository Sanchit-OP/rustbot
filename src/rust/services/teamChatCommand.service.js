const rustConnectionManager = require('../client/RustConnectionManager');
const statusService = require('./status.service');
const crateTimerService = require('./crateTimer.service');
const reminderService = require('./reminder.service');
const { posToGrid } = require('../../core/utils/grid');
const serverEventsInterpreter = require('../interpreters/serverEvents.interpreter');

const COMMAND_PREFIX = '!';

const MARKER_TYPES = {
  CH47: 4,
  CARGO_SHIP: 5,
  CRATE: 6,
  PATROL_HELI: 8,
};

class TeamChatCommandService {
  async handle(commandEvent) {
    const command = commandEvent.command || 'help';

    switch (command) {
      case 'help':
        return this.buildHelp();
      case 'time':
        return this.handleTime();
      case 'players':
        return this.handlePlayers();
      case 'crate':
        return this.handleCrate();
      case 'c_time':
        return this.handleCrateTime();
      case 'remind':
        return this.handleRemind(commandEvent);
      case 'heli':
        return this.handleHeliLocation();
      case 'cargo':
        return this.handleCargoLocation();
      case 'chinook':
        return this.handleChinookLocation();
      case 'map':
        return this.handleMap(commandEvent);
      default:
        return `Unknown command "${command}". Try ${COMMAND_PREFIX}help`;
    }
  }

  async handleTime() {
    await rustConnectionManager.ensureConnected();
    const client = rustConnectionManager.getClient();
    const time = await client.getTime();
    return `Server time: ${statusService.formatGameTime(time)}`;
  }

  async handlePlayers() {
    await rustConnectionManager.ensureConnected();
    const client = rustConnectionManager.getClient();
    const info = await client.getInfo();
    const players = info?.players ?? '?';
    const maxPlayers = info?.maxPlayers ?? '?';
    const queued = info?.queuedPlayers ?? 0;
    return `Players: ${players}/${maxPlayers}${queued ? ` (queue ${queued})` : ''}`;
  }

  handleCrate() {
    return {
      text: crateTimerService.start(),
      tone: 'timer',
    };
  }

  handleCrateTime() {
    // If no timer is active, intentionally return no response.
    const message = crateTimerService.getRemainingMessage();
    if (!message) {
      return null;
    }
    return {
      text: message,
      tone: 'timer',
    };
  }

  handleEvents() {
    return eventHealthService.getSummary();
  }

  handleRemind(commandEvent) {
    const args = commandEvent?.args || [];
    if (args.length < 2) {
      return {
        text: 'Usage: !remind <mm:ss|Xm|Xs> <message>',
        tone: 'timer',
      };
    }

    const durationToken = args[0];
    const seconds = parseDurationSeconds(durationToken);
    if (!seconds || seconds < 5 || seconds > 7200) {
      return {
        text: 'Invalid time. Use 00:30 to 120:00, or 30s/5m.',
        tone: 'timer',
      };
    }

    const text = args.slice(1).join(' ').trim();
    if (!text) {
      return {
        text: 'Reminder text is required.',
        tone: 'timer',
      };
    }

    const result = reminderService.schedule({
      secondsFromNow: seconds,
      text,
      requestedBy: commandEvent?.name || 'unknown',
    });

    if (!result.ok) {
      if (result.error === 'too_many_active') {
        return {
          text: 'Too many active reminders. Wait for some to finish.',
          tone: 'timer',
        };
      }
      return {
        text: 'Could not schedule reminder.',
        tone: 'timer',
      };
    }

    return {
      text: `Reminder set for ${formatSeconds(seconds)}`,
      tone: 'timer',
    };
  }

  async handleHeliLocation() {
    const markers = await this._getMarkers();
    const heli = markers.find(m => m.type === MARKER_TYPES.PATROL_HELI);
    if (!heli) return 'Patrol heli not on map';
    const grid = this._toGrid(heli.x, heli.y);
    return `Patrol heli at ${grid}`;
  }

  async handleCargoLocation() {
    const markers = await this._getMarkers();
    const cargo = markers.find(m => m.type === MARKER_TYPES.CARGO_SHIP);
    if (!cargo) return 'Cargo ship not on map';
    const grid = this._toGrid(cargo.x, cargo.y);
    const heading = rotationToCompass(cargo.rotation);
    return `Cargo ship at ${grid}, heading ${heading}`;
  }

  async handleChinookLocation() {
    const markers = await this._getMarkers();
    const ch47 = markers.find(m => m.type === MARKER_TYPES.CH47);
    if (!ch47) return 'Chinook not on map';
    const grid = this._toGrid(ch47.x, ch47.y);
    return `Chinook at ${grid}`;
  }

  async handleMap(commandEvent) {
    const markers = await this._getMarkers();
    if (!markers.length) return 'No markers on map';

    const NAMES = {
      1: 'Player',
      2: 'Explosion',
      3: 'VendingMachine',
      4: 'Chinook',
      5: 'CargoShip',
      6: 'LockedCrate',
      7: 'RadiusZone',
      8: 'PatrolHeli',
    };

    // Group by type
    const groups = new Map();
    for (const m of markers) {
      if (!groups.has(m.type)) groups.set(m.type, []);
      groups.get(m.type).push(m);
    }

    const mapSize = serverEventsInterpreter.getMapSize();
    const lines = [`Map: ${markers.length} markers | size: ${mapSize}`];

    // Sort types so interesting ones come first
    const priority = [8, 5, 4, 6, 2, 7, 1, 3];
    const sortedTypes = [...groups.keys()].sort((a, b) => {
      const ai = priority.indexOf(a), bi = priority.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    for (const type of sortedTypes) {
      const list = groups.get(type);
      const name = NAMES[type] || `Type${type}`;

      // For high-count types just show count + first name if available
      if (list.length > 3) {
        const sample = list[0].name ? ` (e.g. "${list[0].name}")` : '';
        lines.push(`${name} x${list.length}${sample}`);
      } else {
        for (const m of list) {
          const grid = this._toGrid(m.x, m.y);
          const label = m.name ? ` "${m.name}"` : '';
          lines.push(`${name}${label} @ ${grid}`);
        }
      }
    }

    return lines;
  }

  async _getMarkers() {
    await rustConnectionManager.ensureConnected();
    const client = rustConnectionManager.getClient();
    return (await client.getMapMarkers()) || [];
  }

  _toGrid(x, y) {
    return posToGrid(x, y, serverEventsInterpreter.getMapSize());
  }

  buildHelp() {
    const p = COMMAND_PREFIX;
    return [
      `--- Commands ---`,
      `${p}players  ${p}time`,
      `${p}heli  ${p}cargo  ${p}chinook`,
      `${p}map  ${p}crate  ${p}c_time`,
      `${p}remind 05:00 <msg>`,
    ];
  }
}

module.exports = new TeamChatCommandService();

function rotationToCompass(rotation) {
  if (!Number.isFinite(rotation)) return '?';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((rotation % 360) + 360) % 360 / 45) % 8;
  return dirs[index];
}

function parseDurationSeconds(input) {
  if (!input) {
    return null;
  }

  const token = String(input).trim().toLowerCase();

  if (/^\d+:\d{1,2}$/.test(token)) {
    const [minsText, secsText] = token.split(':');
    const mins = Number.parseInt(minsText, 10);
    const secs = Number.parseInt(secsText, 10);
    if (!Number.isFinite(mins) || !Number.isFinite(secs) || secs >= 60) {
      return null;
    }
    return mins * 60 + secs;
  }

  if (/^\d+s$/.test(token)) {
    return Number.parseInt(token.slice(0, -1), 10);
  }

  if (/^\d+m$/.test(token)) {
    return Number.parseInt(token.slice(0, -1), 10) * 60;
  }

  if (/^\d+$/.test(token)) {
    return Number.parseInt(token, 10);
  }

  return null;
}

function formatSeconds(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
