import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "base-url", label: "Base URL" },
  { id: "users", label: "Users" },
  { id: "presence", label: "Presence" },
  { id: "kv", label: "KV Store" },
  { id: "badges", label: "Badges" },
  { id: "websocket", label: "WebSocket" },
  { id: "webhooks", label: "Webhooks" },
  { id: "examples", label: "Examples" },
];

function Endpoint({ method, path, desc, children }) {
  const colors = {
    GET: "bg-emerald-500/10 text-emerald-400",
    PUT: "bg-amber-500/10 text-amber-400",
    DELETE: "bg-red-500/10 text-red-400",
    POST: "bg-orange-500/10 text-orange-400",
    WSS: "bg-blue-500/10 text-blue-400",
  };

  return (
    <div className="mb-3 border border-[#181818] rounded-md overflow-hidden hover:border-[#222] transition-colors duration-75">
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm ${colors[method] || ""}`}>
          {method}
        </span>
        <code className="text-[13px] text-foreground">{path}</code>
      </div>
      {(desc || children) && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          {desc && <p className="text-[13px] text-[#888] leading-relaxed">{desc}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

function Code({ children, className = "" }) {
  return (
    <pre className={`bg-[#0e0e0e] border border-[#181818] rounded-md p-3 text-[11px] font-mono overflow-x-auto leading-[1.7] text-[#777] ${className}`}>
      {children}
    </pre>
  );
}

export default function Docs() {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex max-w-6xl mx-auto min-h-[calc(100vh-3.5rem)]">
      <aside className="w-48 shrink-0 border-r border-[#181818] sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-6 px-3 max-lg:hidden">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#444] mb-2.5 px-2">
          Docs
        </p>
        <nav className="space-y-px">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`relative block px-2 py-1 text-[12px] rounded-md transition-colors duration-100 ${
                active === s.id ? "text-foreground" : "text-[#555] hover:text-[#999]"
              }`}
            >
              {active === s.id && (
                <motion.div
                  layoutId="docs-pill"
                  className="absolute inset-0 bg-[#161616] rounded-md"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{s.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <main className="flex-1 max-w-3xl px-8 py-8 max-lg:px-5">
        <div className="mb-10">
          <h1 id="overview" className="text-xl font-bold tracking-tight mb-1.5 scroll-mt-20">
            Documentation
          </h1>
          <p className="text-[13px] text-[#888] leading-relaxed max-w-md">
            Beacon is a real-time presence API for DisTalk. Track user status, activity, and Spotify data through REST or WebSocket.
          </p>
        </div>

        <section className="mb-10">
          <h2 id="base-url" className="text-[14px] font-semibold mb-3 scroll-mt-20">Base URL</h2>
          <div className="border border-[#181818] rounded-md px-3.5 py-2.5 flex items-center gap-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#444]">Base</span>
            <code className="text-[13px] text-orange-400 select-all">https://api-beacon.up.railway.app</code>
          </div>
        </section>

        <section className="mb-10">
          <h2 id="users" className="text-[14px] font-semibold mb-3 scroll-mt-20">Users</h2>
          <Endpoint method="GET" path="/v1/users" desc="Returns all tracked users. Filter with ?ids=id1,id2.">
            <Code>curl https://api-beacon.up.railway.app/v1/users</Code>
          </Endpoint>
          <Endpoint method="GET" path="/v1/users/:id" desc="Returns a single user by ID.">
            <Code>curl https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f</Code>
            <Code className="mt-2">{`{
  "success": true,
  "data": {
    "id": "usr_8f7220facabf757f",
    "username": "app",
    "presence": { "status": "online" },
    "badges": [],
    "self_badges": [],
    "kv": {}
  }
}`}</Code>
          </Endpoint>
        </section>

        <section className="mb-10">
          <h2 id="presence" className="text-[14px] font-semibold mb-3 scroll-mt-20">Presence</h2>
          <Endpoint method="GET" path="/v1/users/:id/presence" desc="Returns only the presence object." />
        </section>

        <section className="mb-10">
          <h2 id="kv" className="text-[14px] font-semibold mb-1.5 scroll-mt-20">KV Store</h2>
          <p className="text-[13px] text-[#888] mb-3">Per-user key-value storage for metadata.</p>
          <Endpoint method="GET" path="/v1/users/:id/kv" desc="All KV pairs." />
          <Endpoint method="GET" path="/v1/users/:id/kv/:key" desc="Single KV value." />
          <Endpoint method="PUT" path="/v1/users/:id/kv/:key" desc="Set a KV value. Requires Authorization header.">
            <Code>{`curl -X PUT https://api-beacon.up.railway.app/v1/users/:id/kv/website \\
  -H "Authorization: your-api-key" \\
  -d '"https://example.com"'`}</Code>
          </Endpoint>
          <Endpoint method="DELETE" path="/v1/users/:id/kv/:key" desc="Delete a KV value. Requires Authorization header." />
        </section>

        <section className="mb-10">
          <h2 id="badges" className="text-[14px] font-semibold mb-3 scroll-mt-20">Badges</h2>
          <Endpoint method="GET" path="/v1/badges" desc="Returns all known badge definitions." />
        </section>

        <section className="mb-10">
          <h2 id="websocket" className="text-[14px] font-semibold mb-1.5 scroll-mt-20">WebSocket</h2>
          <p className="text-[13px] text-[#888] mb-3">Subscribe to real-time presence updates.</p>
          <Endpoint method="WSS" path="wss://api-beacon.up.railway.app/socket">
            <Code>{`const ws = new WebSocket("wss://api-beacon.up.railway.app/socket");

ws.send(JSON.stringify({
  op: 2,
  d: { subscribe_to_ids: ["usr_8f7220facabf757f"] }
}));

setInterval(() => ws.send(JSON.stringify({ op: 3 })), 30000);`}</Code>
          </Endpoint>

          <div className="border border-[#181818] rounded-md overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#181818]">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#444] p-2.5 px-3.5 w-10">Op</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#444] p-2.5 px-3.5">Direction</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-[#444] p-2.5 px-3.5">Description</th>
                </tr>
              </thead>
              <tbody className="text-[#888]">
                {[
                  ["0", "Server → Client", "Event dispatch"],
                  ["1", "Server → Client", "Hello"],
                  ["2", "Client → Server", "Subscribe"],
                  ["3", "Client → Server", "Heartbeat"],
                  ["4", "Client → Server", "Unsubscribe"],
                ].map(([op, dir, desc]) => (
                  <tr key={op} className="border-b border-[#141414] last:border-0">
                    <td className="p-2.5 px-3.5 font-mono text-orange-400/60">{op}</td>
                    <td className="p-2.5 px-3.5">{dir}</td>
                    <td className="p-2.5 px-3.5">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-10">
          <h2 id="webhooks" className="text-[14px] font-semibold mb-3 scroll-mt-20">Webhooks</h2>
          <Endpoint method="POST" path="/github" desc="GitHub webhook endpoint. Posts events to DisTalk." />
        </section>

        <section className="mb-10">
          <h2 id="examples" className="text-[14px] font-semibold mb-3 scroll-mt-20">Examples</h2>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-medium text-[#444] uppercase tracking-wider mb-1.5">JavaScript</p>
              <Code>{`const res = await fetch("https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f");
const { data } = await res.json();
console.log(data.presence.status);`}</Code>
            </div>
            <div>
              <p className="text-[10px] font-medium text-[#444] uppercase tracking-wider mb-1.5">Python</p>
              <Code>{`import requests
res = requests.get("https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f")
print(res.json()["data"]["presence"]["status"])`}</Code>
            </div>
            <div>
              <p className="text-[10px] font-medium text-[#444] uppercase tracking-wider mb-1.5">WebSocket</p>
              <Code>{`const ws = new WebSocket("wss://api-beacon.up.railway.app/socket");
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.t === "PRESENCE_UPDATE") {
    console.log(msg.d.presence.status);
  }
};`}</Code>
            </div>
          </div>
        </section>

        <footer className="pt-6 pb-4 border-t border-[#181818] text-[10px] text-[#333]">
          Beacon · DisTalk Presence API
        </footer>
      </main>
    </div>
  );
}