const fs = require("fs");
const path = require("path");

<<<<<<< HEAD
const FILE = path.join(__dirname, "../data/kv.json");
const DIR = path.join(__dirname, "../data");

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);
=======
const DIR = path.join(__dirname, "../data");
const FILE = path.join(DIR, "kv.json");

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
>>>>>>> 7e5f0d1

let data = {};

function load() {
  try {
    if (fs.existsSync(FILE)) {
      data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    }
  } catch {
    data = {};
  }
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function get(key) {
  return data[key] ?? null;
}

function set(key, value) {
  data[key] = value;
  save();
}

function del(key) {
  delete data[key];
  save();
}

function keys() {
  return Object.keys(data);
}

function all() {
  return { ...data };
}

load();

module.exports = { get, set, del, keys, all };