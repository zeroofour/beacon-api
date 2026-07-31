import { Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Docs from "./pages/Docs";
import Privacy from "./pages/Privacy";
import { cn } from "./lib/utils";

const NAV = [
  { path: "/home", label: "Home" },
  { path: "/docs", label: "Docs" },
  { path: "/privacy", label: "Privacy" },
];

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <Link to="/home" className="text-sm font-semibold tracking-tight">
            Beacon
          </Link>
          <div className="flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.path}
                to={n.path}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  location.pathname === n.path
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {n.label}
              </Link>
            ))}
            <a
              href="/"
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors"
            >
              API
            </a>
          </div>
        </div>
      </nav>

      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}