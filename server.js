const express = require("express");
const cors = require("cors");
const http = require("http");
const { initPusher, listenToAllChannels } = require("./src/pusher");
const { fetchAllUsers } = require("./src/fetcher");
const store = require("./src/store");
const api = require("./src/api");
const { setupWebSocket, broadcastUpdate } = require("./src/api");
const { setupGitHubWebhook } = require("./src/github");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

setupGitHubWebhook(app);
app.use(api);
setupWebSocket(server);

let serverIds = [];
let channelIds = [];

async function poll() {
  const result = await fetchAllUsers();
  if (!result) return;

  result.users.forEach((u) => {
    const old = store.get(u.id);
    store.set(u.id, u);
    if (old && old.presence?.status !== u.presence?.status) {
      broadcastUpdate(u.id, u);
    }
  });

  serverIds = result.serverIds;
  channelIds = result.channels;
  console.log(
    `[Poll] ${result.users.length} users | ${serverIds.length} servers | ${channelIds.length} channels`
  );
}

server.listen(PORT, async () => {
  console.log(`\nbeacon running on http://localhost:${PORT}\n`);
  initPusher();
  await poll();
  setInterval(poll, 25000);
  setTimeout(() => listenToAllChannels(channelIds, serverIds), 5000);
});