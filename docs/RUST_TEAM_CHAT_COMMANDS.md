# Rust Team Chat Commands

The bot can now listen to in-game Rust team chat and respond in the same team chat.

## Enable

No extra setup is required beyond working Rust+ credentials.

Optional `.env` settings:

```env
RUST_CHAT_COMMAND_PREFIX=!
RUST_CHAT_ALLOWED_STEAM_IDS=7656119...,7656119...
RUST_MAP_MARKERS_POLL_SECONDS=12
```

- `RUST_CHAT_COMMAND_PREFIX` default is `!`.
- `RUST_CHAT_ALLOWED_STEAM_IDS` is optional comma-separated allowlist.
- `RUST_MAP_MARKERS_POLL_SECONDS` controls map marker polling interval for world events (minimum 5).

## Commands (in Rust team chat)

- `!help`
- `!players`
- `!time`
- `!crate`
- `!c_time`
- `!events`
- `!remind 05:00 meds`

## Notes

- Commands are deduplicated for short bursts to avoid duplicate handling.
- Per-user cooldown is applied (2 seconds).
- Bot responses are posted directly back to Rust team chat.
- `!c_time` intentionally gives no response if no crate timer is active.
- `!crate` starts a 15:00 timer and auto-alerts at 10:00, 05:00, 01:00, and 00:10 remaining.
- `!events` returns event-pipeline health (Rust connection, marker polls, semantic event counts, Discord sends).
- `!remind` supports `mm:ss`, `Xm`, `Xs`, or raw seconds (5s to 2h range).
- World events are auto-announced in Rust team chat (no command needed): heli, cargo, oil events.
