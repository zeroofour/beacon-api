import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

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
    GET: "bg-emerald-500/8 text-emerald-400 border border-emerald-500/10",
    PUT: "bg-amber-500/8 text-amber-400 border border-amber-500/10",
    DELETE: "bg-red-500/8 text-red-400 border border-red-500/10",
    POST: "bg-violet-500/8 text-violet-400 border border-violet-500/10",
    WSS: "bg-blue-500/8 text-blue-400 border border-blue-500/10",
  };

  return (
    <div className="mb-4 rounded-xl border border-border/40 bg-card/50 overflow-hidden transition-colors hover:border-border/60">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span
          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md ${colors[method] || ""}`}
        >
          {method}
        </span>
        <code className="text-[13px] text-foreground/90">{path}</code>
      </div>
      {(desc || children) && (
        <div className="px-4 pb-4 space-y-3">
          {desc && (
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {desc}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function Code({ children, className = "" }) {
  return (
    <pre
      className={`bg-background/80 border border-border/30 rounded-lg p-3.5 text-[11px] font-mono overflow-x-auto leading-[1.7] text-muted-foreground ${className}`}
    >
      {children}
    </pre>
  );
}

export default function Docs() {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-20% 0% -70% 0%" }
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex max-w-6xl mx-auto min-h-[calc(100vh-3rem)]">
      <aside className="w-52 shrink-0 border-r border-border/40 sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto py-8 px-3 max-lg:hidden">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3 px-2">
          On this page
        </p>
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`relative block px-2.5 py-1 text-[13px] rounded-md transition-all duration-150 ${
                active === s.id
                  ? "text-foreground"
                  : "text-muted-foreground/70 hover:text-foreground"
              }`}
            >
              {active === s.id && (
                <motion.div
                  layoutId="docs-pill"
                  className="absolute inset-0 bg-muted/60 rounded-md"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{s.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <main className="flex-1 max-w-3xl px-10 py-10 max-lg:px-6">
        <div className="mb-12">
          <h1
            id="overview"
            className="text-2xl font-bold tracking-tight mb-2 scroll-mt-16"
          >
            Documentation
          </h1>
          <p className="text-[14px] text-muted-foreground/80 leading-relaxed max-w-lg">
            Beacon is a real-time presence API for DisTalk. Track user status,
            activity, and Spotify data through REST or WebSocket.
          </p>
        </div>

        <section className="mb-12">
          <h2
            id="base-url"
            className="text-[15px] font-semibold mb-4 scroll-mt-16"
          >
            Base URL
          </h2>
          <div className="rounded-xl border border-border/40 bg-card/50 px-4 py-3 flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Base
            </span>
            <code className="text-[13px] text-violet-400 select-all">
              https://api-beacon.up.railway.app
            </code>
          </div>
        </section>

        <section className="mb-12">
          <h2
            id="users"
            className="text-[15px] font-semibold mb-4 scroll-mt-16"
          >
            Users
          </h2>
          <Endpoint
            method="GET"
            path="/v1/users"
            desc="Returns all tracked users. Filter with ?ids=id1,id2."
          >
            <Code>
              curl https://api-beacon.up.railway.app/v1/users
            </Code>
          </Endpoint>
          <Endpoint
            method="GET"
            path="/v1/users/:id"
            desc="Returns a single user by ID."
          >
            <Code>
              curl https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f
            </Code>
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

        <section className="mb-12">
          <h2
            id="presence"
            className="text-[15px] font-semibold mb-4 scroll-mt-16"
          >
            Presence
          </h2>
          <Endpoint
            method="GET"
            path="/v1/users/:id/presence"
            desc="Returns only the presence object for a user."
          />
        </section>

        <section className="mb-12">
          <h2
            id="kv"
            className="text-[15px] font-semibold mb-2 scroll-mt-16"
          >
            KV Store
          </h2>
          <p className="text-[13px] text-muted-foreground/80 mb-4">
            Per-user key-value storage for metadata like website URLs or
            pronouns.
          </p>
          <Endpoint
            method="GET"
            path="/v1/users/:id/kv"
            desc="All KV pairs for a user."
          />
          <Endpoint
            method="GET"
            path="/v1/users/:id/kv/:key"
            desc="A single KV value."
          />
          <Endpoint
            method="PUT"
            path="/v1/users/:id/kv/:key"
            desc="Set a KV value. Requires Authorization header."
          >
            <Code>{`curl -X PUT https://api-beacon.up.railway.app/v1/users/:id/kv/website \\
  -H "Authorization: your-api-key" \\
  -d '"https://example.com"'`}</Code>
          </Endpoint>
          <Endpoint
            method="DELETE"
            path="/v1/users/:id/kv/:key"
            desc="Delete a KV value. Requires Authorization header."
          />
        </section>

        <section className="mb-12">
          <h2
            id="badges"
            className="text-[15px] font-semibold mb-4 scroll-mt-16"
          >
            Badges
          </h2>
          <Endpoint
            method="GET"
            path="/v1/badges"
            desc="Returns all known badge definitions scraped from DisTalk."
          />
        </section>

        <section className="mb-12">
          <h2
            id="websocket"
            className="text-[15px] font-semibold mb-2 scroll-mt-16"
          >
            WebSocket
          </h2>
          <p className="text-[13px] text-muted-foreground/80 mb-4">
            Subscribe to real-time presence updates over a persistent connection.
          </p>
          <Endpoint
            method="WSS"
            path="wss://api-beacon.up.railway.app/socket"
            desc="Real-time presence updates."
          >
            <Code>{`const ws = new WebSocket("wss://api-beacon.up.railway.app/socket");

// Subscribe to users
ws.send(JSON.stringify({
  op: 2,
  d: { subscribe_to_ids: ["usr_8f7220facabf757f"] }
}));

// Heartbeat every 30s
setInterval(() => ws.send(JSON.stringify({ op: 3 })), 30000);`}</Code>
          </Endpoint>

          <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 p-3 px-4 w-12">
                    Op
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 p-3 px-4">
                    Direction
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 p-3 px-4">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["0", "Server → Client", "Event dispatch"],
                  ["1", "Server → Client", "Hello"],
                  ["2", "Client → Server", "Subscribe"],
                  ["3", "Client → Server", "Heartbeat"],
                  ["4", "Client → Server", "Unsubscribe"],
                ].map(([op, dir, desc]) => (
                  <tr
                    key={op}
                    className="border-b border-border/20 last:border-0"
                  >
                    <td className="p-3 px-4 font-mono text-violet-400/70">
                      {op}
                    </td>
                    <td className="p-3 px-4">{dir}</td>
                    <td className="p-3 px-4">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2
            id="webhooks"
            className="text-[15px] font-semibold mb-4 scroll-mt-16"
          >
            Webhooks
          </h2>
          <Endpoint
            method="POST"
            path="/github"
            desc="GitHub webhook endpoint. Forwards push, PR, issue, and release events to DisTalk."
          />
        </section>

        <section className="mb-12">
          <h2
            id="examples"
            className="text-[15px] font-semibold mb-4 scroll-mt-16"
          >
            Examples
          </h2>

          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-2">
                JavaScript
              </p>
              <Code>{`const res = await fetch("https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f");
const { data } = await res.json();
console.log(data.presence.status);`}</Code>
            </div>

            <div>
              <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-2">
                Python
              </p>
              <Code>{`import requests
res = requests.get("https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f")
print(res.json()["data"]["presence"]["status"])`}</Code>
            </div>

            <div>
              <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-2">
                WebSocket
              </p>
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

        <footer className="pt-8 pb-4 border-t border-border/30 text-[11px] text-muted-foreground/30">
          Beacon · DisTalk Presence API
        </footer>
      </main>
    </div>
  );
}