const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const panelService = require('../../../rust/services/panel.service');
const panelManager = require('../../panel/PanelManager');
const guildConfigStore = require('../../../storage/guildConfig.store');
const logger = require('../../../core/logger');
const botMessage = require('../../../core/botMessage');
const { DEFAULT_PANEL_INTERVAL_SECONDS } = require('../../../config/discord');
const {
  safeDeferReply,
  safeReply,
  safeEditReply,
} = require('../../utils/interactionResponse');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Manage the Rust status panel')
    .addSubcommand(sub =>
      sub.setName('start').setDescription('Start the live panel updates')
    )
    .addSubcommand(sub =>
      sub.setName('refresh').setDescription('Refresh the live panel once')
    )
    .addSubcommand(sub =>
      sub.setName('stop').setDescription('Stop live panel updates')
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await safeReply(interaction, {
        content: botMessage.prefix('This command can only be used in a server.'),
        flags: MessageFlags.Ephemeral,
      }, 'panel.command.guildOnly');
      return;
    }

    try {
      const subcommand = interaction.options.getSubcommand(true);

      if (subcommand === 'refresh') {
        await handleRefresh(interaction);
        return;
      }

      if (subcommand === 'stop') {
        await handleStop(interaction);
        return;
      }

      await handleStart(interaction);
    } catch (error) {
      logger.error('Failed to update panel', { error: error.message });
      await safeEditReply(interaction, {
        content: botMessage.prefix(`Failed to update panel: ${error.message}`),
      }, 'panel.command.catch');
    }
  },
};

async function handleStart(interaction) {
  await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral }, 'panel.start.defer');

  // Initial update ensures channel + message exist and stores ids
  const panelData = await panelService.getPanelData();
  await panelManager.updatePanel(interaction.guild, panelData);

  // Start interval if not already running
  panelManager.startAutoUpdate(
    interaction.guild,
    async () => {
      const data = await panelService.getPanelData();
      await panelManager.updatePanel(interaction.guild, data);
    },
    DEFAULT_PANEL_INTERVAL_SECONDS
  );

  guildConfigStore.setPanelEnabled(interaction.guild.id, true);

  const channelMention = getStatusChannelMention(interaction.guild.id);

  await safeEditReply(interaction, {
    content: botMessage.prefix(
      `Panel updates started. Live panel in ${channelMention} (every ${DEFAULT_PANEL_INTERVAL_SECONDS}s).`
    ),
  }, 'panel.start.reply');
}

async function handleRefresh(interaction) {
  await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral }, 'panel.refresh.defer');

  const panelData = await panelService.getPanelData();
  await panelManager.updatePanel(interaction.guild, panelData);

  const channelMention = getStatusChannelMention(interaction.guild.id);

  await safeEditReply(interaction, {
    content: botMessage.prefix(`Panel refreshed in ${channelMention}.`),
  }, 'panel.refresh.reply');
}

function getStatusChannelMention(guildId) {
  const channelId = guildConfigStore.getStatusChannelId(guildId);
  return channelId ? `<#${channelId}>` : 'the status channel';
}

async function handleStop(interaction) {
  await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral }, 'panel.stop.defer');

  panelManager.stopAutoUpdate(interaction.guild.id);
  guildConfigStore.setPanelEnabled(interaction.guild.id, false);

  await safeEditReply(interaction, {
    content: botMessage.prefix('Panel updates stopped. The panel message remains pinned.'),
  }, 'panel.stop.reply');
}
