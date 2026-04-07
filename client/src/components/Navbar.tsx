import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X, Search } from "lucide-react";

export default function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/marketplace", label: "Claws" },
    { href: "/marketplace?tab=plugins", label: "Plugins" },
    { href: "/marketplace?tab=search", label: "Search" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: "#000", borderBottom: "1px solid #1a1a1a" }}
    >
      <div className="container flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2.5 cursor-pointer">
            <div
              className="w-7 h-7 flex items-center justify-center"
              style={{ background: "#DDEA4D" }}
            >
              <span className="font-display text-black text-xs font-black">G</span>
            </div>
            <span className="font-display text-white font-bold text-sm tracking-tight">
              GMI <span style={{ color: "#DDEA4D" }}>Claw</span>
            </span>
          </div>
        </Link>

        {/* Desktop nav — centered */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <span
                className="text-sm font-medium transition-colors cursor-pointer"
                style={{
                  color: location === link.href || (link.href === "/marketplace" && location === "/marketplace")
                    ? "#DDEA4D"
                    : "#888",
                }}
                onMouseEnter={(e) => { if ((e.target as HTMLElement).style.color !== "#DDEA4D") (e.target as HTMLElement).style.color = "#fff"; }}
                onMouseLeave={(e) => {
                  const isActive = location === link.href;
                  (e.target as HTMLElement).style.color = isActive ? "#DDEA4D" : "#888";
                }}
              >
                {link.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Right: search icon + auth */}
        <div className="hidden md:flex items-center gap-3">
          <button
            className="text-gray-500 hover:text-white transition-colors p-1"
            onClick={() => {}}
          >
            <Search size={15} />
          </button>
          <button
            className="text-sm font-medium px-4 py-1.5 transition-colors"
            style={{ color: "#888", border: "1px solid #2a2a2a" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#444"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a"; (e.currentTarget as HTMLButtonElement).style.color = "#888"; }}
          >
            Sign in
          </button>
          <Link href="/marketplace">
            <button
              className="text-sm font-bold px-4 py-1.5"
              style={{ background: "#DDEA4D", color: "#000" }}
            >
              Publish Claw
            </button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden transition-colors"
          style={{ color: "#888" }}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden px-6 py-4 space-y-4"
          style={{ background: "#000", borderTop: "1px solid #1a1a1a" }}
        >
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div
                className="text-sm py-2 cursor-pointer transition-colors"
                style={{ color: location === link.href ? "#DDEA4D" : "#888" }}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </div>
            </Link>
          ))}
          <div className="pt-2 flex gap-3">
            <button
              className="text-xs px-4 py-2 flex-1"
              style={{ border: "1px solid #2a2a2a", color: "#888" }}
            >
              Sign In
            </button>
            <button
              className="text-xs px-4 py-2 flex-1 font-bold"
              style={{ background: "#DDEA4D", color: "#000" }}
            >
              Publish Claw
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
