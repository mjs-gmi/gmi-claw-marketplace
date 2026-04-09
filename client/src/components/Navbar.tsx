import { Link, useLocation } from "wouter";
import { LayoutGrid, TerminalSquare, PlusSquare, Home, Search } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/marketplace", label: "Marketplace", icon: LayoutGrid },
  { href: "/dashboard", label: "Dev Console", icon: TerminalSquare },
  { href: "/list-claw", label: "List a Claw", icon: PlusSquare },
];

export default function Navbar() {
  const [location] = useLocation();

  return (
    <>
      {/* ── Left sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className="fixed top-0 left-0 h-screen z-50 flex flex-col"
        style={{
          width: "220px",
          background: "#000",
          borderRight: "1px solid #1a1a1a",
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: "1px solid #1a1a1a" }}>
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div
                className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                style={{ background: "#DDEA4D" }}
              >
                <span className="font-display text-black text-xs font-black">G</span>
              </div>
              <span className="font-display text-white font-bold text-sm tracking-tight">
                GMI <span style={{ color: "#DDEA4D" }}>Claw</span>
              </span>
            </div>
          </Link>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3" style={{ borderBottom: "1px solid #1a1a1a" }}>
          <div
            className="flex items-center gap-2 px-3 py-2 text-xs"
            style={{
              background: "#0d0d0d",
              border: "1px solid #222",
              color: "#555",
            }}
          >
            <Search size={12} />
            <span>Search Claws…</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = location === href || (href !== "/" && location.startsWith(href));
            return (
              <Link key={href} href={href}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-all"
                  style={{
                    color: isActive ? "#DDEA4D" : "#666",
                    background: isActive ? "rgba(221,234,77,0.07)" : "transparent",
                    borderLeft: isActive ? "2px solid #DDEA4D" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLDivElement).style.color = "#fff";
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLDivElement).style.color = "#666";
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }
                  }}
                >
                  <Icon size={15} />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: auth buttons */}
        <div className="px-4 pb-5 space-y-2" style={{ borderTop: "1px solid #1a1a1a", paddingTop: "1rem" }}>
          <button
            className="w-full text-xs font-medium py-2 transition-colors"
            style={{ border: "1px solid #2a2a2a", color: "#888" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#444";
              (e.currentTarget as HTMLButtonElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a";
              (e.currentTarget as HTMLButtonElement).style.color = "#888";
            }}
          >
            Sign In
          </button>
          <Link href="/list-claw">
            <button
              className="w-full text-xs font-bold py-2"
              style={{ background: "#DDEA4D", color: "#000" }}
            >
              + List a Claw
            </button>
          </Link>
        </div>
      </aside>

      {/* Spacer so page content doesn't hide behind sidebar */}
      <div style={{ marginLeft: "220px" }} />
    </>
  );
}
