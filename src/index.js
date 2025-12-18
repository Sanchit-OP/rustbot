/**
 * Main entry point for the Rust+ Discord Bot
 * This file orchestrates the initialization of all components
 */

const logger = require('./core/logger');
const errorHandler = require('./core/errorHandler');
const env = require('./config/env');
const discordClient = require('./discord/client');
const rustConnectionManager = require('./rust/client/RustConnectionManager');

// Load event handlers
require('./rust/events/connection.event');

/**
 * Initialize the application
 */
async function initialize() {
  try {
    logger.info('Starting Rust+ Discord Bot...');

    // Register global error handlers
    errorHandler.register();

    // Validate environment variables
    env.validate();
    logger.success('Environment variables validated');

    // Initialize Rust connection manager
    rustConnectionManager.initialize();

    // Initialize Discord client (this will also login)
    await discordClient.initialize();

    logger.success('Bot initialization complete!');
  } catch (error) {
    logger.error('Failed to initialize bot', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown() {
  logger.info('Shutting down bot...');

  try {
    // Disconnect from Rust server
    rustConnectionManager.disconnect();

    // Destroy Discord client
    const client = discordClient.getClient();
    if (client) {
      await client.destroy();
    }

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the bot
initialize();
