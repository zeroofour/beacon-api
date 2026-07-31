import { useState, useEffect } from "react";
import { motion } from "framer-motion";

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
    <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden mb-6">
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 px-4 py-2.5 text-[13px] text-muted-foreground/80 ${
            i < items.length - 1 ? "border-b border-border/20" : ""
          }`}
        >
          <span className="text-muted-foreground/30 mt-1 shrink-0 text-[8px]">
            ●
          </span>
          <span className="leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  );
}

export default function Privacy() {
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
          Sections
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
                  layoutId="privacy-pill"
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
            Privacy Policy
          </h1>
          <p className="text-[12px] text-muted-foreground/50">
            Last updated — July 31, 2026
          </p>
        </div>

        <p className="text-[14px] text-muted-foreground/80 leading-relaxed mb-10">
          Beacon is a presence API for DisTalk. By being in a server where
          Beacon is active, your visible DisTalk presence data may be collected,
          cached, and exposed through the API.
        </p>

        <section className="mb-10">
          <h2
            id="what"
            className="text-[15px] font-semibold mb-4 scroll-mt-16"
          >
            What We Collect
          </h2>
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
        </section>

        <section className="mb-10">
          <h2
            id="how-collected"
            className="text-[15px] font-semibold mb-3 scroll-mt-16"
          >
            How It's Collected
          </h2>
          <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
            Beacon collects data through a connected account that shares a server
            with you. Only users visible to that account are tracked. No private
            messages or DMs are accessed.
          </p>
        </section>

        <section className="mb-10">
          <h2
            id="how-used"
            className="text-[15px] font-semibold mb-4 scroll-mt-16"
          >
            How It's Used
          </h2>
          <DataList
            items={[
              "To provide real-time presence through the REST API and WebSocket",
              "To support bot commands like /status and /profile",
              "To store optional user-defined KV data",
            ]}
          />
        </section>

        <section className="mb-10">
          <h2
            id="exposure"
            className="text-[15px] font-semibold mb-3 scroll-mt-16"
          >
            Public Exposure
          </h2>
          <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
            Data tracked by Beacon is publicly accessible through API endpoints.
            Anyone can query your presence status, badges, and profile data. Do
            not join a Beacon-tracked server if you do not want this data
            exposed.
          </p>
        </section>

        <section className="mb-10">
          <h2
            id="retention"
            className="text-[15px] font-semibold mb-3 scroll-mt-16"
          >
            Data Retention
          </h2>
          <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
            Presence data is held in memory and clears on restart. KV data and
            notes may persist to disk. If you leave the tracked server, your
            presence will no longer be updated but cached data may remain until
            the next restart.
          </p>
        </section>

        <section className="mb-10">
          <h2
            id="opting-out"
            className="text-[15px] font-semibold mb-3 scroll-mt-16"
          >
            Opting Out
          </h2>
          <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
            Leave the Beacon-tracked server. To request immediate removal of
            cached data, reach out through the DisTalk support server.
          </p>
        </section>

        <section className="mb-10">
          <h2
            id="third-party"
            className="text-[15px] font-semibold mb-3 scroll-mt-16"
          >
            Third-Party Services
          </h2>
          <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
            Beacon runs on Railway. Standard access logging may apply. No data is
            sold or shared with third parties.
          </p>
        </section>

        <section className="mb-10">
          <h2
            id="changes"
            className="text-[15px] font-semibold mb-3 scroll-mt-16"
          >
            Changes
          </h2>
          <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
            This policy may be updated at any time. Changes will be reflected on
            this page with an updated date.
          </p>
        </section>

        <section className="mb-10">
          <h2
            id="contact"
            className="text-[15px] font-semibold mb-3 scroll-mt-16"
          >
            Contact
          </h2>
          <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
            Join the Beacon support server on DisTalk for questions or data
            removal requests.
          </p>
        </section>

        <footer className="pt-8 pb-4 border-t border-border/30 text-[11px] text-muted-foreground/30">
          Beacon · DisTalk Presence API
        </footer>
      </main>
    </div>
  );
}