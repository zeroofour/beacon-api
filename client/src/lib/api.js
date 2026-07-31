const API = window.location.origin;
const WS_URL = API.replace("http", "ws") + "/socket";

export async function fetchUsers() {
  const res = await fetch(`${API}/v1/users`);
  const json = await res.json();
  return json.success ? json.data : [];
}

export async function fetchUser(id) {
  const res = await fetch(`${API}/v1/users/${id}`);
  const json = await res.json();
  return json.success ? json.data : null;
}

export function connectWebSocket(onMessage) {
  let ws = null;
  let heartbeat = null;

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => onMessage({ type: "connection", connected: true });

    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.op === 1) {
        clearInterval(heartbeat);
        heartbeat = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 3 }));
        }, msg.d?.heartbeat_interval || 30000);
        onMessage({ type: "hello" });
        return;
      }
      if (msg.t === "INIT_STATE") {
        onMessage({ type: "init", data: msg.d });
        return;
      }
      if (msg.t === "PRESENCE_UPDATE") {
        onMessage({ type: "presence", data: msg.d });
      }
    };

    ws.onclose = () => {
      clearInterval(heartbeat);
      onMessage({ type: "connection", connected: false });
      setTimeout(connect, 5000);
    };
  }

  connect();

  return {
    subscribe(ids) {
      if (ws?.readyState === WebSocket.OPEN && ids.length) {
        ws.send(JSON.stringify({ op: 2, d: { subscribe_to_ids: ids } }));
      }
    },
    close() {
      clearInterval(heartbeat);
      ws?.close();
    },
  };
}