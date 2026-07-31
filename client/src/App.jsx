import { Routes, Route, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Home from "./pages/Home";
import Docs from "./pages/Docs";
import Privacy from "./pages/Privacy";
import { cn } from "./lib/utils";

const NAV = [
  { path: "/home", label: "Home" },
  { path: "/docs", label: "Docs" },
  { path: "/privacy", label: "Privacy" },
];

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

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <Link
            to="/home"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight group"
          >
            <BeaconIcon className="h-4 w-4 text-violet-400 transition-transform group-hover:scale-110" />
            Beacon
          </Link>
          <div className="flex items-center gap-0.5">
            {NAV.map((n) => (
              <Link
                key={n.path}
                to={n.path}
                className={cn(
                  "relative px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200",
                  location.pathname === n.path
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {location.pathname === n.path && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 bg-secondary rounded-md"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{n.label}</span>
              </Link>
            ))}
            <a
              href="/"
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors duration-200 ml-1"
            >
              API
            </a>
          </div>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2, ease: "easeOut" }}
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
  );
}