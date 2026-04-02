const { MessageFlags } = require('discord.js');
const botMessage = require('../../core/botMessage');
const { safeFollowUp, safeReply } = require('../utils/interactionResponse');

const STATUS_ONLY_COMMANDS = new Set(['panel']);

/**
 * Soft guard to restrict status-only commands to the configured status channel.
 * Returns true when execution should proceed, false when already handled.
 */
async function statusChannelGuard(interaction, guildConfig) {
  if (!STATUS_ONLY_COMMANDS.has(interaction.commandName)) {
    return true;
  }

  const statusChannelId = guildConfig?.statusChannelId;

  // Allow if channel matches stored status channel
  if (statusChannelId && interaction.channelId === statusChannelId) {
    return true;
  }

  const statusChannelMention = statusChannelId ? `<#${statusChannelId}>` : 'the Rust status channel';
  const message = botMessage.prefix(`Please use this command in ${statusChannelMention}.`);

  const payload = { content: message, flags: MessageFlags.Ephemeral };

  if (interaction.replied || interaction.deferred) {
    await safeFollowUp(interaction, payload, 'statusChannel.guard');
  } else {
    await safeReply(interaction, payload, 'statusChannel.guard');
  }

  return false;
}

module.exports = statusChannelGuard;
