const logger = require('../../core/logger');
const rustConnectionManager = require('../client/RustConnectionManager');

const MAX_ACTIVE_REMINDERS = 12;

class ReminderService {
  constructor() {
    this.nextId = 1;
    this.reminders = new Map();
  }

  schedule({ secondsFromNow, text, requestedBy }) {
    if (!Number.isFinite(secondsFromNow) || secondsFromNow <= 0) {
      return { ok: false, error: 'invalid_duration' };
    }

    if (this.reminders.size >= MAX_ACTIVE_REMINDERS) {
      return { ok: false, error: 'too_many_active' };
    }

    const id = this.nextId++;
    const safeText = String(text || '').trim().slice(0, 180);
    const actor = String(requestedBy || 'unknown').trim().slice(0, 32);
    const createdAt = Date.now();
    const dueAt = createdAt + secondsFromNow * 1000;

    const timeout = setTimeout(() => {
      this.fire(id).catch(error => {
        logger.error('Failed to fire reminder', {
          id,
          error: error?.error || error?.message || String(error),
        });
      });
    }, secondsFromNow * 1000);

    this.reminders.set(id, {
      id,
      safeText,
      actor,
      createdAt,
      dueAt,
      timeout,
    });

    return { ok: true, id, dueAt, text: safeText };
  }

  async fire(id) {
    const reminder = this.reminders.get(id);
    if (!reminder) {
      return;
    }

    this.reminders.delete(id);

    const content = `Reminder (${reminder.actor}): ${reminder.safeText}`;
    await this.sendTeamMessage(content);
  }

  clearAll() {
    for (const reminder of this.reminders.values()) {
      clearTimeout(reminder.timeout);
    }
    this.reminders.clear();
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

module.exports = new ReminderService();
