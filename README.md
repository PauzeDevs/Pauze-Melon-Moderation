<div align="center">

# PauzeX

A feature-rich, open source multipurpose Discord bot built with Discord.js v14.
Designed for server protection, community management, AI chat, and automation.

[![Discord](https://img.shields.io/discord/1414217749038891102?color=5865F2&label=Support&logo=discord&logoColor=white)](https://discord.gg/aerox)

</div>

---

## Overview

PauzeX is a fully self-hostable, open source multipurpose Discord bot engineered to replace the need for several bots in a single server. It supports both **prefix commands** (default: `,`) and **slash commands** through a unified hybrid command system. Persistent data is stored in a **PostgreSQL** database via Sequelize ORM, and every feature is configurable on a per-server basis through setup commands.

## Features

### Security & Antinuke
Protect your server from malicious actors and raids.
- Detects and blocks mass channel deletions, role deletions, webhook creations, and unauthorized bot joins
- Interactive setup wizard with configurable thresholds and punishment actions
- Per-server whitelist management for trusted users and bots

### Moderation
Essential tools for keeping your server in order.
- Ban, kick, mute, and temporary role assignment with reason tracking
- Slowmode, channel lock/unlock, and nickname management
- Bulk message purging with filters (user, bots, all)
- Full voice moderation: mute, deafen, kick, move, pull, lock, and private channels

### Automod
Automatic rule enforcement without manual intervention.
- Invite link and URL filtering with configurable whitelists
- Anti-spam and mass mention detection
- Per-channel and per-role whitelist support

### Logging
A comprehensive server audit trail.
- Tracks message edits and deletions with content snapshots
- Logs server changes: channels, roles, and emojis
- Member joins, leaves, user updates, and voice state changes
- Fully configurable log channel routing per event type

### AI Integration
A built-in conversational AI assistant named PauzeX.
- Powered by **Groq API** for fast language model responses
- Image analysis via **Gemini Vision API**
- Real-time web search via **SerpAPI**
- Per-channel enable/disable toggle
- Custom identity — does not reveal underlying model or provider

### Ticketing
A complete support ticket system.
- Multiple ticket categories with dedicated staff roles
- Claim, transfer, rename, close, delete, and reopen tickets
- Full ticket transcripts
- Panel embeds for self-service ticket creation

### Giveaways
Run clean and fair giveaways.
- Create giveaways with a custom prize, duration, and winner count
- End giveaways early and reroll winners at any time
- Automated ending with winner announcement

### Welcome & Farewell
Fully customizable join and leave messages.
- Rich embed configuration with image and background support
- Test command to preview messages before going live
- Per-server setup with channel routing

### Profile System
User identity and engagement tracking.
- Canvas-generated profile cards with custom biography, background, and social links
- View profiles for any server member
- Global message and invite leaderboards

### Utility
A wide range of general-purpose tools.
- Unit and encoding conversions (cm/ft, kg/lb, Base32, Hex, Rot13, Binary)
- Server info, user info, role info, and invite tracking with join positions
- Export server data: bans, roles, members, and messages to file
- AFK status, personal reminders, todo lists, Wikipedia search, calculator

### Automation
Background systems that run without manual input.
- **Join to Create (J2C)** — dynamic temporary voice channels
- **Autopost** — schedule recurring messages in any channel
- **Autobump** — automated server bump scheduling
- **Autoreact** — auto-react to messages in configured channels
- **Vanity Roles** — assign roles based on user Discord status text
- **Reaction Roles** — reaction and button-based role assignment

### Fun & Roleplay
Engagement commands for active communities.
- Roleplay commands: hug, kiss, slap, pat, and more
- Animal facts and images, meme generation, ship calculator, fake hack
- GitHub and YouTube search integrations

---

## Setup

**Requirements:** Node.js >= 18, PostgreSQL database

```bash
# 1. Clone the repository
git clone https://github.com/PauzeDevs/Pauze-Melon-Moderation.git
cd Pauze-Melon-Moderation

# 2. Install dependencies
npm install

# 3. Configure the bot
# Edit src/config.js with your token, client ID, database URL, and API keys

# 4. Start the bot
npm start
```

---

## Configuration

All configuration lives in `src/config.js`.

| Key | Description |
|-----|-------------|
| `BOT_TOKEN` | Discord bot token from the Developer Portal |
| `CLIENT_ID` | Bot application/client ID |
| `OWNER_ID` | Your Discord user ID for owner-only commands |
| `PREFIX` | Default text command prefix (default: `,`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `GROQ.API_KEY` | Groq API key for AI chat |
| `SERPAPI.API_KEY` | SerpAPI key for web search in AI responses |
| `STATUS.status` | Bot presence: `online`, `idle`, `dnd`, `invisible` |
| `STATUS.activity` | Bot activity display text |
| `SUPPORT_SERVER` | Your support server invite link |

The database schema is automatically synced on startup — no manual migrations required.

---

## Project Structure

The project retains the original command, gateway, database, and utility architecture. All functionality is unchanged.

---

## Credits

**Rebranded as** — **PauzeX**  
**Organisation** — [PauzeDevs](https://github.com/PauzeDevs)

---

## Support

Join the PauzeDevs community for help, updates, and support.

**[PauzeDevs](https://github.com/PauzeDevs)**

---

<div align="center">

© 2026 PauzeDevs — PauzeX.  
See [LICENSE](./LICENSE) for usage terms.

</div>
