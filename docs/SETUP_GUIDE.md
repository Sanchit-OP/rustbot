# Setup Guide - Getting Your Credentials

This guide will walk you through obtaining all the necessary credentials for your Rust+ Discord bot.

---

## 1. Discord Bot Credentials

### Getting Your Discord Bot Token

1. **Go to Discord Developer Portal**

   - Visit: https://discord.com/developers/applications
   - Log in with your Discord account

2. **Create a New Application**

   - Click "New Application" button (top right)
   - Give it a name (e.g., "Rust+ Bot")
   - Click "Create"

3. **Create a Bot**

   - In the left sidebar, click "Bot"
   - Click "Add Bot" and confirm
   - Under the bot's username, click "Reset Token" then "Copy"
   - **Save this token** - this is your `DISCORD_BOT_TOKEN`

4. **Get Your Client ID**

   - In the left sidebar, click "OAuth2" → "General"
   - Copy the "Client ID" at the top
   - **Save this** - this is your `DISCORD_CLIENT_ID`

5. **Enable Required Intents**

   - Go back to the "Bot" section
   - Scroll down to "Privileged Gateway Intents"
   - Enable:
     - ✅ Presence Intent
     - ✅ Server Members Intent
     - ✅ Message Content Intent
   - Click "Save Changes"

6. **Invite Bot to Your Server**
   - Go to "OAuth2" → "URL Generator"
   - Select scopes: `bot`, `applications.commands`
   - Select bot permissions: `Administrator` (or customize as needed)
   - Copy the generated URL and open it in your browser
   - Select your server and authorize

---

## 2. Rust+ Server Credentials

### Method 1: Using Rust+ Mobile App (Easiest)

1. **Install Rust+ Mobile App**

   - Download from App Store (iOS) or Google Play (Android)
   - Log in with your Steam account

2. **Pair with a Server**

   - Join a Rust server in-game that has Rust+ enabled
   - Open the Rust+ app on your phone
   - The server should appear in the app
   - Tap on the server to connect

3. **Get Server Details from the App**
   - Server IP and Port are visible in the app
   - **Note:** You'll need to extract these programmatically or use a pairing method

### Method 2: Using rustplus.js Pairing (Recommended)

The rustplus.js library provides a pairing system that makes this much easier!

1. **Get Your Steam ID**

   - Go to: https://steamid.io/
   - Enter your Steam profile URL
   - Copy your **SteamID64** - this is your `RUST_PLAYER_ID`

2. **Use the Pairing System**
   - We'll create a pairing script that listens for pairing notifications
   - In-game, you'll use the command: `/pair <code>`
   - The script will automatically capture your server details and player token

**We'll create a pairing script in the next step that automates this process!**

---

## 3. Quick Reference

Once you have all credentials, create a `.env` file in the root directory:

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_actual_discord_bot_token
DISCORD_CLIENT_ID=your_actual_discord_client_id

# Rust+ Server Configuration (obtained via pairing)
RUST_SERVER_IP=123.456.789.0
RUST_SERVER_PORT=28082
RUST_PLAYER_ID=your_steam_id_64
RUST_PLAYER_TOKEN=obtained_from_pairing

# Optional Rust in-game team chat commands
RUST_CHAT_COMMAND_PREFIX=!
# Optional allowlist (comma separated steam IDs). Leave empty to allow all team members.
# RUST_CHAT_ALLOWED_STEAM_IDS=7656119...,7656119...
# Optional map marker poll interval for world events (seconds, min 5)
# RUST_MAP_MARKERS_POLL_SECONDS=12
```

---

## 4. Security Notes

⚠️ **IMPORTANT:**

- **NEVER** commit your `.env` file to git
- **NEVER** share your bot token or player token publicly
- Keep your credentials secure
- If a token is compromised, regenerate it immediately

---

## Next Steps

After obtaining your credentials:

1. Copy `.env.example` to `.env`
2. Fill in your actual credentials
3. Run the pairing script (we'll create this) to get Rust+ credentials
4. Start your bot!

---

## Troubleshooting

### Discord Bot Not Responding

- Check if bot token is correct
- Verify bot has proper permissions in your server
- Ensure Message Content Intent is enabled

### Can't Connect to Rust Server

- Verify the server has Rust+ enabled
- Check if server IP and port are correct
- Ensure your player token hasn't expired (re-pair if needed)

### Pairing Not Working

- Make sure you're on the correct Rust server
- Verify your Steam ID is correct
- Try re-pairing with a new code

---

## Pairing Helper Script (Repo)

This repo now includes helper commands:

```bash
npm run pair:register
npm run pair:listen
```

`pair:listen` prints a copy-ready `.env` block when a Rust+ server pairing notification is received.
