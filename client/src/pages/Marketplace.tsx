import { useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import CopyButton from "@/components/CopyButton";
import { ALL_CLAWS, TYPE_LABELS, getBadgeConfig, type Claw, type TypeLabel } from "@/lib/clawData";
import { C as baseC, FONT, TYPE_COLOR } from "@/lib/tokens";
import { PlanBadge } from "@/components/PlanUI";
import { isPlanEligibleAgent, CODING_AGENT_PLAN } from "@/lib/modelsPlan";
import V2Badge from "@/components/V2Badge";
import AgentDrawer from "@/components/AgentDrawer";

// ─── Design tokens — shared base from @/lib/tokens, plus a few page-local keys.
const FONT_MONO = "'GeistMono', ui-monospace, 'SFMono-Regular', monospace";
const C = {
  ...baseC,
  mutedSoft: "rgba(250,250,250,0.7)",    // sidebar section labels
  card:      "rgba(23,23,23,0.6)",       // ~ neutral-900 / 60 (page-specific)
  activeBg:  "rgba(255,255,255,0.12)",   // active filter pill
  catAccent: "#c7a7ff",                  // category accent avatar bg
};

// One real command: turns GMI Cloud into a provider inside an existing OpenClaw setup.
const OPENCLAW_INSTALL_CMD = "openclaw plugins install clawhub:openclaw-gmicloud-provider";

// v1.2 §A4 / v1.3 §A — "Recommended" leads (curation, verified first), the
// functional categories follow, "All" closes the row. The README documented
// this ordering; the code was still starting with "All".
type FilterKey = "Recommended" | TypeLabel | "All";
const ALL_TYPES: FilterKey[] = ["Recommended", ...TYPE_LABELS, "All"];

// ─── Sort ───────────────────────────────────────────────────────────────────
type SortKey = "featured" | "trending" | "mostused" | "updated" | "new";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "trending", label: "Trending" },
  { key: "mostused", label: "Most Used" },
  { key: "updated", label: "Recently Updated" },
  { key: "new", label: "New" },
];
// Paid-promotion demo — these list with a "Promoted" chip and pin to the top under
// Featured, kept visually distinct from organic ranking.
const PROMOTED_IDS = new Set(["topify-claw", "enterprise-rag-pipeline"]);
// Stable pseudo-metric from id — the prototype has no real usage/updated data, so
// each sort key derives a deterministic order (varies by salt, stable across renders).
function hashScore(id: string, salt: string): number {
  let h = 0;
  const s = id + salt;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}


// ─── Icons (1.5-stroke lucide-style) ─────────────────────────────────────────
const IconFlame = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2c1.5 3.5-1 5-1 7a3 3 0 0 0 6 0c0-.7-.2-1.4-.5-2 2.2 1.6 3.5 4 3.5 6.5a8 8 0 1 1-16 0c0-4 2.5-7.5 6-9.5 1-.6 1.8-1.4 2-2z" />
  </svg>
);
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

function MiniAvatar({ publisher, color }: { publisher: string; color: string }) {
  // Match production: dark square with category-colored initials + faint tint.
  const initials = publisher.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2);
  const display = initials ? initials[0].toUpperCase() + (initials[1] || "").toLowerCase() : "?";
  return (
    <div
      style={{
        width: 36, height: 36,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}14`,
        border: `1px solid ${color}33`,
        color,
        fontFamily: FONT, fontSize: 13, fontWeight: 700, lineHeight: "14px",
        borderRadius: 8,
        flexShrink: 0,
      }}
    >
      {display}
    </div>
  );
}

function AgentCard({ claw, onOpen }: { claw: Claw; onOpen: (c: Claw) => void }) {
  const [, setLocation] = useLocation();
  const [hovered, setHovered] = useState(false);
  const typeColor = TYPE_COLOR[claw.typeLabel];
  const isVerified = claw.infrastructurePath === "gmi_ce_maas";

  return (
    <div
      // v1.3 §A1 — a card opens the detail drawer rather than navigating. The
      // route still exists and still works; a modified click goes there so
      // "open in a new tab" is not taken away.
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) { setLocation(`/marketplace/${claw.id}`); return; }
        onOpen(claw);
      }}
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
            {PROMOTED_IDS.has(claw.id) && (
              <span
                title="Paid promotion — ranked above organic results"
                style={{
                  flexShrink: 0, fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                  textTransform: "uppercase", color: "#fbbf24",
                  background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.45)",
                  padding: "1px 6px", borderRadius: 4,
                }}
              >
                Promoted
              </span>
            )}
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

      {/* F-08 — default model (Featured), changeable at launch. Copy says "default". */}
      <p style={{ fontFamily: FONT, fontSize: 11, color: C.muted, margin: 0 }}>
        Runs on <span style={{ color: C.fg }}>DeepSeek-V4-Flash</span> by default · change at launch
      </p>

      {/* Category chip + Plan eligible badge — anchored at the bottom of the card */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <CategoryTag type={claw.typeLabel} />
        {isPlanEligibleAgent(claw.typeLabel) && <PlanBadge />}
      </div>
    </div>
  );
}

// ─── Publisher hero banner — v1.2 §A1 ───────────────────────────────────────
// Acquisition band aimed at Agent *authors*, above the buyer-facing catalog.
// Additive: the "Browse Agents" page hero below it is untouched.
function PublisherHeroV2() {
  const [, setLocation] = useLocation();
  return (
    <div style={{ padding: "24px 24px 0" }}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 20, flexWrap: "wrap",
          background: "linear-gradient(96deg, rgba(221,234,77,0.10) 0%, rgba(221,234,77,0.03) 62%, transparent 100%)",
          border: "1px solid rgba(221,234,77,0.26)",
          borderRadius: 12,
          padding: "18px 22px",
        }}
      >
        <div style={{ minWidth: 260, flex: "1 1 420px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", color: C.lime }}>
              <span style={{ width: 5, height: 5, background: C.lime, display: "inline-block" }} />
              DEPLOY · PUBLISH · GROW THE AGENT ECOSYSTEM
            </span>
            <V2Badge />
          </div>
          <h2 style={{ fontFamily: FONT, fontSize: 25, fontWeight: 700, lineHeight: "31px", letterSpacing: "-0.02em", color: C.fg, margin: 0 }}>
            Help Great Agents <span style={{ color: C.lime }}>Get Deployed, Discovered, and Used.</span>
          </h2>
          <p style={{ fontFamily: FONT, fontSize: 13.5, lineHeight: "20px", color: C.muted, margin: "8px 0 0", maxWidth: 720 }}>
            Register, deploy, and test your Agent with Agentbox — then publish it to Agent Marketplace
            so more users can discover and use it.
          </p>
        </div>
        <button
          onClick={() => setLocation("/deploy")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0,
            fontFamily: FONT, fontSize: 14, fontWeight: 600, lineHeight: "20px",
            background: C.lime, color: C.limeText,
            border: "none", padding: "10px 18px", borderRadius: 9, cursor: "pointer",
          }}
        >
          Agent Registration <IconArrowRight />
        </button>
      </div>
    </div>
  );
}

export default function Marketplace() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  // Lands on Recommended, matching the v1.3 shot — the curated view is the
  // default entry, not the undifferentiated "All".
  const [activeType, setActiveType] = useState<FilterKey>("Recommended");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("featured");
  // v1.3 §A — the card detail drawer. Null means closed.
  const [openClaw, setOpenClaw] = useState<Claw | null>(null);

  // v1.3 §A10 / §B2 — "Set up this Agent" hands the catalog entry to My Agents,
  // which picks it up once and adds it as a private copy.
  const setUpAgent = (claw: Claw) => {
    try {
      sessionStorage.setItem("gmi.setupAgent", JSON.stringify({ id: claw.id, name: claw.name }));
    } catch {
      /* storage unavailable — My Agents still opens, just without the handoff */
    }
    setLocation("/dashboard");
  };

  const filtered = ALL_CLAWS
    .filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q));
      // "Recommended" and "All" are not categories — they widen the set rather
      // than narrow it. Recommended differs from All by ordering, below.
      const matchesType =
        activeType === "All" || activeType === "Recommended" || c.typeLabel === activeType;
      const matchesTrust = !verifiedOnly || c.infrastructurePath === "gmi_ce_maas";
      return matchesSearch && matchesType && matchesTrust;
    })
    .sort((a, b) => {
      // The Sort control is gone (v1.3 shot has no dropdown), so "Recommended"
      // carries the curation: verified first, promoted pinned above it.
      if (activeType === "Recommended" || sortBy === "featured") {
        // Promoted pinned first (clearly chipped), then verified, then organic.
        const ap = PROMOTED_IDS.has(a.id) ? 0 : 1;
        const bp = PROMOTED_IDS.has(b.id) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        const aV = a.infrastructurePath === "gmi_ce_maas" ? 0 : 1;
        const bV = b.infrastructurePath === "gmi_ce_maas" ? 0 : 1;
        return aV - bV;
      }
      if (sortBy === "new") return 0; // keep source order (as-listed)
      const salt = sortBy === "trending" ? "trend" : sortBy === "mostused" ? "use" : "upd";
      return hashScore(b.id, salt) - hashScore(a.id, salt);
    });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar />
      <Navbar />
      <div style={{ marginLeft: 210, paddingTop: 40, display: "flex", flexDirection: "column" }}>

        {/* ── Publisher acquisition banner — v1.2 §A1 ──────────────────────── */}
        <PublisherHeroV2 />

        {/* ── Catalog header ─────────────────────────────────────────────── */}
        <section id="catalog" style={{ padding: "28px 24px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              {/* v1.2 §A2 — eyebrow + restated subhead over the catalog */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", color: C.lime }}>
                  <span style={{ width: 5, height: 5, background: C.lime, display: "inline-block" }} />
                  AGENT MARKETPLACE
                </span>
                <V2Badge />
              </div>
              <h1
                style={{
                  fontFamily: FONT, fontSize: 24, fontWeight: 700, lineHeight: "30px",
                  color: C.fg, margin: 0, letterSpacing: "-0.02em",
                }}
              >
                Discover Agents for your workflow.
              </h1>
              <p style={{ fontFamily: FONT, fontSize: 13.5, lineHeight: "20px", color: C.muted, margin: "6px 0 0", maxWidth: 640 }}>
                Compare publisher, runtime, and access details, then deploy a private copy into your GMI account.
              </p>
            </div>

          </div>

          {/* Category pills + Verified toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            {/* One tray, active tab reads as a darker pill — matches the v1.3 shot. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 2, background: "rgba(255,255,255,0.035)", borderRadius: 6, padding: 3 }}>
              {ALL_TYPES.map((type) => {
                const isActive = activeType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveType(type)}
                    title={isPlanEligibleAgent(type) ? `${CODING_AGENT_PLAN.name} eligible` : undefined}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontFamily: FONT, fontSize: 13.5, fontWeight: 500, lineHeight: "20px",
                      background: isActive ? "#0d0d0d" : "transparent",
                      color: isActive ? C.fg : C.muted,
                      border: "none",
                      padding: "7px 14px",
                      borderRadius: 5,
                      cursor: "pointer",
                      transition: "background .15s ease, color .15s ease",
                    }}
                  >
                    {type === "Recommended" && <IconFlame />}
                    {type}
                    {type === "Recommended" && <V2Badge title="New in Agentbox v1.3 — curated default tab" />}
                    {isPlanEligibleAgent(type) && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={C.lime} aria-hidden="true" style={{ flexShrink: 0 }}><path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z" /></svg>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <label
              onClick={() => setVerifiedOnly((v) => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            >
              {/* v1.3 §A12 — a square checkbox, not a switch. */}
              <span
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 16, height: 16, borderRadius: 3,
                  background: verifiedOnly ? C.lime : "transparent",
                  border: `1.5px solid ${verifiedOnly ? C.lime : "#5a5a5a"}`,
                  color: C.limeText,
                  transition: "background .15s ease, border-color .15s ease",
                }}
              >
                {verifiedOnly && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px", color: C.fg }}>
                Verified Only <V2Badge title="New in Agentbox v1.2 §A3" />
              </span>
            </label>
            </div>
          </div>
        </section>

        {/* Coding Agent Plan banner — shown when a plan-eligible category tab is active
            (leverages the existing category tab instead of a separate toggle). */}
        {isPlanEligibleAgent(activeType) && (
          <div style={{ margin: "0 32px", display: "flex", alignItems: "center", gap: 10, background: "rgba(221,234,77,0.06)", border: "1px solid rgba(221,234,77,0.30)", borderRadius: 8, padding: "10px 14px" }}>
            <PlanBadge text={CODING_AGENT_PLAN.name} />
            <span style={{ fontFamily: FONT, fontSize: 13, color: C.fg }}>
              These agents run coding models at <span style={{ color: C.lime, fontWeight: 600 }}>{CODING_AGENT_PLAN.discountPct}% off</span> token pricing with the {CODING_AGENT_PLAN.name}.
            </span>
          </div>
        )}

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
                  // Match production: cards fill the row (~4 columns at this width).
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 16,
                }}
              >
                {filtered.map((claw) => (
                  <AgentCard key={claw.id} claw={claw} onOpen={setOpenClaw} />
                ))}
              </div>
            </>
          )}
        </section>

        <Footer />
      </div>

      {/* v1.3 §A — card detail */}
      <AgentDrawer claw={openClaw} onClose={() => setOpenClaw(null)} onSetUp={setUpAgent} />
    </div>
  );
}
