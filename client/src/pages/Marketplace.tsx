import { useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import { ALL_CLAWS, TYPE_LABELS, getBadgeConfig, type Claw, type TypeLabel } from "@/lib/clawData";

const QUICKSTART_CMD = "openclaw plugins install clawhub:openclaw-gmicloud-provider";

const STATS = [
  { value: "200+", label: "Claws" },
  { value: "12K+", label: "Registrations" },
  { value: "<30s", label: "Register Time" },
  { value: "99.5%", label: "Uptime SLA" },
];

function QuickStartCopyButton({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ background: copied ? "rgba(221,234,77,0.15)" : "#111", border: "1px solid #2a2a2a", color: copied ? "#DDEA4D" : "#888", padding: "3px 7px", cursor: "pointer", fontFamily: "'GeistMono', monospace", fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase" }}
    >
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}

const ALL_TYPES: (TypeLabel | "All")[] = ["All", ...TYPE_LABELS];

const TYPE_COLORS: Record<TypeLabel | "All", string> = {
  All: "#999999",
  Developer: "#7ec8ff",
  Productivity: "#DDEA4D",
  Business: "#34d399",
  Creative: "#f9a8d4",
};

const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 2a8 8 0 1 0 4.906 14.32l4.387 4.387 1.414-1.414-4.387-4.387A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12A6 6 0 0 1 10 4z"/>
  </svg>
);
const IconX = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
  </svg>
);
const IconArrow = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/>
  </svg>
);
const IconCheck = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
  </svg>
);
const IconPlus = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
);

// Only rendered in catalog for Verified — CE/MaaS badges hidden per PRD
function VerifiedBadge({ path }: { path: Claw["infrastructurePath"] }) {
  if (path !== "gmi_ce_maas") return null;
  const badge = getBadgeConfig(path);
  return (
    <span title={badge.tooltip} style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontFamily: "'GeistMono', monospace", fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase", color: badge.color, border: `1px solid ${badge.border}`, background: badge.bg, padding: "1px 6px", cursor: "help" }}>
      <IconCheck /> {badge.label}
    </span>
  );
}

function TypeTag({ type }: { type: TypeLabel }) {
  const colors: Record<TypeLabel, string> = { Developer: "#7ec8ff", Productivity: "#DDEA4D", Business: "#34d399", Creative: "#f9a8d4" };
  return (
    <span style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", color: colors[type], border: `1px solid ${colors[type]}33`, padding: "1px 6px" }}>
      {type}
    </span>
  );
}

function ClawCard({ claw }: { claw: Claw }) {
  const [, setLocation] = useLocation();
  const [hovered, setHovered] = useState(false);
  const isVerified = claw.infrastructurePath === "gmi_ce_maas";

  const borderColor = hovered
    ? "#DDEA4D"
    : isVerified
    ? "rgba(221,234,77,0.28)"
    : "#222222";
  const bgColor = hovered
    ? (isVerified ? "rgba(221,234,77,0.04)" : "#0a0a0a")
    : isVerified
    ? "rgba(221,234,77,0.015)"
    : "#000000";

  return (
    <div
      style={{ background: bgColor, border: `1px solid ${borderColor}`, cursor: "pointer", transition: "border-color 0.12s ease, background 0.12s ease", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}
      onClick={() => setLocation(`/marketplace/${claw.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Verified accent bar */}
      {isVerified && (
        <div style={{ height: "2px", background: "linear-gradient(90deg, #DDEA4D 0%, rgba(221,234,77,0.15) 100%)", flexShrink: 0 }} />
      )}

      <div style={{ padding: "1.125rem", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.625rem", flexWrap: "wrap" }}>
          <VerifiedBadge path={claw.infrastructurePath} />
          <TypeTag type={claw.typeLabel} />
        </div>
        <h3 style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.875rem", fontWeight: 700, color: hovered ? "#DDEA4D" : "#ffffff", marginBottom: "0.5rem", letterSpacing: "-0.01em", lineHeight: 1.3, transition: "color 0.12s ease" }}>
          {claw.name}
        </h3>
        <p style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.6875rem", color: "#999999", lineHeight: 1.6, marginBottom: "0.875rem", flex: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {claw.description}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.625rem", borderTop: `1px solid ${isVerified ? "rgba(221,234,77,0.1)" : "#1a1a1a"}` }}>
          <span style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5625rem", color: "#888888", letterSpacing: "0.05em" }}>@{claw.publisher}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {claw.availability === "available" && (
              <span style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5625rem", color: "#DDEA4D", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <span style={{ width: "4px", height: "4px", background: "#DDEA4D", borderRadius: "50%", display: "inline-block" }} />
                AVAILABLE
              </span>
            )}
            {claw.availability === "early_access" && (
              <span style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5625rem", color: "#fb923c", letterSpacing: "0.08em" }}>EARLY ACCESS</span>
            )}
            {claw.availability === "unavailable" && (
              <span style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5625rem", color: "#777777", letterSpacing: "0.08em" }}>UNAVAILABLE</span>
            )}
          </div>
        </div>
        {hovered && (
          <div style={{ marginTop: "0.625rem", background: "#DDEA4D", color: "#000000", padding: "0.4375rem", fontFamily: "'GeistMono', monospace", fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}>
            VIEW CLAW <IconArrow />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Marketplace() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<TypeLabel | "All">("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const filtered = ALL_CLAWS
    .filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()) || c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchesType = activeType === "All" || c.typeLabel === activeType;
      const matchesTrust = !verifiedOnly || c.infrastructurePath === "gmi_ce_maas";
      return matchesSearch && matchesType && matchesTrust;
    })
    // Verified first, then by name
    .sort((a, b) => {
      const aV = a.infrastructurePath === "gmi_ce_maas" ? 0 : 1;
      const bV = b.infrastructurePath === "gmi_ce_maas" ? 0 : 1;
      return aV - bV;
    });

  const verifiedCount = filtered.filter((c) => c.infrastructurePath === "gmi_ce_maas").length;

  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#ffffff" }}>
      <Topbar />
      <Navbar />
      <div style={{ marginLeft: "210px", paddingTop: "40px", display: "flex", flexDirection: "column" }}>

        {/* Hero */}
        <section style={{ borderBottom: "1px solid #222222", background: "#000000", backgroundImage: "radial-gradient(circle, rgba(221,234,77,0.07) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
          <div style={{ padding: "1.25rem 2rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ display: "inline-block", width: "5px", height: "5px", background: "#DDEA4D" }} />
            <span style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#DDEA4D" }}>GMI CLAW MARKETPLACE — V1</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ padding: "2rem 2rem 2.5rem", borderRight: "1px solid #1a1a1a" }}>
              <h1 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "1.35rem", fontWeight: 400, color: "#ffffff", lineHeight: 1.7, marginBottom: "1rem", letterSpacing: "0.02em" }}>
                Browse, Register,<br />
                <span style={{ color: "#DDEA4D" }}>and Monetize</span><br />
                AI Claws.
              </h1>
              <p style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.75rem", color: "#999999", lineHeight: 1.7, marginBottom: "1.75rem", maxWidth: "380px" }}>
                The combined marketplace and registration platform for production-grade AI agents — discovery, infrastructure, and monetization in one system.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })} style={{ background: "#DDEA4D", color: "#000000", border: "none", fontFamily: "'GeistMono', monospace", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.625rem 1.25rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  Browse Claws <IconArrow />
                </button>
                <button onClick={() => setLocation("/deploy")} style={{ background: "transparent", color: "#DDEA4D", border: "1px solid rgba(221,234,77,0.35)", fontFamily: "'GeistMono', monospace", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.625rem 1.25rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  Register a Claw <IconArrow />
                </button>
              </div>
            </div>

            <div style={{ padding: "2rem 2rem 2.5rem", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#DDEA4D", marginBottom: "0.75rem" }}>Quick Start</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.875rem", background: "#0d0d0d", border: "1px solid #2a2a2a", borderBottom: "1px solid #1a1a1a" }}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <span style={{ width: "7px", height: "7px", background: "#ff5f57", display: "inline-block" }} />
                    <span style={{ width: "7px", height: "7px", background: "#febc2e", display: "inline-block" }} />
                    <span style={{ width: "7px", height: "7px", background: "#28c840", display: "inline-block" }} />
                  </div>
                  <span style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5rem", letterSpacing: "0.15em", color: "#777", textTransform: "uppercase" }}>TERMINAL</span>
                  <QuickStartCopyButton cmd={QUICKSTART_CMD} />
                </div>
                <div style={{ background: "#000", border: "1px solid #2a2a2a", borderTop: "none", padding: "1rem 1.25rem", fontFamily: "'GeistMono', monospace", fontSize: "0.75rem" }}>
                  <span style={{ color: "#777" }}>$ </span>
                  <span style={{ color: "#DDEA4D" }}>{QUICKSTART_CMD}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a" }}>
            {STATS.map((s, i) => (
              <div key={s.label} style={{ flex: 1, padding: "0.875rem 2rem", borderRight: i < STATS.length - 1 ? "1px solid #1a1a1a" : "none", display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.75rem", color: "#DDEA4D", letterSpacing: "0.04em" }}>{s.value}</span>
                <span style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5625rem", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Page header */}
        <div style={{ borderBottom: "1px solid #222222", background: "#000000" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.625rem 2rem", borderBottom: "1px solid #1a1a1a" }}>
            <span style={{ display: "inline-block", width: "5px", height: "5px", background: "#DDEA4D" }} />
            <span style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#DDEA4D" }}>CLAW MARKETPLACE</span>
            <span style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5rem", letterSpacing: "0.1em", color: "#777777" }}>— {ALL_CLAWS.length} CLAWS AVAILABLE · GMI CLUSTER ENGINE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 2rem" }}>
            <h1 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "1rem", fontWeight: 400, color: "#ffffff", letterSpacing: "0.02em", lineHeight: 1.6 }}>CLAW CATALOG</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", color: "#888888", pointerEvents: "none" }}><IconSearch /></span>
                <input type="text" placeholder="SEARCH CLAWS..." value={search} onChange={(e) => setSearch(e.target.value)}
                  style={{ width: "220px", background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#ffffff", fontFamily: "'GeistMono', monospace", fontSize: "0.6875rem", letterSpacing: "0.05em", padding: "0.5rem 2rem 0.5rem 2rem", outline: "none" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", color: "#888888", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}><IconX /></button>
                )}
              </div>
              <button onClick={() => setLocation("/deploy")} style={{ background: "#DDEA4D", color: "#000000", border: "1px solid #DDEA4D", fontFamily: "'GeistMono', monospace", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.5rem 1rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <IconPlus /> REGISTER A CLAW
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal filter bar */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 2rem", borderBottom: "1px solid #1a1a1a", background: "#000000", overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {ALL_TYPES.map((type) => {
              const isActive = activeType === type;
              return (
                <button key={type} onClick={() => setActiveType(type)}
                  style={{ padding: "0.625rem 0.875rem", fontFamily: "'GeistMono', monospace", fontSize: "0.5625rem", letterSpacing: "0.08em", textTransform: "uppercase", background: "transparent", color: isActive ? "#ffffff" : "#888888", border: "none", borderBottom: `2px solid ${isActive ? "#DDEA4D" : "transparent"}`, cursor: "pointer", transition: "color 0.1s ease, border-color 0.1s ease", display: "flex", alignItems: "center", gap: "0.375rem", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#aaaaaa"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#888888"; }}
                >
                  <span style={{ width: "5px", height: "5px", background: isActive ? TYPE_COLORS[type] : "#666666", display: "inline-block", flexShrink: 0, transition: "background 0.1s ease" }} />
                  {type}
                </button>
              );
            })}
          </div>
          <div style={{ width: "1px", height: "20px", background: "#1a1a1a", margin: "0 0.75rem", flexShrink: 0 }} />
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {[{ label: "All Claws", value: false }, { label: "Verified Only", value: true }].map((opt) => {
              const isActive = verifiedOnly === opt.value;
              return (
                <button key={String(opt.value)} onClick={() => setVerifiedOnly(opt.value)}
                  style={{ padding: "0.625rem 0.875rem", fontFamily: "'GeistMono', monospace", fontSize: "0.5625rem", letterSpacing: "0.08em", textTransform: "uppercase", background: "transparent", color: isActive ? "#DDEA4D" : "#888888", border: "none", borderBottom: `2px solid ${isActive ? "#DDEA4D" : "transparent"}`, cursor: "pointer", transition: "color 0.1s ease, border-color 0.1s ease", whiteSpace: "nowrap" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#aaaaaa"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#888888"; }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Catalog grid */}
        <div id="catalog" style={{ flex: 1, padding: "1.5rem 2rem" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "5rem 0", fontFamily: "'GeistMono', monospace" }}>
              <div style={{ fontSize: "0.75rem", color: "#888888", marginBottom: "0.5rem" }}>// NO CLAWS FOUND</div>
              <div style={{ fontSize: "0.625rem", color: "#777777", letterSpacing: "0.05em" }}>Try adjusting your search or filter</div>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.5625rem", color: "#888888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem", paddingBottom: "0.625rem", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span>{filtered.length} RESULT{filtered.length !== 1 ? "S" : ""}</span>
                {verifiedCount > 0 && (
                  <>
                    <span style={{ color: "#2a2a2a" }}>·</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <span style={{ width: "5px", height: "5px", background: "#DDEA4D", display: "inline-block" }} />
                      <span style={{ color: "#DDEA4D" }}>{verifiedCount} VERIFIED</span>
                    </span>
                    <span style={{ color: "#2a2a2a" }}>·</span>
                    <span>VERIFIED FIRST</span>
                  </>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1px", background: "#1a1a1a" }}>
                {filtered.map((claw) => (
                  <div key={claw.id} style={{ background: "#000000" }}>
                    <ClawCard claw={claw} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
}
