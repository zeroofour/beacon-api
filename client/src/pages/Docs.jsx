import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  { id: "commands", label: "Commands" },
];

const COMMANDS = [
  ["/status <user>", "Current status"],
  ["/profile <user>", "Full profile"],
  ["/userid <user>", "Get user ID"],
  ["/whois <id>", "Resolve ID"],
  ["/avatar <user>", "Avatar URL"],
  ["/badges <user>", "List badges"],
  ["/bio <user>", "User bio"],
  ["/socials <user>", "Social links"],
  ["/tag <user>", "Server tag"],
  ["/spotify <user>", "Now playing"],
  ["/compare <a> <b>", "Compare users"],
  ["/online", "Online users"],
  ["/offline", "Recently offline"],
  ["/mobile", "Mobile users"],
  ["/role <role>", "Users by role"],
  ["/search <query>", "Search users"],
  ["/random", "Random user"],
  ["/api <user>", "Raw JSON"],
  ["/kv [user]", "View KV data"],
  ["/kv set <k> <v>", "Set KV"],
  ["/kv del <key>", "Delete KV"],
  ["/set <key> <val>", "Store value"],
  ["/get <key>", "Get value"],
  ["/del <key>", "Delete key"],
  ["/keys", "List keys"],
  ["/note <user> <text>", "Add note"],
  ["/notes <user>", "View notes"],
  ["/server", "Server info"],
  ["/stats", "Bot stats"],
  ["/count", "User count"],
  ["/uptime", "Bot uptime"],
  ["/ping", "Latency"],
  ["/help", "List commands"],
  ["/docs", "API docs"],
  ["/privacy", "Privacy policy"],
];

function Endpoint({ method, path, desc, children }) {
  const colors = {
    GET: "bg-green-500/10 text-green-400",
    PUT: "bg-yellow-500/10 text-yellow-400",
    DELETE: "bg-red-500/10 text-red-400",
    POST: "bg-violet-500/10 text-violet-400",
    WSS: "bg-blue-500/10 text-blue-400",
  };

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-center gap-2.5 mb-2">
          <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${colors[method] || ""}`}>{method}</span>
          <code className="text-sm text-foreground">{path}</code>
        </div>
        {desc && <p className="text-sm text-muted-foreground mb-3">{desc}</p>}
        {children}
      </CardContent>
    </Card>
  );
}

function Code({ children, className = "" }) {
  return (
    <pre className={`bg-muted/50 border border-border rounded-lg p-3 text-xs font-mono overflow-x-auto leading-relaxed ${className}`}>
      {children}
    </pre>
  );
}

export default function Docs() {
  const [active, setActive] = useState("overview");

  return (
    <div className="flex max-w-6xl mx-auto">
      <aside className="w-56 shrink-0 border-r border-border sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 px-4 max-lg:hidden">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-2">On this page</p>
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setActive(s.id)}
              className={`block px-2 py-1 text-sm rounded-md transition-colors ${
                active === s.id ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </aside>

      <main className="flex-1 max-w-3xl px-8 py-12 max-lg:px-6">
        <h1 id="overview" className="text-3xl font-bold tracking-tight mb-2">Documentation</h1>
        <p className="text-muted-foreground mb-12">
          Beacon is a real-time presence API for DisTalk. Track user status, activity, and Spotify data through REST or WebSocket.
        </p>

        <h2 id="base-url" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Base URL</h2>
        <Card className="mb-8">
          <CardContent className="p-4 flex items-center gap-3">
            <Badge variant="secondary" className="text-[10px]">BASE</Badge>
            <code className="text-sm text-violet-400">https://api-beacon.up.railway.app</code>
          </CardContent>
        </Card>

        <h2 id="users" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Users</h2>
        <Endpoint method="GET" path="/v1/users" desc="Returns all tracked users. Filter with ?ids=id1,id2.">
          <Code>curl https://api-beacon.up.railway.app/v1/users</Code>
        </Endpoint>
        <Endpoint method="GET" path="/v1/users/:id" desc="Returns a single user by ID.">
          <Code>curl https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f</Code>
          <Code className="mt-2 text-green-400">{`{
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

        <h2 id="presence" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Presence</h2>
        <Endpoint method="GET" path="/v1/users/:id/presence" desc="Returns only the presence object." />

        <h2 id="kv" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">KV Store</h2>
        <p className="text-sm text-muted-foreground mb-4">Per-user key-value storage for metadata like website URLs or pronouns.</p>
        <Endpoint method="GET" path="/v1/users/:id/kv" desc="All KV pairs for a user." />
        <Endpoint method="GET" path="/v1/users/:id/kv/:key" desc="A single KV value." />
        <Endpoint method="PUT" path="/v1/users/:id/kv/:key" desc="Set a KV value. Requires Authorization header.">
          <Code>{`curl -X PUT https://api-beacon.up.railway.app/v1/users/:id/kv/website \\
  -H "Authorization: your-api-key" \\
  -d '"https://example.com"'`}</Code>
        </Endpoint>
        <Endpoint method="DELETE" path="/v1/users/:id/kv/:key" desc="Delete a KV value. Requires Authorization header." />

        <h2 id="badges" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Badges</h2>
        <Endpoint method="GET" path="/v1/badges" desc="Returns all known badge definitions." />

        <h2 id="websocket" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">WebSocket</h2>
        <Endpoint method="WSS" path="wss://api-beacon.up.railway.app/socket" desc="Real-time presence updates.">
          <Code>{`const ws = new WebSocket("wss://api-beacon.up.railway.app/socket");

// Subscribe
ws.send(JSON.stringify({
  op: 2,
  d: { subscribe_to_ids: ["usr_8f7220facabf757f"] }
}));

// Heartbeat every 30s
setInterval(() => ws.send(JSON.stringify({ op: 3 })), 30000);`}</Code>
        </Endpoint>

        <h2 id="webhooks" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Webhooks</h2>
        <Endpoint method="POST" path="/github" desc="GitHub webhook endpoint. Posts events to DisTalk." />

        <h2 id="examples" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Examples</h2>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">JavaScript</p>
        <Code className="mb-4">{`const res = await fetch("https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f");
const { data } = await res.json();
console.log(data.presence.status);`}</Code>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Python</p>
        <Code className="mb-4">{`import requests
res = requests.get("https://api-beacon.up.railway.app/v1/users/usr_8f7220facabf757f")
print(res.json()["data"]["presence"]["status"])`}</Code>

        <h2 id="commands" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Chat Commands</h2>
        <p className="text-sm text-muted-foreground mb-4">Available in any DisTalk channel where Beacon is present.</p>
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground p-3 px-4">Command</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground p-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody>
                {COMMANDS.map(([cmd, desc]) => (
                  <tr key={cmd} className="border-b border-border last:border-0">
                    <td className="p-3 px-4 font-mono text-xs text-violet-400">{cmd}</td>
                    <td className="p-3 px-4 text-sm text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}