const STATUS_ONLY_COMMANDS = new Set(['panel', 'server', 'team']);

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
  const message = `Please use this command in ${statusChannelMention}.`;

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({ content: message, ephemeral: true });
  } else {
    await interaction.reply({ content: message, ephemeral: true });
  }

  return false;
}

module.exports = statusChannelGuard;
