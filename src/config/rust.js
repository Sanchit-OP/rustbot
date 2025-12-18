/**
 * Rust+ client configuration
 */
const rustConfig = {
  // Connection settings
  connection: {
    reconnectDelay: 5000, // Delay before attempting to reconnect (ms)
    maxReconnectAttempts: 3, // Maximum number of reconnection attempts
    connectionTimeout: 10000, // Connection timeout (ms)
  },

  // Request settings
  request: {
    timeout: 5000, // Default timeout for Rust+ requests (ms)
  },
};

module.exports = rustConfig;
