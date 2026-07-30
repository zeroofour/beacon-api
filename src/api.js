const express = require("express");
const store = require("./store");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    name: "Beacon",
    version: "3.0",
    docs: "GET /docs",
    endpoints: [
      "GET /v1/users",
      "GET /v1/users/:id",
      "GET /v1/users/:id/presence"
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
  <title>Beacon API Docs</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #fff; font-size: 32px; margin-bottom: 8px; }
    .subtitle { color: #888; font-size: 16px; margin-bottom: 40px; }
    .section { margin-bottom: 32px; }
    .section h2 { color: #fff; font-size: 20px; margin-bottom: 16px; border-bottom: 1px solid #222; padding-bottom: 8px; }
    .endpoint { background: #111; border: 1px solid #222; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .method { background: #1a6334; color: #4ade80; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 8px; }
    .path { color: #fff; font-family: monospace; font-size: 14px; }
    .desc { color: #888; font-size: 13px; margin-top: 8px; }
    .example { background: #0d0d0d; border: 1px solid #222; border-radius: 6px; padding: 12px; margin-top: 8px; font-family: monospace; font-size: 13px; color: #a78bfa; overflow-x: auto; }
    .response { background: #0d0d0d; border: 1px solid #222; border-radius: 6px; padding: 12px; margin-top: 8px; font-family: monospace; font-size: 12px; color: #4ade80; white-space: pre; overflow-x: auto; }
    .commands { margin-top: 16px; }
    .cmd { display: flex; gap: 12px; padding: 6px 0; border-bottom: 1px solid #1a1a1a; }
    .cmd-name { color: #a78bfa; font-family: monospace; min-width: 180px; }
    .cmd-desc { color: #888; }
    a { color: #a78bfa; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .base-url { background: #111; border: 1px solid #222; border-radius: 8px; padding: 12px 16px; margin-bottom: 32px; font-family: monospace; color: #4ade80; }
  </style>
</head>
<body>
  <div class="container">
    <h1>beacon</h1>
    <p class="subtitle">lanyard-like presence api for distalk</p>

    <div class="base-url">https://beacon-old-cloud-9654.fly.dev</div>

    <div class="section">
      <h2>endpoints</h2>

      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/v1/users</span>
        <div class="desc">returns all tracked users</div>
        <div class="example">curl https://beacon-old-cloud-9654.fly.dev/v1/users</div>
      </div>

      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/v1/users/:id</span>
        <div class="desc">returns a specific user by id or username</div>
        <div class="example">curl https://beacon-old-cloud-9654.fly.dev/v1/users/usr_8f7220facabf757f</div>
        <div class="response">{
  "success": true,
  "data": {
    "id": "usr_8f7220facabf757f",
    "username": "app",
    "display_name": "app",
    "presence": {
      "status": "online",
      "is_mobile": false,
      "custom_status": { "emoji": "🛠️", "text": null },
      "activity": null
    },
    "spotify": {
      "connected": false,
      "now_playing": null
    }
  }
}</div>
      </div>

      <div class="endpoint">
        <span class="method">GET</span>
        <span class="path">/v1/users/:id/presence</span>
        <div class="desc">returns only the presence data for a user</div>
        <div class="example">curl https://beacon-old-cloud-9654.fly.dev/v1/users/usr_8f7220facabf757f/presence</div>
        <div class="response">{
  "success": true,
  "data": {
    "id": "usr_8f7220facabf757f",
    "status": "online",
    "is_mobile": false,
    "custom_status": { "emoji": "🛠️", "text": null },
    "activity": null,
    "spotify": { "connected": false, "now_playing": null }
  }
}</div>
      </div>

      <div class="endpoint">
        <span class="method">POST</span>
        <span class="path">/github</span>
        <div class="desc">github webhook endpoint — posts commit/pr/issue updates to distalk</div>
      </div>
    </div>

    <div class="section">
      <h2>usage examples</h2>

      <div class="endpoint">
        <div class="desc">javascript</div>
        <div class="response">const res = await fetch("https://beacon-old-cloud-9654.fly.dev/v1/users/usr_8f7220facabf757f");
const { data } = await res.json();
console.log(data.presence.status);</div>
      </div>

      <div class="endpoint">
        <div class="desc">python</div>
        <div class="response">import requests
res = requests.get("https://beacon-old-cloud-9654.fly.dev/v1/users/usr_8f7220facabf757f")
print(res.json()["data"]["presence"]["status"])</div>
      </div>

      <div class="endpoint">
        <div class="desc">html widget</div>
        <div class="response">&lt;script&gt;
  fetch("https://beacon-old-cloud-9654.fly.dev/v1/users/usr_8f7220facabf757f/presence")
    .then(r => r.json())
    .then(j => document.getElementById("status").innerText = j.data.status);
&lt;/script&gt;
&lt;span id="status"&gt;&lt;/span&gt;</div>
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
        <div class="cmd"><span class="cmd-name">/announce &lt;text&gt;</span><span class="cmd-desc">announcement (owner)</span></div>
        <div class="cmd"><span class="cmd-name">/server</span><span class="cmd-desc">server info</span></div>
        <div class="cmd"><span class="cmd-name">/stats</span><span class="cmd-desc">bot statistics</span></div>
        <div class="cmd"><span class="cmd-name">/count</span><span class="cmd-desc">tracked users</span></div>
        <div class="cmd"><span class="cmd-name">/uptime</span><span class="cmd-desc">bot uptime</span></div>
        <div class="cmd"><span class="cmd-name">/ping</span><span class="cmd-desc">latency</span></div>
        <div class="cmd"><span class="cmd-name">/help</span><span class="cmd-desc">this message</span></div>
      </div>
    </div>
  </div>
</body>
</html>
  `);
});

router.get("/v1/users", (req, res) => {
  const users = store.values().map(({ _ts, ...u }) => u);
  res.json({ success: true, count: users.length, data: users });
});

router.get("/v1/users/:id", (req, res) => {
  let id = req.params.id;
  if (!id.startsWith("usr_")) id = "usr_" + id;
  const data = store.get(id);
  if (!data) return res.status(404).json({ success: false, error: "Not found" });
  const { _ts, ...clean } = data;
  res.json({ success: true, data: clean });
});

router.get("/v1/users/:id/presence", (req, res) => {
  let id = req.params.id;
  if (!id.startsWith("usr_")) id = "usr_" + id;
  const data = store.get(id);
  if (!data) return res.json({ success: true, data: { status: "offline" } });
  res.json({ success: true, data: { id: data.id, ...data.presence, spotify: data.spotify } });
});

module.exports = router;