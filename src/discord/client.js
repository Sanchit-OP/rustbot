const { Client, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
const logger = require('../core/logger');
const env = require('../config/env');
const discordConfig = require('../config/discord');

/**
 * Discord client setup and initialization
 */
class DiscordClient {
  constructor() {
    this.client = null;
    this.commands = new Collection();
  }

  /**
   * Initialize the Discord client
   */
  async initialize() {
    try {
      logger.info('Initializing Discord client...');

      // Create Discord client
      this.client = new Client(discordConfig.clientOptions);

      // Load commands
      await this.loadCommands();

      // Load events
      await this.loadEvents();

      // Register slash commands
      await this.registerCommands();

      // Login to Discord
      await this.client.login(env.discord.botToken);

      logger.success('Discord client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Discord client', { error: error.message });
      throw error;
    }
  }

  /**
   * Load command files
   */
  async loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = this.getCommandFiles(commandsPath);

    for (const file of commandFiles) {
      const command = require(file);
      if (command.data && command.execute) {
        this.commands.set(command.data.name, command);
        logger.debug(`Loaded command: ${command.data.name}`);
      }
    }

    logger.info(`Loaded ${this.commands.size} commands`);
  }

  /**
   * Recursively get all command files
   */
  getCommandFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.getCommandFiles(fullPath));
      } else if (item.endsWith('.command.js')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Load event files
   */
  async loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.event.js'));

    for (const file of eventFiles) {
      const event = require(path.join(eventsPath, file));
      if (event.name && event.execute) {
        if (event.once) {
          this.client.once(event.name, (...args) => event.execute(...args));
        } else {
          this.client.on(event.name, (...args) => event.execute(...args));
        }
        logger.debug(`Loaded event: ${event.name}`);
      }
    }

    logger.info(`Loaded ${eventFiles.length} events`);
  }

  /**
   * Register slash commands with Discord
   */
  async registerCommands() {
    try {
      const commands = Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());

      const rest = new REST({ version: '10' }).setToken(env.discord.botToken);

      logger.info('Registering slash commands...');

      if (env.discord.guildId) {
        // Register commands for a specific guild (faster for development)
        await rest.put(
          Routes.applicationGuildCommands(env.discord.clientId, env.discord.guildId),
          { body: commands }
        );
        logger.success(`Registered ${commands.length} guild commands`);
      } else {
        // Register commands globally (takes up to 1 hour to propagate)
        await rest.put(
          Routes.applicationCommands(env.discord.clientId),
          { body: commands }
        );
        logger.success(`Registered ${commands.length} global commands`);
      }
    } catch (error) {
      logger.error('Failed to register commands', { error: error.message });
      throw error;
    }
  }

  /**
   * Get the Discord client instance
   */
  getClient() {
    if (!this.client) {
      throw new Error('Discord client not initialized');
    }
    return this.client;
  }

  /**
   * Get a command by name
   */
  getCommand(name) {
    return this.commands.get(name);
  }
}

// Export singleton instance
module.exports = new DiscordClient();
