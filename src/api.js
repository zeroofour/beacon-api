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
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (msg.op === 3) {
        alive = true;
        return;
      }

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
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beacon — API Docs</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0a0a0a;
      color: #d4d4d4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.6;
      padding: 48px 20px;
    }

    .container { max-width: 780px; margin: 0 auto; }

    header { margin-bottom: 48px; }
    header h1 { font-size: 28px; font-weight: 600; color: #fff; letter-spacing: -0.5px; }
    header p { color: #555; margin-top: 4px; font-size: 13px; }

    .base-url {
      display: inline-block;
      background: #111;
      border: 1px solid #1f1f1f;
      border-radius: 6px;
      padding: 8px 14px;
      font-family: monospace;
      font-size: 13px;
      color: #a78bfa;
      margin-top: 16px;
    }

    section { margin-bottom: 40px; }

    section h2 {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #1a1a1a;
    }

    .endpoint {
      background: #111;
      border: 1px solid #1f1f1f;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 10px;
    }

    .endpoint-title { display: flex; align-items: center; gap: 10px; }

    .badge {
      font-family: monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .badge-get    { background: #0d2e1a; color: #4ade80; }
    .badge-put    { background: #2e1e00; color: #fbbf24; }
    .badge-delete { background: #2e0d0d; color: #f87171; }
    .badge-post   { background: #1e0e40; color: #a78bfa; }
    .badge-ws     { background: #0d1e38; color: #60a5fa; }

    .path { font-family: monospace; font-size: 13px; color: #e2e2e2; }
    .desc { color: #666; font-size: 12px; margin-top: 6px; }

    pre {
      background: #0d0d0d;
      border: 1px solid #1a1a1a;
      border-radius: 6px;
      padding: 12px 14px;
      font-family: monospace;
      font-size: 12px;
      color: #a78bfa;
      overflow-x: auto;
      margin-top: 10px;
      white-space: pre;
    }

    pre.response { color: #4ade80; }
    pre.code     { color: #d4d4d4; }

    .cmd-table { width: 100%; border-collapse: collapse; }
    .cmd-table tr { border-bottom: 1px solid #141414; }
    .cmd-table tr:last-child { border-bottom: none; }
    .cmd-table td { padding: 7px 0; font-size: 13px; vertical-align: top; }
    .cmd-table td:first-child { font-family: monospace; color: #a78bfa; width: 220px; }
    .cmd-table td:last-child { color: #555; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Beacon</h1>
      <p>Presence API for DisTalk</p>
      <div class="base-url">https://api-beacon.up.railway.app</div>
    </header>

    <section>
      <h2>REST API</h2>

      <div class="endpoint">
        <div class="endpoint-title">
          <span class="badge badge-get">GET</span>
          <span class="path">/v1/users</span>
        </div>
        <div class="desc">Returns all tracked users. Supports <code>?ids=id1,id2</code> to filter by ID.</div>
        <pre>curl https://api-beacon.up.railway.app/v1/users</pre>
      </div>

      <div class="endpoint">
        <div class="endpoint-title">
          <span class="badge badge-get">GET</span>
          <span class="path">/v1/users/:id</span>
        </div>
        <div class="desc">Returns a single user by ID.</div>
        <pre>curl https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f</pre>
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
    "kv": {}
  }
}</pre>
      </div>

      <div class="endpoint">
        <div class="endpoint-title">
          <span class="badge badge-get">GET</span>
          <span class="path">/v1/users/:id/presence</span>
        </div>
        <div class="desc">Returns only the presence object for a user.</div>
        <pre>curl https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f/presence</pre>
      </div>
    </section>

    <section>
      <h2>KV Store</h2>

      <div class="endpoint">
        <div class="endpoint-title">
          <span class="badge badge-get">GET</span>
          <span class="path">/v1/users/:id/kv</span>
        </div>
        <div class="desc">Returns all KV pairs for a user.</div>
      </div>

      <div class="endpoint">
        <div class="endpoint-title">
          <span class="badge badge-get">GET</span>
          <span class="path">/v1/users/:id/kv/:key</span>
        </div>
        <div class="desc">Returns a single KV value by key.</div>
      </div>

      <div class="endpoint">
        <div class="endpoint-title">
          <span class="badge badge-put">PUT</span>
          <span class="path">/v1/users/:id/kv/:key</span>
        </div>
        <div class="desc">Sets a KV value. Requires an <code>Authorization</code> header.</div>
        <pre>curl -X PUT https://api-beacon.up.railway.app/v1/users/:id/kv/website \\
  -H "Authorization: your-api-key" \\
  -d '"https://example.com"'</pre>
      </div>

      <div class="endpoint">
        <div class="endpoint-title">
          <span class="badge badge-delete">DELETE</span>
          <span class="path">/v1/users/:id/kv/:key</span>
        </div>
        <div class="desc">Deletes a KV value. Requires an <code>Authorization</code> header.</div>
      </div>
    </section>

    <section>
      <h2>WebSocket</h2>

      <div class="endpoint">
        <div class="endpoint-title">
          <span class="badge badge-ws">WSS</span>
          <span class="path">wss://api-beacon.up.railway.app/socket</span>
        </div>
        <div class="desc">Real-time presence updates over WebSocket.</div>
        <pre class="code">const ws = new WebSocket("wss://api-beacon.up.railway.app/socket");

// On connect, you receive:
// { op: 1, d: { heartbeat_interval: 30000 } }

// Subscribe to one or more users
ws.send(JSON.stringify({
  op: 2,
  d: { subscribe_to_ids: ["usr_8f7220facabf757f"] }
}));

// You receive INIT_STATE immediately, then PRESENCE_UPDATE on changes

// Send a heartbeat every 30s
setInterval(() => ws.send(JSON.stringify({ op: 3 })), 30000);</pre>
      </div>
    </section>

    <section>
      <h2>Webhooks</h2>

      <div class="endpoint">
        <div class="endpoint-title">
          <span class="badge badge-post">POST</span>
          <span class="path">/github</span>
        </div>
        <div class="desc">GitHub webhook endpoint. Posts push, PR, issue, and release events to DisTalk.</div>
      </div>
    </section>

    <section>
      <h2>Usage Examples</h2>

      <div class="endpoint">
        <div class="desc">JavaScript</div>
        <pre class="code">const res = await fetch("https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f");
const { data } = await res.json();
console.log(data.presence.status);</pre>
      </div>

      <div class="endpoint">
        <div class="desc">Python</div>
        <pre class="code">import requests
res = requests.get("https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f")
print(res.json()["data"]["presence"]["status"])</pre>
      </div>

      <div class="endpoint">
        <div class="desc">WebSocket</div>
        <pre class="code">const ws = new WebSocket("wss://api-beacon.up.railway.app/socket");
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.t === "PRESENCE_UPDATE") {
    console.log(msg.d.presence.status);
  }
};</pre>
      </div>
    </section>

    <section>
      <h2>Chat Commands</h2>
      <p style="color:#555; font-size:12px; margin-bottom:14px;">Available in any DisTalk channel where Beacon is present.</p>
      <table class="cmd-table">
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
          <tr><td>/set &lt;key&gt; &lt;value&gt;</td><td>Store a value</td></tr>
          <tr><td>/get &lt;key&gt;</td><td>Retrieve a value</td></tr>
          <tr><td>/del &lt;key&gt;</td><td>Delete a key</td></tr>
          <tr><td>/keys</td><td>List stored keys</td></tr>
          <tr><td>/note &lt;user&gt; &lt;text&gt;</td><td>Add a note</td></tr>
          <tr><td>/notes &lt;user&gt;</td><td>View notes</td></tr>
          <tr><td>/server</td><td>Server info</td></tr>
          <tr><td>/stats</td><td>Bot statistics</td></tr>
          <tr><td>/count</td><td>Tracked user count</td></tr>
          <tr><td>/uptime</td><td>Bot uptime</td></tr>
          <tr><td>/ping</td><td>Latency</td></tr>
          <tr><td>/docs</td><td>API documentation</td></tr>
          <tr><td>/privacy</td><td>Privacy policy</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</body>
</html>`);
});

router.get("/privacy", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beacon — Privacy Policy</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0a0a0a;
      color: #d4d4d4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.7;
      padding: 48px 20px;
    }

    .container { max-width: 680px; margin: 0 auto; }

    header { margin-bottom: 48px; }
    header h1 { font-size: 28px; font-weight: 600; color: #fff; letter-spacing: -0.5px; }
    header p { color: #555; margin-top: 4px; font-size: 13px; }

    section { margin-bottom: 36px; }

    section h2 {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #1a1a1a;
    }

    p { color: #999; margin-bottom: 8px; }

    ul {
      list-style: none;
      background: #111;
      border: 1px solid #1f1f1f;
      border-radius: 8px;
      padding: 14px 16px;
    }

    ul li {
      color: #999;
      padding: 4px 0;
      border-bottom: 1px solid #161616;
      font-size: 13px;
    }

    ul li:last-child { border-bottom: none; }

    ul li::before {
      content: "–";
      color: #333;
      margin-right: 10px;
    }

    code {
      background: #111;
      border: 1px solid #1f1f1f;
      border-radius: 4px;
      padding: 1px 6px;
      font-family: monospace;
      font-size: 12px;
      color: #a78bfa;
    }

    a { color: #a78bfa; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Privacy Policy</h1>
      <p>Beacon &mdash; Last updated July 30, 2026</p>
    </header>

    <section>
      <h2>Overview</h2>
      <p>
        Beacon is a presence API for DisTalk. By being in a server where Beacon is active,
        your visible DisTalk presence data may be collected, cached, and exposed through the API.
      </p>
    </section>

    <section>
      <h2>What We Collect</h2>
      <ul>
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
    </section>

    <section>
      <h2>How It's Collected</h2>
      <p>
        Beacon collects data through a connected account that shares a server with you.
        Only users visible to that account are tracked.
      </p>
    </section>

    <section>
      <h2>How It's Used</h2>
      <ul>
        <li>To provide real-time presence through the API and WebSocket</li>
        <li>To support bot commands like <code>/status</code> and <code>/profile</code></li>
        <li>To store optional user-defined KV data</li>
      </ul>
    </section>

    <section>
      <h2>Public Exposure</h2>
      <p>
        Data tracked by Beacon is publicly accessible through API endpoints.
        Do not join a Beacon-tracked server if you do not want your presence exposed.
      </p>
    </section>

    <section>
      <h2>Data Retention</h2>
      <p>
        Presence data is held in memory and clears on restart. KV data and notes may persist to disk.
        If you leave the tracked server, your presence will no longer be updated.
      </p>
    </section>

    <section>
      <h2>Opting Out</h2>
      <p>
        Leave the Beacon-tracked server. To request removal of cached data,
        reach out through the DisTalk support server.
      </p>
    </section>

    <section>
      <h2>Third-Party Services</h2>
      <p>Beacon runs on third-party hosting infrastructure where standard access logging may apply.</p>
    </section>

    <section>
      <h2>Changes</h2>
      <p>This policy may be updated at any time. Changes will be reflected on this page.</p>
    </section>

    <section>
      <h2>Contact</h2>
      <p>Join the Beacon support server on DisTalk.</p>
    </section>
  </div>
</body>
</html>`);
});

router.get("/v1/users", (req, res) => {
  const ids = req.query.ids?.split(",") || null;
  let users = store.values();

  if (ids) {
    users = ids
      .map((id) => {
        if (!id.startsWith("usr_")) id = "usr_" + id;
        return store.get(id);
      })
      .filter(Boolean);
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
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  let id = req.params.id;
  if (!id.startsWith("usr_")) id = "usr_" + id;
  let value = req.body;
  try {
    value = JSON.parse(value);
  } catch {}
  kv.set(`kv:${id}:${req.params.key}`, value);
  res.json({ success: true });
});

router.delete("/v1/users/:id/kv/:key", (req, res) => {
  const apiKey = req.headers.authorization;
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
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

module.exports = router;
module.exports.setupWebSocket = setupWebSocket;
module.exports.broadcastUpdate = broadcastUpdate;