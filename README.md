# Discord Invites Manager

## Overview

The Discord Invites Manager is an npm module written in TypeScript. It is designed to facilitate the management and tracking of invites in a Discord bot using the Discord.js library. The module provides functionalities to track different types of invites, such as regular, bonus, fake, and leave, as well as vanity invites (custom URL invites).

## Features

- **Invite Tracking:** Keep track of various invite-related statistics for each guild member.
- **Event Handling:** Emit events for 'guildMemberAdd' and 'guildMemberRemove' to allow customization based on these events.
- **Persistent Storage:** Utilize 'quick.db' for simple and persistent data storage.

## Installation

Install the Discord Invites Manager module using npm:

```bash
npm install discord-invites-manager
```

## Usage

```typescript
import { Client } from 'discord.js';
import { InviteManager } from 'discord-invites-manager';

// Create a Discord.js client
const client = new Client();

// Instantiate InviteManager and pass the client
const inviteManager = new InviteManager(client, { prefix: 'invitemanager_', fakeDays: 7 });

// Set up event listeners or customize as needed
inviteManager.on('guildMemberAdd', (member) => {
    // Custom logic on guild member add
});

// Log in to Discord
client.login('YOUR_BOT_TOKEN');
```

## Options

- `prefix`: Prefix for keys in the database (default: 'invitemanager_').
- `fakeDays`: Number of days to consider an invite as fake (default: 7).

## Events

- **guildMemberAdd:** Emitted when a member joins a guild.
- **guildMemberRemove:** Emitted when a member leaves a guild.

## Methods

- **getInvites(member):** Get invite statistics for a guild member.
- **getInvitesUsers(member):** Get detailed invite information for a guild member.
- **addInvite(member, inviter):** Add an invite to a guild member.
- **removeInvite(member):** Remove a leave invite from a guild member.
- **clearInvites(member):** Clear all invites for a guild member.

## Contributions

Contributions are welcome! If you have any suggestions, bug reports, or improvements, feel free to open an issue or submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).
