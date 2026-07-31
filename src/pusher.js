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
let lastSync = new Date(Date.now() - 5000).toISOString();
let syncing = false;

const subs = new Set();
const seen = new Set();
const replied = new Set();

function initPusher() {
  ws = new WebSocket(
    "wss://ws-eu.pusher.com/app/8ecfcde38263841b251c?protocol=7&client=distalk&version=1.0&flash=false"
  );

  ws.on("open", () => console.log("[WS] Connected"));

  ws.on("message", async (raw) => {
    let p;
    try {
      p = JSON.parse(raw);
    } catch {
      return;
    }

    if (p.event === "pusher:connection_established") {
      subs.forEach((ch) => sub(ch));
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: "pusher:ping", data: {} }));
        }
      }, 30000);
      return;
    }

    if (p.event === "pusher:pong") return;
    if (p.event === "pusher_internal:subscription_succeeded") return;

    if (p.event === "sync") {
      if (syncing) return;
      syncing = true;
      await checkMessages();
      syncing = false;
    }
  });

  ws.on("close", (code) => {
    console.warn(`[WS] Closed (${code}). Reconnecting in 5s...`);
    clearInterval(pingTimer);
    setTimeout(initPusher, 5000);
  });

  ws.on("error", (e) => console.error("[WS]", e.message));
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
    if (age > 15000) continue;

    replied.add(msg.id);
    if (replied.size > 500) replied.delete(replied.values().next().value);

    console.log(`[Chat] "${msg.body}" from ${msg.user_id} in ${msg.channel_id}`);
    await handleCommand(msg);
  }
}

async function handleCommand(msg) {
  const parts = msg.body.trim().split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ").trim();
  const argsLower = args.toLowerCase();
  const reply = (text) => send(msg.channel_id, text, msg.server_id);

  commandsRun++;

  switch (cmd) {
    case "/status":   return cmdStatus(argsLower, reply);
    case "/online":   return cmdOnline(reply);
    case "/profile":  return cmdProfile(argsLower, reply);
    case "/search":   return cmdSearch(argsLower, reply);
    case "/api":      return cmdApi(argsLower, reply);
    case "/userid":   return cmdUserId(argsLower, reply);
    case "/avatar":   return cmdAvatar(argsLower, reply);
    case "/badges":   return cmdBadges(argsLower, reply);
    case "/spotify":  return cmdSpotify(argsLower, reply);
    case "/server":   return cmdServer(msg, reply);
    case "/uptime":   return cmdUptime(reply);
    case "/ping":     return cmdPing(msg, reply);
    case "/count":    return cmdCount(reply);
    case "/socials":  return cmdSocials(argsLower, reply);
    case "/tag":      return cmdTag(argsLower, reply);
    case "/compare":  return cmdCompare(argsLower, reply);
    case "/random":   return cmdRandom(reply);
    case "/mobile":   return cmdMobile(reply);
    case "/offline":  return cmdOffline(reply);
    case "/role":     return cmdRole(argsLower, reply);
    case "/bio":      return cmdBio(argsLower, reply);
    case "/whois":    return cmdWhois(argsLower, reply);
    case "/stats":    return cmdStats(reply);
    case "/set":      return cmdSet(args, msg, reply);
    case "/get":      return cmdGet(argsLower, reply);
    case "/del":      return cmdDel(argsLower, msg, reply);
    case "/keys":     return cmdKeys(reply);
    case "/kv":       return cmdKV(args, msg, reply);
    case "/note":     return cmdNote(args, msg, reply);
    case "/notes":    return cmdNotes(argsLower, reply);
    case "/announce": return cmdAnnounce(args, msg, reply);
    case "/docs":     return cmdDocs(reply);
    case "/privacy":  return cmdPrivacy(reply);
    case "/who":      return cmdWho(argsLower, msg, reply);
    case "/help":     return cmdHelp(reply);
    default:          return;
  }
}

function formatBadge(b) {
  if (b.icon) return `${b.icon} ${b.name}`;
  if (b.lucide) return b.name;
  return b.name;
}

function formatBadgeList(badges) {
  return badges.map(formatBadge).join(", ");
}

function row(label, value) {
  return `${label} <-> ${value}`;
}

async function cmdStatus(query, reply) {
  if (!query) return reply("## Usage\n`/status <username>`");
  const user = findUser(query);
  if (!user) return reply(`**User "${query}" not found**`);

  const p = user.presence;
  let t = `## ${user.display_name}\n`;
  t += `-------\n`;
  t += `${row("**Status**", `\`${p.status}\``)}\n`;
  if (p.is_mobile) t += `${row("**Device**", "`mobile`")}\n`;
  if (p.custom_status?.text) t += `${row("**Custom**", p.custom_status.text)}\n`;
  if (p.activity) t += `${row("**Activity**", p.activity)}\n`;
  if (user.spotify?.now_playing) t += `${row("**Spotify**", user.spotify.now_playing)}\n`;

  return reply(t);
}

async function cmdOnline(reply) {
  const users = store.values();
  const online = users.filter((u) => u.presence.status === "online");
  const idle = users.filter((u) => u.presence.status === "idle");
  const dnd = users.filter((u) => u.presence.status === "dnd");
  const total = online.length + idle.length + dnd.length;

  let t = `## Online Users\n`;
  t += `**${total}** active right now\n`;
  t += `-------\n`;

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
  if (!total) t += "*Nobody is online right now*";

  return reply(t);
}

async function cmdProfile(query, reply) {
  if (!query) return reply("## Usage\n`/profile <username>`");
  const user = findUser(query);
  if (!user) return reply(`**User "${query}" not found**`);

  const p = user.presence;
  let t = `## ${user.display_name}\n`;
  t += `@${user.username} · \`${user.id}\`\n`;
  t += `-------\n`;
  t += `${row("**Status**", `\`${p.status}\``)}\n`;
  t += `${row("**Role**", `\`${user.platform_role}\``)}\n`;
  if (user.bio) t += `${row("**Bio**", user.bio)}\n`;
  if (p.is_mobile) t += `${row("**Device**", "`mobile`")}\n`;

  if (user.badges?.length) {
    t += `${row("**Badges**", formatBadgeList(user.badges))}\n`;
  }
  if (user.self_badges?.length) {
    t += `${row("**Tags**", formatBadgeList(user.self_badges))}\n`;
  }

  if (user.tag) t += `${row("**Server Tag**", `${user.tag.text || ""} (${user.tag.server_name})`)}\n`;

  if (user.socials?.youtube) t += `${row("**YouTube**", user.socials.youtube)}\n`;
  if (user.socials?.twitch) t += `${row("**Twitch**", user.socials.twitch)}\n`;
  if (user.socials?.tiktok) t += `${row("**TikTok**", user.socials.tiktok)}\n`;

  if (user.spotify?.connected) {
    if (user.spotify.now_playing) {
      t += `${row("**Spotify**", user.spotify.now_playing)}\n`;
    } else {
      t += `${row("**Spotify**", "connected")}\n`;
    }
  }
  if (p.activity) t += `${row("**Activity**", p.activity)}\n`;

  return reply(t);
}

async function cmdSearch(query, reply) {
  if (!query) return reply("## Usage\n`/search <query>`");

  const results = store
    .values()
    .filter(
      (u) => u.username?.includes(query) || u.display_name?.toLowerCase().includes(query)
    )
    .slice(0, 10);

  if (!results.length) return reply(`**No users matching "${query}"**`);

  let t = `## Search Results\n`;
  t += `**"${query}"** — ${results.length} result${results.length !== 1 ? "s" : ""}\n`;
  t += `-------\n`;

  t += `| User | Status |\n`;
  t += `| --- | --- |\n`;
  results.forEach((u) => {
    t += `| ${u.display_name} (@${u.username}) | \`${u.presence.status}\` |\n`;
  });

  return reply(t);
}

async function cmdApi(query, reply) {
  if (!query) return reply("## Usage\n`/api <username>`");
  const user = findUser(query);
  if (!user) return reply(`**User "${query}" not found**`);

  const { _ts, ...clean } = user;
  const json = JSON.stringify({ success: true, data: clean }, null, 2);

  let t = `## API Response\n`;
  t += `\`${user.display_name}\`\n`;
  t += `-------\n`;
  json.split("\n").forEach((line) => (t += `\`${line}\`\n`));

  return reply(t);
}

async function cmdUserId(query, reply) {
  if (!query) return reply("## Usage\n`/userid <username>`");
  const user = findUser(query);
  if (!user) return reply(`**User "${query}" not found**`);
  return reply(`${row(`**${user.display_name}**`, `\`${user.id}\``)}`);
}

async function cmdAvatar(query, reply) {
  if (!query) return reply("## Usage\n`/avatar <username>`");
  const user = findUser(query);
  if (!user) return reply(`**User "${query}" not found**`);
  if (!user.avatar_url) return reply(`**${user.display_name}** has no avatar`);
  return reply(user.avatar_url);
}

async function cmdBadges(query, reply) {
  if (!query) return reply("## Usage\n`/badges <username>`");
  const user = findUser(query);
  if (!user) return reply(`**User "${query}" not found**`);

  const platform = user.badges || [];
  const self = user.self_badges || [];
  const total = platform.length + self.length;

  if (!total) return reply(`**${user.display_name}** has no badges`);

  let t = `## ${user.display_name}\n`;
  t += `**${total}** badge${total !== 1 ? "s" : ""}\n`;
  t += `-------\n`;

  if (platform.length) {
    t += `**Platform**\n`;
    platform.forEach((b) => {
      t += `- [x] ${b.icon ? b.icon + " " : ""}${b.name}\n`;
    });
    t += "\n";
  }

  if (self.length) {
    t += `**Self**\n`;
    self.forEach((b) => {
      t += `- [x] ${b.icon ? b.icon + " " : ""}${b.name}\n`;
    });
  }

  return reply(t);
}

async function cmdSpotify(query, reply) {
  if (!query) return reply("## Usage\n`/spotify <username>`");
  const user = findUser(query);
  if (!user) return reply(`**User "${query}" not found**`);
  if (!user.spotify?.connected) return reply(`**${user.display_name}** has no Spotify connected`);
  if (!user.spotify.now_playing) return reply(`**${user.display_name}** is not listening to anything`);
  return reply(`${row(`**${user.display_name}**`, user.spotify.now_playing)}`);
}

async function cmdSocials(query, reply) {
  if (!query) return reply("## Usage\n`/socials <username>`");
  const user = findUser(query);
  if (!user) return reply(`**User "${query}" not found**`);

  const s = user.socials;
  if (!s?.youtube && !s?.twitch && !s?.tiktok && !s?.spotify) {
    return reply(`**${user.display_name}** has no socials linked`);
  }

  let t = `## ${user.display_name}\n`;
  t += `**Socials**\n`;
  t += `-------\n`;
  if (s.youtube) t += `${row("**YouTube**", s.youtube)}\n`;
  if (s.twitch)  t += `${row("**Twitch**", s.twitch)}\n`;
  if (s.tiktok)  t += `${row("**TikTok**", s.tiktok)}\n`;
  if (s.spotify) t += `${row("**Spotify**", s.spotify)}\n`;

  return reply(t);
}

async function cmdTag(query, reply) {
  if (!query) return reply("## Usage\n`/tag <username>`");
  const user = findUser(query);
  if (!user) return reply(`**User "${query}" not found**`);
  if (!user.tag) return reply(`**${user.display_name}** has no server tag`);

  let t = `## ${user.display_name}\n`;
  t += `**Server Tag**\n`;
  t += `-------\n`;
  t += `${row("**Text**", user.tag.text || "—")}\n`;
  t += `${row("**Server**", user.tag.server_name)}\n`;
  if (user.tag.invite_slug) t += `${row("**Invite**", `distalk.app/invite/${user.tag.invite_slug}`)}\n`;

  return reply(t);
}

async function cmdCompare(query, reply) {
  const parts = query.split(" ").filter(Boolean);
  if (parts.length < 2) return reply("## Usage\n`/compare <user1> <user2>`");

  const user1 = findUser(parts[0]);
  const user2 = findUser(parts[1]);

  if (!user1) return reply(`**User "${parts[0]}" not found**`);
  if (!user2) return reply(`**User "${parts[1]}" not found**`);

  const b1 = (user1.badges?.length || 0) + (user1.self_badges?.length || 0);
  const b2 = (user2.badges?.length || 0) + (user2.self_badges?.length || 0);

  let t = `## Compare\n`;
  t += `-------\n`;
  t += `| | **${user1.display_name}** | **${user2.display_name}** |\n`;
  t += `| --- | --- | --- |\n`;
  t += `| Status | \`${user1.presence.status}\` | \`${user2.presence.status}\` |\n`;
  t += `| Role | \`${user1.platform_role}\` | \`${user2.platform_role}\` |\n`;
  t += `| Mobile | ${user1.presence.is_mobile ? "Yes" : "No"} | ${user2.presence.is_mobile ? "Yes" : "No"} |\n`;
  t += `| Badges | ${b1} | ${b2} |\n`;
  t += `| Spotify | ${user1.spotify?.connected ? "Yes" : "No"} | ${user2.spotify?.connected ? "Yes" : "No"} |\n`;

  return reply(t);
}

async function cmdRandom(reply) {
  const users = store.values();
  if (!users.length) return reply("**No users tracked**");

  const user = users[Math.floor(Math.random() * users.length)];

  let t = `## Random User\n`;
  t += `-------\n`;
  t += `${row("**Name**", `${user.display_name} (@${user.username})`)}\n`;
  t += `${row("**ID**", `\`${user.id}\``)}\n`;
  t += `${row("**Status**", `\`${user.presence.status}\``)}\n`;
  t += `${row("**Role**", `\`${user.platform_role}\``)}\n`;

  return reply(t);
}

async function cmdMobile(reply) {
  const mobile = store.values().filter((u) => u.presence.is_mobile);
  if (!mobile.length) return reply("**No users on mobile right now**");

  let t = `## Mobile Users\n`;
  t += `**${mobile.length}** user${mobile.length !== 1 ? "s" : ""}\n`;
  t += `-------\n`;
  mobile.forEach((u) => (t += `- [x] ${u.display_name} (@${u.username}) — \`${u.presence.status}\`\n`));

  return reply(t);
}

async function cmdOffline(reply) {
  const offline = store
    .values()
    .filter((u) => u.presence.status === "offline" && u.presence.last_seen)
    .sort((a, b) => new Date(b.presence.last_seen) - new Date(a.presence.last_seen))
    .slice(0, 10);

  if (!offline.length) return reply("**No recently seen offline users**");

  let t = `## Recently Offline\n`;
  t += `-------\n`;
  t += `| User | Last Seen |\n`;
  t += `| --- | --- |\n`;
  offline.forEach((u) => {
    t += `| ${u.display_name} (@${u.username}) | ${timeAgo(u.presence.last_seen)} |\n`;
  });

  return reply(t);
}

async function cmdRole(query, reply) {
  if (!query) return reply("## Usage\n`/role <role>`\n\nRoles: `user`, `admin`, `owner`, `supporter`");

  const users = store.values().filter((u) => u.platform_role === query);
  if (!users.length) return reply(`**No users with role "${query}"**`);

  let t = `## Role: ${query}\n`;
  t += `**${users.length}** user${users.length !== 1 ? "s" : ""}\n`;
  t += `-------\n`;
  users.forEach((u) => (t += `- [x] ${u.display_name} (@${u.username}) — \`${u.presence.status}\`\n`));

  return reply(t);
}

async function cmdBio(query, reply) {
  if (!query) return reply("## Usage\n`/bio <username>`");
  const user = findUser(query);
  if (!user) return reply(`**User "${query}" not found**`);
  if (!user.bio) return reply(`**${user.display_name}** has no bio`);

  let t = `## ${user.display_name}\n`;
  t += `-------\n`;
  t += user.bio;

  return reply(t);
}

async function cmdWhois(query, reply) {
  if (!query) return reply("## Usage\n`/whois <user_id>`");
  const id = query.startsWith("usr_") ? query : `usr_${query}`;
  const user = store.get(id);
  if (!user) return reply(`**No user found with ID** \`${id}\``);
  return reply(`${row(`\`${id}\``, `**${user.display_name}** (@${user.username})`)}`);
}

async function cmdStats(reply) {
  const users = store.values();
  const total = users.length;
  const online = users.filter((u) => u.presence.status === "online").length;
  const idle = users.filter((u) => u.presence.status === "idle").length;
  const dnd = users.filter((u) => u.presence.status === "dnd").length;
  const offline = total - online - idle - dnd;
  const mobile = users.filter((u) => u.presence.is_mobile).length;
  const spotify = users.filter((u) => u.spotify?.connected).length;
  const withBio = users.filter((u) => u.bio).length;
  const withAvatar = users.filter((u) => u.avatar_url).length;
  const withBadges = users.filter(
    (u) => (u.badges?.length || 0) + (u.self_badges?.length || 0) > 0
  ).length;

  let t = `## Beacon Stats\n`;
  t += `-------\n`;
  t += `| Metric | Value |\n`;
  t += `| --- | --- |\n`;
  t += `| Users | **${total}** |\n`;
  t += `| Online | **${online}** |\n`;
  t += `| Idle | **${idle}** |\n`;
  t += `| DND | **${dnd}** |\n`;
  t += `| Offline | **${offline}** |\n`;
  t += `| Mobile | **${mobile}** |\n`;
  t += `| Spotify | **${spotify}** |\n`;
  t += `| Has Bio | **${withBio}** |\n`;
  t += `| Has Avatar | **${withAvatar}** |\n`;
  t += `| Has Badges | **${withBadges}** |\n`;
  t += `| Uptime | **${formatUptime(Date.now() - START_TIME)}** |\n`;
  t += `| Commands | **${commandsRun}** |\n`;
  t += `| Channels | **${subs.size}** |\n`;

  return reply(t);
}

async function cmdServer(msg, reply) {
  const users = store.values();
  const total = users.length;
  const online = users.filter((u) => u.presence.status === "online").length;
  const idle = users.filter((u) => u.presence.status === "idle").length;
  const dnd = users.filter((u) => u.presence.status === "dnd").length;
  const offline = total - online - idle - dnd;

  let t = `## Server Info\n`;
  t += `\`${msg.server_id}\` · \`${msg.channel_id}\`\n`;
  t += `-------\n`;
  t += `| Status | Count |\n`;
  t += `| --- | --- |\n`;
  t += `| Total | **${total}** |\n`;
  t += `| Online | **${online}** |\n`;
  t += `| Idle | **${idle}** |\n`;
  t += `| DND | **${dnd}** |\n`;
  t += `| Offline | **${offline}** |\n`;

  return reply(t);
}

async function cmdSet(input, msg, reply) {
  const space = input.indexOf(" ");
  if (space === -1) return reply("## Usage\n`/set <key> <value>`");
  const key = input.substring(0, space).trim();
  const value = input.substring(space + 1).trim();
  kv.set(key, value);
  return reply(`${row(`\`${key}\``, `\`${value}\``)}`);
}

async function cmdGet(key, reply) {
  if (!key) return reply("## Usage\n`/get <key>`");
  const value = kv.get(key);
  if (value === null) return reply(`**Key "${key}" not found**`);
  return reply(`${row(`\`${key}\``, `\`${value}\``)}`);
}

async function cmdDel(key, msg, reply) {
  if (!key) return reply("## Usage\n`/del <key>`");
  if (msg.user_id !== OWNER_ID) return reply("**Only the owner can delete keys**");
  kv.del(key);
  return reply(`~~${key}~~ **deleted**`);
}

async function cmdKeys(reply) {
  const keys = kv.keys();
  if (!keys.length) return reply("**No keys stored**");

  let t = `## Stored Keys\n`;
  t += `**${keys.length}** key${keys.length !== 1 ? "s" : ""}\n`;
  t += `-------\n`;
  t += `| Key | Value |\n`;
  t += `| --- | --- |\n`;
  keys.forEach((k) => (t += `| \`${k}\` | \`${kv.get(k)}\` |\n`));

  return reply(t);
}

async function cmdNote(input, msg, reply) {
  const space = input.indexOf(" ");
  if (space === -1) return reply("## Usage\n`/note <user> <text>`");

  const username = input.substring(0, space).trim().toLowerCase();
  const text = input.substring(space + 1).trim();
  const user = findUser(username);
  if (!user) return reply(`**User "${username}" not found**`);

  const key = `note:${user.id}`;
  const existing = kv.get(key) || [];
  existing.push({ text, by: msg.user_id, at: new Date().toISOString() });
  kv.set(key, existing);

  return reply(`Note added for **${user.display_name}** (${existing.length} total)`);
}

async function cmdNotes(query, reply) {
  if (!query) return reply("## Usage\n`/notes <user>`");
  const user = findUser(query);
  if (!user) return reply(`**User "${query}" not found**`);

  const notes = kv.get(`note:${user.id}`);
  if (!notes?.length) return reply(`**No notes for ${user.display_name}**`);

  let t = `## Notes for ${user.display_name}\n`;
  t += `**${notes.length}** note${notes.length !== 1 ? "s" : ""}\n`;
  t += `-------\n`;
  notes.forEach((n, i) => (t += `${i + 1}. ${n.text}\n`));

  return reply(t);
}

async function cmdAnnounce(text, msg, reply) {
  if (msg.user_id !== OWNER_ID) return reply("**Only the owner can use /announce**");
  if (!text) return reply("## Usage\n`/announce <message>`");

  let t = `## Announcement\n`;
  t += `-------\n`;
  t += `-> ${text} <-`;

  return reply(t);
}

async function cmdUptime(reply) {
  return reply(`${row("**Uptime**", `\`${formatUptime(Date.now() - START_TIME)}\``)}`);
}

async function cmdPing(msg, reply) {
  const latency = Date.now() - new Date(msg.created_at).getTime();
  return reply(`${row("**Pong**", `\`${latency}ms\``)}`);
}

async function cmdCount(reply) {
  return reply(`${row("**Tracking**", `**${store.count()}** users`)}`);
}

async function cmdDocs(reply) {
  return reply("## Beacon API\n-------\nhttps://api-beacon.up.railway.app/docs");
}

async function cmdPrivacy(reply) {
  return reply("## Privacy Policy\n-------\nhttps://api-beacon.up.railway.app/privacy");
}

async function cmdHelp(reply) {
  let t = `## Beacon Commands\n`;
  t += `-------\n`;
  t += `| Command | Description |\n`;
  t += `| --- | --- |\n`;
  t += `| \`/status <user>\` | Current status |\n`;
  t += `| \`/profile <user>\` | Full profile |\n`;
  t += `| \`/userid <user>\` | Get user ID |\n`;
  t += `| \`/whois <id>\` | Resolve ID |\n`;
  t += `| \`/avatar <user>\` | Avatar URL |\n`;
  t += `| \`/badges <user>\` | List badges |\n`;
  t += `| \`/bio <user>\` | User bio |\n`;
  t += `| \`/socials <user>\` | Social links |\n`;
  t += `| \`/tag <user>\` | Server tag |\n`;
  t += `| \`/spotify <user>\` | Now playing |\n`;
  t += `| \`/compare <a> <b>\` | Compare users |\n`;
  t += `| \`/online\` | Online users |\n`;
  t += `| \`/offline\` | Recently offline |\n`;
  t += `| \`/mobile\` | Mobile users |\n`;
  t += `| \`/role <role>\` | Users by role |\n`;
  t += `| \`/search <query>\` | Search users |\n`;
  t += `| \`/random\` | Random user |\n`;
  t += `| \`/api <user>\` | Raw JSON |\n`;
  t += `| \`/kv [user]\` | View KV data |\n`;
  t += `| \`/kv set <k> <v>\` | Set KV |\n`;
  t += `| \`/kv del <key>\` | Delete KV |\n`;
  t += `| \`/set <key> <val>\` | Store value |\n`;
  t += `| \`/get <key>\` | Get value |\n`;
  t += `| \`/del <key>\` | Delete key |\n`;
  t += `| \`/keys\` | List keys |\n`;
  t += `| \`/note <user> <t>\` | Add note |\n`;
  t += `| \`/notes <user>\` | View notes |\n`;
  t += `| \`/server\` | Server info |\n`;
  t += `| \`/stats\` | Bot stats |\n`;
  t += `| \`/count\` | User count |\n`;
  t += `| \`/uptime\` | Bot uptime |\n`;
  t += `| \`/ping\` | Latency |\n`;
  t += `| \`/docs\` | API docs |\n`;
  t += `| \`/privacy\` | Privacy policy |\n`;

  return reply(t);
}

async function cmdKV(input, msg, reply) {
  const parts = input.split(" ").filter(Boolean);

  if (parts[0] === "set" && parts.length >= 3) {
    const key = parts[1];
    const value = parts.slice(2).join(" ");
    kv.set(`kv:${msg.user_id}:${key}`, value);
    return reply(`${row(`\`${key}\``, `\`${value}\``)}`);
  }

  if (parts[0] === "del" && parts.length >= 2) {
    const key = parts[1];
    kv.del(`kv:${msg.user_id}:${key}`);
    return reply(`~~${key}~~ **deleted**`);
  }

  const userId = parts[0] ? findUser(parts[0])?.id || msg.user_id : msg.user_id;
  const user = store.get(userId);
  const name = user?.display_name || userId;

  const prefix = `kv:${userId}:`;
  const userKV = {};
  kv.keys().forEach((k) => {
    if (k.startsWith(prefix)) userKV[k.replace(prefix, "")] = kv.get(k);
  });

  const kvKeys = Object.keys(userKV);

  let t = `## KV for ${name}\n`;
  t += `-------\n`;

  if (kvKeys.length) {
    t += `| Key | Value |\n`;
    t += `| --- | --- |\n`;
    kvKeys.forEach((k) => (t += `| \`${k}\` | \`${userKV[k]}\` |\n`));
  } else {
    t += `*No KV data*\n`;
  }

  t += `\n+++ API Usage\n`;
  t += `\`https://api-beacon.up.railway.app/v1/users/${userId}\`\n\n`;
  t += `REST: \`.data.kv.KEY_NAME\`\n`;
  t += `Socket: \`.d.kv.KEY_NAME\`\n\n`;
  t += `\`/kv set <key> <value>\`\n`;
  t += `\`/kv del <key>\`\n`;
  t += `\`/kv <username>\`\n`;
  t += `+++`;

  return reply(t);
}

async function cmdWho(query, msg, reply) {
  const user = query ? findUser(query) : store.get(msg.user_id);
  if (!user) return reply(`**User "${query}" not found**`);

  const prefix = `kv:${user.id}:`;
  const userKV = {};
  kv.keys().forEach((k) => {
    if (k.startsWith(prefix)) userKV[k.replace(prefix, "")] = kv.get(k);
  });

  const kvKeys = Object.keys(userKV);

  let t = `## ${user.display_name}\n`;
  t += `@${user.username} · \`${user.id}\`\n`;
  t += `-------\n`;
  t += `${row("**API**", `\`api-beacon.up.railway.app/v1/users/${user.id}\``)}\n\n`;

  if (kvKeys.length) {
    t += `**KV Data**\n`;
    t += `| Key | Value |\n`;
    t += `| --- | --- |\n`;
    kvKeys.forEach((k) => (t += `| \`${k}\` | \`${userKV[k]}\` |\n`));
  } else {
    t += `*No KV data*`;
  }

  return reply(t);
}

function listenToAllChannels(channels = [], serverIds = []) {
  console.log(`[Bot] Subscribing to ${serverIds.length} servers, ${channels.length} channels`);
  serverIds.forEach((id) => sub(`srv-${id}`));
  channels.forEach((ch) => sub(`chn-${ch}`));
}

function findUser(query) {
  return store.values().find(
    (u) =>
      u.id?.toLowerCase() === query ||
      u.username === query ||
      u.display_name?.toLowerCase() === query
  );
}

function statusDot(s) {
  return { online: "[on]", idle: "[idle]", dnd: "[dnd]", offline: "[off]" }[s] ?? "[off]";
}

function pad(str, len) {
  return (str || "").substring(0, len).padEnd(len);
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

module.exports = { initPusher, listenToAllChannels };