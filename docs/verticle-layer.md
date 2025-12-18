# Vertical Layer Architecture

This document provides a comprehensive overview of the bot's architecture, implemented features, and the purpose of each file in the codebase.

## Architecture Overview

The bot follows a **strict vertical layer architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────┐
│         Discord Layer (UI)              │
│  Commands, Events, User Interactions    │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│       Service Layer (Business Logic)    │
│   Coordinates between Discord & Rust    │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         Rust Layer (Data Source)        │
│    Rust+ API Integration & Management   │
└─────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│      Core Layer (Infrastructure)        │
│  Logging, Events, Error Handling, Config│
└─────────────────────────────────────────┘
```

**Key Principle:** The Discord layer NEVER directly calls the Rust layer. All communication flows through the Service layer.

---

## Implemented Features

### ✅ Core Features

- **Discord Bot Integration**: Fully functional Discord.js v14 bot with slash commands
- **Rust+ API Integration**: Connection to Rust servers via @liamcottle/rustplus.js
- **Event-Driven Architecture**: Central event bus for decoupled communication
- **Auto Channel Creation**: Automatically creates "test-commands-bot" channel in guilds
- **Slash Commands**: `/status` command to check Rust server status
- **Color-Coded Logging**: Structured logging with different levels (INFO, SUCCESS, WARN, ERROR)
- **Graceful Shutdown**: Proper cleanup of connections on exit
- **Environment Configuration**: Secure credential management via .env

### 🔧 Technical Features

- **Singleton Pattern**: Used for managers and services to ensure single instances
- **Connection Management**: Automatic reconnection handling for Rust+ connections
- **Error Handling**: Global error handlers for uncaught exceptions and rejections
- **Type Safety**: Proper validation of environment variables
- **Modular Design**: Easy to extend with new commands and features

---

## File Structure & Purpose

### 📁 Root Level

#### `package.json`

- **Purpose**: Project metadata and dependencies
- **Key Dependencies**: discord.js, @liamcottle/rustplus.js, dotenv
- **Scripts**: `npm start` to run the bot

#### `.env` (not in repo)

- **Purpose**: Environment variables for sensitive data
- **Contains**: Discord bot token, client ID, Rust server credentials

#### `.gitignore`

- **Purpose**: Excludes sensitive files and dependencies from git

---

### 📁 `src/` - Main Source Code

#### `src/index.js`

- **Layer**: Entry Point
- **Purpose**: Main orchestrator that initializes all systems
- **Responsibilities**:
  - Loads environment variables
  - Initializes error handlers
  - Starts Discord client
  - Sets up graceful shutdown handlers
- **Flow**: Config → Error Handlers → Discord Client → Graceful Shutdown

---

### 📁 `src/config/` - Configuration Layer

#### `src/config/env.js`

- **Purpose**: Loads and validates environment variables
- **Exports**: Validated configuration object
- **Validation**: Ensures all required variables are present

#### `src/config/discord.js`

- **Purpose**: Discord client configuration
- **Contains**:
  - Required intents (Guilds, GuildMessages)
  - Channel names (test-commands-bot)
  - Partials configuration

#### `src/config/rust.js`

- **Purpose**: Rust+ connection settings
- **Contains**: Server IP, port, player ID, player token
- **Source**: Pulls from environment variables

---

### 📁 `src/core/` - Core Infrastructure Layer

#### `src/core/logger.js`

- **Purpose**: Centralized logging system
- **Features**:
  - Color-coded console output
  - Log levels: INFO (blue), SUCCESS (green), WARN (yellow), ERROR (red)
  - Timestamp formatting
  - Structured logging with metadata support

#### `src/core/eventBus.js`

- **Purpose**: Central event bus for decoupled communication
- **Pattern**: EventEmitter singleton
- **Usage**: Allows layers to communicate without direct dependencies
- **Events**:
  - `rust:connected` - Rust server connection established
  - `rust:disconnected` - Rust server disconnected
  - `rust:connection_failed` - Connection attempt failed
  - `rust:error` - Rust client error

#### `src/core/errorHandler.js`

- **Purpose**: Global error handling
- **Handles**:
  - Uncaught exceptions
  - Unhandled promise rejections
- **Behavior**: Logs errors and exits gracefully

---

### 📁 `src/discord/` - Discord Layer (UI)

#### `src/discord/client.js`

- **Purpose**: Discord client initialization and management
- **Responsibilities**:
  - Creates Discord client with proper intents
  - Loads and registers slash commands
  - Loads and attaches event handlers
  - Registers commands with Discord API
  - Provides login method
- **Key Functions**:
  - `loadCommands()` - Dynamically loads command files
  - `loadEvents()` - Dynamically loads event handlers
  - `registerCommands()` - Registers slash commands with Discord

---

### 📁 `src/discord/commands/` - Slash Commands

#### `src/discord/commands/status.command.js`

- **Purpose**: `/status` slash command implementation
- **Layer**: Discord Layer
- **Functionality**:
  - Checks Rust server status
  - Displays server info (name, players, map, time, etc.)
  - Shows connection status
  - Handles errors gracefully
- **Architecture**: Calls `statusService` (Service Layer), never directly calls Rust layer
- **Response Format**: Discord embed with server information (no emojis per user request)

---

### 📁 `src/discord/events/` - Discord Event Handlers

#### `src/discord/events/ready.event.js`

- **Event**: `clientReady` (Discord.js v14)
- **Trigger**: When bot successfully connects to Discord
- **Responsibilities**:
  - Logs bot login information
  - Sets bot presence/status ("Watching Rust servers")
  - Auto-creates "test-commands-bot" channel in all guilds
- **Note**: Uses `clientReady` instead of deprecated `ready` event

#### `src/discord/events/interactionCreate.event.js`

- **Event**: `interactionCreate`
- **Trigger**: When user interacts with bot (slash commands, buttons, etc.)
- **Responsibilities**:
  - Routes slash command interactions to appropriate handlers
  - Logs command execution
  - Handles command errors
  - Sends error messages to users

---

### 📁 `src/discord/permissions/` - Permission System

#### `src/discord/permissions/rustRoles.js`

- **Purpose**: Role-based permission system (placeholder)
- **Status**: Not yet implemented
- **Future Use**: Restrict certain commands to specific Discord roles

---

### 📁 `src/rust/` - Rust Layer (Data Source)

#### `src/rust/client/RustClient.js`

- **Purpose**: Wrapper around RustPlus client
- **Responsibilities**:
  - Manages connection to a single Rust server
  - Handles connection lifecycle (connect, disconnect, reconnect)
  - Provides methods to fetch server data
  - Emits events via event bus
- **Key Methods**:
  - `connect()` - Establishes connection and waits for 'connected' event
  - `getInfo()` - Fetches server information (name, players, map, etc.)
  - `getTime()` - Fetches in-game time
  - `disconnect()` - Closes connection
  - `getConnectionStatus()` - Returns current connection state
- **Event Handling**: Listens to RustPlus events and forwards to event bus
- **Fix Applied**: Properly waits for connection before allowing API calls

#### `src/rust/client/RustConnectionManager.js`

- **Purpose**: Singleton manager for Rust connections
- **Pattern**: Singleton
- **Responsibilities**:
  - Creates and manages RustClient instances
  - Ensures only one connection per server
  - Provides centralized access to Rust clients
- **Key Methods**:
  - `connect()` - Connects to configured Rust server
  - `disconnect()` - Disconnects from server
  - `getClient()` - Returns active RustClient instance
  - `getStatus()` - Returns connection status

---

### 📁 `src/rust/services/` - Service Layer (Business Logic)

#### `src/rust/services/status.service.js`

- **Layer**: Service Layer
- **Purpose**: Business logic for checking Rust server status
- **Architecture**: Coordinates between Discord and Rust layers
- **Responsibilities**:
  - Checks if connected to Rust server
  - Initiates connection if needed
  - Fetches server info and time
  - Formats data for Discord display
  - Handles errors and returns user-friendly messages
- **Key Methods**:
  - `checkServerStatus()` - Main method to get formatted server status
  - `formatGameTime()` - Converts game time to readable format (12-hour clock)
  - `getConnectionStatus()` - Returns simple connection status
- **Data Flow**: Discord Command → Status Service → Rust Connection Manager → Rust Client → Rust+ API

---

### 📁 `src/rust/events/` - Rust Event Handlers

#### `src/rust/events/connection.event.js`

- **Purpose**: Handles Rust connection events from event bus
- **Listens To**:
  - `rust:connected` - Logs successful connection
  - `rust:disconnected` - Logs disconnection
  - `rust:connection_failed` - Logs connection failures
  - `rust:error` - Logs Rust client errors
- **Behavior**: Currently just logs events, can be extended for notifications

---

### 📁 `src/storage/` - Storage Layer

#### `src/storage/guildConfig.store.js`

- **Purpose**: In-memory storage for guild configurations
- **Pattern**: Singleton
- **Status**: Placeholder for future use
- **Future Use**: Store per-guild settings (preferred channels, roles, etc.)

---

### 📁 `docs/` - Documentation

#### `docs/SETUP_GUIDE.md`

- **Purpose**: Setup instructions for the bot
- **Contains**: Installation steps, configuration guide, running instructions

#### `docs/verticle-layer.md` (this file)

- **Purpose**: Architecture documentation and file reference

---

## Data Flow Examples

### Example 1: User Executes `/status` Command

```
1. User types /status in Discord
   ↓
2. Discord API sends interaction to bot
   ↓
3. interactionCreate.event.js receives interaction
   ↓
4. Routes to status.command.js execute()
   ↓
5. status.command.js calls statusService.checkServerStatus()
   ↓
6. statusService checks connection via rustConnectionManager
   ↓
7. If not connected, rustConnectionManager.connect() is called
   ↓
8. RustClient.connect() establishes connection to Rust server
   ↓
9. RustClient emits 'rust:connected' event via eventBus
   ↓
10. statusService calls rustClient.getInfo() and rustClient.getTime()
    ↓
11. RustClient uses sendRequestAsync() to fetch data from Rust+ API
    ↓
12. statusService formats the data
    ↓
13. status.command.js creates Discord embed
    ↓
14. Discord API sends embed to user
```

### Example 2: Bot Startup

```
1. npm start executes src/index.js
   ↓
2. Load environment variables (config/env.js)
   ↓
3. Initialize error handlers (core/errorHandler.js)
   ↓
4. Initialize Discord client (discord/client.js)
   ↓
5. Load commands from discord/commands/
   ↓
6. Load events from discord/events/
   ↓
7. Register slash commands with Discord API
   ↓
8. Login to Discord
   ↓
9. clientReady event fires
   ↓
10. Set bot presence
    ↓
11. Create test-commands-bot channels
    ↓
12. Bot is ready to receive commands
```

---

## Key Design Decisions

### 1. **Separation of Concerns**

- Each layer has a specific responsibility
- Discord layer handles UI/UX
- Service layer handles business logic
- Rust layer handles data fetching
- Core layer provides infrastructure

### 2. **Event-Driven Architecture**

- Layers communicate via event bus
- Reduces coupling between components
- Makes it easy to add new features without modifying existing code

### 3. **Singleton Pattern**

- Ensures single instances of managers and services
- Prevents multiple connections to same server
- Centralized state management

### 4. **Async/Await**

- All I/O operations use async/await
- Proper error handling with try/catch
- Clean, readable code

### 5. **Dynamic Loading**

- Commands and events are loaded dynamically
- Easy to add new commands without modifying client.js
- Follows Discord.js best practices

---

## Bug Fixes Applied

### 1. **RustPlus Connection Timing Issue**

- **Problem**: Code was trying to await `client.connect()` which doesn't return a promise
- **Solution**: Wrapped connection in Promise that resolves on 'connected' event
- **File**: `src/rust/client/RustClient.js`

### 2. **Response Structure Issue**

- **Problem**: Accessing `response.response.info` instead of `response.info`
- **Solution**: Fixed to access response properties directly
- **Files**: `src/rust/client/RustClient.js` (getInfo, getTime methods)

### 3. **Protobuf Missing Field Error**

- **Problem**: `queuedPlayers` field was required but some servers don't send it
- **Solution**: Changed field from `required` to `optional` in rustplus.proto
- **File**: `node_modules/@liamcottle/rustplus.js/rustplus.proto`

### 4. **Discord.js Deprecation Warning**

- **Problem**: Using deprecated 'ready' event name
- **Solution**: Changed to 'clientReady' event
- **File**: `src/discord/events/ready.event.js`

---

## Future Enhancements

### Planned Features

- [ ] More slash commands (team chat, smart switches, alarms)
- [ ] Role-based permissions system
- [ ] Per-guild configuration storage
- [ ] Database integration (SQLite/PostgreSQL)
- [ ] Webhook notifications for server events
- [ ] Map marker tracking
- [ ] Vending machine search
- [ ] Team chat sync between Discord and Rust
- [ ] Smart device control via Discord

### Architecture Improvements

- [ ] Add caching layer for frequently accessed data
- [ ] Implement rate limiting to respect Rust+ API limits
- [ ] Add unit tests for core functionality
- [ ] Add integration tests for command flows
- [ ] Implement health check endpoint
- [ ] Add metrics and monitoring

---

## Development Guidelines

### Adding a New Command

1. Create command file in `src/discord/commands/`
2. Export object with `data` (SlashCommandBuilder) and `execute` function
3. Call appropriate service from Service Layer
4. Never directly call Rust layer from command
5. Handle errors gracefully
6. Restart bot to load new command

### Adding a New Service

1. Create service file in `src/rust/services/`
2. Implement business logic
3. Use `rustConnectionManager` to access Rust client
4. Export singleton instance
5. Add error handling

### Adding a New Event Handler

1. Create event file in `src/discord/events/` or `src/rust/events/`
2. Export object with `name`, `once` (optional), and `execute` function
3. Restart bot to load new event

---

## Troubleshooting

### Bot won't start

- Check `.env` file has all required variables
- Verify Discord bot token is valid
- Ensure Node.js version is 16.9.0 or higher

### Slash commands not showing

- Wait up to 1 hour for global commands to register
- Use guild-specific commands for instant registration (dev mode)
- Check bot has `applications.commands` scope

### Rust connection fails

- Verify Rust server IP and port are correct
- Ensure `app.port` is configured in server.cfg
- Check firewall allows connections to app.port
- Verify player token is valid

### Commands return errors

- Check bot logs for detailed error messages
- Verify Rust server is online
- Ensure bot has proper Discord permissions

---

## Conclusion

This bot is built with a solid vertical layer architecture that promotes:

- **Maintainability**: Easy to understand and modify
- **Scalability**: Easy to add new features
- **Testability**: Layers can be tested independently
- **Reliability**: Proper error handling and logging

The architecture is production-ready and can be extended with additional features while maintaining clean separation of concerns.
