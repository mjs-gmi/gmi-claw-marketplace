import { useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import { ALL_CLAWS, TYPE_LABELS, getBadgeConfig, type Claw, type TypeLabel } from "@/lib/clawData";

// ─── Design tokens — extracted verbatim from Figma JSON ──────────────────────
// Geist Sans across the board. Mono only inside the terminal block.
const FONT      = "'Geist', system-ui, sans-serif";
const FONT_MONO = "'GeistMono', ui-monospace, 'SFMono-Regular', monospace";

// Colors (lab/oklab from Figma → sRGB hex)
const C = {
  bg:        "#0a0a0a",                  // lab(2.75 0 0)
  fg:        "#fafafa",                  // lab(98.26 0 0)
  muted:     "#a3a3a3",                  // lab(66.13 …) — neutral-400
  mutedSoft: "rgba(250,250,250,0.7)",    // sidebar section labels
  border:    "#404040",                  // rgb(64,64,64) — neutral-700
  borderSoft:"#262626",                  // neutral-800
  card:      "rgba(23,23,23,0.6)",       // ~ neutral-900 / 60
  cardSolid: "#171717",                  // neutral-900
  pillBg:    "rgba(82,82,82,0.3)",       // search/input chrome
  activeBg:  "rgba(255,255,255,0.12)",   // active filter pill
  lime:      "#DDEA4D",                  // accent — GMI lime
  limeText:  "#0a0a0a",
  // Category accent (purple from "Da" avatar in Figma): lab(76.74 18.39 -37.07)
  catAccent: "#c7a7ff",
} as const;

// One real command: turns GMI Cloud into a provider inside an existing OpenClaw setup.
const OPENCLAW_INSTALL_CMD = "openclaw plugins install clawhub:openclaw-gmicloud-provider";

const ALL_TYPES: (TypeLabel | "All")[] = ["All", ...TYPE_LABELS];

// Subtle per-category accent. Avatar bg uses 12% alpha of the same.
// Matched to production: Code & Dev Tools = purple, Content & Marketing = green
const TYPE_COLOR: Record<TypeLabel, string> = {
  "Code & Dev Tools":     "#c7a7ff", // violet/purple
  "Data & Analytics":     C.lime,
  "Customer Support":     "#7dd3fc", // sky-300
  "Content & Marketing":  "#86efac", // green-300
  "Research & Knowledge": "#f9a8d4", // pink-300
};

// ─── Icons (1.5-stroke lucide-style) ─────────────────────────────────────────
const IconSearch = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
const IconCheck = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconPlus = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconArrowRight = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);
const IconX = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconCopy = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

function CopyButton({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "transparent",
        border: "none",
        color: copied ? C.lime : C.muted,
        fontFamily: FONT, fontSize: 12, fontWeight: 500, lineHeight: "16px",
        cursor: "pointer",
        padding: "2px 6px",
        borderRadius: 6,
      }}
    >
      {copied ? <><IconCheck size={11} /> Copied</> : <><IconCopy size={11} /> Copy</>}
    </button>
  );
}

function VerifiedBadge({ path }: { path: Claw["infrastructurePath"] }) {
  if (path !== "gmi_ce_maas") return null;
  const badge = getBadgeConfig(path);
  return (
    <span
      title={badge.tooltip}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontFamily: FONT, fontSize: 11, fontWeight: 500, lineHeight: "16px",
        color: C.lime,
        background: "rgba(221,234,77,0.10)",
        border: `1px solid rgba(221,234,77,0.35)`,
        padding: "1px 7px",
        borderRadius: 999,
        cursor: "help",
      }}
    >
      <IconCheck size={10} /> Verified
    </span>
  );
}

function CategoryTag({ type }: { type: TypeLabel }) {
  const color = TYPE_COLOR[type];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: FONT, fontSize: 11, fontWeight: 500, lineHeight: "16px",
        color: C.muted,
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${C.borderSoft}`,
        padding: "2px 8px",
        borderRadius: 4,
        whiteSpace: "nowrap",
        alignSelf: "flex-start",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
      {type}
    </span>
  );
}

function Avatar({ publisher, color }: { publisher: string; color: string }) {
  const initials = publisher.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2);
  const display = initials ? initials[0].toUpperCase() + (initials[1] || "").toLowerCase() : "?";
  return (
    <div
      style={{
        width: 36, height: 36,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}1f`,
        border: `1px solid ${color}55`,
        color,
        fontFamily: FONT, fontSize: 14, fontWeight: 700, lineHeight: "20px",
        borderRadius: 8,
        flexShrink: 0,
      }}
    >
      {display}
    </div>
  );
}

function VerifiedCheck() {
  return (
    <span
      title="Verified — hosted on GMI Cluster Engine with GMI MaaS"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 14, height: 14, borderRadius: 999,
        background: "#7dd3fc",
        color: "#0a0a0a",
        flexShrink: 0,
      }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

function MiniAvatar({ publisher }: { publisher: string; color: string }) {
  // Match production: plain dark square with neutral white initials.
  // The per-category color now lives only in the small dot of the category chip.
  const initials = publisher.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2);
  const display = initials ? initials[0].toUpperCase() + (initials[1] || "").toLowerCase() : "?";
  return (
    <div
      style={{
        width: 32, height: 32,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0a0a0a",
        border: `1px solid ${C.border}`,
        color: C.fg,
        fontFamily: FONT, fontSize: 12, fontWeight: 600, lineHeight: "14px",
        borderRadius: 6,
        flexShrink: 0,
      }}
    >
      {display}
    </div>
  );
}

function AgentCard({ claw }: { claw: Claw }) {
  const [, setLocation] = useLocation();
  const [hovered, setHovered] = useState(false);
  const typeColor = TYPE_COLOR[claw.typeLabel];
  const isVerified = claw.infrastructurePath === "gmi_ce_maas";

  return (
    <div
      onClick={() => setLocation(`/marketplace/${claw.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.cardSolid,
        border: `1px solid ${hovered ? "#525252" : C.border}`,
        borderRadius: 10,
        padding: 14,
        cursor: "pointer",
        transition: "border-color .15s ease, transform .15s ease",
        transform: hovered ? "translateY(-1px)" : "none",
        display: "flex", flexDirection: "column", gap: 10,
        minHeight: 152,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <MiniAvatar publisher={claw.publisher} color={typeColor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <h3
              style={{
                fontFamily: FONT, fontSize: 14, fontWeight: 600, lineHeight: "20px",
                color: C.fg,
                margin: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {claw.name}
            </h3>
            {isVerified && <VerifiedCheck />}
          </div>
          <div
            style={{
              fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "16px",
              color: C.muted,
              marginTop: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {claw.publisher}
          </div>
        </div>
      </div>

      <p
        style={{
          fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "17px",
          color: C.muted,
          margin: 0,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          flex: 1,
        }}
      >
        {claw.description}
      </p>

      {/* Category chip — anchored at the bottom of the card */}
      <CategoryTag type={claw.typeLabel} />
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
      const q = search.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q));
      const matchesType = activeType === "All" || c.typeLabel === activeType;
      const matchesTrust = !verifiedOnly || c.infrastructurePath === "gmi_ce_maas";
      return matchesSearch && matchesType && matchesTrust;
    })
    .sort((a, b) => {
      const aV = a.infrastructurePath === "gmi_ce_maas" ? 0 : 1;
      const bV = b.infrastructurePath === "gmi_ce_maas" ? 0 : 1;
      return aV - bV;
    });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar />
      <Navbar />
      <div style={{ marginLeft: 210, paddingTop: 40, display: "flex", flexDirection: "column" }}>

        {/* Thin OpenClaw plugin banner — single horizontal row */}
        <div style={{ padding: "14px 24px 0" }}>
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "8px 12px",
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            }}
          >
            <span
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 22, height: 22, borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
                color: C.muted,
                flexShrink: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2v4M15 2v4M6 6h12v6a6 6 0 0 1-12 0V6zM12 18v4" />
              </svg>
            </span>
            <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.fg, whiteSpace: "nowrap" }}>
              Already on OpenClaw? Add GMI Cloud as a provider:
            </span>
            <code
              style={{
                fontFamily: FONT_MONO, fontSize: 12, color: C.fg,
                background: "#0d0d0d",
                border: `1px solid ${C.borderSoft}`,
                padding: "3px 8px", borderRadius: 6,
                whiteSpace: "nowrap", overflowX: "auto",
                flex: "1 1 auto",
                minWidth: 0,
              }}
            >
              <span style={{ color: C.muted }}>$ </span>{OPENCLAW_INSTALL_CMD}
            </code>
            <CopyButton cmd={OPENCLAW_INSTALL_CMD} />
            <button
              onClick={() => setLocation("/deploy")}
              style={{
                fontFamily: FONT, fontSize: 12, fontWeight: 500,
                background: "transparent", color: C.lime,
                border: "none", padding: "2px 4px", cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Not on OpenClaw? Register from the dashboard →
            </button>
          </div>
        </div>

        {/* ── Catalog header ─────────────────────────────────────────────── */}
        <section id="catalog" style={{ padding: "14px 24px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <h1
              style={{
                fontFamily: FONT, fontSize: 24, fontWeight: 700, lineHeight: "30px",
                color: C.fg, margin: 0, letterSpacing: "-0.02em",
              }}
            >
              Agent Catalog
            </h1>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 10, color: C.muted, display: "flex" }}>
                  <IconSearch size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search Agents…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: 260,
                    background: C.pillBg,
                    border: `1px solid ${C.border}`,
                    color: C.fg,
                    fontFamily: FONT, fontSize: 14, fontWeight: 400, lineHeight: "20px",
                    padding: "8px 32px 8px 32px",
                    borderRadius: 8,
                    outline: "none",
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    style={{ position: "absolute", right: 8, color: C.muted, background: "none", border: "none", cursor: "pointer", display: "flex" }}
                  >
                    <IconX />
                  </button>
                )}
              </div>
              <button
                onClick={() => setLocation("/deploy")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
                  background: C.lime, color: C.limeText,
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <IconPlus /> Register an Agent
              </button>
            </div>
          </div>

          {/* Category pills + Verified toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ALL_TYPES.map((type) => {
                const isActive = activeType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveType(type)}
                    style={{
                      fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
                      background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                      color: isActive ? C.fg : C.muted,
                      border: "1px solid transparent",
                      padding: "6px 12px",
                      borderRadius: 6,
                      cursor: "pointer",
                      transition: "background .15s ease, color .15s ease",
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            <label
              onClick={() => setVerifiedOnly((v) => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            >
              <span
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 18, height: 18, borderRadius: 999,
                  background: verifiedOnly ? "#7dd3fc" : "transparent",
                  border: `1.5px solid #7dd3fc`,
                  color: verifiedOnly ? "#0a0a0a" : "#7dd3fc",
                  transition: "background .15s ease",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px", color: "#7dd3fc" }}>
                Verified Only
              </span>
              <span
                style={{
                  width: 32, height: 18,
                  background: verifiedOnly ? "#7dd3fc" : C.border,
                  borderRadius: 999,
                  position: "relative",
                  transition: "background .15s ease",
                  marginLeft: 4,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: verifiedOnly ? 16 : 2,
                    width: 14, height: 14,
                    background: verifiedOnly ? "#0a0a0a" : "#fafafa",
                    borderRadius: 999,
                    transition: "left .15s ease",
                  }}
                />
              </span>
            </label>
          </div>
        </section>

        {/* ── Catalog grid ───────────────────────────────────────────────── */}
        <section style={{ padding: "12px 32px 32px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "64px 0", fontFamily: FONT }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.fg, marginBottom: 6 }}>No agents found</div>
              <div style={{ fontSize: 12, color: C.muted }}>Try adjusting your search or filter.</div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  // Cap card max-width at 320px so sparse catalogs (2-3 items)
                  // don't stretch cards across the full row. Cards stay uniform
                  // regardless of count; extra space breathes to the right.
                  gridTemplateColumns: "repeat(auto-fill, 280px)",
                  justifyContent: "start",
                  gap: 12,
                }}
              >
                {filtered.map((claw) => (
                  <AgentCard key={claw.id} claw={claw} />
                ))}
              </div>
            </>
          )}
        </section>

        <Footer />
      </div>
    </div>
  );
}
