# System Context and Failure Analysis (2026-04-02)

This document is a current-state snapshot of the repository and runtime behavior, based on source review plus a live startup run on April 2, 2026.

## 1. Repository Snapshot

- Runtime: Node.js app (`npm start` -> `node src/index.js`)
- Main dependency surface:
  - `discord.js` v14
  - `@liamcottle/rustplus.js`
  - `dotenv`
- Entry point: `src/index.js`
- Layers used in code:
  - `src/discord` (UI, commands, Discord routing)
  - `src/rust` (Rust+ client, connection manager, event interpretation)
  - `src/core` (logger, event bus, process error hooks)
  - `src/storage` (JSON-backed guild settings)

Tracked source files are small enough to audit fully. Current architecture is clean in intent, but there are runtime reliability issues and some critical design gaps.

## 2. How the System Currently Works

### 2.1 Startup path

1. `src/index.js` loads env and registers global error handlers.
2. Rust connection manager initializes a single Rust client wrapper (lazy connect).
3. Discord client initializes:
   - Loads commands/events dynamically
   - Registers slash commands
   - Logs in
4. `clientReady` handler:
   - Ensures `rust-status`, `server-events`, and `test-commands-bot` channels
   - Starts/resumes panel auto-updates for all guilds

### 2.2 Command path

- `/status` -> `status.command.js` -> `status.service.js` -> `RustConnectionManager.ensureConnected()` -> Rust API calls (`getInfo`, `getTime`) -> embed response.
- `/panel start|refresh|stop` -> panel service + panel manager + guild config flags.

### 2.3 Event path

- Rust client emits low-level events to `eventBus`.
- `world.event.js` forwards raw Rust map/entity events.
- `serverEvents.interpreter.js` derives semantic events (cargo, heli, oil rig, chinook) and emits `server:event`.
- `discord/events/serverEvents.handler.js` posts messages into configured `server-events` channel.

## 3. Observed Runtime Behavior (Live Run)

A live run (`npm start`) succeeded in Discord login and command registration, but the Rust connection path became unstable.

Observed sequence:

- Discord startup healthy (bot logs in, channels present, panel loop starts).
- Panel loop triggers Rust fetch every 60s.
- Rust connections frequently timeout (`ETIMEDOUT` / `Connection timeout`).
- Reconnect logic starts overlapping attempts.
- Log pattern repeatedly shows:
  - `Initiating auto-reconnect...`
  - Multiple concurrent `Attempting to reconnect (x/5)...`
  - `Already connected or connecting to Rust server`
  - Panel auto-update failures
- During `/status`, interaction handling eventually degraded to:
  - `Unknown interaction`
  - `Interaction has already been acknowledged`
  - uncaught exception logged by global handler

This reproduces the "system not working" symptoms and confirms instability is not only setup-related.

## 4. Main Structural Problems

### 4.1 Rust reconnection concurrency is not serialized

Primary files:

- `src/rust/client/RustConnectionManager.js`
- `src/rust/client/RustClient.js`
- `src/rust/events/connection.event.js`

Issues:

- `handleReconnect()` can be triggered multiple times in parallel from repeated disconnect/error events.
- No reconnect mutex/singleflight guard exists.
- Recursive retry (`await this.handleReconnect()`) compounds overlap under noisy disconnects.
- `ensureConnected()` does wait-loop polling, but no shared in-flight promise; different callers still race.

Impact:

- Reconnect storms.
- Inconsistent `isConnecting`/`isConnected` timing perception across callers.
- Panel and command paths contend for connection lifecycle.

### 4.2 Interaction error handling can double-acknowledge under failure

Primary files:

- `src/discord/commands/status.command.js`
- `src/discord/events/interactionCreate.event.js`

Issues:

- Command-level catch may reply/edit; event-level catch also replies/followups.
- Under delayed/failed interactions, this can produce `Interaction has already been acknowledged`.
- A command failure can cascade into a second response attempt.

Impact:

- User-facing command failures.
- Extra exceptions during already degraded conditions.

### 4.3 Panel loop always resumes on startup for every guild

Primary file:

- `src/discord/events/ready.event.js`

Issue:

- `resumePanels()` starts updates for every guild on boot and sets `panelEnabled = true`, regardless of prior intent.

Impact:

- Immediate Rust polling pressure at startup.
- Harder to isolate failures while troubleshooting.

### 4.4 Multi-server support is fundamentally absent

Primary files:

- `src/config/env.js`
- `src/rust/client/RustConnectionManager.js`
- `src/rust/interpreters/serverEvents.interpreter.js`
- `src/storage/guildConfig.store.js`

Issue:

- Only one global Rust server credential set is supported (`RUST_SERVER_*` + one player token).
- Connection manager owns a single client instance globally.
- Server event interpreter annotates events with one env guild id fallback.
- Guild config has channel/message ids, but no per-guild or per-server Rust credential model.

Impact:

- Cannot attach different Rust servers cleanly.
- Guild isolation is incomplete.
- Scaling beyond one server requires architectural change, not a minor patch.

### 4.5 Event listener lifecycle may duplicate over reconnects

Primary file:

- `src/rust/events/world.event.js`

Issue:

- On each `rust:connected`, listeners are attached again to the current underlying Rust+ client object without explicit dedupe/cleanup strategy.

Impact:

- Risk of duplicate event emission/spam over reconnect cycles.

### 4.6 Security and operational hygiene gaps

Findings:

- Secrets are present in local config artifacts (`.env` and `rustplus.config.json` contents observed in workspace).
- `rustplus.config.json` is tracked in git history despite being listed in `.gitignore` now.
- `data/guildConfig.json` is also tracked, coupling runtime state to repository commits.

Impact:

- Credential leakage risk.
- Harder environment portability.

## 5. What Is Working

- Discord client boot, slash command registration, and guild channel creation.
- Layer boundaries are mostly respected (Discord does not call Rust APIs directly).
- Core logging and process-level error hooks are in place.
- Event interpreter logic and panel rendering structure are conceptually solid.

## 6. Documentation Drift

Existing docs (`docs/verticle-layer.md`, `docs/bot-context.md`) describe intended architecture well, but they understate current runtime instability and do not cover key production blockers:

- reconnection concurrency
- interaction double-ack failure mode
- missing multi-server model
- credential/state hygiene problems

## 7. Recommended Recovery Plan (Priority Order)

### Phase 0 - Stabilize runtime (must do first)

1. Add a singleflight connection gate in `RustConnectionManager` (shared in-flight connect/reconnect promise).
2. Ensure only one reconnect loop can run at a time.
3. Add backoff strategy and hard circuit-breaker when Rust endpoint is unreachable.
4. Make panel auto-start opt-in based on stored `panelEnabled` instead of forcing `true` at boot.

### Phase 1 - Harden Discord interaction handling

1. Centralize interaction response ownership (command OR router, not both).
2. Add safe response helpers (`safeReply`, `safeEditReply`, `safeFollowUp`) with swallow/log behavior for known Discord interaction states.

### Phase 2 - Introduce real multi-server model

1. Define `servers[]` model in storage with per-server credentials.
2. Associate guild -> selected server id (or many-to-many if needed).
3. Replace singleton Rust client with keyed connection pool (`serverId -> client/manager`).
4. Route events/status/panel by guild-selected server context.

### Phase 3 - Secure configs and state

1. Remove tracked secrets and rotate exposed tokens.
2. Stop tracking runtime state files (`data/guildConfig.json`) unless intentionally used as fixtures.
3. Add `.env.example` and explicit secret handling policy.

### Phase 4 - Observability and regression protection

1. Add health/status command for Rust connection internals.
2. Add minimal tests for reconnection gate and interaction response safety.
3. Add structured metrics counters (connect attempts, reconnect loops, panel failures).

## 8. Suggested "Read First" File List for Future Sessions

- `src/index.js`
- `src/rust/client/RustConnectionManager.js`
- `src/rust/client/RustClient.js`
- `src/discord/events/ready.event.js`
- `src/discord/events/interactionCreate.event.js`
- `src/discord/commands/status.command.js`
- `src/rust/events/world.event.js`
- `src/rust/interpreters/serverEvents.interpreter.js`
- `src/storage/guildConfig.store.js`

## 9. Summary

The codebase has a good modular skeleton, but current failures are dominated by connection lifecycle concurrency and missing server tenancy model. The system is effectively single-server and becomes unstable when Rust connectivity is flaky. Stabilizing reconnect logic and introducing per-server context are the two highest-value actions before adding new features.
