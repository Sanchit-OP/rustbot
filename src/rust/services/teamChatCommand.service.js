const rustConnectionManager = require('../client/RustConnectionManager');
const statusService = require('./status.service');
const crateTimerService = require('./crateTimer.service');
const eventHealthService = require('./eventHealth.service');
const reminderService = require('./reminder.service');

const COMMAND_PREFIX = '!';

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
      case 'events':
        return this.handleEvents();
      case 'remind':
        return this.handleRemind(commandEvent);
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

  buildHelp() {
    return [
      'Commands:',
      '',
      `${COMMAND_PREFIX}players - show player count`,
      '',
      `${COMMAND_PREFIX}time - show server time`,
      '',
      `${COMMAND_PREFIX}crate - start 15:00 crate timer`,
      '',
      `${COMMAND_PREFIX}c_time - show remaining crate time`,
      '',
      `${COMMAND_PREFIX}events - check event pipeline health`,
      '',
      `${COMMAND_PREFIX}remind 05:00 meds - reminder timer`,
    ].join('\n');
  }
}

module.exports = new TeamChatCommandService();

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
