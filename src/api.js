const express = require("express");
const store = require("./store");
const kv = require("./kv");
const WebSocket = require("ws");
const router = express.Router();

let wss = null;
const subscribers = new Map();

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on("connection", ws => {
    let subscribedIds = new Set();
    let heartbeatTimer = null;
    let alive = true;

    ws.send(JSON.stringify({
      op: 1,
      d: { heartbeat_interval: 30000 }
    }));

    heartbeatTimer = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
    }, 35000);

    ws.on("message", raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.op === 3) {
        alive = true;
        return;
      }

      if (msg.op === 2) {
        const ids = msg.d?.subscribe_to_ids || msg.d?.subscribe_to_id;
        if (!ids) return;

        const idList = Array.isArray(ids) ? ids : [ids];
        idList.forEach(id => {
          if (!id.startsWith("usr_")) id = "usr_" + id;
          subscribedIds.add(id);

          if (!subscribers.has(id)) subscribers.set(id, new Set());
          subscribers.get(id).add(ws);

          const data = store.get(id);
          if (data) {
            const { _ts, ...clean } = data;
            ws.send(JSON.stringify({
              op: 0,
              t: "INIT_STATE",
              d: clean
            }));
          }
        });
        return;
      }

      if (msg.op === 4) {
        const ids = msg.d?.subscribe_to_ids || msg.d?.subscribe_to_id;
        if (!ids) return;
        const idList = Array.isArray(ids) ? ids : [ids];
        idList.forEach(id => {
          subscribedIds.delete(id);
          subscribers.get(id)?.delete(ws);
        });
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeatTimer);
      subscribedIds.forEach(id => {
        subscribers.get(id)?.delete(ws);
      });
    });
  });

  console.log("[WS API] WebSocket server ready");
}

function broadcastUpdate(userId, data) {
  const subs = subscribers.get(userId);
  if (!subs?.size) return;

  const msg = JSON.stringify({
    op: 0,
    t: "PRESENCE_UPDATE",
    d: data
  });

  subs.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

router.get("/", (req, res) => {
  res.json({
    name: "Beacon",
    version: "4.0",
    docs: "GET /docs",
    endpoints: [
      "GET /v1/users",
      "GET /v1/users/:id",
      "GET /v1/users/:id/presence",
      "GET /v1/users/:id/kv",
      "GET /v1/users/:id/kv/:key",
      "PUT /v1/users/:id/kv/:key",
      "DELETE /v1/users/:id/kv/:key",
      "WSS /socket"
    ]
  });
});

router.get("/docs", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>beacon API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #fff; font-size: 32px; margin-bottom: 8px; }
    .subtitle { color: #888; font-size: 16px; margin-bottom: 40px; }
    .section { margin-bottom: 32px; }
    .section h2 { color: #fff; font-size: 20px; margin-bottom: 16px; border-bottom: 1px solid #222; padding-bottom: 8px; }
    .endpoint { background: #111; border: 1px solid #222; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .method { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 8px; }
    .method-get { background: #1a6334; color: #4ade80; }
    .method-put { background: #854d0e; color: #fbbf24; }
    .method-delete { background: #7f1d1d; color: #f87171; }
    .method-ws { background: #1e3a5f; color: #60a5fa; }
    .method-post { background: #4a1d96; color: #a78bfa; }
    .path { color: #fff; font-family: monospace; font-size: 14px; }
    .desc { color: #888; font-size: 13px; margin-top: 8px; }
    .example { background: #0d0d0d; border: 1px solid #222; border-radius: 6px; padding: 12px; margin-top: 8px; font-family: monospace; font-size: 13px; color: #a78bfa; overflow-x: auto; }
    .response { background: #0d0d0d; border: 1px solid #222; border-radius: 6px; padding: 12px; margin-top: 8px; font-family: monospace; font-size: 12px; color: #4ade80; white-space: pre; overflow-x: auto; }
    .commands { margin-top: 16px; }
    .cmd { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid #1a1a1a; }
    .cmd-name { color: #a78bfa; font-family: monospace; min-width: 180px; }
    .cmd-desc { color: #888; }
    .base-url { background: #111; border: 1px solid #222; border-radius: 8px; padding: 12px 16px; margin-bottom: 32px; font-family: monospace; color: #4ade80; }
    .note { background: #1a1a0a; border: 1px solid #333; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; color: #fbbf24; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>beacon</h1>
    <p class="subtitle">presence api for distalk</p>

    <div class="base-url">https://api-beacon.fly.dev</div>

    <div class="section">
      <h2>rest api</h2>

      <div class="endpoint">
        <span class="method method-get">GET</span>
        <span class="path">/v1/users</span>
        <div class="desc">returns all tracked users</div>
        <div class="example">curl https://api-beacon.fly.dev/v1/users</div>
      </div>

      <div class="endpoint">
        <span class="method method-get">GET</span>
        <span class="path">/v1/users/:id</span>
        <div class="desc">returns a specific user by id</div>
        <div class="example">curl https://api-beacon.fly.dev/v1/users/usr_8f7220facabf757f</div>
        <div class="response">{
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
}</div>
      </div>

      <div class="endpoint">
        <span class="method method-get">GET</span>
        <span class="path">/v1/users/:id/presence</span>
        <div class="desc">returns only presence data</div>
        <div class="example">curl https://api-beacon.fly.dev/v1/users/usr_8f7220facabf757f/presence</div>
      </div>
    </div>

    <div class="section">
      <h2>kv store</h2>

      <div class="endpoint">
        <span class="method method-get">GET</span>
        <span class="path">/v1/users/:id/kv</span>
        <div class="desc">returns all kv pairs for a user</div>
        <div class="example">curl https://api-beacon.fly.dev/v1/users/usr_8f7220facabf757f/kv</div>
      </div>

      <div class="endpoint">
        <span class="method method-get">GET</span>
        <span class="path">/v1/users/:id/kv/:key</span>
        <div class="desc">returns a specific kv value</div>
        <div class="example">curl https://api-beacon.fly.dev/v1/users/usr_8f7220facabf757f/kv/website</div>
      </div>

      <div class="endpoint">
        <span class="method method-put">PUT</span>
        <span class="path">/v1/users/:id/kv/:key</span>
        <div class="desc">set a kv value (requires api key header)</div>
        <div class="example">curl -X PUT https://api-beacon.fly.dev/v1/users/usr_8f7220facabf757f/kv/website -H "Authorization: your-api-key" -d '"https://example.com"'</div>
      </div>

      <div class="endpoint">
        <span class="method method-delete">DELETE</span>
        <span class="path">/v1/users/:id/kv/:key</span>
        <div class="desc">delete a kv value (requires api key header)</div>
        <div class="example">curl -X DELETE https://api-beacon.fly.dev/v1/users/usr_8f7220facabf757f/kv/website -H "Authorization: your-api-key"</div>
      </div>
    </div>

    <div class="section">
      <h2>websocket</h2>

      <div class="endpoint">
        <span class="method method-ws">WSS</span>
        <span class="path">wss://api-beacon.fly.dev/socket</span>
        <div class="desc">real-time presence updates via websocket</div>
        <div class="response">// connect
const ws = new WebSocket("wss://api-beacon.fly.dev/socket");

// receive hello (op 1)
// { op: 1, d: { heartbeat_interval: 30000 } }

// subscribe to user(s) (op 2)
ws.send(JSON.stringify({
  op: 2,
  d: { subscribe_to_ids: ["usr_8f7220facabf757f"] }
}));

// receive init state (op 0, t: INIT_STATE)
// receive updates  (op 0, t: PRESENCE_UPDATE)

// send heartbeat every 30s (op 3)
setInterval(() => ws.send(JSON.stringify({ op: 3 })), 30000);</div>
      </div>
    </div>

    <div class="section">
      <h2>webhooks</h2>

      <div class="endpoint">
        <span class="method method-post">POST</span>
        <span class="path">/github</span>
        <div class="desc">github webhook endpoint — posts commit, pr, and issue updates to distalk</div>
      </div>
    </div>

    <div class="section">
      <h2>usage</h2>

      <div class="endpoint">
        <div class="desc">javascript</div>
        <div class="response">const res = await fetch("https://api-beacon.fly.dev/v1/users/usr_8f7220facabf757f");
const { data } = await res.json();
console.log(data.presence.status);</div>
      </div>

      <div class="endpoint">
        <div class="desc">python</div>
        <div class="response">import requests
res = requests.get("https://api-beacon.fly.dev/v1/users/usr_8f7220facabf757f")
print(res.json()["data"]["presence"]["status"])</div>
      </div>

      <div class="endpoint">
        <div class="desc">websocket</div>
        <div class="response">const ws = new WebSocket("wss://api-beacon.fly.dev/socket");
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.t === "PRESENCE_UPDATE") {
    console.log(msg.d.presence.status);
  }
};</div>
      </div>
    </div>

    <div class="section">
      <h2>chat commands</h2>
      <p class="desc" style="margin-bottom: 16px;">type these in any distalk channel where beacon is present</p>
      <div class="commands">
        <div class="cmd"><span class="cmd-name">/status &lt;user&gt;</span><span class="cmd-desc">current status</span></div>
        <div class="cmd"><span class="cmd-name">/profile &lt;user&gt;</span><span class="cmd-desc">full profile</span></div>
        <div class="cmd"><span class="cmd-name">/userid &lt;user&gt;</span><span class="cmd-desc">get user id</span></div>
        <div class="cmd"><span class="cmd-name">/whois &lt;id&gt;</span><span class="cmd-desc">id to username</span></div>
        <div class="cmd"><span class="cmd-name">/avatar &lt;user&gt;</span><span class="cmd-desc">avatar url</span></div>
        <div class="cmd"><span class="cmd-name">/badges &lt;user&gt;</span><span class="cmd-desc">list badges</span></div>
        <div class="cmd"><span class="cmd-name">/bio &lt;user&gt;</span><span class="cmd-desc">user bio</span></div>
        <div class="cmd"><span class="cmd-name">/socials &lt;user&gt;</span><span class="cmd-desc">social links</span></div>
        <div class="cmd"><span class="cmd-name">/tag &lt;user&gt;</span><span class="cmd-desc">server tag</span></div>
        <div class="cmd"><span class="cmd-name">/spotify &lt;user&gt;</span><span class="cmd-desc">now playing</span></div>
        <div class="cmd"><span class="cmd-name">/compare &lt;a&gt; &lt;b&gt;</span><span class="cmd-desc">compare users</span></div>
        <div class="cmd"><span class="cmd-name">/online</span><span class="cmd-desc">online users</span></div>
        <div class="cmd"><span class="cmd-name">/offline</span><span class="cmd-desc">recently offline</span></div>
        <div class="cmd"><span class="cmd-name">/mobile</span><span class="cmd-desc">mobile users</span></div>
        <div class="cmd"><span class="cmd-name">/role &lt;role&gt;</span><span class="cmd-desc">users by role</span></div>
        <div class="cmd"><span class="cmd-name">/search &lt;query&gt;</span><span class="cmd-desc">search users</span></div>
        <div class="cmd"><span class="cmd-name">/random</span><span class="cmd-desc">random user</span></div>
        <div class="cmd"><span class="cmd-name">/api &lt;user&gt;</span><span class="cmd-desc">raw json</span></div>
        <div class="cmd"><span class="cmd-name">/set &lt;key&gt; &lt;value&gt;</span><span class="cmd-desc">store a value</span></div>
        <div class="cmd"><span class="cmd-name">/get &lt;key&gt;</span><span class="cmd-desc">retrieve a value</span></div>
        <div class="cmd"><span class="cmd-name">/del &lt;key&gt;</span><span class="cmd-desc">delete a key</span></div>
        <div class="cmd"><span class="cmd-name">/keys</span><span class="cmd-desc">list stored keys</span></div>
        <div class="cmd"><span class="cmd-name">/note &lt;user&gt; &lt;text&gt;</span><span class="cmd-desc">add note</span></div>
        <div class="cmd"><span class="cmd-name">/notes &lt;user&gt;</span><span class="cmd-desc">view notes</span></div>
        <div class="cmd"><span class="cmd-name">/server</span><span class="cmd-desc">server info</span></div>
        <div class="cmd"><span class="cmd-name">/stats</span><span class="cmd-desc">bot statistics</span></div>
        <div class="cmd"><span class="cmd-name">/count</span><span class="cmd-desc">tracked users</span></div>
        <div class="cmd"><span class="cmd-name">/uptime</span><span class="cmd-desc">bot uptime</span></div>
        <div class="cmd"><span class="cmd-name">/ping</span><span class="cmd-desc">latency</span></div>
        <div class="cmd"><span class="cmd-name">/docs</span><span class="cmd-desc">api documentation</span></div>
      </div>
    </div>
  </div>
</body>
</html>
  `);
});

router.get("/v1/users", (req, res) => {
  const ids = req.query.ids?.split(",") || null;
  let users = store.values();

  if (ids) {
    users = ids.map(id => {
      if (!id.startsWith("usr_")) id = "usr_" + id;
      return store.get(id);
    }).filter(Boolean);
  }

  const clean = users.map(u => {
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
  try { value = JSON.parse(value); } catch {}

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
  const allKeys = kv.keys();
  const result = {};
  allKeys.forEach(k => {
    if (k.startsWith(prefix)) {
      result[k.replace(prefix, "")] = kv.get(k);
    }
  });
  return result;
}

module.exports = router;
module.exports.setupWebSocket = setupWebSocket;
module.exports.broadcastUpdate = broadcastUpdate;