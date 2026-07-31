import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "what", label: "What We Collect" },
  { id: "how-collected", label: "How It's Collected" },
  { id: "how-used", label: "How It's Used" },
  { id: "exposure", label: "Public Exposure" },
  { id: "retention", label: "Data Retention" },
  { id: "opting-out", label: "Opting Out" },
];

function DataList({ items }) {
  return (
    <div className="border border-[#181818] rounded-md overflow-hidden mb-5">
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex items-start gap-2.5 px-3.5 py-2 text-[13px] text-[#888] ${
            i < items.length - 1 ? "border-b border-[#141414]" : ""
          }`}
        >
          <span className="text-[#333] mt-1.5 shrink-0 text-[6px]">●</span>
          <span className="leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  );
}

export default function Privacy() {
  const [active, setActive] = useState("overview");
  const mainRef = useRef(null);

  useEffect(() => {
    function updateActive() {
        let current = "overview";
        for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= 120) current = s.id;
        }
        }
        setActive(current);
    }

    window.addEventListener("scroll", updateActive, { passive: true });
    updateActive();

    return () => window.removeEventListener("scroll", updateActive);
    }, []);

  return (
    <div className="flex max-w-6xl mx-auto min-h-[calc(100vh-3.5rem)]">
      <aside className="w-48 shrink-0 border-r border-[#181818] sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-6 px-3 max-lg:hidden">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#444] mb-2.5 px-2">
          Privacy
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
                  layoutId="priv-pill"
                  className="absolute inset-0 bg-[#161616] rounded-md"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{s.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <main ref={mainRef} className="flex-1 max-w-3xl px-8 py-8 max-lg:px-5">
        <div className="mb-10">
          <h1 id="overview" className="text-xl font-bold tracking-tight mb-1 scroll-mt-20">
            Privacy Policy
          </h1>
          <p className="text-[11px] text-[#555]">Last updated — July 31, 2026</p>
        </div>

        <p className="text-[13px] text-[#888] leading-relaxed mb-8">
          Beacon is a presence API for DisTalk. By being in a server where Beacon is active, your
          visible DisTalk presence data may be collected, cached, and exposed through the API.
        </p>

        <section className="mb-8">
          <h2 id="what" className="text-[14px] font-semibold mb-3 scroll-mt-20">What We Collect</h2>
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

        <section className="mb-8">
          <h2 id="how-collected" className="text-[14px] font-semibold mb-2 scroll-mt-20">How It's Collected</h2>
          <p className="text-[13px] text-[#888] leading-relaxed">
            Beacon collects data through a connected account that shares a server with you. Only
            users visible to that account are tracked. No private messages or DMs are accessed.
          </p>
        </section>

        <section className="mb-8">
          <h2 id="how-used" className="text-[14px] font-semibold mb-3 scroll-mt-20">How It's Used</h2>
          <DataList
            items={[
              "To provide real-time presence through the REST API and WebSocket",
              "To support bot commands like /status and /profile",
              "To store optional user-defined KV data",
            ]}
          />
        </section>

        <section className="mb-8">
          <h2 id="exposure" className="text-[14px] font-semibold mb-2 scroll-mt-20">Public Exposure</h2>
          <p className="text-[13px] text-[#888] leading-relaxed">
            Data tracked by Beacon is publicly accessible through API endpoints. Anyone can query
            your presence status, badges, and profile data. Do not join a Beacon-tracked server if
            you do not want this data exposed.
          </p>
        </section>

        <section className="mb-8">
          <h2 id="retention" className="text-[14px] font-semibold mb-2 scroll-mt-20">Data Retention</h2>
          <p className="text-[13px] text-[#888] leading-relaxed">
            Presence data is held in memory and clears on restart. KV data and notes may persist to
            disk. If you leave the tracked server, your presence will no longer be updated but cached
            data may remain until the next restart.
          </p>
        </section>

        <section className="mb-8">
          <h2 id="opting-out" className="text-[14px] font-semibold mb-2 scroll-mt-20">Opting Out</h2>
          <p className="text-[13px] text-[#888] leading-relaxed">
            Leave the Beacon-tracked server. To request immediate removal of cached data, reach out
            through the DisTalk support server.
          </p>
        </section>

        <footer className="pt-6 pb-4 border-t border-[#181818] text-[10px] text-[#333]">
          Beacon · DisTalk Presence API
        </footer>
      </main>
    </div>
  );
}