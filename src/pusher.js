const WebSocket = require("ws");
const store = require("./store");
const { send, fetchMessages } = require("./fetcher");

const BOT_ID = "usr_527896a920b8dc3e";
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
  ws = new WebSocket("wss://ws-eu.pusher.com/app/8ecfcde38263841b251c?protocol=7&client=distalk&version=1.0&flash=false");

  ws.on("open", () => console.log("[WS] Connected"));

  ws.on("message", async raw => {
    let p;
    try { p = JSON.parse(raw); } catch { return; }

    if (p.event === "pusher:connection_established") {
      console.log("[WS] Established");
      subs.forEach(ch => sub(ch));
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: "pusher:ping", data: {} }));
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
      return;
    }
  });

  ws.on("close", code => {
    console.warn(`[WS] Closed (${code}). Reconnecting...`);
    clearInterval(pingTimer);
    setTimeout(initPusher, 5000);
  });

  ws.on("error", e => console.error("[WS]", e.message));
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
  const fresh = msgs.filter(m => !seen.has(m.id));
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
  const reply = text => send(msg.channel_id, text, msg.server_id);

  commandsRun++;

  switch (cmd) {
    case "/status": return cmdStatus(argsLower, reply);
    case "/online": return cmdOnline(reply);
    case "/profile": return cmdProfile(argsLower, reply);
    case "/search": return cmdSearch(argsLower, reply);
    case "/api": return cmdApi(argsLower, reply);
    case "/userid": return cmdUserId(argsLower, reply);
    case "/avatar": return cmdAvatar(argsLower, reply);
    case "/badges": return cmdBadges(argsLower, reply);
    case "/spotify": return cmdSpotify(argsLower, reply);
    case "/server": return cmdServer(msg, reply);
    case "/uptime": return cmdUptime(reply);
    case "/ping": return cmdPing(msg, reply);
    case "/count": return cmdCount(reply);
    case "/socials": return cmdSocials(argsLower, reply);
    case "/tag": return cmdTag(argsLower, reply);
    case "/compare": return cmdCompare(argsLower, reply);
    case "/random": return cmdRandom(reply);
    case "/mobile": return cmdMobile(reply);
    case "/offline": return cmdOffline(reply);
    case "/role": return cmdRole(argsLower, reply);
    case "/bio": return cmdBio(argsLower, reply);
    case "/whois": return cmdWhois(argsLower, reply);
    case "/stats": return cmdStats(reply);
    case "/help": return cmdHelp(reply);
    default: return;
  }
}

async function cmdStatus(query, reply) {
  if (!query) return reply("`usage: /status <username>`");
  const user = findUser(query);
  if (!user) return reply(`\`user "${query}" not found\``);

  const p = user.presence;
  const e = statusEmoji(p.status);

  let t = `\`${e} ${user.display_name} (@${user.username})\`\n`;
  t += `\`status    ${p.status}\`\n`;
  if (p.is_mobile) t += "`device    mobile`\n";
  if (p.activity) t += `\`activity  ${p.activity}\`\n`;
  if (user.spotify?.now_playing) t += `\`spotify   ${user.spotify.now_playing}\`\n`;

  return reply(t);
}

async function cmdOnline(reply) {
  const users = store.values();
  const online = users.filter(u => u.presence.status === "online");
  const idle = users.filter(u => u.presence.status === "idle");
  const dnd = users.filter(u => u.presence.status === "dnd");
  const total = online.length + idle.length + dnd.length;

  let t = `\`online users (${total})\`\n\n`;

  if (online.length) {
    online.forEach(u => t += `\`${u.display_name} (@${u.username})\`\n`);
    t += "\n";
  }
  if (idle.length) {
    idle.forEach(u => t += `\`${u.display_name} (@${u.username})\`\n`);
    t += "\n";
  }
  if (dnd.length) {
    dnd.forEach(u => t += `\`${u.display_name} (@${u.username})\`\n`);
  }
  if (!total) t += "`nobody is online right now`";

  return reply(t);
}

async function cmdProfile(query, reply) {
  if (!query) return reply("`usage: /profile <username>`");
  const user = findUser(query);
  if (!user) return reply(`\`user "${query}" not found\``);

  const p = user.presence;
  const e = statusEmoji(p.status);

  let t = `\`${e} ${user.display_name} (@${user.username})\`\n`;
  t += `\`status    ${p.status}\`\n`;
  t += `\`role      ${user.platform_role}\`\n`;
  if (user.bio) t += `\`bio       ${user.bio}\`\n`;
  if (p.is_mobile) t += "`device    📱 mobile`\n";
  if (user.badges?.length) t += `\`badges    ${user.badges.join(", ")}\`\n`;
  if (user.self_badges?.length) t += `\`tags      ${user.self_badges.join(", ")}\`\n`;
  if (user.tag) t += `\`server    ${user.tag.emoji || ""} ${user.tag.text || ""} (${user.tag.server_name})\`\n`;
  if (user.socials?.youtube) t += `\`youtube   ${user.socials.youtube}\`\n`;
  if (user.socials?.twitch) t += `\`twitch    ${user.socials.twitch}\`\n`;
  if (user.socials?.tiktok) t += `\`tiktok    ${user.socials.tiktok}\`\n`;
  if (user.spotify?.connected) t += "`spotify   connected`\n";
  if (user.spotify?.now_playing) t += `\`playing   🎵 ${user.spotify.now_playing}\`\n`;
  if (p.activity) t += `\`activity  ${p.activity}\`\n`;

  return reply(t);
}

async function cmdSearch(query, reply) {
  if (!query) return reply("`usage: /search <query>`");

  const results = store.values().filter(u =>
    u.username?.includes(query) || u.display_name?.toLowerCase().includes(query)
  ).slice(0, 10);

  if (!results.length) return reply(`\`no users matching "${query}"\``);

  let t = `\`search: "${query}" (${results.length} results)\`\n\n`;
  results.forEach(u => {
    t += `\`${statusEmoji(u.presence.status)} ${u.display_name} (@${u.username})\`\n`;
  });

  return reply(t);
}

async function cmdApi(query, reply) {
  if (!query) return reply("`usage: /api <username>`");
  const user = findUser(query);
  if (!user) return reply(`\`user "${query}" not found\``);

  const { _ts, ...clean } = user;
  const json = JSON.stringify({ success: true, data: clean }, null, 2);
  let t = "";
  json.split("\n").forEach(line => t += `\`${line}\`\n`);

  return reply(t);
}

async function cmdUserId(query, reply) {
  if (!query) return reply("`usage: /userid <username>`");
  const user = findUser(query);
  if (!user) return reply(`\`user "${query}" not found\``);

  return reply(`\`${user.display_name} → ${user.id}\``);
}

async function cmdAvatar(query, reply) {
  if (!query) return reply("`usage: /avatar <username>`");
  const user = findUser(query);
  if (!user) return reply(`\`user "${query}" not found\``);

  if (!user.avatar_url) return reply(`\`${user.display_name} has no avatar\``);
  return reply(user.avatar_url);
}

async function cmdBadges(query, reply) {
  if (!query) return reply("`usage: /badges <username>`");
  const user = findUser(query);
  if (!user) return reply(`\`user "${query}" not found\``);

  const all = [...new Set([...(user.badges || []), ...(user.self_badges || [])])];
  if (!all.length) return reply(`\`${user.display_name} has no badges\``);

  let t = `\`${user.display_name}'s badges (${all.length})\`\n\n`;
  all.forEach(b => t += `\`• ${b}\`\n`);

  return reply(t);
}

async function cmdSpotify(query, reply) {
  if (!query) return reply("`usage: /spotify <username>`");
  const user = findUser(query);
  if (!user) return reply(`\`user "${query}" not found\``);

  if (!user.spotify?.connected) return reply(`\`${user.display_name} has no spotify connected\``);
  if (!user.spotify.now_playing) return reply(`\`${user.display_name} is not listening to anything\``);

  return reply(`\`${user.display_name} is listening to: ${user.spotify.now_playing}\``);
}

async function cmdSocials(query, reply) {
  if (!query) return reply("`usage: /socials <username>`");
  const user = findUser(query);
  if (!user) return reply(`\`user "${query}" not found\``);

  const s = user.socials;
  const has = s?.youtube || s?.twitch || s?.tiktok || s?.spotify;
  if (!has) return reply(`\`${user.display_name} has no socials linked\``);

  let t = `\`${user.display_name}'s socials\`\n\n`;
  if (s.youtube) t += `\`youtube   ${s.youtube}\`\n`;
  if (s.twitch) t += `\`twitch    ${s.twitch}\`\n`;
  if (s.tiktok) t += `\`tiktok    ${s.tiktok}\`\n`;
  if (s.spotify) t += `\`spotify   ${s.spotify}\`\n`;

  return reply(t);
}

async function cmdTag(query, reply) {
  if (!query) return reply("`usage: /tag <username>`");
  const user = findUser(query);
  if (!user) return reply(`\`user "${query}" not found\``);

  if (!user.tag) return reply(`\`${user.display_name} has no server tag\``);

  let t = `\`${user.display_name}'s tag\`\n\n`;
  t += `\`text      ${user.tag.emoji || ""} ${user.tag.text || ""}\`\n`;
  t += `\`server    ${user.tag.server_name}\`\n`;
  if (user.tag.invite_slug) t += `\`invite    distalk.app/invite/${user.tag.invite_slug}\`\n`;

  return reply(t);
}

async function cmdCompare(query, reply) {
  const parts = query.split(" ").filter(Boolean);
  if (parts.length < 2) return reply("`usage: /compare <user1> <user2>`");

  const user1 = findUser(parts[0]);
  const user2 = findUser(parts[1]);

  if (!user1) return reply(`\`user "${parts[0]}" not found\``);
  if (!user2) return reply(`\`user "${parts[1]}" not found\``);

  const e1 = statusEmoji(user1.presence.status);
  const e2 = statusEmoji(user2.presence.status);

  let t = `\`comparing two users\`\n\n`;
  t += `\`            ${pad(user1.display_name, 15)} ${pad(user2.display_name, 15)}\`\n`;
  t += `\`status      ${pad(e1 + " " + user1.presence.status, 15)} ${pad(e2 + " " + user2.presence.status, 15)}\`\n`;
  t += `\`role        ${pad(user1.platform_role, 15)} ${pad(user2.platform_role, 15)}\`\n`;
  t += `\`mobile      ${pad(user1.presence.is_mobile ? "yes" : "no", 15)} ${pad(user2.presence.is_mobile ? "yes" : "no", 15)}\`\n`;
  t += `\`badges      ${pad(String((user1.badges?.length || 0) + (user1.self_badges?.length || 0)), 15)} ${pad(String((user2.badges?.length || 0) + (user2.self_badges?.length || 0)), 15)}\`\n`;
  t += `\`spotify     ${pad(user1.spotify?.connected ? "yes" : "no", 15)} ${pad(user2.spotify?.connected ? "yes" : "no", 15)}\`\n`;

  return reply(t);
}

async function cmdRandom(reply) {
  const users = store.values();
  if (!users.length) return reply("`no users tracked`");

  const user = users[Math.floor(Math.random() * users.length)];
  const e = statusEmoji(user.presence.status);

  let t = `\`random user\`\n\n`;
  t += `\`${e} ${user.display_name} (@${user.username})\`\n`;
  t += `\`id        ${user.id}\`\n`;
  t += `\`status    ${user.presence.status}\`\n`;
  t += `\`role      ${user.platform_role}\`\n`;

  return reply(t);
}

async function cmdMobile(reply) {
  const mobile = store.values().filter(u => u.presence.is_mobile);

  if (!mobile.length) return reply("`no users on mobile right now`");

  let t = `\`mobile users (${mobile.length})\`\n\n`;
  mobile.forEach(u => {
    t += `\`${statusEmoji(u.presence.status)} ${u.display_name} (@${u.username})\`\n`;
  });

  return reply(t);
}

async function cmdOffline(reply) {
  const offline = store.values()
    .filter(u => u.presence.status === "offline" && u.presence.last_seen)
    .sort((a, b) => new Date(b.presence.last_seen) - new Date(a.presence.last_seen))
    .slice(0, 10);

  if (!offline.length) return reply("`no recently seen offline users`");

  let t = `\`recently offline (${offline.length})\`\n\n`;
  offline.forEach(u => {
    const ago = timeAgo(u.presence.last_seen);
    t += `\`${u.display_name} (@${u.username}) — ${ago}\`\n`;
  });

  return reply(t);
}

async function cmdRole(query, reply) {
  if (!query) return reply("`usage: /role <role>`\n`roles: user, admin, owner, supporter`");

  const users = store.values().filter(u => u.platform_role === query);
  if (!users.length) return reply(`\`no users with role "${query}"\``);

  let t = `\`role: ${query} (${users.length})\`\n\n`;
  users.forEach(u => {
    t += `\`${statusEmoji(u.presence.status)} ${u.display_name} (@${u.username})\`\n`;
  });

  return reply(t);
}

async function cmdBio(query, reply) {
  if (!query) return reply("`usage: /bio <username>`");
  const user = findUser(query);
  if (!user) return reply(`\`user "${query}" not found\``);

  if (!user.bio) return reply(`\`${user.display_name} has no bio\``);
  return reply(`\`${user.display_name}'s bio:\`\n\`${user.bio}\``);
}

async function cmdWhois(query, reply) {
  if (!query) return reply("`usage: /whois <user_id>`");

  const id = query.startsWith("usr_") ? query : `usr_${query}`;
  const user = store.get(id);

  if (!user) return reply(`\`no user found with id ${id}\``);
  return reply(`\`${id} → ${user.display_name} (@${user.username})\``);
}

async function cmdStats(reply) {
  const users = store.values();
  const total = users.length;
  const online = users.filter(u => u.presence.status === "online").length;
  const idle = users.filter(u => u.presence.status === "idle").length;
  const dnd = users.filter(u => u.presence.status === "dnd").length;
  const offline = total - online - idle - dnd;
  const mobile = users.filter(u => u.presence.is_mobile).length;
  const spotifyConnected = users.filter(u => u.spotify?.connected).length;
  const withBio = users.filter(u => u.bio).length;
  const withAvatar = users.filter(u => u.avatar_url).length;

  const ms = Date.now() - START_TIME;
  const uptime = formatUptime(ms);

  let t = `\`beacon stats\`\n\n`;
  t += `\`users       ${total}\`\n`;
  t += `\`online   ${online}\`\n`;
  t += `\`idle     ${idle}\`\n`;
  t += `\`dnd      ${dnd}\`\n`;
  t += `\`offline  ${offline}\`\n`;
  t += `\`mobile   ${mobile}\`\n`;
  t += `\`spotify  ${spotifyConnected}\`\n`;
  t += `\`has bio  ${withBio}\`\n`;
  t += `\`avatar   ${withAvatar}\`\n`;
  t += `\`uptime   ${uptime}\`\n`;
  t += `\`commands ${commandsRun}\`\n`;
  t += `\`channels ${subs.size}\`\n`;

  return reply(t);
}

async function cmdServer(msg, reply) {
  const users = store.values();
  const total = users.length;
  const online = users.filter(u => u.presence.status === "online").length;
  const idle = users.filter(u => u.presence.status === "idle").length;
  const dnd = users.filter(u => u.presence.status === "dnd").length;
  const offline = total - online - idle - dnd;

  let t = `\`server: ${msg.server_id}\`\n`;
  t += `\`channel: ${msg.channel_id}\`\n\n`;
  t += `\`total     ${total} users\`\n`;
  t += `\`🟢 online  ${online}\`\n`;
  t += `\`🟡 idle    ${idle}\`\n`;
  t += `\`🔴 dnd     ${dnd}\`\n`;
  t += `\`⚫ offline ${offline}\`\n`;

  return reply(t);
}

async function cmdUptime(reply) {
  return reply(`\`uptime: ${formatUptime(Date.now() - START_TIME)}\``);
}

async function cmdPing(msg, reply) {
  const sent = new Date(msg.created_at).getTime();
  const latency = Date.now() - sent;
  return reply(`\`pong — ${latency}ms\``);
}

async function cmdCount(reply) {
  return reply(`\`tracking ${store.count()} users\``);
}

async function cmdHelp(reply) {
  return reply(
    "`/status <user>`  current status\n" +
    "`/profile <user>`  full profile\n" +
    "`/userid <user>`  get user id\n" +
    "`/whois <id>`  id to username\n" +
    "`/avatar <user>`  avatar url\n" +
    "`/badges <user>`  list badges\n" +
    "`/bio <user>`  user bio\n" +
    "`/socials <user>`  social links\n" +
    "`/tag <user>`  server tag\n" +
    "`/spotify <user>`  now playing\n" +
    "`/compare <a> <b>`  compare users\n" +
    "`/online`  online users\n" +
    "`/offline`  recently offline\n" +
    "`/mobile`  mobile users\n" +
    "`/role <role>`  users by role\n" +
    "`/search <query>`  search users\n" +
    "`/random`  random user\n" +
    "`/api <user>`  raw json\n" +
    "`/server`  server info\n" +
    "`/stats`  bot statistics\n" +
    "`/count`  tracked users\n" +
    "`/uptime`  bot uptime\n" +
    "`/ping`  latency\n" +
    "`/help`  this message"
  );
}

function findUser(query) {
  return store.values().find(u =>
    u.id?.toLowerCase() === query ||
    u.username === query ||
    u.display_name?.toLowerCase() === query
  );
}

function statusEmoji(s) {
  return { online: "🟢", idle: "🟡", dnd: "🔴", offline: "⚫" }[s] || "⚫";
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

function listenToAllChannels(channels = [], serverIds = []) {
  console.log(`[Bot] Subscribing to ${serverIds.length} servers + ${channels.length} channels`);
  serverIds.forEach(id => sub(`srv-${id}`));
  channels.forEach(ch => sub(`chn-${ch}`));
}

module.exports = { initPusher, listenToAllChannels };