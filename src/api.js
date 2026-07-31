const express = require("express");
const store = require("./store");
const kv = require("./kv");
const WebSocket = require("ws");
const router = express.Router();

let wss = null;
const subscribers = new Map();

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    let subscribedIds = new Set();
    let heartbeatTimer = null;
    let alive = true;

    ws.send(JSON.stringify({ op: 1, d: { heartbeat_interval: 30000 } }));

    heartbeatTimer = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
    }, 35000);

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.op === 3) { alive = true; return; }

      if (msg.op === 2) {
        const ids = msg.d?.subscribe_to_ids || msg.d?.subscribe_to_id;
        if (!ids) return;
        const idList = Array.isArray(ids) ? ids : [ids];
        idList.forEach((id) => {
          if (!id.startsWith("usr_")) id = "usr_" + id;
          subscribedIds.add(id);
          if (!subscribers.has(id)) subscribers.set(id, new Set());
          subscribers.get(id).add(ws);
          const data = store.get(id);
          if (data) {
            const { _ts, ...clean } = data;
            clean.kv = getUserKV(id);
            ws.send(JSON.stringify({ op: 0, t: "INIT_STATE", d: clean }));
          }
        });
        return;
      }

      if (msg.op === 4) {
        const ids = msg.d?.subscribe_to_ids || msg.d?.subscribe_to_id;
        if (!ids) return;
        const idList = Array.isArray(ids) ? ids : [ids];
        idList.forEach((id) => {
          subscribedIds.delete(id);
          subscribers.get(id)?.delete(ws);
        });
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeatTimer);
      subscribedIds.forEach((id) => subscribers.get(id)?.delete(ws));
    });
  });
}

function broadcastUpdate(userId, data) {
  const subs = subscribers.get(userId);
  if (!subs?.size) return;
  const msg = JSON.stringify({ op: 0, t: "PRESENCE_UPDATE", d: data });
  subs.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

router.get("/", (req, res) => {
  res.json({
    name: "Beacon",
    version: "4.0",
    docs: "/docs",
    privacy: "/privacy",
    endpoints: [
      "GET /v1/users",
      "GET /v1/users/:id",
      "GET /v1/users/:id/presence",
      "GET /v1/users/:id/kv",
      "GET /v1/users/:id/kv/:key",
      "PUT /v1/users/:id/kv/:key",
      "DELETE /v1/users/:id/kv/:key",
      "WSS /socket",
    ],
  });
});

router.get("/docs", (req, res) => {
  res.send(docsPage());
});

router.get("/privacy", (req, res) => {
  res.send(privacyPage());
});

router.get("/v1/users", (req, res) => {
  const ids = req.query.ids?.split(",") || null;
  let users = store.values();
  if (ids) {
    users = ids.map((id) => {
      if (!id.startsWith("usr_")) id = "usr_" + id;
      return store.get(id);
    }).filter(Boolean);
  }
  const clean = users.map((u) => {
    const { _ts, ...rest } = u;
    rest.kv = getUserKV(rest.id);
    return rest;
  });
  res.json({ success: true, count: clean.length, data: clean });
});

router.get("/v1/users/:id", (req, res) => {
  let id = req.params.id;
  if (!id.startsWith("usr_")) id = "usr_" + id;
  const data = store.get(id);
  if (!data) return res.status(404).json({ success: false, error: "Not found" });
  const { _ts, ...clean } = data;
  clean.kv = getUserKV(id);
  res.json({ success: true, data: clean });
});

router.get("/v1/users/:id/presence", (req, res) => {
  let id = req.params.id;
  if (!id.startsWith("usr_")) id = "usr_" + id;
  const data = store.get(id);
  if (!data) return res.json({ success: true, data: { status: "offline" } });
  res.json({ success: true, data: { id: data.id, ...data.presence, spotify: data.spotify } });
});

router.get("/v1/users/:id/kv", (req, res) => {
  let id = req.params.id;
  if (!id.startsWith("usr_")) id = "usr_" + id;
  res.json({ success: true, data: getUserKV(id) });
});

router.get("/v1/users/:id/kv/:key", (req, res) => {
  let id = req.params.id;
  if (!id.startsWith("usr_")) id = "usr_" + id;
  const value = kv.get(`kv:${id}:${req.params.key}`);
  if (value === null) return res.status(404).json({ success: false, error: "Key not found" });
  res.json({ success: true, data: value });
});

router.put("/v1/users/:id/kv/:key", express.text({ type: "*/*" }), (req, res) => {
  const apiKey = req.headers.authorization;
  if (!apiKey || apiKey !== process.env.API_KEY) return res.status(401).json({ success: false, error: "Unauthorized" });
  let id = req.params.id;
  if (!id.startsWith("usr_")) id = "usr_" + id;
  let value = req.body;
  try { value = JSON.parse(value); } catch {}
  kv.set(`kv:${id}:${req.params.key}`, value);
  res.json({ success: true });
});

router.delete("/v1/users/:id/kv/:key", (req, res) => {
  const apiKey = req.headers.authorization;
  if (!apiKey || apiKey !== process.env.API_KEY) return res.status(401).json({ success: false, error: "Unauthorized" });
  let id = req.params.id;
  if (!id.startsWith("usr_")) id = "usr_" + id;
  kv.del(`kv:${id}:${req.params.key}`);
  res.json({ success: true });
});

function getUserKV(userId) {
  const prefix = `kv:${userId}:`;
  const result = {};
  kv.keys().forEach((k) => {
    if (k.startsWith(prefix)) result[k.replace(prefix, "")] = kv.get(k);
  });
  return result;
}

function docsPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beacon — Documentation</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0a0a0b;
      --bg-surface: #111113;
      --bg-subtle: #19191b;
      --bg-hover: #1e1e21;
      --border: #222225;
      --border-subtle: #2a2a2e;
      --text: #ededef;
      --text-secondary: #9394a1;
      --text-tertiary: #62636e;
      --accent: #7c6ef6;
      --accent-subtle: rgba(124, 110, 246, 0.08);
      --green: #3ecf71;
      --yellow: #e5a913;
      --red: #e5534b;
      --blue: #539bf5;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: "Inter", -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      line-height: 1.6;
    }

    .page { display: flex; min-height: 100vh; }

    .sidebar {
      width: 260px;
      border-right: 1px solid var(--border);
      padding: 32px 0;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      flex-shrink: 0;
    }

    .sidebar-logo {
      padding: 0 24px;
      margin-bottom: 32px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .sidebar-logo .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
    }

    .sidebar-logo h1 {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .sidebar-logo span {
      font-size: 11px;
      color: var(--text-tertiary);
      background: var(--bg-subtle);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }

    .nav-section {
      margin-bottom: 24px;
    }

    .nav-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-tertiary);
      padding: 0 24px;
      margin-bottom: 8px;
    }

    .nav-link {
      display: block;
      padding: 6px 24px;
      font-size: 13px;
      color: var(--text-secondary);
      text-decoration: none;
      transition: all 0.1s;
      border-left: 2px solid transparent;
    }

    .nav-link:hover {
      color: var(--text);
      background: var(--bg-hover);
    }

    .nav-link.active {
      color: var(--accent);
      border-left-color: var(--accent);
      background: var(--accent-subtle);
    }

    .content {
      flex: 1;
      max-width: 720px;
      padding: 48px 56px;
    }

    .content h1 {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 8px;
    }

    .content > p.lead {
      color: var(--text-secondary);
      font-size: 16px;
      margin-bottom: 48px;
    }

    .content h2 {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-top: 48px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
      scroll-margin-top: 24px;
    }

    .content h3 {
      font-size: 14px;
      font-weight: 600;
      margin-top: 32px;
      margin-bottom: 12px;
    }

    .content p {
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 16px;
    }

    .endpoint {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 16px;
      overflow: hidden;
    }

    .endpoint-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      cursor: pointer;
      transition: background 0.1s;
    }

    .endpoint-header:hover { background: var(--bg-hover); }

    .method {
      font-family: "JetBrains Mono", monospace;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 5px;
      letter-spacing: 0.02em;
    }

    .method-get { background: rgba(62, 207, 113, 0.12); color: var(--green); }
    .method-put { background: rgba(229, 169, 19, 0.12); color: var(--yellow); }
    .method-delete { background: rgba(229, 83, 75, 0.12); color: var(--red); }
    .method-post { background: rgba(124, 110, 246, 0.12); color: var(--accent); }
    .method-wss { background: rgba(83, 155, 245, 0.12); color: var(--blue); }

    .endpoint-path {
      font-family: "JetBrains Mono", monospace;
      font-size: 13px;
      color: var(--text);
    }

    .endpoint-body {
      padding: 0 18px 18px;
    }

    .endpoint-desc {
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }

    pre {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      font-family: "JetBrains Mono", monospace;
      font-size: 12px;
      line-height: 1.7;
      overflow-x: auto;
      margin-bottom: 12px;
    }

    pre.cmd { color: var(--text-secondary); }
    pre.response { color: var(--green); }
    pre.code { color: var(--text-secondary); }

    .cmd-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }

    .cmd-table th {
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-tertiary);
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }

    .cmd-table td {
      padding: 8px 0;
      font-size: 13px;
      border-bottom: 1px solid var(--border-subtle);
      vertical-align: top;
    }

    .cmd-table td:first-child {
      font-family: "JetBrains Mono", monospace;
      font-size: 12px;
      color: var(--accent);
      width: 240px;
      padding-right: 24px;
    }

    .cmd-table td:last-child { color: var(--text-secondary); }
    .cmd-table tr:last-child td { border-bottom: none; }

    .base-url-box {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 32px;
    }

    .base-url-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-tertiary);
      white-space: nowrap;
    }

    .base-url-value {
      font-family: "JetBrains Mono", monospace;
      font-size: 13px;
      color: var(--accent);
    }

    code {
      font-family: "JetBrains Mono", monospace;
      font-size: 12px;
      background: var(--bg-subtle);
      border: 1px solid var(--border-subtle);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--accent);
    }

    @media (max-width: 860px) {
      .sidebar { display: none; }
      .content { padding: 32px 20px; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="page">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <div class="dot"></div>
        <h1>Beacon</h1>
        <span>v4.0</span>
      </div>

      <div class="nav-section">
        <div class="nav-label">Getting Started</div>
        <a href="#overview" class="nav-link active">Overview</a>
        <a href="#base-url" class="nav-link">Base URL</a>
      </div>

      <div class="nav-section">
        <div class="nav-label">REST API</div>
        <a href="#users" class="nav-link">Users</a>
        <a href="#presence" class="nav-link">Presence</a>
        <a href="#kv-store" class="nav-link">KV Store</a>
        <a href="#badges-api" class="nav-link">Badges</a>
      </div>

      <div class="nav-section">
        <div class="nav-label">Real-time</div>
        <a href="#websocket" class="nav-link">WebSocket</a>
        <a href="#webhooks" class="nav-link">Webhooks</a>
      </div>

      <div class="nav-section">
        <div class="nav-label">Reference</div>
        <a href="#examples" class="nav-link">Examples</a>
        <a href="#commands" class="nav-link">Chat Commands</a>
      </div>
    </nav>

    <main class="content">
      <h1 id="overview">Documentation</h1>
      <p class="lead">Beacon is a real-time presence API for DisTalk. Track user status, activity, and Spotify data through REST endpoints or WebSocket subscriptions.</p>

      <h2 id="base-url">Base URL</h2>
      <div class="base-url-box">
        <span class="base-url-label">Base URL</span>
        <span class="base-url-value">https://api-beacon.up.railway.app</span>
      </div>

      <h2 id="users">Users</h2>

      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method method-get">GET</span>
          <span class="endpoint-path">/v1/users</span>
        </div>
        <div class="endpoint-body">
          <p class="endpoint-desc">Returns all tracked users. Filter by ID with <code>?ids=id1,id2</code>.</p>
          <pre class="cmd">curl https://api-beacon.up.railway.app/v1/users</pre>
        </div>
      </div>

      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method method-get">GET</span>
          <span class="endpoint-path">/v1/users/:id</span>
        </div>
        <div class="endpoint-body">
          <p class="endpoint-desc">Returns a single user by ID.</p>
          <pre class="cmd">curl https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f</pre>
          <pre class="response">{
  "success": true,
  "data": {
    "id": "usr_8f7220facabf757f",
    "username": "app",
    "display_name": "app",
    "presence": {
      "status": "online",
      "is_mobile": false,
      "custom_status": { "emoji": null, "text": null },
      "activity": null
    },
    "spotify": { "connected": false, "now_playing": null },
    "badges": [],
    "self_badges": [],
    "kv": {}
  }
}</pre>
        </div>
      </div>

      <h2 id="presence">Presence</h2>

      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method method-get">GET</span>
          <span class="endpoint-path">/v1/users/:id/presence</span>
        </div>
        <div class="endpoint-body">
          <p class="endpoint-desc">Returns only the presence object for a user.</p>
        </div>
      </div>

      <h2 id="kv-store">KV Store</h2>
      <p>A simple key-value store scoped per user. Useful for storing metadata like website URLs, pronouns, or any custom data.</p>

      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method method-get">GET</span>
          <span class="endpoint-path">/v1/users/:id/kv</span>
        </div>
        <div class="endpoint-body">
          <p class="endpoint-desc">Returns all KV pairs for a user.</p>
        </div>
      </div>

      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method method-get">GET</span>
          <span class="endpoint-path">/v1/users/:id/kv/:key</span>
        </div>
        <div class="endpoint-body">
          <p class="endpoint-desc">Returns a single KV value.</p>
        </div>
      </div>

      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method method-put">PUT</span>
          <span class="endpoint-path">/v1/users/:id/kv/:key</span>
        </div>
        <div class="endpoint-body">
          <p class="endpoint-desc">Sets a KV value. Requires <code>Authorization</code> header.</p>
          <pre class="cmd">curl -X PUT https://api-beacon.up.railway.app/v1/users/:id/kv/website \\
  -H "Authorization: your-api-key" \\
  -d '"https://example.com"'</pre>
        </div>
      </div>

      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method method-delete">DELETE</span>
          <span class="endpoint-path">/v1/users/:id/kv/:key</span>
        </div>
        <div class="endpoint-body">
          <p class="endpoint-desc">Deletes a KV value. Requires <code>Authorization</code> header.</p>
        </div>
      </div>

      <h2 id="badges-api">Badges</h2>

      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method method-get">GET</span>
          <span class="endpoint-path">/v1/badges</span>
        </div>
        <div class="endpoint-body">
          <p class="endpoint-desc">Returns all known badge definitions scraped from DisTalk.</p>
        </div>
      </div>

      <h2 id="websocket">WebSocket</h2>
      <p>Subscribe to real-time presence updates over a persistent WebSocket connection.</p>

      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method method-wss">WSS</span>
          <span class="endpoint-path">wss://api-beacon.up.railway.app/socket</span>
        </div>
        <div class="endpoint-body">
          <pre class="code">const ws = new WebSocket("wss://api-beacon.up.railway.app/socket");

// On connect: { op: 1, d: { heartbeat_interval: 30000 } }

// Subscribe
ws.send(JSON.stringify({
  op: 2,
  d: { subscribe_to_ids: ["usr_8f7220facabf757f"] }
}));

// Receive INIT_STATE, then PRESENCE_UPDATE on changes

// Heartbeat every 30s
setInterval(() => ws.send(JSON.stringify({ op: 3 })), 30000);</pre>
        </div>
      </div>

      <h2 id="webhooks">Webhooks</h2>

      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method method-post">POST</span>
          <span class="endpoint-path">/github</span>
        </div>
        <div class="endpoint-body">
          <p class="endpoint-desc">GitHub webhook endpoint. Posts push, PR, issue, and release events to DisTalk.</p>
        </div>
      </div>

      <h2 id="examples">Examples</h2>

      <h3>JavaScript</h3>
      <pre class="code">const res = await fetch("https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f");
const { data } = await res.json();
console.log(data.presence.status);</pre>

      <h3>Python</h3>
      <pre class="code">import requests
res = requests.get("https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f")
print(res.json()["data"]["presence"]["status"])</pre>

      <h3>WebSocket</h3>
      <pre class="code">const ws = new WebSocket("wss://api-beacon.up.railway.app/socket");
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.t === "PRESENCE_UPDATE") {
    console.log(msg.d.presence.status);
  }
};</pre>

      <h2 id="commands">Chat Commands</h2>
      <p>Available in any DisTalk channel where Beacon is present.</p>

      <table class="cmd-table">
        <thead><tr><th>Command</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>/status &lt;user&gt;</td><td>Current status</td></tr>
          <tr><td>/profile &lt;user&gt;</td><td>Full profile</td></tr>
          <tr><td>/userid &lt;user&gt;</td><td>Get user ID</td></tr>
          <tr><td>/whois &lt;id&gt;</td><td>Resolve ID to username</td></tr>
          <tr><td>/avatar &lt;user&gt;</td><td>Avatar URL</td></tr>
          <tr><td>/badges &lt;user&gt;</td><td>List badges</td></tr>
          <tr><td>/bio &lt;user&gt;</td><td>User bio</td></tr>
          <tr><td>/socials &lt;user&gt;</td><td>Social links</td></tr>
          <tr><td>/tag &lt;user&gt;</td><td>Server tag</td></tr>
          <tr><td>/spotify &lt;user&gt;</td><td>Now playing</td></tr>
          <tr><td>/compare &lt;a&gt; &lt;b&gt;</td><td>Compare two users</td></tr>
          <tr><td>/online</td><td>Online users</td></tr>
          <tr><td>/offline</td><td>Recently offline</td></tr>
          <tr><td>/mobile</td><td>Mobile users</td></tr>
          <tr><td>/role &lt;role&gt;</td><td>Users by role</td></tr>
          <tr><td>/search &lt;query&gt;</td><td>Search users</td></tr>
          <tr><td>/random</td><td>Random user</td></tr>
          <tr><td>/api &lt;user&gt;</td><td>Raw JSON</td></tr>
          <tr><td>/kv [user]</td><td>View KV data</td></tr>
          <tr><td>/kv set &lt;k&gt; &lt;v&gt;</td><td>Set KV</td></tr>
          <tr><td>/kv del &lt;key&gt;</td><td>Delete KV</td></tr>
          <tr><td>/set &lt;key&gt; &lt;val&gt;</td><td>Store value</td></tr>
          <tr><td>/get &lt;key&gt;</td><td>Get value</td></tr>
          <tr><td>/del &lt;key&gt;</td><td>Delete key</td></tr>
          <tr><td>/keys</td><td>List keys</td></tr>
          <tr><td>/note &lt;user&gt; &lt;text&gt;</td><td>Add a note</td></tr>
          <tr><td>/notes &lt;user&gt;</td><td>View notes</td></tr>
          <tr><td>/server</td><td>Server info</td></tr>
          <tr><td>/stats</td><td>Bot statistics</td></tr>
          <tr><td>/count</td><td>User count</td></tr>
          <tr><td>/uptime</td><td>Bot uptime</td></tr>
          <tr><td>/ping</td><td>Latency</td></tr>
          <tr><td>/help</td><td>List all commands</td></tr>
          <tr><td>/docs</td><td>API documentation</td></tr>
          <tr><td>/privacy</td><td>Privacy policy</td></tr>
        </tbody>
      </table>
    </main>
  </div>

  <script>
    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
        link.classList.add("active");
      });
    });
  </script>
</body>
</html>`;
}

function privacyPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beacon — Privacy Policy</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0a0a0b;
      --bg-surface: #111113;
      --bg-subtle: #19191b;
      --border: #222225;
      --border-subtle: #2a2a2e;
      --text: #ededef;
      --text-secondary: #9394a1;
      --text-tertiary: #62636e;
      --accent: #7c6ef6;
      --accent-subtle: rgba(124, 110, 246, 0.08);
      --green: #3ecf71;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: "Inter", -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      line-height: 1.7;
    }

    .page { display: flex; min-height: 100vh; }

    .sidebar {
      width: 260px;
      border-right: 1px solid var(--border);
      padding: 32px 0;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      flex-shrink: 0;
    }

    .sidebar-logo {
      padding: 0 24px;
      margin-bottom: 32px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .sidebar-logo .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); }
    .sidebar-logo h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }

    .nav-section { margin-bottom: 24px; }

    .nav-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-tertiary);
      padding: 0 24px;
      margin-bottom: 8px;
    }

    .nav-link {
      display: block;
      padding: 6px 24px;
      font-size: 13px;
      color: var(--text-secondary);
      text-decoration: none;
      transition: all 0.1s;
      border-left: 2px solid transparent;
    }

    .nav-link:hover { color: var(--text); background: rgba(255,255,255,0.03); }
    .nav-link.active { color: var(--accent); border-left-color: var(--accent); background: var(--accent-subtle); }

    .content {
      flex: 1;
      max-width: 680px;
      padding: 48px 56px;
    }

    .content h1 {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 4px;
    }

    .content .updated {
      font-size: 13px;
      color: var(--text-tertiary);
      margin-bottom: 40px;
    }

    .content h2 {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-top: 40px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
      scroll-margin-top: 24px;
    }

    .content p {
      color: var(--text-secondary);
      font-size: 14px;
      margin-bottom: 12px;
    }

    .data-list {
      list-style: none;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .data-list li {
      padding: 10px 18px;
      font-size: 13px;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .data-list li:last-child { border-bottom: none; }

    .data-list li::before {
      content: "";
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--text-tertiary);
      flex-shrink: 0;
    }

    code {
      font-family: "JetBrains Mono", monospace;
      font-size: 12px;
      background: var(--bg-subtle);
      border: 1px solid var(--border-subtle);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--accent);
    }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    @media (max-width: 860px) {
      .sidebar { display: none; }
      .content { padding: 32px 20px; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="page">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <div class="dot"></div>
        <h1>Beacon</h1>
      </div>

      <div class="nav-section">
        <div class="nav-label">Policy</div>
        <a href="#overview" class="nav-link active">Overview</a>
        <a href="#what-we-collect" class="nav-link">What We Collect</a>
        <a href="#how-collected" class="nav-link">How It's Collected</a>
        <a href="#how-used" class="nav-link">How It's Used</a>
        <a href="#exposure" class="nav-link">Public Exposure</a>
        <a href="#retention" class="nav-link">Data Retention</a>
        <a href="#opting-out" class="nav-link">Opting Out</a>
        <a href="#third-party" class="nav-link">Third-Party</a>
        <a href="#changes" class="nav-link">Changes</a>
        <a href="#contact" class="nav-link">Contact</a>
      </div>

      <div class="nav-section">
        <div class="nav-label">Links</div>
        <a href="/docs" class="nav-link">Documentation</a>
        <a href="/" class="nav-link">API</a>
      </div>
    </nav>

    <main class="content">
      <h1 id="overview">Privacy Policy</h1>
      <p class="updated">Last updated — July 31, 2026</p>

      <p>Beacon is a presence API for DisTalk. By being in a server where Beacon is active, your visible DisTalk presence data may be collected, cached, and exposed through the API.</p>

      <h2 id="what-we-collect">What We Collect</h2>
      <ul class="data-list">
        <li>User ID, username, and display name</li>
        <li>Avatar and banner URLs</li>
        <li>Presence status (online, idle, dnd, offline)</li>
        <li>Mobile device state</li>
        <li>Custom status text and emoji</li>
        <li>Activity and now playing information</li>
        <li>Spotify connection and track info</li>
        <li>Public profile data (badges, bio, socials, server tag)</li>
        <li>KV data explicitly set through Beacon</li>
      </ul>

      <h2 id="how-collected">How It's Collected</h2>
      <p>Beacon collects data through a connected account that shares a server with you. Only users visible to that account are tracked. No private messages or DMs are accessed.</p>

      <h2 id="how-used">How It's Used</h2>
      <ul class="data-list">
        <li>To provide real-time presence through the REST API and WebSocket</li>
        <li>To support bot commands like <code>/status</code> and <code>/profile</code></li>
        <li>To store optional user-defined KV data</li>
      </ul>

      <h2 id="exposure">Public Exposure</h2>
      <p>Data tracked by Beacon is publicly accessible through API endpoints. Anyone can query your presence status, badges, and profile data. Do not join a Beacon-tracked server if you do not want this data exposed.</p>

      <h2 id="retention">Data Retention</h2>
      <p>Presence data is held in memory and clears on restart. KV data and notes may persist to disk. If you leave the tracked server, your presence will no longer be updated but cached data may remain until the next restart.</p>

      <h2 id="opting-out">Opting Out</h2>
      <p>Leave the Beacon-tracked server. To request immediate removal of cached data, reach out through the DisTalk support server.</p>

      <h2 id="third-party">Third-Party Services</h2>
      <p>Beacon runs on third-party hosting infrastructure (Railway) where standard access logging may apply. No data is sold or shared with third parties.</p>

      <h2 id="changes">Changes</h2>
      <p>This policy may be updated at any time. Changes will be reflected on this page with an updated date.</p>

      <h2 id="contact">Contact</h2>
      <p>Join the Beacon support server on DisTalk for questions or data removal requests.</p>
    </main>
  </div>

  <script>
    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
        link.classList.add("active");
      });
    });
  </script>
</body>
</html>`;
}

module.exports = router;
module.exports.setupWebSocket = setupWebSocket;
module.exports.broadcastUpdate = broadcastUpdate;