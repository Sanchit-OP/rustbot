const logger = require('../../core/logger');
const rustConnectionManager = require('../client/RustConnectionManager');

const CRATE_DURATION_SECONDS = 15 * 60;
const ALERT_SECONDS = [10 * 60, 5 * 60, 60, 10];

class CrateTimerService {
  constructor() {
    this.timer = null;
  }

  start() {
    this.clear();

    const startedAt = Date.now();
    const endsAt = startedAt + CRATE_DURATION_SECONDS * 1000;
    const handles = [];
    const timerId = String(startedAt);

    for (const secondsRemaining of ALERT_SECONDS) {
      const delayMs = CRATE_DURATION_SECONDS * 1000 - secondsRemaining * 1000;
      if (delayMs <= 0) {
        continue;
      }

      const handle = setTimeout(() => {
        this.emitRemaining(timerId, secondsRemaining).catch(error => {
          logger.error('Failed to emit crate timer remaining notification', {
            error: error?.error || error?.message || String(error),
            secondsRemaining,
          });
        });
      }, delayMs);
      handles.push(handle);
    }

    const endHandle = setTimeout(() => {
      if (this.timer?.id === timerId) {
        this.clear();
      }
    }, CRATE_DURATION_SECONDS * 1000);
    handles.push(endHandle);

    this.timer = {
      id: timerId,
      startedAt,
      endsAt,
      handles,
    };

    return 'Crate timer started: 15:00';
  }

  getRemainingMessage() {
    if (!this.timer) {
      return null;
    }

    const remainingMs = this.timer.endsAt - Date.now();
    if (remainingMs <= 0) {
      this.clear();
      return null;
    }

    return `Crate timer remaining: ${formatRemaining(remainingMs)}`;
  }

  clear() {
    if (!this.timer) {
      return;
    }

    for (const handle of this.timer.handles || []) {
      clearTimeout(handle);
    }

    this.timer = null;
  }

  async emitRemaining(timerId, secondsRemaining) {
    if (!this.timer || this.timer.id !== timerId) {
      return;
    }

    const message = `Crate timer: ${formatSeconds(secondsRemaining)} remaining`;
    await this.sendTeamMessage(message);
  }

  async sendTeamMessage(message) {
    await rustConnectionManager.ensureConnected();
    const client = rustConnectionManager.getClient();
    await client.sendTeamMessage({
      text: message,
      tone: 'timer',
    });
  }
}

function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return formatSeconds(totalSeconds);
}

function formatSeconds(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

module.exports = new CrateTimerService();
