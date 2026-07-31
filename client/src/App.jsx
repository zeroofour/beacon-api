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

const pageTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.15, ease: "easeOut" },
};

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/60 sticky top-0 z-50 bg-background/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-12">
          <Link to="/home" className="flex items-center gap-2 group">
            <BeaconIcon className="h-[18px] w-[18px] text-foreground/80 transition-all duration-200 group-hover:text-violet-400 group-hover:scale-105" />
            <span className="text-[13px] font-semibold tracking-tight">Beacon</span>
          </Link>
          <div className="flex items-center gap-0.5">
            {NAV.map((n) => (
              <Link
                key={n.path}
                to={n.path}
                className={cn(
                  "relative px-3 py-1 text-[13px] font-medium rounded-md transition-colors duration-150",
                  location.pathname === n.path
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {location.pathname === n.path && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-muted/80 rounded-md"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{n.label}</span>
              </Link>
            ))}
            <div className="w-px h-4 bg-border/60 mx-2" />
            <a
              href="/"
              className="px-3 py-1 text-[13px] font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors duration-150"
            >
              API
            </a>
          </div>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={location.pathname} {...pageTransition}>
          <Routes location={location}>
            <Route path="/home" element={<Home />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}