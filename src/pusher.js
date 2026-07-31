const WebSocket = require("ws");
const store = require("./store");
const { send, fetchMessages } = require("./fetcher");
const kv = require("./kv");

const BOT_ID = "usr_527896a920b8dc3e";
const OWNER_ID = "usr_8f7220facabf757f";
const START_TIME = Date.now();

let commandsRun = 0;
let ws = null;
let pingTimer = null;
let messagePollTimer = null;
let lastSync = new Date(Date.now() - 30000).toISOString();
let syncing = false;

const subs = new Set();
const seen = new Set();
const replied = new Set();

function formatBadge(b) {
  if (b.icon) return `${b.icon} ${b.name}`;
  return b.name;
}

function formatBadgeList(badges) {
  return badges.map(formatBadge).join(", ");
}

function row(label, value) {
  return `${label} <-> ${value}`;
}

function timeAgo(date) {
  if (!date || date === "1970-01-01T00:00:00+00:00") return "unknown";
  const ms = Date.now() - new Date(date).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const d = Math.floor(ms / 86400000);
  let t = "";
  if (d > 0) t += `${d}d `;
  if (h > 0) t += `${h}h `;
  if (m > 0) t += `${m}m `;
  t += `${s}s`;
  return t;
}

function findUser(query) {
  return store.values().find(
    (u) =>
      u.id?.toLowerCase() === query ||
      u.username === query ||
      u.display_name?.toLowerCase() === query
  );
}

const commands = {
  "/status": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/status <username>`");
    const user = findUser(args);
    if (!user) return reply(`**User "${args}" not found**`);
    const p = user.presence;
    let t = `## ${user.display_name}\n-------\n`;
    t += `${row("**Status**", `\`${p.status}\``)}\n`;
    if (p.is_mobile) t += `${row("**Device**", "`mobile`")}\n`;
    if (p.custom_status?.text) t += `${row("**Custom**", p.custom_status.text)}\n`;
    if (p.activity) t += `${row("**Activity**", p.activity)}\n`;
    if (user.spotify?.now_playing) t += `${row("**Spotify**", user.spotify.now_playing)}\n`;
    return reply(t);
  },

  "/online": (args, msg, reply) => {
    const users = store.values();
    const online = users.filter((u) => u.presence.status === "online");
    const idle = users.filter((u) => u.presence.status === "idle");
    const dnd = users.filter((u) => u.presence.status === "dnd");
    const total = online.length + idle.length + dnd.length;
    let t = `## Online Users\n**${total}** active\n-------\n`;
    if (online.length) {
      t += `**Online** (${online.length})\n`;
      online.forEach((u) => (t += `- [x] ${u.display_name} (@${u.username})\n`));
      t += "\n";
    }
    if (idle.length) {
      t += `**Idle** (${idle.length})\n`;
      idle.forEach((u) => (t += `- [ ] ${u.display_name} (@${u.username})\n`));
      t += "\n";
    }
    if (dnd.length) {
      t += `**DND** (${dnd.length})\n`;
      dnd.forEach((u) => (t += `- [ ] ${u.display_name} (@${u.username})\n`));
    }
    if (!total) t += "*Nobody is online*";
    return reply(t);
  },

  "/profile": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/profile <username>`");
    const user = findUser(args);
    if (!user) return reply(`**User "${args}" not found**`);
    const p = user.presence;
    let t = `## ${user.display_name}\n@${user.username} · \`${user.id}\`\n-------\n`;
    t += `${row("**Status**", `\`${p.status}\``)}\n`;
    t += `${row("**Role**", `\`${user.platform_role}\``)}\n`;
    if (user.bio) t += `${row("**Bio**", user.bio)}\n`;
    if (p.is_mobile) t += `${row("**Device**", "`mobile`")}\n`;
    if (user.badges?.length) t += `${row("**Badges**", formatBadgeList(user.badges))}\n`;
    if (user.self_badges?.length) t += `${row("**Tags**", formatBadgeList(user.self_badges))}\n`;
    if (user.tag) t += `${row("**Server Tag**", `${user.tag.text || ""} (${user.tag.server_name})`)}\n`;
    if (user.socials?.youtube) t += `${row("**YouTube**", user.socials.youtube)}\n`;
    if (user.socials?.twitch) t += `${row("**Twitch**", user.socials.twitch)}\n`;
    if (user.socials?.tiktok) t += `${row("**TikTok**", user.socials.tiktok)}\n`;
    if (user.spotify?.now_playing) t += `${row("**Spotify**", user.spotify.now_playing)}\n`;
    else if (user.spotify?.connected) t += `${row("**Spotify**", "connected")}\n`;
    if (p.activity) t += `${row("**Activity**", p.activity)}\n`;
    return reply(t);
  },

  "/search": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/search <query>`");
    const results = store.values()
      .filter((u) => u.username?.includes(args) || u.display_name?.toLowerCase().includes(args))
      .slice(0, 10);
    if (!results.length) return reply(`**No users matching "${args}"**`);
    let t = `## Search: "${args}"\n${results.length} result${results.length !== 1 ? "s" : ""}\n-------\n`;
    t += `| User | Status |\n| --- | --- |\n`;
    results.forEach((u) => (t += `| ${u.display_name} (@${u.username}) | \`${u.presence.status}\` |\n`));
    return reply(t);
  },

  "/api": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/api <username>`");
    const user = findUser(args);
    if (!user) return reply(`**User "${args}" not found**`);
    const { _ts, ...clean } = user;
    let t = `## API Response\n\`${user.display_name}\`\n-------\n`;
    JSON.stringify({ success: true, data: clean }, null, 2).split("\n").forEach((l) => (t += `\`${l}\`\n`));
    return reply(t);
  },

  "/userid": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/userid <username>`");
    const user = findUser(args);
    if (!user) return reply(`**User "${args}" not found**`);
    return reply(`${row(`**${user.display_name}**`, `\`${user.id}\``)}`);
  },

  "/avatar": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/avatar <username>`");
    const user = findUser(args);
    if (!user) return reply(`**User "${args}" not found**`);
    if (!user.avatar_url) return reply(`**${user.display_name}** has no avatar`);
    return reply(user.avatar_url);
  },

  "/badges": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/badges <username>`");
    const user = findUser(args);
    if (!user) return reply(`**User "${args}" not found**`);
    const platform = user.badges || [];
    const self = user.self_badges || [];
    const total = platform.length + self.length;
    if (!total) return reply(`**${user.display_name}** has no badges`);
    let t = `## ${user.display_name}\n**${total}** badge${total !== 1 ? "s" : ""}\n-------\n`;
    if (platform.length) {
      t += `**Platform**\n`;
      platform.forEach((b) => (t += `- [x] ${b.icon ? `${b.icon} ` : ""}${b.name}\n`));
      t += "\n";
    }
    if (self.length) {
      t += `**Self**\n`;
      self.forEach((b) => (t += `- [x] ${b.icon ? `${b.icon} ` : ""}${b.name}\n`));
    }
    return reply(t);
  },

  "/spotify": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/spotify <username>`");
    const user = findUser(args);
    if (!user) return reply(`**User "${args}" not found**`);
    if (!user.spotify?.connected) return reply(`**${user.display_name}** has no Spotify connected`);
    if (!user.spotify.now_playing) return reply(`**${user.display_name}** is not listening to anything`);
    return reply(`${row(`**${user.display_name}**`, user.spotify.now_playing)}`);
  },

  "/socials": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/socials <username>`");
    const user = findUser(args);
    if (!user) return reply(`**User "${args}" not found**`);
    const s = user.socials;
    if (!s?.youtube && !s?.twitch && !s?.tiktok && !s?.spotify) return reply(`**${user.display_name}** has no socials`);
    let t = `## ${user.display_name}\n**Socials**\n-------\n`;
    if (s.youtube) t += `${row("**YouTube**", s.youtube)}\n`;
    if (s.twitch) t += `${row("**Twitch**", s.twitch)}\n`;
    if (s.tiktok) t += `${row("**TikTok**", s.tiktok)}\n`;
    if (s.spotify) t += `${row("**Spotify**", s.spotify)}\n`;
    return reply(t);
  },

  "/tag": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/tag <username>`");
    const user = findUser(args);
    if (!user) return reply(`**User "${args}" not found**`);
    if (!user.tag) return reply(`**${user.display_name}** has no server tag`);
    let t = `## ${user.display_name}\n**Server Tag**\n-------\n`;
    t += `${row("**Text**", user.tag.text || "—")}\n`;
    t += `${row("**Server**", user.tag.server_name)}\n`;
    if (user.tag.invite_slug) t += `${row("**Invite**", `distalk.app/invite/${user.tag.invite_slug}`)}\n`;
    return reply(t);
  },

  "/compare": (args, msg, reply) => {
    const parts = args.split(" ").filter(Boolean);
    if (parts.length < 2) return reply("## Usage\n`/compare <user1> <user2>`");
    const u1 = findUser(parts[0]);
    const u2 = findUser(parts[1]);
    if (!u1) return reply(`**User "${parts[0]}" not found**`);
    if (!u2) return reply(`**User "${parts[1]}" not found**`);
    const b1 = (u1.badges?.length || 0) + (u1.self_badges?.length || 0);
    const b2 = (u2.badges?.length || 0) + (u2.self_badges?.length || 0);
    let t = `## Compare\n-------\n`;
    t += `| | **${u1.display_name}** | **${u2.display_name}** |\n| --- | --- | --- |\n`;
    t += `| Status | \`${u1.presence.status}\` | \`${u2.presence.status}\` |\n`;
    t += `| Role | \`${u1.platform_role}\` | \`${u2.platform_role}\` |\n`;
    t += `| Mobile | ${u1.presence.is_mobile ? "Yes" : "No"} | ${u2.presence.is_mobile ? "Yes" : "No"} |\n`;
    t += `| Badges | ${b1} | ${b2} |\n`;
    t += `| Spotify | ${u1.spotify?.connected ? "Yes" : "No"} | ${u2.spotify?.connected ? "Yes" : "No"} |\n`;
    return reply(t);
  },

  "/random": (args, msg, reply) => {
    const users = store.values();
    if (!users.length) return reply("**No users tracked**");
    const user = users[Math.floor(Math.random() * users.length)];
    let t = `## Random User\n-------\n`;
    t += `${row("**Name**", `${user.display_name} (@${user.username})`)}\n`;
    t += `${row("**ID**", `\`${user.id}\``)}\n`;
    t += `${row("**Status**", `\`${user.presence.status}\``)}\n`;
    t += `${row("**Role**", `\`${user.platform_role}\``)}\n`;
    return reply(t);
  },

  "/mobile": (args, msg, reply) => {
    const mobile = store.values().filter((u) => u.presence.is_mobile);
    if (!mobile.length) return reply("**No users on mobile**");
    let t = `## Mobile Users\n**${mobile.length}** user${mobile.length !== 1 ? "s" : ""}\n-------\n`;
    mobile.forEach((u) => (t += `- [x] ${u.display_name} (@${u.username}) — \`${u.presence.status}\`\n`));
    return reply(t);
  },

  "/offline": (args, msg, reply) => {
    const offline = store.values()
      .filter((u) => u.presence.status === "offline" && u.presence.last_seen)
      .sort((a, b) => new Date(b.presence.last_seen) - new Date(a.presence.last_seen))
      .slice(0, 10);
    if (!offline.length) return reply("**No recently offline users**");
    let t = `## Recently Offline\n-------\n| User | Last Seen |\n| --- | --- |\n`;
    offline.forEach((u) => (t += `| ${u.display_name} (@${u.username}) | ${timeAgo(u.presence.last_seen)} |\n`));
    return reply(t);
  },

  "/role": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/role <role>`\n\nRoles: `user`, `admin`, `owner`, `supporter`");
    const users = store.values().filter((u) => u.platform_role === args);
    if (!users.length) return reply(`**No users with role "${args}"**`);
    let t = `## Role: ${args}\n**${users.length}** user${users.length !== 1 ? "s" : ""}\n-------\n`;
    users.forEach((u) => (t += `- [x] ${u.display_name} (@${u.username}) — \`${u.presence.status}\`\n`));
    return reply(t);
  },

  "/bio": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/bio <username>`");
    const user = findUser(args);
    if (!user) return reply(`**User "${args}" not found**`);
    if (!user.bio) return reply(`**${user.display_name}** has no bio`);
    return reply(`## ${user.display_name}\n-------\n${user.bio}`);
  },

  "/whois": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/whois <user_id>`");
    const id = args.startsWith("usr_") ? args : `usr_${args}`;
    const user = store.get(id);
    if (!user) return reply(`**No user found with ID** \`${id}\``);
    return reply(`${row(`\`${id}\``, `**${user.display_name}** (@${user.username})`)}`);
  },

  "/stats": (args, msg, reply) => {
    const users = store.values();
    const total = users.length;
    const online = users.filter((u) => u.presence.status === "online").length;
    const idle = users.filter((u) => u.presence.status === "idle").length;
    const dnd = users.filter((u) => u.presence.status === "dnd").length;
    const offline = total - online - idle - dnd;
    const mobile = users.filter((u) => u.presence.is_mobile).length;
    const spotify = users.filter((u) => u.spotify?.connected).length;
    const withBadges = users.filter((u) => (u.badges?.length || 0) + (u.self_badges?.length || 0) > 0).length;
    let t = `## Beacon Stats\n-------\n| Metric | Value |\n| --- | --- |\n`;
    t += `| Users | **${total}** |\n| Online | **${online}** |\n| Idle | **${idle}** |\n`;
    t += `| DND | **${dnd}** |\n| Offline | **${offline}** |\n| Mobile | **${mobile}** |\n`;
    t += `| Spotify | **${spotify}** |\n| Has Badges | **${withBadges}** |\n`;
    t += `| Uptime | **${formatUptime(Date.now() - START_TIME)}** |\n`;
    t += `| Commands | **${commandsRun}** |\n| Channels | **${subs.size}** |\n`;
    return reply(t);
  },

  "/server": (args, msg, reply) => {
    const users = store.values();
    const total = users.length;
    const online = users.filter((u) => u.presence.status === "online").length;
    const idle = users.filter((u) => u.presence.status === "idle").length;
    const dnd = users.filter((u) => u.presence.status === "dnd").length;
    let t = `## Server Info\n\`${msg.server_id}\` · \`${msg.channel_id}\`\n-------\n`;
    t += `| Status | Count |\n| --- | --- |\n`;
    t += `| Total | **${total}** |\n| Online | **${online}** |\n| Idle | **${idle}** |\n`;
    t += `| DND | **${dnd}** |\n| Offline | **${total - online - idle - dnd}** |\n`;
    return reply(t);
  },

  "/set": (args, msg, reply) => {
    const space = args.indexOf(" ");
    if (space === -1) return reply("## Usage\n`/set <key> <value>`");
    const key = args.substring(0, space).trim();
    const value = args.substring(space + 1).trim();
    kv.set(key, value);
    return reply(`${row(`\`${key}\``, `\`${value}\``)}`);
  },

  "/get": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/get <key>`");
    const value = kv.get(args);
    if (value === null) return reply(`**Key "${args}" not found**`);
    return reply(`${row(`\`${args}\``, `\`${value}\``)}`);
  },

  "/del": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/del <key>`");
    if (msg.user_id !== OWNER_ID) return reply("**Only the owner can delete keys**");
    kv.del(args);
    return reply(`~~${args}~~ **deleted**`);
  },

  "/keys": (args, msg, reply) => {
    const keys = kv.keys();
    if (!keys.length) return reply("**No keys stored**");
    let t = `## Stored Keys\n**${keys.length}** key${keys.length !== 1 ? "s" : ""}\n-------\n`;
    t += `| Key | Value |\n| --- | --- |\n`;
    keys.forEach((k) => (t += `| \`${k}\` | \`${kv.get(k)}\` |\n`));
    return reply(t);
  },

  "/note": (args, msg, reply) => {
    const space = args.indexOf(" ");
    if (space === -1) return reply("## Usage\n`/note <user> <text>`");
    const username = args.substring(0, space).trim().toLowerCase();
    const text = args.substring(space + 1).trim();
    const user = findUser(username);
    if (!user) return reply(`**User "${username}" not found**`);
    const key = `note:${user.id}`;
    const existing = kv.get(key) || [];
    existing.push({ text, by: msg.user_id, at: new Date().toISOString() });
    kv.set(key, existing);
    return reply(`Note added for **${user.display_name}** (${existing.length} total)`);
  },

  "/notes": (args, msg, reply) => {
    if (!args) return reply("## Usage\n`/notes <user>`");
    const user = findUser(args);
    if (!user) return reply(`**User "${args}" not found**`);
    const notes = kv.get(`note:${user.id}`);
    if (!notes?.length) return reply(`**No notes for ${user.display_name}**`);
    let t = `## Notes for ${user.display_name}\n**${notes.length}** note${notes.length !== 1 ? "s" : ""}\n-------\n`;
    notes.forEach((n, i) => (t += `${i + 1}. ${n.text}\n`));
    return reply(t);
  },

  "/announce": (args, msg, reply) => {
    if (msg.user_id !== OWNER_ID) return reply("**Only the owner can use /announce**");
    if (!args) return reply("## Usage\n`/announce <message>`");
    return reply(`## Announcement\n-------\n-> ${args} <-`);
  },

  "/uptime": (args, msg, reply) => {
    return reply(`${row("**Uptime**", `\`${formatUptime(Date.now() - START_TIME)}\``)}`);
  },

  "/ping": (args, msg, reply) => {
    const latency = Date.now() - new Date(msg.created_at).getTime();
    return reply(`${row("**Pong**", `\`${latency}ms\``)}`);
  },

  "/count": (args, msg, reply) => {
    return reply(`${row("**Tracking**", `**${store.count()}** users`)}`);
  },

  "/docs": (args, msg, reply) => {
    return reply("## Beacon API\n-------\nhttps://api-beacon.up.railway.app/docs");
  },

  "/privacy": (args, msg, reply) => {
    return reply("## Privacy Policy\n-------\nhttps://api-beacon.up.railway.app/privacy");
  },

  "/kv": (args, msg, reply) => {
    const parts = args.split(" ").filter(Boolean);
    if (parts[0] === "set" && parts.length >= 3) {
      const key = parts[1];
      const value = parts.slice(2).join(" ");
      kv.set(`kv:${msg.user_id}:${key}`, value);
      return reply(`${row(`\`${key}\``, `\`${value}\``)}`);
    }
    if (parts[0] === "del" && parts.length >= 2) {
      kv.del(`kv:${msg.user_id}:${parts[1]}`);
      return reply(`~~${parts[1]}~~ **deleted**`);
    }
    const userId = parts[0] ? findUser(parts[0])?.id || msg.user_id : msg.user_id;
    const user = store.get(userId);
    const name = user?.display_name || userId;
    const prefix = `kv:${userId}:`;
    const userKV = {};
    kv.keys().forEach((k) => { if (k.startsWith(prefix)) userKV[k.replace(prefix, "")] = kv.get(k); });
    const kvKeys = Object.keys(userKV);
    let t = `## KV for ${name}\n-------\n`;
    if (kvKeys.length) {
      t += `| Key | Value |\n| --- | --- |\n`;
      kvKeys.forEach((k) => (t += `| \`${k}\` | \`${userKV[k]}\` |\n`));
    } else {
      t += `*No KV data*\n`;
    }
    t += `\n+++ API Usage\n\`https://api-beacon.up.railway.app/v1/users/${userId}\`\n\n`;
    t += `REST: \`.data.kv.KEY_NAME\`\nSocket: \`.d.kv.KEY_NAME\`\n\n`;
    t += `\`/kv set <key> <value>\`\n\`/kv del <key>\`\n\`/kv <username>\`\n+++`;
    return reply(t);
  },

  "/who": (args, msg, reply) => {
    const user = args ? findUser(args) : store.get(msg.user_id);
    if (!user) return reply(`**User "${args}" not found**`);
    const prefix = `kv:${user.id}:`;
    const userKV = {};
    kv.keys().forEach((k) => { if (k.startsWith(prefix)) userKV[k.replace(prefix, "")] = kv.get(k); });
    const kvKeys = Object.keys(userKV);
    let t = `## ${user.display_name}\n@${user.username} · \`${user.id}\`\n-------\n`;
    t += `${row("**API**", `\`api-beacon.up.railway.app/v1/users/${user.id}\``)}\n\n`;
    if (kvKeys.length) {
      t += `**KV Data**\n| Key | Value |\n| --- | --- |\n`;
      kvKeys.forEach((k) => (t += `| \`${k}\` | \`${userKV[k]}\` |\n`));
    } else {
      t += `*No KV data*`;
    }
    return reply(t);
  },

  "/help": (args, msg, reply) => {
    let t = `## Beacon Commands\n-------\n| Command | Description |\n| --- | --- |\n`;
    t += `| \`/status <user>\` | Current status |\n| \`/profile <user>\` | Full profile |\n`;
    t += `| \`/userid <user>\` | Get user ID |\n| \`/whois <id>\` | Resolve ID |\n`;
    t += `| \`/avatar <user>\` | Avatar URL |\n| \`/badges <user>\` | List badges |\n`;
    t += `| \`/bio <user>\` | User bio |\n| \`/socials <user>\` | Social links |\n`;
    t += `| \`/tag <user>\` | Server tag |\n| \`/spotify <user>\` | Now playing |\n`;
    t += `| \`/compare <a> <b>\` | Compare users |\n| \`/online\` | Online users |\n`;
    t += `| \`/offline\` | Recently offline |\n| \`/mobile\` | Mobile users |\n`;
    t += `| \`/role <role>\` | Users by role |\n| \`/search <query>\` | Search users |\n`;
    t += `| \`/random\` | Random user |\n| \`/api <user>\` | Raw JSON |\n`;
    t += `| \`/kv [user]\` | View KV data |\n| \`/kv set <k> <v>\` | Set KV |\n`;
    t += `| \`/kv del <key>\` | Delete KV |\n| \`/set <key> <val>\` | Store value |\n`;
    t += `| \`/get <key>\` | Get value |\n| \`/del <key>\` | Delete key |\n`;
    t += `| \`/keys\` | List keys |\n| \`/note <user> <t>\` | Add note |\n`;
    t += `| \`/notes <user>\` | View notes |\n| \`/server\` | Server info |\n`;
    t += `| \`/stats\` | Bot stats |\n| \`/count\` | User count |\n`;
    t += `| \`/uptime\` | Bot uptime |\n| \`/ping\` | Latency |\n`;
    t += `| \`/docs\` | API docs |\n| \`/privacy\` | Privacy policy |\n`;
    return reply(t);
  },
};

function initPusher() {
  ws = new WebSocket(
    "wss://ws-eu.pusher.com/app/8ecfcde38263841b251c?protocol=7&client=distalk&version=1.0&flash=false"
  );

  ws.on("open", () => console.log("[WS] Connected"));

  ws.on("message", async (raw) => {
    let p;
    try { p = JSON.parse(raw); } catch { return; }

    if (p.event === "pusher:connection_established") {
      console.log("[WS] Established");
      subs.forEach((ch) => sub(ch));
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: "pusher:ping", data: {} }));
      }, 30000);
      startMessagePolling();
      return;
    }

    if (p.event === "pusher:pong" || p.event === "pusher_internal:subscription_succeeded") return;

    if (p.event === "sync") {
      console.log("[WS] sync event");
      triggerMessageCheck();
    }
  });

  ws.on("close", (code) => {
    console.warn(`[WS] Closed (${code}). Reconnecting in 5s...`);
    clearInterval(pingTimer);
    clearInterval(messagePollTimer);
    messagePollTimer = null;
    setTimeout(initPusher, 5000);
  });

  ws.on("error", (e) => console.error("[WS]", e.message));
}

function startMessagePolling() {
  if (messagePollTimer) return;
  console.log("[Bot] Starting message poller (3s interval)");
  messagePollTimer = setInterval(triggerMessageCheck, 3000);
}

function triggerMessageCheck() {
  if (syncing) return;
  syncing = true;
  checkMessages()
    .catch((err) => console.error("[Bot] checkMessages error:", err.message))
    .finally(() => { syncing = false; });
}

function sub(name) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event: "pusher:subscribe", data: { channel: name } }));
  }
  subs.add(name);
}

async function checkMessages() {
  const msgs = await fetchMessages(lastSync);
  if (!msgs?.length) return;

  console.log(`[Bot] ${msgs.length} message(s) since ${lastSync}`);
  lastSync = new Date().toISOString();

  const fresh = msgs.filter((m) => !seen.has(m.id));
  if (!fresh.length) return;

  for (const msg of fresh) {
    seen.add(msg.id);
    if (seen.size > 1000) seen.delete(seen.values().next().value);
    if (msg.user_id === BOT_ID) continue;
    if (!msg.body?.startsWith("/")) continue;
    if (replied.has(msg.id)) continue;

    const age = Date.now() - new Date(msg.created_at).getTime();
    if (age > 60000) continue;

    replied.add(msg.id);
    if (replied.size > 500) replied.delete(replied.values().next().value);

    console.log(`[Chat] "${msg.body}" from ${msg.user_id} in ${msg.channel_id}`);

    const parts = msg.body.trim().split(" ");
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ").trim().toLowerCase();
    const handler = commands[cmd];

    if (handler) {
      commandsRun++;
      const rawArgs = parts.slice(1).join(" ").trim();
      await handler(cmd === "/set" || cmd === "/note" || cmd === "/announce" || cmd === "/kv" ? rawArgs : args, msg, (text) => send(msg.channel_id, text, msg.server_id));
    }
  }
}

function listenToAllChannels(channels = [], serverIds = []) {
  console.log(`[Bot] Subscribing to ${serverIds.length} servers, ${channels.length} channels`);
  serverIds.forEach((id) => sub(`srv-${id}`));
  channels.forEach((ch) => sub(`chn-${ch}`));
}

module.exports = { initPusher, listenToAllChannels };