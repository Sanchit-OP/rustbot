Project Context

This project is a 24/7 Discord bot integrated with the Rust+ (Rust Companion App) API, built using Node.js and discord.js v14.

The bot follows a strict vertical layer architecture with clear separation of concerns:

Discord Layer → UI & interactions

Service Layer → Business logic

Rust Layer → Rust+ API integration

Core Layer → Infrastructure (logging, events, error handling)

All layers are already connected and working end-to-end (vertical connect is complete).
The bot can successfully connect to Discord, connect to a Rust server, and return server status.

The next phase focuses on user-facing UX and persistent live status features, not backend plumbing.

High-Level Product Goal

The bot should provide a clean, always-available “Rust Status Dashboard” inside Discord, without spamming messages and without cluttering other channels.

This dashboard should:

Live inside a dedicated Discord channel

Show server status and team info

Be persistent (same message updated over time)

Be pinned and act as the single source of truth

Be controlled via a small, focused set of slash commands

Dedicated Status Channel Concept
Channel Behavior

The bot will create a new text channel (e.g. #rust-status)

This channel is not a general command channel

Users may type anything in it, but:

The Rust bot will only respond to specific commands

All other commands are ignored or politely rejected

Status-Only Commands

The bot should only listen and respond to the following commands in the status channel:

/panel

/panel refresh

/panel stop

/server

/team

If these commands are used outside the status channel:

The bot should respond with a friendly message indicating the correct channel

This restriction must be enforced in bot logic, not via Discord permission locking.

Live Panel (Persistent Message) Concept
What the Panel Is

A single Discord message posted by the bot at the top of the status channel

This message contains:

Rust server information

Team online/offline snapshot

Last updated timestamp

The message is pinned

The bot edits this same message on updates instead of sending new messages

This message acts as a live dashboard, not a chat log.

Panel Lifecycle Rules

There is one panel per guild

When the panel is created:

Bot posts the message

Pins it

Stores guildId, channelId, and messageId

On refresh:

The bot edits the existing message

If the message is deleted:

The bot recreates it automatically

If the channel is deleted:

The bot recreates the channel and the panel

Update Strategy

The panel should be updated using polling (not events yet)

A fixed interval (e.g. 60–120 seconds)

Manual refresh via /panel refresh

Event-driven updates (alarms, team changes) will be added later

The Rust connection strategy is already defined as Hybrid:

Lazy-initialized

Persistent

Auto-reconnecting

Owned by RustConnectionManager

Architectural Constraints (Must Be Followed)

Discord layer must NEVER call Rust+ APIs directly

Discord commands must ONLY call Service layer methods

Rust layer must not know Discord exists

Connection lifecycle is owned by RustConnectionManager only

Live panel update logic belongs to the Discord layer, not Rust or services

Services return structured data, never Discord embeds

One feature at a time — no scope creep

Non-Goals (Explicitly Out of Scope for Now)

Smart alarms

Team chat sync

Device control

Multi-server per guild

Role-based permissions

Database persistence (in-memory or JSON is fine)

Definition of Success for This Phase

This phase is successful when:

A new status channel is created automatically

The bot posts and pins a live panel message

The panel shows server + team information

The panel can be refreshed without creating new messages

Only the intended commands work in that channel

The bot can run 24/7 without manual intervention

Mental Model to Follow

“This bot behaves like a live status screen, not a chat bot.”

Once this context is set, the implementation should proceed in small, incremental steps, validating behavior after each step.
