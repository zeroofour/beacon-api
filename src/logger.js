const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../logs");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const file = path.join(dir, "events.log");

function logEvent(channel, event, data) {
  const entry = { time: new Date().toISOString(), channel, event, data };
  fs.appendFileSync(file, JSON.stringify(entry) + "\n");
}

module.exports = { logEvent };