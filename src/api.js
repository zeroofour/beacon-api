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
    home: "/home",
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
      "GET /v1/badges",
      "WSS /socket",
    ],
  });
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
  const result = {};
  kv.keys().forEach((k) => {
    if (k.startsWith(prefix)) result[k.replace(prefix, "")] = kv.get(k);
  });
  return result;
}

module.exports = router;
module.exports.setupWebSocket = setupWebSocket;
module.exports.broadcastUpdate = broadcastUpdate;