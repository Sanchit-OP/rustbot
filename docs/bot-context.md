Project Context

We have a Node.js Discord bot (discord.js v14) integrated with Rust+ via @liamcottle/rustplus.js. The bot already implements a strict vertical layer architecture:

Discord Layer (UI): commands, channel management, sending messages

Service Layer: business logic, formatting decisions (not Discord embeds)

Rust Layer: Rust+ connection, event listening, raw data collection

Core Layer: eventBus, logger, error handler

Storage Layer: in-memory per-guild config

The bot already has:

A dedicated status channel with a pinned live panel message

A hybrid persistent Rust connection owned by RustConnectionManager

An event bus used for decoupling (eventBus.emit(...))

Now we are implementing the next major feature: a dedicated channel that receives push-based server/world event notifications.

Goal

Implement a new Discord channel named:

server-events

This channel is a feed of important Rust world events. It should be:

Automatically created if missing (on startup)

Stored per guild in config (guildConfig)

Used only for event notifications (append-only messages)

The status channel remains calm and only contains the pinned dashboard. The event channel is for notifications.

Events to Detect and Notify

We want to detect these world events and send notifications:

Chinook Drop

Notify: “Chinook drop at grid X”

Cargo Ship

Notify: “Cargo entering from SIDE at grid X”

Notify: “Cargo leaving toward SIDE at grid X”

SIDE is an approximation based on position near map edge (e.g., WEST/EAST/NORTH/SOUTH)

Patrol Helicopter

Notify when heli enters/spawns: “Patrol heli IN at grid X”

Notify when heli is destroyed / despawns: “Patrol heli DOWN at grid X”

“DOWN grid” must use the last known heli position tracked prior to death

Small Oil Rig Called

Notify: “Small Oil Rig called at grid X”

Large Oil Rig Called

Notify: “Large Oil Rig called at grid X”

Important Notes / Constraints
Rust+ Data Reality

Rust+ does not directly provide perfect semantic events like “cargo entering from west”. Instead we must:

Listen to low-level Rust+ events such as map markers and entity changes

Maintain local state (previous markers/entities)

Infer higher-level events (entering/leaving/down/called)

Emit clean high-level domain events into our internal event bus

Architecture Rules (Must Follow)

Discord layer must NEVER call Rust+ APIs directly

Rust layer must NEVER reference Discord

Low-level Rust+ events must be interpreted in the Rust layer (or a Rust-specific interpreter module)

Only high-level, semantic events should be emitted over the eventBus to the rest of the app

Discord side should only:

find the correct channel (server-events)

format message text

send a notification

Implement minimal scope: only these event types, no other features

Event Pipeline Design
Target Event Flow
RustClient (raw Rust+ events)
↓
Rust World Event Listener (collect marker/entity updates)
↓
Server Events Interpreter (stateful inference)
↓
eventBus.emit('server:event', payload)
↓
Discord Server Events Router
↓
#server-events channel message

We will implement a semantic payload for each event emitted on the bus, e.g.:

type: 'CHINOOK_DROP'

type: 'CARGO', state: 'ENTERING'|'LEAVING', side: 'WEST'|'EAST'|'NORTH'|'SOUTH', grid: 'H12'

type: 'PATROL_HELI', state: 'IN'|'DOWN', grid: 'K8'

type: 'OIL_RIG', size: 'SMALL'|'LARGE', grid: 'M19'

plus timestamp always

Grid Conversion Requirement

We must convert Rust world coordinates (x/y) to a Rust grid format like:

H14

K8

This should be implemented as a shared utility (core or rust utility module).

Cargo “side” inference uses:

proximity to map edges (x/y near min/max) → determine cardinal entry/exit side.

Anti-Spam / Deduplication Rules (Very Important)

Event channels can get noisy, so implement these protections:

Deduplicate identical events

Same event type + same grid + same state within a short window (e.g., 30–60 seconds) should not resend

Cargo/heli should only emit meaningful transitions:

cargo entering once

cargo leaving once

heli in once

heli down once

The event channel is append-only

Never edit old events

Always send new messages only when a semantic event occurs

Discord Notification Format Requirements

Notifications should be readable and consistent. Use Discord timestamp formatting:

Include 🕘 <t:UNIX:R> for relative time

Simple messages are acceptable (embeds optional later)

Examples:

Chinook

🚁 Chinook Drop — Grid H14 — 🕘 <t:...:R>

Cargo

🚢 Cargo Incoming — From WEST — Grid A10 — 🕘 <t:...:R>

🚢 Cargo Leaving — Toward EAST — Grid B9 — 🕘 <t:...:R>

Heli

🚁 Patrol Heli IN — Grid K12 — 🕘 <t:...:R>

💥 Patrol Heli DOWN — Grid J10 — 🕘 <t:...:R>

Oil Rig

🛢 Large Oil Rig Called — Grid M19 — 🕘 <t:...:R>

Success Criteria

The feature is successful when:

#server-events is created automatically if missing

The bot listens to Rust+ updates continuously

The interpreter detects the requested events reliably

The bot posts notifications to #server-events

Patrol heli “DOWN at grid” uses last known position

No spam: duplicates are controlled

The rest of the bot (status panel) remains stable and unaffected

Out of Scope

Role pings / mentions

Quiet hours

Per-user subscription

Database persistence

Multi-server per guild

Buttons / interactive components
