const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const env = require('../../config/env');
const rustConnectionManager = require('../client/RustConnectionManager');
const teamChatCommandService = require('../services/teamChatCommand.service');

const USER_COOLDOWN_MS = 2000;
const cooldowns = new Map(); // steamId -> timestamp

eventBus.subscribe('rust:team_chat_command', async (commandEvent) => {
  try {
    if (!isAllowed(commandEvent.steamId)) {
      logger.info('Ignoring team chat command from non-allowed Steam ID', {
        steamId: commandEvent.steamId,
        name: commandEvent.name,
      });
      return;
    }

    if (isInCooldown(commandEvent.steamId)) {
      logger.debug('Ignoring team chat command due to cooldown', {
        steamId: commandEvent.steamId,
      });
      return;
    }

    const response = await teamChatCommandService.handle(commandEvent);
    if (!response) {
      return;
    }

    await rustConnectionManager.ensureConnected();
    const client = rustConnectionManager.getClient();

    const messages = Array.isArray(response) ? response : [response];
    for (const msg of messages) {
      await client.sendTeamMessage(msg);
    }
  } catch (error) {
    logger.error('Failed to process Rust team chat command', {
      error: error?.error || error?.message || String(error),
      command: commandEvent?.command,
      steamId: commandEvent?.steamId,
    });
  }
});

logger.info('Rust team chat command handler registered');

function isAllowed(steamId) {
  const allowList = env.rust.chatAllowedSteamIds || [];
  if (allowList.length === 0) {
    return true;
  }
  return allowList.includes(String(steamId || ''));
}

function isInCooldown(steamId) {
  const key = String(steamId || '');
  const now = Date.now();
  const last = cooldowns.get(key);
  if (last && now - last < USER_COOLDOWN_MS) {
    return true;
  }

  cooldowns.set(key, now);
  prune(now);
  return false;
}

function prune(now) {
  for (const [key, ts] of cooldowns.entries()) {
    if (now - ts > USER_COOLDOWN_MS * 5) {
      cooldowns.delete(key);
    }
  }
}
