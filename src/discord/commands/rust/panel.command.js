const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const panelService = require('../../../rust/services/panel.service');
const panelManager = require('../../panel/PanelManager');
const guildConfigStore = require('../../../storage/guildConfig.store');
const logger = require('../../../core/logger');
const { DEFAULT_PANEL_INTERVAL_SECONDS } = require('../../../config/discord');

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
      await interaction.reply({
        content: 'This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
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
      await interaction.editReply({
        content: `Failed to update panel: ${error.message}`,
      });
    }
  },
};

async function handleStart(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

  await interaction.editReply({
    content: `Panel updates started. Live panel in ${channelMention} (every ${DEFAULT_PANEL_INTERVAL_SECONDS}s).`,
  });
}

async function handleRefresh(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const panelData = await panelService.getPanelData();
  await panelManager.updatePanel(interaction.guild, panelData);

  const channelMention = getStatusChannelMention(interaction.guild.id);

  await interaction.editReply({
    content: `Panel refreshed in ${channelMention}.`,
  });
}

function getStatusChannelMention(guildId) {
  const channelId = guildConfigStore.getStatusChannelId(guildId);
  return channelId ? `<#${channelId}>` : 'the status channel';
}

async function handleStop(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  panelManager.stopAutoUpdate(interaction.guild.id);
  guildConfigStore.setPanelEnabled(interaction.guild.id, false);

  await interaction.editReply({
    content: 'Panel updates stopped. The panel message remains pinned.',
  });
}
