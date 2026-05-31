const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const rustConnectionManager = require('../client/RustConnectionManager');
const serverEventsInterpreter = require('../interpreters/serverEvents.interpreter');
const { posToGrid } = require('../../core/utils/grid');

// steamId (string) -> { isAlive: bool, name: string }
const prevMembers = new Map();
let initialized = false;

// On connect: fetch initial team state as baseline (no notifications for this snapshot)
eventBus.subscribe('rust:connected', async () => {
  prevMembers.clear();
  initialized = false;

  try {
    const client = rustConnectionManager.getClient();
    const teamInfo = await client.getTeamInfo();
    if (teamInfo?.members) {
      for (const member of teamInfo.members) {
        prevMembers.set(String(member.steamId), {
          isAlive: member.isAlive,
          name: member.name || 'Teammate',
        });
      }
      logger.info(`Team death tracker ready (${prevMembers.size} members)`);
    }
    initialized = true;
  } catch (error) {
    logger.warn('Team death tracker init failed', {
      error: error?.error || error?.message || String(error),
    });
    initialized = true; // still allow future broadcasts to work
  }
});

// On disconnect: reset state
eventBus.subscribe('rust:disconnected', () => {
  prevMembers.clear();
  initialized = false;
});

// Watch for team change broadcasts
eventBus.subscribe('rust:raw_message', (msg) => {
  if (!initialized) return;

  try {
    const members = msg?.broadcast?.teamChanged?.teamInfo?.members;
    if (!Array.isArray(members) || members.length === 0) return;
    handleTeamChanged(members);
  } catch (error) {
    logger.debug('Error in team death tracker', { error: error?.message });
  }
});

function handleTeamChanged(members) {
  for (const member of members) {
    const id = String(member.steamId);
    const prev = prevMembers.get(id);

    // Detect transition: alive → dead
    if (prev && prev.isAlive === true && member.isAlive === false) {
      const mapSize = serverEventsInterpreter.getMapSize();
      const grid = posToGrid(member.x, member.y, mapSize);
      const name = member.name || prev.name || 'Teammate';
      sendDeathNotification(name, grid);
    }

    prevMembers.set(id, {
      isAlive: member.isAlive,
      name: member.name || (prev?.name ?? 'Teammate'),
    });
  }
}

async function sendDeathNotification(name, grid) {
  try {
    await rustConnectionManager.ensureConnected();
    const client = rustConnectionManager.getClient();
    await client.sendTeamMessage(`${name} died at ${grid}`);
    logger.info(`Death notification sent: ${name} at ${grid}`);
  } catch (error) {
    logger.warn('Failed to send death notification', {
      error: error?.error || error?.message || String(error),
    });
  }
}

module.exports = {};
