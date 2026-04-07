import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-black/90 backdrop-blur-sm">
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="w-7 h-7 bg-lime flex items-center justify-center">
              <span className="font-display text-black text-xs font-black">G</span>
            </div>
            <span className="font-display text-white font-bold text-base tracking-tight">
              GMI <span className="text-lime">Claw</span>
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <span
                className={`text-sm font-medium transition-colors cursor-pointer ${
                  location === link.href ? "text-lime" : "text-gray-400 hover:text-white"
                }`}
              >
                {link.label}
              </span>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button className="btn-outline-dashed text-xs px-4 py-2">Sign In</button>
          <Link href="/marketplace">
            <button className="btn-primary-lime text-xs px-4 py-2">Get Started</button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-gray-400 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-black border-t border-gray-800 px-6 py-4 space-y-4">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div
                className="text-sm text-gray-300 hover:text-lime py-2 cursor-pointer"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </div>
            </Link>
          ))}
          <div className="pt-2 flex gap-3">
            <button className="btn-outline-dashed text-xs px-4 py-2 flex-1">Sign In</button>
            <button className="btn-primary-lime text-xs px-4 py-2 flex-1">Get Started</button>
          </div>
        </div>
      )}
    </nav>
  );
}
