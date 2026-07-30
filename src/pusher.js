const WebSocket = require("ws");
const store = require("./store");
const { send, fetchMessages } = require("./fetcher");

const BOT_ID = "usr_527896a920b8dc3e";
let ws = null;
let pingTimer = null;
// Start from 5 seconds ago max — ignores anything older on restart
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
        console.log(`[Debug] msg ${msg.id} age: ${age}ms`);
        if (age > 15000) {
        console.log(`[Debug] skipping old message (${age}ms)`);
        continue;
        }

    replied.add(msg.id);
    if (replied.size > 500) replied.delete(replied.values().next().value);

    console.log(`[Chat] "${msg.body}" from ${msg.user_id} in ${msg.channel_id}`);
    await handleCommand(msg);
  }
}

async function handleCommand(msg) {
  const parts = msg.body.trim().split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ").trim().toLowerCase();
  const reply = text => send(msg.channel_id, text, msg.server_id);

  switch (cmd) {
    case "/status": return cmdStatus(args, reply);
    case "/online": return cmdOnline(reply);
    case "/profile": return cmdProfile(args, reply);
    case "/search": return cmdSearch(args, reply);
    case "/help": return cmdHelp(reply);
    default: return;
  }
}

async function cmdStatus(query, reply) {
  if (!query) return reply("`❌ usage: /status <username>`");

  const user = findUser(query);
  if (!user) return reply(`\`❌ user "${query}" not found\``);

  const p = user.presence;
  const e = { online: "🟢", idle: "🟡", dnd: "🔴", offline: "⚫" }[p.status] || "⚫";

  let t = `\`${e} ${user.display_name} (@${user.username})\`\n`;
  t += `\`status    ${p.status}\`\n`;
  if (p.is_mobile) t += "`device    📱 mobile`\n";
  if (p.activity) t += `\`activity  ${p.activity}\`\n`;
  if (user.spotify?.now_playing) t += `\`spotify   🎵 ${user.spotify.now_playing}\`\n`;

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
    online.forEach(u => t += `\`🟢 ${u.display_name} (@${u.username})\`\n`);
    t += "\n";
  }

  if (idle.length) {
    idle.forEach(u => t += `\`🟡 ${u.display_name} (@${u.username})\`\n`);
    t += "\n";
  }

  if (dnd.length) {
    dnd.forEach(u => t += `\`🔴 ${u.display_name} (@${u.username})\`\n`);
  }

  if (!total) t += "`nobody is online right now`";

  return reply(t);
}

async function cmdProfile(query, reply) {
  if (!query) return reply("`❌ usage: /profile <username>`");

  const user = findUser(query);
  if (!user) return reply(`\`❌ user "${query}" not found\``);

  const p = user.presence;
  const e = { online: "🟢", idle: "🟡", dnd: "🔴", offline: "⚫" }[p.status] || "⚫";

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
  if (!query) return reply("`❌ usage: /search <query>`");

  const results = store.values().filter(u =>
    u.username?.includes(query) || u.display_name?.toLowerCase().includes(query)
  ).slice(0, 10);

  if (!results.length) return reply(`\`❌ no users matching "${query}"\``);

  let t = `\`search: "${query}" (${results.length} results)\`\n\n`;
  results.forEach(u => {
    const e = { online: "🟢", idle: "🟡", dnd: "🔴", offline: "⚫" }[u.presence.status] || "⚫";
    t += `\`${e} ${u.display_name} (@${u.username})\`\n`;
  });

  return reply(t);
}

async function cmdHelp(reply) {
  return reply(
    "`/status <user>` — get someone's current status\n" +
    "`/profile <user>` — full profile info\n" +
    "`/online` — list all online users\n" +
    "`/search <query>` — search users by name\n" +
    "`/help` — show this message"
  );
}

function findUser(query) {
  return store.values().find(u =>
    u.id?.toLowerCase() === query ||
    u.username === query ||
    u.display_name?.toLowerCase() === query
  );
}

function listenToAllChannels(channels = [], serverIds = []) {
  console.log(`[Bot] Subscribing to ${serverIds.length} servers + ${channels.length} channels`);
  serverIds.forEach(id => sub(`srv-${id}`));
  channels.forEach(ch => sub(`chn-${ch}`));
}

module.exports = { initPusher, listenToAllChannels };