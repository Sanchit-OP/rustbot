const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const guildConfigStore = require('../../storage/guildConfig.store');
const discordClient = require('../client');
const discordConfig = require('../../config/discord');

/**
 * Listens for semantic server events and posts them to the server-events channel.
 * Discord layer only; no Rust logic.
 */
eventBus.subscribe('server:event', async (event) => {
  try {
    const client = discordClient.getClient();
    const guildId = event.guildId || event.guild?.id || null;

    if (!guildId) {
      logger.warn('Server event missing guildId; cannot route', { event });
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      logger.warn('Guild not found for server event', { guildId, event });
      return;
    }

    const channel = await ensureServerEventsChannel(guild);
    if (!channel) return;

    const content = formatServerEvent(event);
    if (!content) return;

    await channel.send({ content });
  } catch (error) {
    logger.error('Failed to handle server event', { error: error.message, event });
  }
});

async function ensureServerEventsChannel(guild) {
  const channelName = discordConfig.SERVER_EVENTS_CHANNEL_NAME;
  const storedId = guildConfigStore.getServerEventsChannelId(guild.id);

  if (storedId) {
    const channel = guild.channels.cache.get(storedId);
    if (channel && channel.isTextBased()) {
      return channel;
    }
  }

  const existingByName = guild.channels.cache.find(
    c => c.name === channelName && c.isTextBased()
  );
  if (existingByName) {
    guildConfigStore.setServerEventsChannelId(guild.id, existingByName.id);
    return existingByName;
  }

  try {
    const created = await guild.channels.create({
      name: channelName,
      type: 0, // GuildText
      topic: 'Rust world event notifications',
    });
    guildConfigStore.setServerEventsChannelId(guild.id, created.id);
    logger.info(`Recreated server-events channel in guild: ${guild.name}`);
    return created;
  } catch (error) {
    logger.error('Failed to recreate server-events channel', {
      guildId: guild.id,
      guild: guild.name,
      error: error.message,
    });
    return null;
  }
}

function formatServerEvent(event) {
  const ts = event.timestamp ? `<t:${Math.floor(new Date(event.timestamp).getTime() / 1000)}:R>` : '';
  switch (event.type) {
    case 'CHINOOK_DROP':
      return `🚁 Chinook Drop — Grid ${event.grid || 'Unknown'} — 🕘 ${ts}`;
    case 'CARGO':
      if (event.state === 'ENTERING') {
        return `🚢 Cargo Incoming — From ${event.side || 'UNKNOWN'} — Grid ${event.grid || 'Unknown'} — 🕘 ${ts}`;
      }
      if (event.state === 'LEAVING') {
        return `🚢 Cargo Leaving — Toward ${event.side || 'UNKNOWN'} — Grid ${event.grid || 'Unknown'} — 🕘 ${ts}`;
      }
      return null;
    case 'PATROL_HELI':
      if (event.state === 'IN') {
        return `🚁 Patrol Heli IN — Grid ${event.grid || 'Unknown'} — 🕘 ${ts}`;
      }
      if (event.state === 'DOWN') {
        return `💥 Patrol Heli DOWN — Grid ${event.grid || 'Unknown'} — 🕘 ${ts}`;
      }
      return null;
    case 'OIL_RIG':
      if (event.size === 'LARGE') {
        return `🏭 Large Oil Rig Called — Grid ${event.grid || 'Unknown'} — 🕘 ${ts}`;
      }
      if (event.size === 'SMALL') {
        return `🏭 Small Oil Rig Called — Grid ${event.grid || 'Unknown'} — 🕘 ${ts}`;
      }
      return null;
    default:
      return null;
  }
}

module.exports = {};
