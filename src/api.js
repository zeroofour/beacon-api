const express = require("express");
const store = require("./store");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    name: "Beacon",
    version: "3.0",
    endpoints: [
      "GET /v1/users",
      "GET /v1/users/:id",
      "GET /v1/users/:id/presence"
    ]
  });
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