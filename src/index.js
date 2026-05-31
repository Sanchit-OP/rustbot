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
require('./rust/events/world.event');
require('./rust/events/teamChatBootstrap.event');
require('./rust/events/mapMarkersPoller.event');
require('./rust/events/teamEventAnnouncer.event');
require('./rust/interpreters/serverEvents.interpreter');
require('./rust/interpreters/teamChat.interpreter');
require('./rust/events/teamChatCommand.event');
require('./rust/events/teamTracker.event');
require('./discord/events/serverEvents.handler');

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

    // Real-time features (events + in-game chat commands) need an active Rust connection.
    // Attempt now; if it fails, reconnect loop will continue in background.
    rustConnectionManager.ensureConnected().catch((error) => {
      logger.warn('Initial Rust connection attempt failed; reconnect loop will continue', {
        error: error?.error || error?.message || String(error),
      });
      rustConnectionManager.handleReconnect().catch((reconnectError) => {
        logger.error('Failed to start reconnect loop', {
          error: reconnectError?.error || reconnectError?.message || String(reconnectError),
        });
      });
    });

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
