const eventBus = require('../../core/eventBus');
const logger = require('../../core/logger');
const env = require('../../config/env');
const rustConnectionManager = require('../client/RustConnectionManager');

const MIN_POLL_SECONDS = 5;

class MapMarkersPoller {
  constructor() {
    this.intervalHandle = null;
    this.inFlight = false;
    this.pollSeconds = Math.max(
      MIN_POLL_SECONDS,
      Number.isFinite(env.rust.mapMarkersPollSeconds) ? env.rust.mapMarkersPollSeconds : 12
    );

    eventBus.subscribe('rust:connected', () => this.start());
    eventBus.subscribe('rust:disconnected', () => this.stop());

    logger.info(`Rust map markers poller configured (${this.pollSeconds}s interval)`);
  }

  start() {
    if (this.intervalHandle) {
      return;
    }

    this.poll().catch(error => {
      logger.warn('Initial map marker poll failed', { error: asErrorText(error) });
    });

    this.intervalHandle = setInterval(() => {
      this.poll().catch(error => {
        logger.warn('Map marker poll failed', { error: asErrorText(error) });
      });
    }, this.pollSeconds * 1000);

    logger.info('Started map marker polling');
  }

  stop() {
    if (!this.intervalHandle) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
    this.inFlight = false;
    logger.info('Stopped map marker polling');
  }

  async poll() {
    if (this.inFlight) {
      return;
    }

    this.inFlight = true;
    const startedAt = Date.now();

    try {
      const status = rustConnectionManager.getStatus();
      if (!status.isConnected) {
        return;
      }

      const client = rustConnectionManager.getClient();
      const markers = await client.getMapMarkers();

      eventBus.emitEvent('rust:map_markers', markers);
      eventBus.emitEvent('rust:map_markers_poll_success', {
        count: Array.isArray(markers) ? markers.length : 0,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      eventBus.emitEvent('rust:map_markers_poll_error', {
        error: asErrorText(error),
      });
      throw error;
    } finally {
      this.inFlight = false;
    }
  }
}

function asErrorText(error) {
  return error?.error || error?.message || String(error);
}

module.exports = new MapMarkersPoller();
