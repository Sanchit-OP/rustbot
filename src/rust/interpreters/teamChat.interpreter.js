const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const env = require('../../config/env');

const DEDUPE_WINDOW_MS = 60000;

class TeamChatInterpreter {
  constructor() {
    this.prefix = (env.rust.chatCommandPrefix || '!').trim();
    this.prefixLower = this.prefix.toLowerCase();
    this.recent = new Map();

    eventBus.subscribe('rust:raw_message', msg => this.handleRawMessage(msg));
    logger.info(`Rust team chat interpreter enabled with bang-command mode (!help, !crate, ...)`);
  }

  handleRawMessage(msg) {
    const teamMessage = msg?.broadcast?.teamMessage;
    const payload = teamMessage?.message || teamMessage;
    const rawText = payload?.message;

    if (!payload || typeof rawText !== 'string') {
      return;
    }

    const message = rawText.trim();
    if (!message) {
      return;
    }

    const dedupeKey = `${payload.steamId || ''}|${payload.time || ''}|${message}`;
    if (this.isDuplicate(dedupeKey)) {
      return;
    }

    const parsed = this.parseCommand(message);
    if (!parsed) {
      return;
    }

    const eventPayload = {
      steamId: String(payload.steamId || ''),
      name: payload.name || 'Unknown',
      originalMessage: message,
      command: parsed.command,
      args: parsed.args,
      timestamp: payload.time ? new Date(payload.time * 1000).toISOString() : new Date().toISOString(),
      prefix: this.prefix,
    };

    eventBus.emitEvent('rust:team_chat_command', eventPayload);
    logger.info('Rust team chat command captured', {
      name: eventPayload.name,
      steamId: eventPayload.steamId,
      command: eventPayload.command || 'help',
      args: eventPayload.args,
    });
  }

  parseCommand(message) {
    const trimmed = message.trim();
    if (!trimmed.startsWith('!')) {
      return null;
    }

    const rest = trimmed.slice(1).trim();
    if (!rest) {
      return { command: 'help', args: [] };
    }

    const [firstToken, ...tail] = rest.split(/\s+/);
    let command = firstToken.toLowerCase();
    let args = tail;

    // Backward compatibility for old syntax: "!r help"
    if (command === 'r' && args.length > 0) {
      command = args[0].toLowerCase();
      args = args.slice(1);
    }

    return {
      command,
      args,
    };
  }

  isDuplicate(key) {
    const now = Date.now();
    this.prune(now);

    const existing = this.recent.get(key);
    if (existing && now - existing < DEDUPE_WINDOW_MS) {
      return true;
    }

    this.recent.set(key, now);
    return false;
  }

  prune(now = Date.now()) {
    for (const [key, ts] of this.recent.entries()) {
      if (now - ts > DEDUPE_WINDOW_MS) {
        this.recent.delete(key);
      }
    }
  }
}

module.exports = new TeamChatInterpreter();
