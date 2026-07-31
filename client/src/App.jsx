import { Routes, Route, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Home from "./pages/Home";
import Docs from "./pages/Docs";
import Privacy from "./pages/Privacy";
import { cn } from "./lib/utils";

function BeaconIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path
        fill="currentColor"
        d="M8 10V8h1V4H8V3l4-2l4 2v1h-1v4h1v2h-1.26l-6.3 3.64L9 10zm5-2V4h-2v4zM7 23l.04-.24l9.11-5.26l.52 3.38L13 23zm1.05-6.83L15.31 12l.52 3.37l-8.4 4.85z"
      />
    </svg>
  );
}

const NAV = [
  { path: "/home", label: "Home" },
  { path: "/docs", label: "Docs" },
  { path: "/privacy", label: "Privacy" },
];

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50">
        <nav className="flex items-center gap-1 px-1.5 py-1 bg-[#111]/90 backdrop-blur-md border border-[#222] rounded-lg shadow-lg shadow-black/20">
          <Link to="/home" className="flex items-center gap-1.5 pl-2 pr-1 group">
            <BeaconIcon className="h-3.5 w-3.5 text-orange-500 transition-transform duration-200 group-hover:scale-110" />
            <span className="text-[13px] font-semibold text-foreground pr-2 border-r border-[#222]">
              Beacon
            </span>
          </Link>
          {NAV.map((n) => (
            <Link
              key={n.path}
              to={n.path}
              className={cn(
                "relative px-2.5 py-1 text-[12px] font-medium rounded transition-colors duration-100",
                location.pathname === n.path
                  ? "text-foreground"
                  : "text-[#666] hover:text-[#999]"
              )}
            >
              {location.pathname === n.path && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-[#1a1a1a] rounded"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{n.label}</span>
            </Link>
          ))}
          <a
            href="/"
            className="px-2.5 py-1 text-[12px] font-medium text-[#666] hover:text-[#999] rounded transition-colors duration-100"
          >
            API
          </a>
        </nav>
      </div>

      <div className="pt-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
          >
            <Routes location={location}>
              <Route path="/home" element={<Home />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}