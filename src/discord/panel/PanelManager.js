const { ChannelType } = require('discord.js');
const logger = require('../../core/logger');
const discordConfig = require('../../config/discord');
const guildConfigStore = require('../../storage/guildConfig.store');
const { posToGrid, DEFAULT_MAP_SIZE } = require('../../core/utils/grid');

/**
 * Manages the live panel message per guild.
 * No Rust calls; accepts prepared panel data and updates a single pinned message.
 */
class PanelManager {
  constructor() {
    this.intervals = new Map();
  }

  /**
   * Ensure the status channel exists and return it.
   */
  async ensureStatusChannel(guild) {
    const desiredName = discordConfig.STATUS_CHANNEL_NAME;
    const storedChannelId = guildConfigStore.getStatusChannelId(guild.id);

    if (storedChannelId) {
      const channel = guild.channels.cache.get(storedChannelId);
      if (channel) {
        return channel;
      }
    }

    const existingByName = guild.channels.cache.find(
      channel => channel.name === desiredName && channel.type === ChannelType.GuildText
    );

    if (existingByName) {
      guildConfigStore.setStatusChannelId(guild.id, existingByName.id);
      return existingByName;
    }

    const newChannel = await guild.channels.create({
      name: desiredName,
      type: ChannelType.GuildText,
      topic: 'Rust status dashboard',
    });
    guildConfigStore.setStatusChannelId(guild.id, newChannel.id);
    logger.success(`Created status channel "${desiredName}" in guild: ${guild.name}`);

    return newChannel;
  }

  /**
   * Ensure the panel message exists and is pinned.
   */
  async ensurePanelMessage(guild, channel) {
    if (!channel) {
      channel = await this.ensureStatusChannel(guild);
    }

    const botUserId = channel.client?.user?.id;
    const storedMessageId = guildConfigStore.getStatusPanelMessageId(guild.id);

    if (storedMessageId) {
      const message = await this.fetchMessageSafe(channel, storedMessageId);
      if (message) {
        if (!message.pinned) {
          await message.pin().catch(() => {});
        }
        return message;
      }
    }

    if (botUserId) {
      try {
        const pinned = await channel.messages.fetchPins();
        const candidates = pinned?.values ? Array.from(pinned.values()) : Array.isArray(pinned) ? pinned : [];
        logger.debug?.('Pinned messages fetched', {
          guildId: guild.id,
          channelId: channel.id,
          pinnedCount: candidates.length,
        });
        const existing = candidates.find(msg => msg.author?.id === botUserId);
        if (existing) {
          guildConfigStore.setStatusPanelMessageId(guild.id, existing.id);
          if (!existing.pinned) {
            await existing.pin().catch(() => {});
          }
          return existing;
        }

        if (candidates.length > 0) {
          const reuse = candidates[0];
          guildConfigStore.setStatusPanelMessageId(guild.id, reuse.id);
          if (!reuse.pinned) {
            await reuse.pin().catch(() => {});
          }
          return reuse;
        }
      } catch (error) {
        logger.warn('Failed to fetch pinned messages while ensuring panel', {
          channelId: channel.id,
          guildId: guild.id,
          error: error.message,
        });
      }

      try {
        const recent = await channel.messages.fetch({ limit: 50 });
        const botMessages = recent.filter(msg => msg.author?.id === botUserId);
        if (botMessages.size > 0) {
          const nonSystem = botMessages.filter(m => !m.system);
          const latest = (nonSystem.size > 0 ? nonSystem : botMessages)
            .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
            .first();
          if (latest) {
            guildConfigStore.setStatusPanelMessageId(guild.id, latest.id);
            return latest;
          }
        }
      } catch (error) {
        logger.warn('Failed to fetch recent messages while ensuring panel', {
          channelId: channel.id,
          guildId: guild.id,
          error: error.message,
        });
      }
    }

    const newMessage = await channel.send('Initializing Rust status panel...');
    await newMessage.pin().catch(() => {});

    guildConfigStore.setStatusPanelMessageId(guild.id, newMessage.id);
    logger.info(`Created and pinned panel message in guild: ${guild.name}`);

    return newMessage;
  }

  /**
   * Update the panel message with new data.
   * Accepts panelData: { server, team, updatedAt }
   */
  async updatePanel(guild, panelData) {
    const channel = await this.ensureStatusChannel(guild);
    const content = this.buildPanelContent(panelData);

    let message = await this.ensurePanelMessage(guild, channel);

    try {
      await message.edit({ content });
    } catch (error) {
      logger.warn('Panel message missing; recreating', {
        guildId: guild.id,
        guild: guild.name,
        messageId: message.id,
        error: error.message,
      });
      message = await channel.send(content);
      await message.pin().catch(() => {});
      guildConfigStore.setStatusPanelMessageId(guild.id, message.id);
    }

    if (!message.pinned) {
      await message.pin().catch(() => {});
    }
  }

  /**
   * Build plain text panel content (no Discord embeds).
   */
  buildPanelContent(panelData) {
    const { server, team, updatedAt } = panelData;
    const lines = [];

    lines.push('╔═ Rust Status ═════════════════╗');
    lines.push(...this.buildServerSection(server));
    lines.push('╚══════════════════════════════╝');
    lines.push('');
    lines.push(...this.buildTeamSection(team, server));
    lines.push('');
    const updatedSeconds = Math.floor(
      updatedAt ? new Date(updatedAt).getTime() / 1000 : Date.now() / 1000
    );
    lines.push(`Last Updated: <t:${updatedSeconds}:R>`);

    return lines.join('\n');
  }

  async fetchMessageSafe(channel, messageId) {
    try {
      return await channel.messages.fetch(messageId);
    } catch (error) {
      logger.warn('Panel message missing or inaccessible; will recreate', {
        channelId: channel.id,
        messageId,
        error: error.message,
      });
      return null;
    }
  }

  startAutoUpdate(guild, updateFn, intervalSeconds) {
    if (this.intervals.has(guild.id)) {
      logger.info(`Panel auto-update already running for guild: ${guild.name}`);
      return;
    }

    const intervalMs = intervalSeconds * 1000;
    const handle = setInterval(async () => {
      try {
        await updateFn();
      } catch (error) {
        logger.error('Panel auto-update failed', {
          guildId: guild.id,
          guild: guild.name,
          error: error.message,
        });
      }
    }, intervalMs);

    this.intervals.set(guild.id, handle);
    logger.info(`Started panel auto-update for guild: ${guild.name} (${intervalSeconds}s)`);
  }

  stopAutoUpdate(guildId) {
    const handle = this.intervals.get(guildId);
    if (handle) {
      clearInterval(handle);
      this.intervals.delete(guildId);
      logger.info(`Stopped panel auto-update for guild: ${guildId}`);
    }
  }

  getStatusChannelId(guildId) {
    return guildConfigStore.getStatusChannelId(guildId);
  }

  buildTeamSection(team, server) {
    if (!team || !Array.isArray(team.members)) {
      return ['Team: unavailable'];
    }

    const members = team.members || [];
    const onlineCount = members.filter(m => m.isOnline).length;
    const total = members.length;
    const mapSize = server?.mapSize || DEFAULT_MAP_SIZE;

    const lines = [];
    lines.push(`👥 Team Status — ${onlineCount} / ${total} Online`);

    const maxRows = 12;
    members.slice(0, maxRows).forEach(member => {
      const dot = this.getStatusDot(member);
      const name = member.name || member.steamId || 'Unknown';
      const info = this.getMemberInfo(member, mapSize);
      lines.push(info ? `${dot} ${name} — ${info}` : `${dot} ${name}`);
    });

    if (members.length > maxRows) {
      lines.push(`(+${members.length - maxRows} more)`);
    }

    return lines;
  }

  buildServerSection(server) {
    if (!server) {
      return ['Server data unavailable'];
    }

    const name = server.name || 'Unknown Server';
    const players = `${server.players ?? '?'} / ${server.maxPlayers ?? '?'}`;
    const address = server.address ? `${server.address.ip}:${server.address.port}` : 'Unknown';
    const gameTime = this.formatGameTime(server.time);

    return [
      `║ 📡 Server: ${name}`,
      `║ 👥 Players: ${players}`,
      `║ 🌐 ${address}`,
      `║ 🕒 Game: ${gameTime}`,
    ];
  }

  formatGameTime(time) {
    if (!time || typeof time.time === 'undefined') {
      return 'Unknown';
    }
    const hours = Math.floor(time.time);
    const minutes = Math.floor((time.time - hours) * 60);
    const displayHours = hours % 24;
    return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  getStatusDot(member) {
    if (member.isAlive === false) return '🔴';
    if (member.isOnline) return '🟢';
    return '⚪';
  }

  getMemberInfo(member, mapSize) {
    const parts = [];
    const grid = this.getGridForMember(member, mapSize);
    if (grid) parts.push(`Grid ${grid}`);

    if (member.deathTime) {
      parts.push(`died ${this.formatRelativeUnix(member.deathTime)}`);
    } else if (member.spawnTime && !member.isOnline) {
      parts.push(`last seen ${this.formatRelativeUnix(member.spawnTime)}`);
    }

    if (parts.length === 0) return null;
    return parts.join(' • ');
  }

  getGridForMember(member, mapSize) {
    if (Number.isFinite(member?.x) && Number.isFinite(member?.y)) {
      return posToGrid(member.x, member.y, mapSize);
    }
    return null;
  }

  formatRelativeUnix(unixSeconds) {
    const timestampMs = unixSeconds * 1000;
    if (!Number.isFinite(timestampMs)) return 'unknown time';
    const diffMs = Date.now() - timestampMs;
    if (diffMs < 0) return 'just now';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}

module.exports = new PanelManager();
