const users = new Map();

module.exports = {
  get: (id) => users.get(id),
  set: (id, data) => users.set(id, { ...data, _ts: Date.now() }),
  has: (id) => users.has(id),
  count: () => users.size,
  all: () => Object.fromEntries(users),
  values: () => [...users.values()],
};