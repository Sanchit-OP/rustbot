# Rust+ Pairing Helper

Use this flow when `RUST_PLAYER_TOKEN` is invalid (`not_found`) or after switching servers.

## 1. Register (one-time or when auth expires)

```bash
npm run pair:register
```

Notes:

- This launches Chrome for Steam login through `rustplus.js`.
- Credentials are saved to `rustplus.config.json` (or `RUSTPLUS_CONFIG_FILE` if set).

## 2. Listen for pairing notifications

```bash
npm run pair:listen
```

This script wraps `fcm-listen` and prints a ready-to-paste `.env` block when a server pairing notification is received.

## 3. Trigger pairing in game

1. Join the Rust server.
2. Open the Rust+ pairing prompt in game and click `Pair with Server`.
3. Watch terminal output for `=== Pairing captured ===`.

## 4. Update `.env`

Copy the printed values:

- `RUST_SERVER_IP`
- `RUST_SERVER_PORT`
- `RUST_PLAYER_ID`
- `RUST_PLAYER_TOKEN`

Then restart the bot.
