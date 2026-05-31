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

Run the config script and paste in the printed values when prompted:

```powershell
.\scripts\set-server.ps1
```

Or pass them directly without prompts:

```powershell
.\scripts\set-server.ps1 -Ip 1.2.3.4 -Port 28082 -PlayerId 765611... -PlayerToken 123456789
```

The bot will auto-fetch map size from the new server on startup — no need to set it manually.

Then restart the bot:

```powershell
npm start
```
