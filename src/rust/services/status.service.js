const rustConnectionManager = require('../client/RustConnectionManager');
const logger = require('../../core/logger');

/**
 * Service for checking Rust server status
 * This is the business logic layer that coordinates between Discord and Rust
 * 
 * IMPORTANT: This service REQUESTS DATA, it does NOT manage connections
 * Connection management is the sole responsibility of RustConnectionManager
 */
class StatusService {
  /**
   * Check the status of the Rust server
   * Returns formatted status information
   */
  async checkServerStatus() {
    try {
      logger.info('Checking Rust server status...');

      // Ensure connection is established (manager handles this)
      await rustConnectionManager.ensureConnected();

      // Get the client to make API calls
      const client = rustConnectionManager.getClient();
      const connectionStatus = client.getConnectionStatus();

      // Get server info
      const info = await client.getInfo();
      const time = await client.getTime();

      // Format the response
      const status = {
        success: true,
        serverName: info.name || 'Unknown Server',
        players: `${info.players}/${info.maxPlayers}`,
        map: info.map || 'Unknown',
        mapSize: info.mapSize || info.size || 'Unknown',
        wipeTime: info.wipe ? new Date(info.wipe * 1000).toLocaleString() : 'Unknown',
        gameTime: this.formatGameTime(time),
        serverIp: connectionStatus.serverIp,
        serverPort: connectionStatus.serverPort,
      };

      logger.success('Server status retrieved successfully');
      return status;
    } catch (error) {
      const errorText = getErrorMessage(error);
      logger.error('Failed to check server status', { error: errorText });
      const hint = this.getConnectionHint(error);
      
      return {
        success: false,
        error: errorText,
        message: hint || 'Failed to connect to Rust server. Please check your credentials and try again.',
      };
    }
  }

  getConnectionHint(error) {
    const message = getErrorMessage(error).toLowerCase();

    if (message.includes('parse error: expected http/')) {
      return 'Connection endpoint appears incorrect. Use the Rust+ app.port from server.cfg (not the game/query port).';
    }

    if (message.includes('not_found')) {
      return 'Rust+ credentials were accepted at socket level but request auth failed (not_found). Re-pair this server and update RUST_PLAYER_ID / RUST_PLAYER_TOKEN for the same Steam account.';
    }

    return null;
  }

  /**
   * Format game time into a readable string
   */
  formatGameTime(time) {
    if (!time || typeof time.time === 'undefined') {
      return 'Unknown';
    }

    const hours = Math.floor(time.time);
    const minutes = Math.floor((time.time - hours) * 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  /**
   * Get simple connection status
   */
  getConnectionStatus() {
    const status = rustConnectionManager.getStatus();
    return {
      isConnected: status.isConnected,
      isConnecting: status.isConnecting,
      serverIp: status.serverIp,
      serverPort: status.serverPort,
    };
  }
}

// Export singleton instance
module.exports = new StatusService();

function getErrorMessage(error) {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.error && typeof error.error === 'string') {
    return error.error;
  }

  if (error?.message && typeof error.message === 'string') {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch (jsonError) {
    return String(error);
  }
}
