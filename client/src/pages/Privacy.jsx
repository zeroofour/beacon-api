import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "what", label: "What We Collect" },
  { id: "how-collected", label: "How It's Collected" },
  { id: "how-used", label: "How It's Used" },
  { id: "exposure", label: "Public Exposure" },
  { id: "retention", label: "Data Retention" },
  { id: "opting-out", label: "Opting Out" },
  { id: "third-party", label: "Third-Party" },
  { id: "changes", label: "Changes" },
  { id: "contact", label: "Contact" },
];

function DataList({ items }) {
  return (
    <Card className="mb-4">
      <CardContent className="p-0">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 px-4 py-3 text-sm text-muted-foreground ${
              i < items.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span className="text-muted-foreground/40 mt-1.5 shrink-0">·</span>
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Privacy() {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
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
    <div className="flex max-w-6xl mx-auto">
      <aside className="w-56 shrink-0 border-r border-border sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 px-4 max-lg:hidden">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-2">Sections</p>
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`relative block px-2 py-1 text-sm rounded-md transition-all duration-200 ${
                active === s.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active === s.id && (
                <motion.div
                  layoutId="privacy-active"
                  className="absolute inset-0 bg-muted rounded-md"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{s.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <main className="flex-1 max-w-3xl px-8 py-12 max-lg:px-6">
        <h1 id="overview" className="text-3xl font-bold tracking-tight mb-2 scroll-mt-20">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-12">Last updated — July 31, 2026</p>

        <p className="text-sm text-muted-foreground mb-8">
          Beacon is a presence API for DisTalk. By being in a server where Beacon is active, your visible DisTalk presence data may be collected, cached, and exposed through the API.
        </p>

        <h2 id="what" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">What We Collect</h2>
        <DataList
          items={[
            "User ID, username, and display name",
            "Avatar and banner URLs",
            "Presence status (online, idle, dnd, offline)",
            "Mobile device state",
            "Custom status text and emoji",
            "Activity and now playing information",
            "Spotify connection and track info",
            "Public profile data (badges, bio, socials, server tag)",
            "KV data explicitly set through Beacon",
          ]}
        />

        <h2 id="how-collected" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">How It's Collected</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Beacon collects data through a connected account that shares a server with you. Only users visible to that account are tracked. No private messages or DMs are accessed.
        </p>

        <h2 id="how-used" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">How It's Used</h2>
        <DataList
          items={[
            "To provide real-time presence through the REST API and WebSocket",
            "To support bot commands like /status and /profile",
            "To store optional user-defined KV data",
          ]}
        />

        <h2 id="exposure" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Public Exposure</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Data tracked by Beacon is publicly accessible through API endpoints. Anyone can query your presence status, badges, and profile data. Do not join a Beacon-tracked server if you do not want this data exposed.
        </p>

        <h2 id="retention" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Data Retention</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Presence data is held in memory and clears on restart. KV data and notes may persist to disk. If you leave the tracked server, your presence will no longer be updated but cached data may remain until the next restart.
        </p>

        <h2 id="opting-out" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Opting Out</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Leave the Beacon-tracked server. To request immediate removal of cached data, reach out through the DisTalk support server.
        </p>

        <h2 id="third-party" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Third-Party Services</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Beacon runs on Railway. Standard access logging may apply. No data is sold or shared with third parties.
        </p>

        <h2 id="changes" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Changes</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This policy may be updated at any time. Changes will be reflected on this page with an updated date.
        </p>

        <h2 id="contact" className="text-lg font-semibold mb-3 pt-8 border-t border-border mt-8 scroll-mt-20">Contact</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Join the Beacon support server on DisTalk for questions or data removal requests.
        </p>
      </main>
    </div>
  );
}