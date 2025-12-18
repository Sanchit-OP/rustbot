const rustConnectionManager = require('../client/RustConnectionManager');
const logger = require('../../core/logger');

/**
 * Aggregates data required for the live status panel.
 * Returns raw data with no Discord formatting.
 */
class PanelService {
  constructor() {
    this.hasLoggedTeamShape = false;
  }
  /**
   * Fetch server and team data for the live panel.
   * @returns {Promise<{server: object, team: object, updatedAt: string}>}
   */
  async getPanelData() {
    try {
      logger.info('Fetching panel data...');

      // Ensure connection is established
      await rustConnectionManager.ensureConnected();

      const client = rustConnectionManager.getClient();

      const info = await client.getInfo();
      const time = await client.getTime();

      let teamInfo = null;
      try {
        teamInfo = await client.getTeamInfo();
        if (!this.hasLoggedTeamShape) {
          logger.info('Team data sample', { teamInfo });
          this.hasLoggedTeamShape = true;
        }
      } catch (teamError) {
        logger.warn('Team info unavailable; continuing without it', { error: teamError.message });
        teamInfo = null;
      }

      const server = {
        name: info?.name || 'Unknown Server',
        players: info?.players ?? null,
        maxPlayers: info?.maxPlayers ?? null,
        map: info?.map || null,
        mapSize: info?.size ?? null,
        wipe: info?.wipe ?? null,
        time: time || null,
        address: {
          ip: client.serverIp,
          port: client.serverPort,
        },
      };

      const team = teamInfo || null;

      return {
        server,
        team,
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to fetch panel data', { error: error.message });
      throw error;
    }
  }
}

module.exports = new PanelService();
