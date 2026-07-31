import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchUsers, fetchUser, connectWebSocket } from "../lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  User,
  Smartphone,
  Music,
  X,
  ChevronDown,
  Terminal,
  ArrowUpRight,
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

const SORT_OPTIONS = [
  { value: "status", label: "Status" },
  { value: "name", label: "Name" },
  { value: "role", label: "Role" },
];

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-muted/40 ${className}`} />;
}

export default function Home() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("status");
  const [sortOpen, setSortOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const initialized = useRef(false);
  const sortRef = useRef(null);
  const logEndRef = useRef(null);

  const addEvent = useCallback((type, data) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setEvents((prev) => [{ time, type, data }, ...prev].slice(0, 100));
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
        addEvent(msg.connected ? "CONNECTED" : "DISCONNECTED", "");
        return;
      }
      if (msg.type === "hello") {
        setUsers((prev) => {
          const ids = prev.map((u) => u.id);
          if (ids.length) socket.subscribe(ids);
          return prev;
        });
        return;
      }
      if (msg.type === "init") {
        addEvent("INIT", msg.data?.display_name || msg.data?.id);
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
        addEvent("UPDATE", `${d.display_name || d.id} → ${d.presence?.status}`);
      }
    });

    return () => socket.close();
  }, [addEvent]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      if (sort === "name") {
        return (a.display_name || a.username || "").localeCompare(
          b.display_name || b.username || ""
        );
      }
      if (sort === "role") {
        return (a.platform_role || "").localeCompare(b.platform_role || "");
      }
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

  const FILTERS = [
    { key: "all", label: "All", count: counts.total },
    { key: "online", label: "Online", count: counts.online },
    { key: "idle", label: "Idle", count: counts.idle },
    { key: "dnd", label: "DND", count: counts.dnd },
    { key: "offline", label: "Offline", count: counts.total - counts.online - counts.idle - counts.dnd },
  ];

  return (
    <div className="max-w-6xl mx-auto flex gap-0 min-h-[calc(100vh-3rem)]">
      <div className="flex-1 max-w-4xl border-r border-border/30 px-6 py-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full h-10 bg-transparent border border-border/40 rounded-xl pl-10 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/70 transition-colors duration-150"
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors duration-150 ${
                  filter === f.key
                    ? "text-foreground"
                    : "text-muted-foreground/60 hover:text-muted-foreground"
                }`}
              >
                {filter === f.key && (
                  <motion.div
                    layoutId="home-filter"
                    className="absolute inset-0 bg-muted/50 rounded-lg border border-border/30"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{f.label}</span>
                <span className="relative z-10 text-[10px] tabular-nums opacity-60">
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-muted-foreground/60 hover:text-muted-foreground rounded-lg border border-border/30 transition-colors duration-150"
            >
              Sort: {SORT_OPTIONS.find((s) => s.value === sort)?.label}
              <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${sortOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {sortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 top-full mt-1 bg-card border border-border/40 rounded-lg shadow-lg overflow-hidden z-50 min-w-[120px]"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSort(opt.value);
                        setSortOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-100 ${
                        sort === opt.value
                          ? "text-foreground bg-muted/40"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="rounded-xl border border-border/30 overflow-hidden">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/20 last:border-0">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2.5 w-40" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground/40">
              <User className="h-5 w-5 mx-auto mb-2 opacity-40" />
              <p className="text-[12px]">No users found</p>
            </div>
          ) : (
            <div>
              {filtered.map((u, i) => {
                const status = u.presence?.status || "offline";
                const initial = (u.display_name || u.username || "?")[0].toUpperCase();
                const platformBadges = (u.badges || [])
                  .filter((b) => typeof b === "object")
                  .map((b) => b.name);
                const isSelected = selected?.id === u.id;

                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.2) }}
                    onClick={() => setSelected(isSelected ? null : u)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-100 border-b border-border/15 last:border-0 ${
                      isSelected ? "bg-muted/40" : "hover:bg-muted/20"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="h-8 w-8 rounded-full bg-muted/40 flex items-center justify-center text-[11px] font-semibold text-muted-foreground overflow-hidden">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initial
                        )}
                      </div>
                      <div className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-[1.5px] border-background ${STATUS_BG[status]}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium truncate">
                          {u.display_name || u.username}
                        </span>
                        {platformBadges.map((name) => (
                          <span
                            key={name}
                            className="text-[9px] font-semibold uppercase tracking-wider px-1 py-px rounded bg-muted/60 text-muted-foreground/60 shrink-0"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground/50 truncate leading-tight">
                        {u.presence?.custom_status?.text || u.bio || `@${u.username}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 max-sm:hidden">
                      {u.presence?.is_mobile && (
                        <Smartphone className="h-3 w-3 text-muted-foreground/30" />
                      )}
                      {u.spotify?.now_playing && (
                        <span className="flex items-center gap-1 text-[10px] text-green-500/70 bg-green-500/5 px-1.5 py-0.5 rounded-full max-w-[140px] truncate">
                          <Music className="h-2.5 w-2.5 shrink-0" />
                          {u.spotify.now_playing}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground/30 px-1">
          <span>{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
          <button
            onClick={() => setShowLog(!showLog)}
            className="flex items-center gap-1 hover:text-muted-foreground/50 transition-colors duration-100"
          >
            <Terminal className="h-3 w-3" />
            {showLog ? "Hide" : "Show"} log
          </button>
        </div>

        <AnimatePresence>
          {showLog && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-xl border border-border/30 overflow-hidden">
                <div className="px-4 py-2 border-b border-border/20 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground/50">WebSocket Log</span>
                  <span className="text-[10px] text-muted-foreground/30 tabular-nums">{events.length}</span>
                </div>
                <div className="max-h-[200px] overflow-y-auto p-3">
                  {events.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/30 text-center py-4">
                      No events yet
                    </p>
                  ) : (
                    <div className="space-y-px">
                      {events.map((e, i) => (
                        <motion.div
                          key={`${e.time}-${i}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-baseline gap-2 text-[10px] font-mono py-px"
                        >
                          <span className="text-muted-foreground/25 shrink-0">{e.time}</span>
                          <span className="text-violet-400/50 shrink-0">{e.type}</span>
                          <span className="text-muted-foreground/35 truncate">{e.data}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-[380px] max-xl:hidden sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="p-5"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center text-lg font-semibold text-muted-foreground overflow-hidden shrink-0">
                    {selected.avatar_url ? (
                      <img src={selected.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (selected.display_name || "?")[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-semibold">
                        {selected.display_name || selected.username}
                      </h3>
                      <span className={`text-[11px] font-medium capitalize ${STATUS_TEXT[selected.presence?.status] || ""}`}>
                        {selected.presence?.status || "offline"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/50 font-mono">
                      @{selected.username}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30 transition-colors duration-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Role" value={selected.platform_role || "user"} />
                  <Field label="Mobile" value={selected.presence?.is_mobile ? "Yes" : "No"} />
                </div>

                {selected.bio && <Field label="Bio" value={selected.bio} />}

                {selected.presence?.custom_status?.text && (
                  <Field label="Custom Status" value={selected.presence.custom_status.text} />
                )}

                {selected.spotify?.now_playing && (
                  <div className="rounded-lg border border-green-500/10 bg-green-500/5 p-3">
                    <p className="text-[10px] font-medium text-green-500/50 uppercase tracking-wider mb-1">
                      Listening to
                    </p>
                    <p className="text-[12px] text-green-400/80">{selected.spotify.now_playing}</p>
                  </div>
                )}

                {allBadges.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider mb-2">
                      Badges
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {allBadges.map((b, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-muted/30 border border-border/20 px-1.5 py-0.5 rounded-md text-muted-foreground/60"
                        >
                          {typeof b === "string" ? b : b.icon ? `${b.icon} ${b.name}` : b.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider mb-1.5">
                    API
                  </p>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/40">
                    <code className="truncate select-all flex-1">
                      /v1/users/{selected.id}
                    </code>
                    <a
                      href={`${window.location.origin}/v1/users/${selected.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1 rounded hover:bg-muted/30 transition-colors duration-100"
                    >
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider mb-1.5">
                    ID
                  </p>
                  <code className="text-[11px] font-mono text-muted-foreground/40 select-all">
                    {selected.id}
                  </code>
                </div>

                <details className="group">
                  <summary className="text-[10px] font-medium text-muted-foreground/30 uppercase tracking-wider cursor-pointer hover:text-muted-foreground/50 transition-colors duration-100 list-none flex items-center gap-1">
                    <ChevronDown className="h-3 w-3 transition-transform duration-150 group-open:rotate-180" />
                    Raw JSON
                  </summary>
                  <pre className="mt-2 bg-muted/20 border border-border/20 rounded-lg p-3 text-[10px] font-mono text-muted-foreground/40 overflow-x-auto max-h-[300px] overflow-y-auto leading-relaxed">
                    {JSON.stringify(selected, null, 2)}
                  </pre>
                </details>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-full text-muted-foreground/20"
            >
              <div className="text-center">
                <User className="h-5 w-5 mx-auto mb-2 opacity-40" />
                <p className="text-[12px]">Select a user</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-[12px] text-muted-foreground/70 leading-relaxed">{value}</p>
    </div>
  );
}