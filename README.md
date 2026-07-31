<div align="center">
  <img src="https://api-beacon.up.railway.app/favicon.svg" width="64" height="64" />
  <h1>Beacon</h1>
  <p>Real-time presence API for <a href="https://distalk.app">DisTalk</a></p>

  <p>
    <a href="https://api-beacon.up.railway.app/docs">Docs</a>
    ·
    <a href="https://api-beacon.up.railway.app/home">Demo</a>
    ·
    <a href="https://api-beacon.up.railway.app/privacy">Privacy</a>
  </p>
</div>

---

Beacon tracks user presence on DisTalk and exposes it through a REST API, WebSocket, and chat bot. Think [Lanyard](https://github.com/Phineas/lanyard) but for DisTalk.

## Features

- **REST API** — query user presence, profiles, badges, and Spotify data
- **WebSocket** — subscribe to real-time presence updates
- **KV Store** — per-user key-value storage accessible via API
- **Chat Bot** — 30+ commands available in any DisTalk channel
- **GitHub Webhooks** — post push, PR, issue, and release events to DisTalk
- **Badge Scraping** — automatically discovers and maps DisTalk badge definitions
- **React Dashboard** — browse tracked users with a live updating UI

## API

Base URL: `https://api-beacon.up.railway.app`

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/users` | All tracked users. Supports `?ids=id1,id2` |
| `GET` | `/v1/users/:id` | Single user by ID |
| `GET` | `/v1/users/:id/presence` | Presence data only |
| `GET` | `/v1/users/:id/kv` | All KV pairs |
| `GET` | `/v1/users/:id/kv/:key` | Single KV value |
| `PUT` | `/v1/users/:id/kv/:key` | Set KV value (requires auth) |
| `DELETE` | `/v1/users/:id/kv/:key` | Delete KV value (requires auth) |
| `GET` | `/v1/badges` | All badge definitions |

### Example Response

```json
{
  "success": true,
  "data": {
    "id": "usr_8f7220facabf757f",
    "username": "app",
    "display_name": "app",
    "presence": {
      "status": "online",
      "is_mobile": false,
      "custom_status": { "emoji": "🛠️", "text": "building" }
    },
    "spotify": { "connected": false, "now_playing": null },
    "badges": [
      { "id": "verified", "name": "VERIFIED", "type": "platform" }
    ],
    "self_badges": [
      { "id": "active_developer", "name": "Active Developer", "lucide": "code-2", "type": "self" }
    ],
    "kv": {}
  }
}
```

### WebSocket

Connect to `wss://api-beacon.up.railway.app/socket`

```js
const ws = new WebSocket("wss://api-beacon.up.railway.app/socket");

// On connect you receive: { op: 1, d: { heartbeat_interval: 30000 } }

// Subscribe to users
ws.send(JSON.stringify({
  op: 2,
  d: { subscribe_to_ids: ["usr_8f7220facabf757f"] }
}));

// Listen for updates
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.t === "PRESENCE_UPDATE") {
    console.log(msg.d.presence.status);
  }
};

// Heartbeat every 30s
setInterval(() => ws.send(JSON.stringify({ op: 3 })), 30000);
```

| Op | Direction | Description |
|----|-----------|-------------|
| 0 | Server → Client | Event dispatch (`INIT_STATE`, `PRESENCE_UPDATE`) |
| 1 | Server → Client | Hello (contains heartbeat interval) |
| 2 | Client → Server | Subscribe to user IDs |
| 3 | Client → Server | Heartbeat |
| 4 | Client → Server | Unsubscribe from user IDs |

## Chat Commands

Available in any DisTalk channel where Beacon is present.

| Command | Description |
|---------|-------------|
| `/status <user>` | Current status |
| `/profile <user>` | Full profile |
| `/userid <user>` | Get user ID |
| `/whois <id>` | Resolve ID to username |
| `/avatar <user>` | Avatar URL |
| `/badges <user>` | List badges |
| `/bio <user>` | User bio |
| `/socials <user>` | Social links |
| `/tag <user>` | Server tag |
| `/spotify <user>` | Now playing |
| `/compare <a> <b>` | Compare two users |
| `/online` | Online users |
| `/offline` | Recently offline |
| `/mobile` | Mobile users |
| `/role <role>` | Users by role |
| `/search <query>` | Search users |
| `/random` | Random user |
| `/api <user>` | Raw JSON |
| `/kv [user]` | View KV data |
| `/kv set <k> <v>` | Set KV value |
| `/kv del <key>` | Delete KV value |
| `/set <key> <val>` | Store a global value |
| `/get <key>` | Retrieve a value |
| `/del <key>` | Delete a key |
| `/keys` | List stored keys |
| `/note <user> <text>` | Add a note |
| `/notes <user>` | View notes |
| `/server` | Server info |
| `/stats` | Bot statistics |
| `/count` | Tracked user count |
| `/uptime` | Bot uptime |
| `/ping` | Latency |
| `/help` | List all commands |
| `/docs` | API documentation |
| `/privacy` | Privacy policy |

## GitHub Webhook

Beacon can post GitHub events to a DisTalk channel.

1. Go to your repo → **Settings** → **Webhooks** → **Add webhook**
2. Set payload URL to `https://api-beacon.up.railway.app/github`
3. Content type: `application/json`
4. Select events you want to forward

Supported events: `push`, `pull_request`, `issues`, `issue_comment`, `create`, `delete`, `release`, `star`, `fork`, `pull_request_review`, `workflow_run`

## Tech Stack

- **Backend** — Node.js, Express, ws
- **Frontend** — React, Vite, Tailwind CSS, shadcn/ui, Framer Motion
- **Real-time** — Pusher (DisTalk's WebSocket), custom WebSocket server
- **Hosting** — Railway

## License

MIT

## Credits

Inspired by [Lanyard](https://github.com/Phineas/lanyard) by Phineas.
Built for [DisTalk](https://distalk.app).