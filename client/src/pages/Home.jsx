import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
} from "lucide-react";

const STATUS_BG = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-zinc-600",
};

const STATUS_TEXT = {
  online: "text-green-400",
  idle: "text-yellow-400",
  dnd: "text-red-400",
  offline: "text-zinc-500",
};

const FILTERS = ["all", "online", "idle", "dnd", "offline"];

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-muted/60 ${className}`} />;
}

function UserSkeleton() {
  return (
    <div className="flex items-center gap-3.5 px-5 py-3 border-b border-border/40 last:border-0">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-44" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color, delay = 0, loading }) {
  if (loading) {
    return (
      <Card className="border-border/40">
        <CardContent className="p-4">
          <Skeleton className="h-2.5 w-10 mb-2.5" />
          <Skeleton className="h-6 w-8" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2 }}
    >
      <Card className="border-border/40 transition-colors hover:border-border/60">
        <CardContent className="p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className={`text-2xl font-semibold tracking-tight mt-1 tabular-nums ${color || ""}`}>
            {value}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DetailField({ label, children, full = false }) {
  return (
    <div className={`p-4 ${full ? "col-span-full" : ""}`}>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default function Home() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const initialized = useRef(false);

  const addEvent = useCallback((type, data) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setEvents((prev) => [{ time, type, data }, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    fetchUsers().then((data) => {
      setUsers(data);
      setLoading(false);
    });
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
        const d = msg.data;
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
        addEvent(
          "PRESENCE_UPDATE",
          `${d.display_name || d.id} → ${d.presence?.status}`
        );
      }
    });

    return () => socket.close();
  }, [addEvent]);

  const filtered = users
    .filter((u) => {
      if (filter !== "all" && u.presence?.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          u.username?.includes(q) ||
          u.display_name?.toLowerCase().includes(q) ||
          u.id?.includes(q)
        );
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

  const allBadges = selected
    ? [...(selected.badges || []), ...(selected.self_badges || [])]
    : [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          {connected ? (
            <Wifi className="h-3 w-3 text-green-500" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          <span>{connected ? "connected" : "reconnecting..."}</span>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by username or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-9 text-sm pl-9 border-border/40 focus:border-border transition-colors duration-150"
          />
        </div>
        <Button
          size="sm"
          className="h-9 px-4 transition-all duration-150 active:scale-[0.97]"
          onClick={handleSearch}
        >
          Look up
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2.5 mb-5 max-sm:grid-cols-2">
        <StatCard label="Total" value={counts.total} loading={loading} delay={0} />
        <StatCard label="Online" value={counts.online} color="text-green-500" loading={loading} delay={0.03} />
        <StatCard label="Idle" value={counts.idle} color="text-yellow-500" loading={loading} delay={0.06} />
        <StatCard label="DND" value={counts.dnd} color="text-red-500" loading={loading} delay={0.09} />
      </div>

      <div className="flex gap-0.5 p-0.5 bg-muted/40 rounded-lg w-fit mb-5 border border-border/30">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`relative px-3.5 py-1 text-xs font-medium rounded-md transition-colors duration-150 capitalize ${
              filter === f
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {filter === f && (
              <motion.div
                layoutId="filter-pill"
                className="absolute inset-0 bg-background shadow-sm rounded-md border border-border/40"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10">{f}</span>
          </button>
        ))}
      </div>

      <Card className="border-border/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
          <span className="text-[13px] font-semibold">Users</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {filtered.length}
          </span>
        </div>
        <div>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <UserSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <User className="h-6 w-6 mx-auto mb-2 opacity-30" />
              <p className="text-[13px]">No users found</p>
            </div>
          ) : (
            <ul>
              {filtered.map((u, i) => {
                const status = u.presence?.status || "offline";
                const initial = (
                  u.display_name ||
                  u.username ||
                  "?"
                )[0].toUpperCase();
                const platformBadges = (u.badges || [])
                  .filter((b) => typeof b === "object")
                  .map((b) => b.name);

                return (
                  <motion.li
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                    onClick={() => setSelected(u)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-100 border-b border-border/30 last:border-0 ${
                      selected?.id === u.id
                        ? "bg-muted/60"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center text-xs font-semibold text-muted-foreground overflow-hidden">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initial
                        )}
                      </div>
                      <div
                        className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-[1.5px] border-card ${STATUS_BG[status]}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[13px] font-medium">
                        <span className="truncate">
                          {u.display_name || u.username}
                        </span>
                        {platformBadges.map((name) => (
                          <span
                            key={name}
                            className="text-[9px] font-semibold uppercase tracking-wider px-1 py-px rounded bg-muted/80 text-muted-foreground shrink-0"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate leading-tight">
                        {u.presence?.custom_status?.text || u.bio || u.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 max-sm:hidden">
                      {u.presence?.is_mobile && (
                        <Smartphone className="h-3 w-3 text-muted-foreground/60" />
                      )}
                      {u.spotify?.now_playing && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-green-500/80 bg-green-500/8 px-1.5 py-0.5 rounded-full max-w-[160px] truncate">
                          <Music className="h-2.5 w-2.5 shrink-0" />
                          {u.spotify.now_playing}
                        </span>
                      )}
                      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="mt-3 space-y-3"
          >
            <Card className="border-border/40 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-muted/60 flex items-center justify-center text-base font-semibold text-muted-foreground overflow-hidden shrink-0">
                    {selected.avatar_url ? (
                      <img
                        src={selected.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (selected.display_name || "?")[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-semibold">
                        {selected.display_name || selected.username}
                      </h3>
                      <span
                        className={`text-[11px] font-medium capitalize ${
                          STATUS_TEXT[selected.presence?.status] || ""
                        }`}
                      >
                        {selected.presence?.status || "offline"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      @{selected.username} · {selected.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 max-sm:grid-cols-1 divide-x divide-y divide-border/30">
                <DetailField label="Role">
                  <span className="text-[13px]">{selected.platform_role || "user"}</span>
                </DetailField>
                <DetailField label="Mobile">
                  <span className="text-[13px]">{selected.presence?.is_mobile ? "Yes" : "No"}</span>
                </DetailField>
                <DetailField label="Spotify">
                  <span className="text-[13px] truncate block">
                    {selected.spotify?.now_playing ||
                      (selected.spotify?.connected ? "Connected" : "—")}
                  </span>
                </DetailField>
              </div>

              {(selected.bio || selected.presence?.custom_status?.text) && (
                <div className="grid grid-cols-2 max-sm:grid-cols-1 divide-x divide-border/30 border-t border-border/30">
                  <DetailField label="Bio">
                    <span className="text-[13px] text-muted-foreground">
                      {selected.bio || "—"}
                    </span>
                  </DetailField>
                  <DetailField label="Custom Status">
                    <span className="text-[13px] text-muted-foreground">
                      {selected.presence?.custom_status?.text || "—"}
                    </span>
                  </DetailField>
                </div>
              )}

              {allBadges.length > 0 && (
                <div className="border-t border-border/30">
                  <DetailField label="Badges" full>
                    <div className="flex flex-wrap gap-1">
                      {allBadges.map((b, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[11px] bg-muted/50 border border-border/30 px-2 py-0.5 rounded-md text-muted-foreground"
                        >
                          {typeof b === "string"
                            ? b
                            : b.icon
                              ? `${b.icon} ${b.name}`
                              : b.name}
                        </span>
                      ))}
                    </div>
                  </DetailField>
                </div>
              )}

              <div className="border-t border-border/30">
                <DetailField label="API Endpoint" full>
                  <code className="text-[11px] font-mono text-muted-foreground select-all">
                    {window.location.origin}/v1/users/{selected.id}
                  </code>
                </DetailField>
              </div>
            </Card>

            <Card className="border-border/40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/40">
                <span className="text-[13px] font-semibold">JSON</span>
              </div>
              <div className="p-3">
                <pre className="bg-muted/30 border border-border/30 rounded-lg p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto leading-relaxed max-h-[360px] overflow-y-auto">
                  {JSON.stringify(selected, null, 2)}
                </pre>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="mt-3 border-border/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
          <div className="flex items-center gap-1.5">
            <Terminal className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-[13px] font-semibold">Events</span>
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {events.length}
          </span>
        </div>
        <div className="p-3 max-h-[240px] overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60 text-center py-8">
              Waiting for events...
            </p>
          ) : (
            <div className="space-y-px">
              {events.map((e, i) => (
                <motion.div
                  key={`${e.time}-${i}`}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.1 }}
                  className="flex items-baseline gap-2.5 text-[11px] font-mono py-0.5"
                >
                  <span className="text-muted-foreground/50 shrink-0">
                    {e.time}
                  </span>
                  <span className="text-violet-400/80 shrink-0 font-medium">
                    {e.type}
                  </span>
                  <span className="text-muted-foreground/60 truncate">
                    {e.data}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <footer className="text-center py-8 text-[11px] text-muted-foreground/40">
        Beacon · DisTalk Presence API
      </footer>
    </div>
  );
}