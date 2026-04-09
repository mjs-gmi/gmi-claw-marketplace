import { Link, useLocation } from "wouter";

/* ── Inline SVG pixelart icons from iconify pixelarticons set ── */
const PixelHomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3L2 12h3v9h6v-5h2v5h6v-9h3L12 3zm0 2.5l7 6.3V20h-4v-5H9v5H5v-8.2L12 5.5z"/>
  </svg>
);
const PixelGridIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/>
  </svg>
);
const PixelTerminalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 3h20v18H2V3zm2 2v14h16V5H4zm2 2l4 3-4 3v-2l2-1-2-1V7zm5 6h6v2h-6v-2z"/>
  </svg>
);
const PixelSearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 2a8 8 0 1 0 4.906 14.32l4.387 4.387 1.414-1.414-4.387-4.387A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12A6 6 0 0 1 10 4z"/>
  </svg>
);
const PixelRocketIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8 2 4 6 4 10c0 2 1 4 2 5l-2 5 5-2c1 1 3 2 3 2s2-1 3-2l5 2-2-5c1-1 2-3 2-5 0-4-4-8-8-8zm0 2c3 0 6 3 6 6 0 1.5-.5 3-1.5 4L12 16l-4.5-2C6.5 13 6 11.5 6 10c0-3 3-6 6-6zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
  </svg>
);
const PixelListIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 5h2v2H3V5zm4 0h14v2H7V5zM3 11h2v2H3v-2zm4 0h14v2H7v-2zM3 17h2v2H3v-2zm4 0h14v2H7v-2z"/>
  </svg>
);

const navLinks = [
  { href: "/", label: "Home", Icon: PixelHomeIcon },
  { href: "/marketplace", label: "Marketplace", Icon: PixelGridIcon },
  { href: "/dashboard", label: "Dashboard", Icon: PixelTerminalIcon },
];

export default function Navbar() {
  const [location] = useLocation();

  return (
    <aside
      className="fixed top-0 left-0 h-screen z-50 flex flex-col"
      style={{
        width: "220px",
        background: "#000000",
        borderRight: "1px solid #222222",
        fontFamily: "'GeistMono', monospace",
      }}
    >
      {/* ── Logo row ── */}
      <div
        className="px-4 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid #222222", minHeight: "56px" }}
      >
        <Link href="/">
          <div className="cursor-pointer flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 200 56"
              aria-label="GMI"
              style={{ width: "100px", height: "auto" }}
            >
              <path fill="#fff" d="M54.98 22.138a17.4 17.4 0 0 0-6.377-1.237 17.04 17.04 0 0 0-15.304 9.54c-.91 1.858-1.37 3.899-2.203 5.793-1.226 2.804-2.848 5.213-4.73 7.04a16 16 0 0 1-1.852 1.536c-1.862 1.292-4.223 2.206-6.515 2.206-4.89 0-9.041-4.103-9.041-9.05a9.03 9.03 0 0 1 4.072-7.551c2.424-1.594 5.793-1.92 8.456-.796a13.57 13.57 0 0 1-1.875-6.91c0-.585.036-1.153.118-1.715.706-5.727 4.97-10.365 10.5-11.638a13.3 13.3 0 0 1 3.07-.351c2.204 0 4.276.519 6.122 1.453a13.6 13.6 0 0 1 5.24 4.625l6.635-4.454A21.7 21.7 0 0 0 45.9 5.053 21.4 21.4 0 0 0 34.3 1.03c-.328-.023-.663-.03-.998-.03-3.027 0-5.917.621-8.538 1.752-7.56 3.251-12.916 10.694-13.136 19.386a17.07 17.07 0 0 0-8.66 7.8A16.94 16.94 0 0 0 .96 37.966c0 8.81 6.67 16.055 15.222 16.96.059.006.124.012.183.012q.34.036.68.053c.043.007.08.007.119.007q.412.021.84.023c.286 0 .562-.007.84-.023.037 0 .073 0 .12-.007a10 10 0 0 0 .679-.053q.097-.001.184-.013c2.89-.286 5.632-1.262 8.134-2.81 2.227-1.368 4.253-3.186 6.043-5.355a25 25 0 0 0 1.823-2.482c2.584-4.07 2.959-5.852 4.174-9.093 1.556-4.155 4.818-6.266 8.61-6.266 1.731 0 3.538.543 4.976 1.5a9.06 9.06 0 0 1 4.066 7.55c0 4.99-4.056 9.05-9.041 9.05-1.6 0-3.1-.417-4.408-1.154a39 39 0 0 1-3.1 4.813c-.466.621-.955 1.22-1.451 1.798a16.9 16.9 0 0 0 8.962 2.548c9.406 0 17.038-7.633 17.038-17.055 0-7.166-4.414-13.3-10.66-15.828zM139.205 5.535h-8.4v44.958h8.4zM199.487 5.535h-8.401v44.958h8.401z" />
              <path fill="#fff" d="M145.533 5.535h-8.4l10.318 44.958h8.404zM180.776 5.535h-8.401v44.958h8.401z" />
              <path fill="#fff" d="M164.252 50.493h-8.4L166.17 5.535h8.401zM122.107 27.21v7.93l-.059.076h-24.22V27.21h24.282z" />
              <path fill="#fff" d="M122.113 35.218V45.67c-5.097 3.61-11.609 5.796-18.355 5.796-17.398 0-28.531-10.55-28.531-23.564S85.296 4.34 103.758 4.34c6.572 0 13.16 2.255 18.355 5.97v10.466c-3.816-4.809-11.038-8.431-18.355-8.431-12.843 0-20.614 6.11-20.614 15.558s8.362 15.56 20.614 15.56c7.386 0 14.5-3.495 18.293-8.245h.062" />
            </svg>
          </div>
        </Link>
        {/* System status dot */}
        <div className="flex items-center gap-1">
          <div style={{ width: "6px", height: "6px", background: "#DDEA4D" }} />
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid #222222" }}>
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            background: "#0a0a0a",
            border: "1px solid #2a2a2a",
            color: "#444444",
            fontSize: "0.6875rem",
            letterSpacing: "0.05em",
            fontFamily: "'GeistMono', monospace",
          }}
        >
          <PixelSearchIcon />
          <span>SEARCH CLAWS_</span>
        </div>
      </div>

      {/* ── Section label ── */}
      <div
        className="px-4 py-2"
        style={{
          fontSize: "0.5625rem",
          letterSpacing: "0.2em",
          color: "#333333",
          fontFamily: "'GeistMono', monospace",
          textTransform: "uppercase",
          borderBottom: "1px solid #111111",
        }}
      >
        NAVIGATION
      </div>

      {/* ── Nav links ── */}
      <nav className="flex-1 py-1">
        {navLinks.map(({ href, label, Icon }) => {
          const isActive = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <div
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all"
                style={{
                  color: isActive ? "#DDEA4D" : "#555555",
                  background: isActive ? "rgba(212,255,0,0.05)" : "transparent",
                  borderLeft: isActive ? "2px solid #DDEA4D" : "2px solid transparent",
                  borderBottom: "1px solid #111111",
                  fontSize: "0.75rem",
                  letterSpacing: "0.08em",
                  fontFamily: "'GeistMono', monospace",
                  textTransform: "uppercase",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.color = "#ffffff";
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
                    (e.currentTarget as HTMLDivElement).style.borderLeftColor = "#333333";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.color = "#555555";
                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    (e.currentTarget as HTMLDivElement).style.borderLeftColor = "transparent";
                  }
                }}
              >
                <Icon />
                {label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom CTA section ── */}
      <div
        className="px-3 pb-4 space-y-2"
        style={{ borderTop: "1px solid #222222", paddingTop: "0.75rem" }}
      >
        {/* Section label */}
        <div
          style={{
            fontSize: "0.5625rem",
            letterSpacing: "0.2em",
            color: "#333333",
            fontFamily: "'GeistMono', monospace",
            textTransform: "uppercase",
            paddingBottom: "0.5rem",
            borderBottom: "1px solid #111111",
            marginBottom: "0.5rem",
          }}
        >
          DEVELOPER
        </div>

        {/* Sign In */}
        <button
          className="w-full py-2 text-center transition-all"
          style={{
            border: "1px solid #2a2a2a",
            color: "#555555",
            background: "transparent",
            fontSize: "0.6875rem",
            letterSpacing: "0.1em",
            fontFamily: "'GeistMono', monospace",
            textTransform: "uppercase",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#555555";
            (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a";
            (e.currentTarget as HTMLButtonElement).style.color = "#555555";
          }}
        >
          [ SIGN IN ]
        </button>

        {/* Deploy a Claw — primary lime */}
        <Link href="/deploy">
          <button
            className="w-full py-2 flex items-center justify-center gap-2 font-bold transition-all"
            style={{
              background: "#DDEA4D",
              color: "#000000",
              border: "1px solid #DDEA4D",
              fontSize: "0.6875rem",
              letterSpacing: "0.1em",
              fontFamily: "'GeistMono', monospace",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#bfea00"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#DDEA4D"; }}
          >
            <PixelRocketIcon />
            DEPLOY CLAW
          </button>
        </Link>

        {/* List a Claw — outline */}
        <Link href="/list-claw">
          <button
            className="w-full py-2 flex items-center justify-center gap-2 transition-all"
            style={{
              border: "1px solid #2a2a2a",
              color: "#555555",
              background: "transparent",
              fontSize: "0.6875rem",
              letterSpacing: "0.1em",
              fontFamily: "'GeistMono', monospace",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#DDEA4D";
              (e.currentTarget as HTMLButtonElement).style.color = "#DDEA4D";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a";
              (e.currentTarget as HTMLButtonElement).style.color = "#555555";
            }}
          >
            <PixelListIcon />
            LIST CLAW
          </button>
        </Link>

        {/* Version tag */}
        <div
          style={{
            fontSize: "0.5rem",
            letterSpacing: "0.15em",
            color: "#222222",
            fontFamily: "'GeistMono', monospace",
            textAlign: "center",
            paddingTop: "0.25rem",
          }}
        >
          GMI CLAW v0.1.0-pre
        </div>
      </div>
    </aside>
  );
}
