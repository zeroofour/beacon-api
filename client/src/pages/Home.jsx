import { useState, useEffect, useRef, useCallback } from "react";
import { fetchUsers, fetchUser, connectWebSocket } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Wifi,
  WifiOff,
  User,
  Smartphone,
  Music,
  ChevronRight,
  Terminal,
} from "lucide-react";

const STATUS_BG = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-zinc-600",
};

const FILTERS = ["all", "online", "idle", "dnd", "offline"];

export default function Home() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const wsRef = useRef(null);
  const initialized = useRef(false);

  const addEvent = useCallback((type, data) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setEvents((prev) => [{ time, type, data }, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    fetchUsers().then(setUsers);
    const interval = setInterval(() => fetchUsers().then(setUsers), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const socket = connectWebSocket((msg) => {
      if (msg.type === "connection") {
        setConnected(msg.connected);
        addEvent(msg.connected ? "CONNECTED" : "DISCONNECTED", "");
        return;
      }
      if (msg.type === "hello") {
        setUsers((prev) => {
          const ids = prev.map((u) => u.id);
          if (ids.length) socket.subscribe(ids);
          return prev;
        });
        addEvent("SUBSCRIBE", "subscribed");
        return;
      }
      if (msg.type === "init") {
        addEvent("INIT_STATE", msg.data?.display_name || msg.data?.id);
        return;
      }
      if (msg.type === "presence") {
        const d = msg.d || msg.data;
        if (!d?.id) return;
        setUsers((prev) => {
          const idx = prev.findIndex((u) => u.id === d.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...d };
            return next;
          }
          return [...prev, d];
        });
        addEvent("PRESENCE_UPDATE", `${d.display_name || d.id} → ${d.presence?.status}`);
      }
    });

    wsRef.current = socket;
    return () => socket.close();
  }, [addEvent]);

  const filtered = users
    .filter((u) => {
      if (filter !== "all" && u.presence?.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return u.username?.includes(q) || u.display_name?.toLowerCase().includes(q) || u.id?.includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const o = { online: 0, idle: 1, dnd: 2, offline: 3 };
      return (o[a.presence?.status] ?? 3) - (o[b.presence?.status] ?? 3);
    });

  const counts = {
    total: users.length,
    online: users.filter((u) => u.presence?.status === "online").length,
    idle: users.filter((u) => u.presence?.status === "idle").length,
    dnd: users.filter((u) => u.presence?.status === "dnd").length,
  };

  async function handleSearch() {
    const q = search.trim();
    if (!q) return;
    if (q.startsWith("usr_") || /^[a-f0-9]{16}$/.test(q)) {
      const user = await fetchUser(q);
      if (user) {
        setUsers((prev) => {
          const idx = prev.findIndex((u) => u.id === user.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = user;
            return next;
          }
          return [user, ...prev];
        });
        setSelected(user);
      }
    }
  }

  function formatBadge(b) {
    if (typeof b === "string") return b;
    if (b.icon) return `${b.icon} ${b.name}`;
    return b.name;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-6 px-1">
        {connected ? <Wifi className="h-3 w-3 text-green-500" /> : <WifiOff className="h-3 w-3" />}
        {connected ? "connected" : "reconnecting..."}
      </div>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Search by username or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="h-9 text-sm"
        />
        <Button size="sm" className="h-9 px-4" onClick={handleSearch}>
          <Search className="h-3.5 w-3.5 mr-1.5" />
          Look up
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6 max-sm:grid-cols-2">
        {[
          { label: "Total", value: counts.total },
          { label: "Online", value: counts.online, color: "text-green-500" },
          { label: "Idle", value: counts.idle, color: "text-yellow-500" },
          { label: "DND", value: counts.dnd, color: "text-red-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-2xl font-semibold tracking-tight mt-1 ${s.color || ""}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
              filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3 px-5">
          <CardTitle className="text-sm font-semibold">Users</CardTitle>
          <Badge variant="secondary" className="text-xs font-normal">
            {filtered.length} user{filtered.length !== 1 ? "s" : ""}
          </Badge>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            <ul>
              {filtered.map((u) => {
                const status = u.presence?.status || "offline";
                const initial = (u.display_name || u.username || "?")[0].toUpperCase();
                const badgeNames = (u.badges || []).filter((b) => typeof b === "object").map((b) => b.name);

                return (
                  <li
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className={`flex items-center gap-3.5 px-5 py-3.5 cursor-pointer transition-colors border-b border-border last:border-0 ${
                      selected?.id === u.id ? "bg-muted/80" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground overflow-hidden">
                        {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : initial}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${STATUS_BG[status]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {u.display_name || u.username}
                        {badgeNames.length > 0 &&
                          badgeNames.map((name) => (
                            <span key={name} className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {name}
                            </span>
                          ))}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.presence?.custom_status?.text || u.bio || u.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 max-sm:hidden">
                      {u.presence?.is_mobile && <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />}
                      {u.spotify?.now_playing && (
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full max-w-[180px] truncate">
                          <Music className="h-3 w-3 shrink-0" />
                          {u.spotify.now_playing}
                        </span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {selected && (
        <>
          <Card className="mt-4">
            <CardContent className="p-0">
              <div className="flex items-center gap-4 p-5 border-b border-border">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xl font-semibold text-muted-foreground overflow-hidden shrink-0">
                  {selected.avatar_url ? (
                    <img src={selected.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (selected.display_name || "?")[0].toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selected.display_name || selected.username}</h3>
                  <p className="text-xs text-muted-foreground font-mono">@{selected.username} · {selected.id}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 max-sm:grid-cols-1">
                {[
                  ["Status", selected.presence?.status || "offline"],
                  ["Role", selected.platform_role || "user"],
                  ["Mobile", selected.presence?.is_mobile ? "Yes" : "No"],
                  ["Spotify", selected.spotify?.now_playing || (selected.spotify?.connected ? "Connected" : "—")],
                  ["Bio", selected.bio || "—"],
                  ["Custom Status", selected.presence?.custom_status?.text || "—"],
                ].map(([label, value], i) => (
                  <div key={label} className="p-4 border-b border-r border-border last:border-b-0 [&:nth-child(2n)]:border-r-0 max-sm:border-r-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm break-all">{value}</p>
                  </div>
                ))}
                <div className="p-4 border-b border-border col-span-full">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Badges</p>
                  {[...(selected.badges || []), ...(selected.self_badges || [])].length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {[...(selected.badges || []), ...(selected.self_badges || [])].map((b, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-md">
                          {typeof b === "string" ? b : b.icon ? `${b.icon} ${b.name}` : b.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
                <div className="p-4 col-span-full">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">API</p>
                  <p className="text-xs font-mono text-muted-foreground">{window.location.origin}/v1/users/{selected.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="py-3 px-5">
              <CardTitle className="text-sm font-semibold">Raw JSON</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-4">
              <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between py-3 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5" />
            WebSocket
          </CardTitle>
          <Badge variant="secondary" className="text-xs font-normal">{events.length}</Badge>
        </CardHeader>
        <Separator />
        <CardContent className="p-4 max-h-[280px] overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Waiting for events...</p>
          ) : (
            <div className="space-y-0.5">
              {events.map((e, i) => (
                <div key={i} className="flex items-baseline gap-3 text-xs font-mono">
                  <span className="text-muted-foreground shrink-0">{e.time}</span>
                  <span className="text-violet-400 shrink-0 font-medium">{e.type}</span>
                  <span className="text-muted-foreground truncate">{e.data}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}