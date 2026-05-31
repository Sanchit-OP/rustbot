const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const botMessage = require('../../core/botMessage');
const guildConfigStore = require('../../storage/guildConfig.store');
const discordClient = require('../client');
const discordConfig = require('../../config/discord');

const ICON = {
  CARGO: '\u{1F6A2}',
  HELI_IN: '\u{1F681}',
  HELI_DOWN: '\u{1F4A5}',
  OIL: '\u{1F3D7}\u{FE0F}',
  CLOCK: '\u{1F558}',
};

/**
 * Listens for semantic server events and posts them to the server-events channel.
 * Discord layer only; no Rust logic.
 */
eventBus.subscribe('server:event', async (event) => {
  try {
    const client = discordClient.getClient();
    const content = formatServerEvent(event);
    if (!content) return;

    const guildId = event.guildId || event.guild?.id || null;

    const guildsToNotify = guildId
      ? [client.guilds.cache.get(guildId)].filter(Boolean)
      : [...client.guilds.cache.values()];

    if (guildsToNotify.length === 0) {
      logger.warn('No guilds found to route server event', { guildId, event });
      return;
    }

    for (const guild of guildsToNotify) {
      const channel = await ensureServerEventsChannel(guild);
      if (!channel) continue;

      await channel.send({ content });
      eventBus.emitEvent('discord:server_event_sent', {
        guildId: guild.id,
        channelId: channel.id,
        type: event.type,
        timestamp: new Date().toISOString(),
      });
    }
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
      return null;
    case 'CARGO':
      if (event.state === 'ENTERING') {
        return botMessage.prefix(
          `${ICON.CARGO} Cargo Incoming - From ${event.side || 'UNKNOWN'} - Grid ${event.grid || 'Unknown'} - ${ICON.CLOCK} ${ts}`
        );
      }
      if (event.state === 'LEAVING') {
        return botMessage.prefix(
          `${ICON.CARGO} Cargo Leaving - Toward ${event.side || 'UNKNOWN'} - Grid ${event.grid || 'Unknown'} - ${ICON.CLOCK} ${ts}`
        );
      }
      return null;
    case 'PATROL_HELI':
      if (event.state === 'IN') {
        return botMessage.prefix(
          `${ICON.HELI_IN} Patrol Heli IN - Grid ${event.grid || 'Unknown'} - ${ICON.CLOCK} ${ts}`
        );
      }
      if (event.state === 'DOWN') {
        return botMessage.prefix(
          `${ICON.HELI_DOWN} Patrol Heli DOWN - Grid ${event.grid || 'Unknown'} - ${ICON.CLOCK} ${ts}`
        );
      }
      return null;
    case 'OIL_RIG':
      if (event.size === 'LARGE') {
        return botMessage.prefix(
          `${ICON.OIL} Large Oil Rig Called - Grid ${event.grid || 'Unknown'} - ${ICON.CLOCK} ${ts}`
        );
      }
      if (event.size === 'SMALL') {
        return botMessage.prefix(
          `${ICON.OIL} Small Oil Rig Called - Grid ${event.grid || 'Unknown'} - ${ICON.CLOCK} ${ts}`
        );
      }
      return null;
    default:
      return null;
  }
}

module.exports = {};
