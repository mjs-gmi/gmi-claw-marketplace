import { Link, useLocation } from "wouter";
import { LayoutGrid, TerminalSquare, Rocket, Home, Search, ListPlus } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/marketplace", label: "Marketplace", icon: LayoutGrid },
  { href: "/dashboard", label: "Dashboard", icon: TerminalSquare },
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
        {/* Logo — official GMI Cloud SVG */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #1a1a1a" }}>
          <Link href="/">
            <div className="cursor-pointer flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 200 56"
                aria-label="GMI Cloud"
                style={{ width: "120px", height: "auto" }}
              >
                <path fill="#fff" d="M54.98 22.138a17.4 17.4 0 0 0-6.377-1.237 17.04 17.04 0 0 0-15.304 9.54c-.91 1.858-1.37 3.899-2.203 5.793-1.226 2.804-2.848 5.213-4.73 7.04a16 16 0 0 1-1.852 1.536c-1.862 1.292-4.223 2.206-6.515 2.206-4.89 0-9.041-4.103-9.041-9.05a9.03 9.03 0 0 1 4.072-7.551c2.424-1.594 5.793-1.92 8.456-.796a13.57 13.57 0 0 1-1.875-6.91c0-.585.036-1.153.118-1.715.706-5.727 4.97-10.365 10.5-11.638a13.3 13.3 0 0 1 3.07-.351c2.204 0 4.276.519 6.122 1.453a13.6 13.6 0 0 1 5.24 4.625l6.635-4.454A21.7 21.7 0 0 0 45.9 5.053 21.4 21.4 0 0 0 34.3 1.03c-.328-.023-.663-.03-.998-.03-3.027 0-5.917.621-8.538 1.752-7.56 3.251-12.916 10.694-13.136 19.386a17.07 17.07 0 0 0-8.66 7.8A16.94 16.94 0 0 0 .96 37.966c0 8.81 6.67 16.055 15.222 16.96.059.006.124.012.183.012q.34.036.68.053c.043.007.08.007.119.007q.412.021.84.023c.286 0 .562-.007.84-.023.037 0 .073 0 .12-.007a10 10 0 0 0 .679-.053q.097-.001.184-.013c2.89-.286 5.632-1.262 8.134-2.81 2.227-1.368 4.253-3.186 6.043-5.355a25 25 0 0 0 1.823-2.482c2.584-4.07 2.959-5.852 4.174-9.093 1.556-4.155 4.818-6.266 8.61-6.266 1.731 0 3.538.543 4.976 1.5a9.06 9.06 0 0 1 4.066 7.55c0 4.99-4.056 9.05-9.041 9.05-1.6 0-3.1-.417-4.408-1.154a39 39 0 0 1-3.1 4.813c-.466.621-.955 1.22-1.451 1.798a16.9 16.9 0 0 0 8.962 2.548c9.406 0 17.038-7.633 17.038-17.055 0-7.166-4.414-13.3-10.66-15.828zM139.205 5.535h-8.4v44.958h8.4zM199.487 5.535h-8.401v44.958h8.401z" />
                <path fill="#fff" d="M145.533 5.535h-8.4l10.318 44.958h8.404zM180.776 5.535h-8.401v44.958h8.401z" />
                <path fill="#fff" d="M164.252 50.493h-8.4L166.17 5.535h8.401zM122.107 27.21v7.93l-.059.076h-24.22V27.21h24.282z" />
                <path fill="#fff" d="M122.113 35.218V45.67c-5.097 3.61-11.609 5.796-18.355 5.796-17.398 0-28.531-10.55-28.531-23.564S85.296 4.34 103.758 4.34c6.572 0 13.16 2.255 18.355 5.97v10.466c-3.816-4.809-11.038-8.431-18.355-8.431-12.843 0-20.614 6.11-20.614 15.558s8.362 15.56 20.614 15.56c7.386 0 14.5-3.495 18.293-8.245h.062" />
              </svg>
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
          <Link href="/deploy">
            <button
              className="w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5"
              style={{ background: "#DDEA4D", color: "#000" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#eef566"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#DDEA4D"; }}
            >
              <Rocket size={12} />
              Deploy a Claw
            </button>
          </Link>
          <Link href="/list-claw">
            <button
              className="w-full text-xs font-medium py-2 flex items-center justify-center gap-1.5 transition-colors"
              style={{ border: "1px solid #2a2a2a", color: "#888" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#DDEA4D";
                (e.currentTarget as HTMLButtonElement).style.color = "#DDEA4D";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a";
                (e.currentTarget as HTMLButtonElement).style.color = "#888";
              }}
            >
              <ListPlus size={12} />
              List a Claw
            </button>
          </Link>
        </div>
      </aside>

    </>
  );
}
