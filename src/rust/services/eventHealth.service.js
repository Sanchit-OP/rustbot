const eventBus = require('../../core/eventBus');
const rustConnectionManager = require('../client/RustConnectionManager');

class EventHealthService {
  constructor() {
    this.state = {
      rustConnected: false,
      rawMessages: 0,
      mapMarkerBatches: 0,
      pollSuccess: 0,
      pollErrors: 0,
      semanticEvents: 0,
      discordSends: 0,
      lastRawAt: null,
      lastMapMarkersAt: null,
      lastPollSuccessAt: null,
      lastPollErrorAt: null,
      lastSemanticAt: null,
      lastDiscordSendAt: null,
    };

    this.subscribe();
  }

  subscribe() {
    eventBus.subscribe('rust:connected', () => {
      this.state.rustConnected = true;
    });

    eventBus.subscribe('rust:disconnected', () => {
      this.state.rustConnected = false;
    });

    eventBus.subscribe('rust:raw_message', () => {
      this.state.rawMessages += 1;
      this.state.lastRawAt = Date.now();
    });

    eventBus.subscribe('rust:map_markers', () => {
      this.state.mapMarkerBatches += 1;
      this.state.lastMapMarkersAt = Date.now();
    });

    eventBus.subscribe('rust:map_markers_poll_success', () => {
      this.state.pollSuccess += 1;
      this.state.lastPollSuccessAt = Date.now();
    });

    eventBus.subscribe('rust:map_markers_poll_error', () => {
      this.state.pollErrors += 1;
      this.state.lastPollErrorAt = Date.now();
    });

    eventBus.subscribe('server:event', () => {
      this.state.semanticEvents += 1;
      this.state.lastSemanticAt = Date.now();
    });

    eventBus.subscribe('discord:server_event_sent', () => {
      this.state.discordSends += 1;
      this.state.lastDiscordSendAt = Date.now();
    });
  }

  getSummary() {
    const status = rustConnectionManager.getStatus();
    const rustUp = status.isConnected ? 'UP' : this.state.rustConnected ? 'UP' : 'DOWN';

    return [
      `Events | Rust:${rustUp}`,
      `raw:${this.state.rawMessages} (${formatAge(this.state.lastRawAt)})`,
      `poll:${this.state.pollSuccess}/${this.state.pollErrors} (${formatAge(this.state.lastPollSuccessAt)})`,
      `marker_polls:${this.state.mapMarkerBatches} (${formatAge(this.state.lastMapMarkersAt)})`,
      `semantic:${this.state.semanticEvents} (${formatAge(this.state.lastSemanticAt)})`,
      `discord:${this.state.discordSends} (${formatAge(this.state.lastDiscordSendAt)})`,
    ].join(' | ');
  }
}

function formatAge(timestampMs) {
  if (!timestampMs) {
    return 'never';
  }

  const diffMs = Date.now() - timestampMs;
  if (diffMs < 1000) {
    return 'now';
  }

  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) {
    return `${secs}s ago`;
  }

  const mins = Math.floor(secs / 60);
  if (mins < 60) {
    return `${mins}m ago`;
  }

  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

module.exports = new EventHealthService();
