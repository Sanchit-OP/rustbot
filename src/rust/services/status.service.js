const rustConnectionManager = require('../client/RustConnectionManager');
const logger = require('../../core/logger');

/**
 * Service for checking Rust server status
 * This is the business logic layer that coordinates between Discord and Rust
 */
class StatusService {
  /**
   * Check the status of the Rust server
   * Returns formatted status information
   */
  async checkServerStatus() {
    try {
      logger.info('Checking Rust server status...');

      const client = rustConnectionManager.getClient();
      const connectionStatus = client.getConnectionStatus();

      // If not connected, try to connect
      if (!connectionStatus.isConnected && !connectionStatus.isConnecting) {
        logger.info('Not connected to Rust server, attempting to connect...');
        await rustConnectionManager.connect();
      }

      // Get server info
      const info = await client.getInfo();
      const time = await client.getTime();

      // Format the response
      const status = {
        success: true,
        serverName: info.name || 'Unknown Server',
        players: `${info.players}/${info.maxPlayers}`,
        map: info.map || 'Unknown',
        mapSize: info.size || 'Unknown',
        wipeTime: info.wipe ? new Date(info.wipe * 1000).toLocaleString() : 'Unknown',
        gameTime: this.formatGameTime(time),
        serverIp: connectionStatus.serverIp,
        serverPort: connectionStatus.serverPort,
      };

      logger.success('Server status retrieved successfully');
      return status;
    } catch (error) {
      logger.error('Failed to check server status', { error: error.message });
      
      return {
        success: false,
        error: error.message,
        message: 'Failed to connect to Rust server. Please check your credentials and try again.',
      };
    }
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
