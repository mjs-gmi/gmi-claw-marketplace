/* ─────────────────────────────────────────────────────────────────────────
   GMI CLAW MARKETPLACE — Marketplace Page
   Design: Cyber Industrial Terminal
   - Pure Black canvas, Cyber Lime (#DDEA4D) accent
   - Geist Mono throughout, 1px solid borders, zero border-radius
   - Left filter sidebar with explicit grid lines
   ───────────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ALL_CLAWS, TYPE_LABELS, type Claw, type TypeLabel } from "@/lib/clawData";

const ALL_TYPES: (TypeLabel | "All")[] = ["All", ...TYPE_LABELS];

// ─── Inline pixel icons ───────────────────────────────────────────────────────
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
const IconStar = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

// ─── Trust Badge ──────────────────────────────────────────────────────────────
function TrustBadge({ tier }: { tier: Claw["trustTier"] }) {
  if (tier === "Verified") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          fontFamily: "'GeistMono', monospace",
          fontSize: "0.5rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#DDEA4D",
          border: "1px solid rgba(212,255,0,0.25)",
          padding: "1px 6px",
        }}
      >
        <IconCheck /> VERIFIED
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        fontFamily: "'GeistMono', monospace",
        fontSize: "0.5rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#444444",
        border: "1px solid #2a2a2a",
        padding: "1px 6px",
      }}
    >
      COMMUNITY
    </span>
  );
}

// ─── Type Tag ─────────────────────────────────────────────────────────────────
function TypeTag({ type }: { type: TypeLabel }) {
  const colors: Record<TypeLabel, string> = {
    Developer: "#7ec8ff",
    Productivity: "#DDEA4D",
    Business: "#34d399",
    Creative: "#f9a8d4",
  };
  return (
    <span
      style={{
        fontFamily: "'GeistMono', monospace",
        fontSize: "0.5rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: colors[type],
        border: `1px solid ${colors[type]}33`,
        padding: "1px 6px",
      }}
    >
      {type}
    </span>
  );
}

// ─── Claw Card ────────────────────────────────────────────────────────────────
function ClawCard({ claw }: { claw: Claw }) {
  const [, setLocation] = useLocation();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        background: hovered ? "#0a0a0a" : "#000000",
        border: `1px solid ${hovered ? "#DDEA4D" : "#222222"}`,
        padding: "1.125rem",
        cursor: "pointer",
        transition: "border-color 0.1s ease, background 0.1s ease",
        display: "flex",
        flexDirection: "column",
      }}
      onClick={() => setLocation(`/marketplace/${claw.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Badges row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.625rem", flexWrap: "wrap" }}>
        <TrustBadge tier={claw.trustTier} />
        <TypeTag type={claw.typeLabel} />
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: "'GeistMono', monospace",
          fontSize: "0.875rem",
          fontWeight: 700,
          color: hovered ? "#DDEA4D" : "#ffffff",
          marginBottom: "0.5rem",
          letterSpacing: "-0.01em",
          lineHeight: 1.3,
          transition: "color 0.1s ease",
        }}
      >
        {claw.name}
      </h3>

      {/* Description */}
      <p
        style={{
          fontFamily: "'GeistMono', monospace",
          fontSize: "0.6875rem",
          color: "#555555",
          lineHeight: 1.6,
          marginBottom: "0.875rem",
          flex: 1,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {claw.description}
      </p>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "0.625rem",
          borderTop: "1px solid #1a1a1a",
        }}
      >
        <span
          style={{
            fontFamily: "'GeistMono', monospace",
            fontSize: "0.5625rem",
            color: "#444444",
            letterSpacing: "0.05em",
          }}
        >
          @{claw.publisher}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {claw.deployed ? (
            <span
              style={{
                fontFamily: "'GeistMono', monospace",
                fontSize: "0.5625rem",
                color: "#DDEA4D",
                letterSpacing: "0.08em",
              }}
            >
              {claw.pricing}
            </span>
          ) : (
            <span
              style={{
                fontFamily: "'GeistMono', monospace",
                fontSize: "0.5625rem",
                color: "#333333",
                letterSpacing: "0.08em",
              }}
            >
              UNAVAILABLE
            </span>
          )}
        </div>
      </div>

      {/* Hover CTA */}
      {hovered && (
        <div
          style={{
            marginTop: "0.625rem",
            background: "#DDEA4D",
            color: "#000000",
            padding: "0.4375rem",
            fontFamily: "'GeistMono', monospace",
            fontSize: "0.5625rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.375rem",
          }}
        >
          VIEW CLAW <IconArrow />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Marketplace() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<TypeLabel | "All">("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const filtered = ALL_CLAWS.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesType = activeType === "All" || c.typeLabel === activeType;
    const matchesTrust = !verifiedOnly || c.trustTier === "Verified";
    return matchesSearch && matchesType && matchesTrust;
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#000000", color: "#ffffff" }}>
      <Navbar />

      <div style={{ flex: 1, marginLeft: "220px", display: "flex", flexDirection: "column" }}>

        {/* ── Page header bar ── */}
        <div
          style={{
            borderBottom: "1px solid #222222",
            background: "#000000",
          }}
        >
          {/* Breadcrumb/label row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.625rem 2rem",
              borderBottom: "1px solid #1a1a1a",
            }}
          >
            <span style={{ display: "inline-block", width: "5px", height: "5px", background: "#DDEA4D" }} />
            <span
              style={{
                fontFamily: "'GeistMono', monospace",
                fontSize: "0.5rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#DDEA4D",
              }}
            >
              CLAW MARKETPLACE
            </span>
            <span
              style={{
                fontFamily: "'GeistMono', monospace",
                fontSize: "0.5rem",
                letterSpacing: "0.1em",
                color: "#333333",
              }}
            >
              — {ALL_CLAWS.length} CLAWS AVAILABLE · GMI CLUSTER ENGINE
            </span>
          </div>

          {/* Title + search row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.25rem 2rem",
            }}
          >
            <h1
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "1rem",
                fontWeight: 400,
                color: "#ffffff",
                letterSpacing: "0.02em",
                lineHeight: 1.6,
              }}
            >
              CLAW CATALOG
            </h1>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "0.625rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#444444",
                    pointerEvents: "none",
                  }}
                >
                  <IconSearch />
                </span>
                <input
                  type="text"
                  placeholder="SEARCH CLAWS..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "220px",
                    background: "#0a0a0a",
                    border: "1px solid #2a2a2a",
                    color: "#ffffff",
                    fontFamily: "'GeistMono', monospace",
                    fontSize: "0.6875rem",
                    letterSpacing: "0.05em",
                    padding: "0.5rem 2rem 0.5rem 2rem",
                    outline: "none",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    style={{
                      position: "absolute",
                      right: "0.5rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#444444",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <IconX />
                  </button>
                )}
              </div>

              {/* Deploy CTA */}
              <button
                onClick={() => setLocation("/deploy")}
                style={{
                  background: "#DDEA4D",
                  color: "#000000",
                  border: "1px solid #DDEA4D",
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "0.5rem 1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <IconPlus /> DEPLOY CLAW
              </button>
            </div>
          </div>
        </div>

        {/* ── Main layout: filter sidebar + grid ── */}
        <div style={{ display: "flex", flex: 1 }}>

          {/* Left filter sidebar */}
          <aside
            style={{
              width: "180px",
              flexShrink: 0,
              borderRight: "1px solid #222222",
              padding: "1.5rem 0",
            }}
          >
            {/* Type filter */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.5rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#DDEA4D",
                  padding: "0 1rem 0.5rem",
                  borderBottom: "1px solid #1a1a1a",
                  marginBottom: "0.25rem",
                }}
              >
                TYPE
              </div>
              {ALL_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.5rem 1rem",
                    fontFamily: "'GeistMono', monospace",
                    fontSize: "0.6875rem",
                    letterSpacing: "0.05em",
                    background: activeType === type ? "rgba(212,255,0,0.05)" : "transparent",
                    color: activeType === type ? "#DDEA4D" : "#555555",
                    borderTop: "none",
                    borderRight: "none",
                    borderBottom: "1px solid #111111",
                    borderLeft: `2px solid ${activeType === type ? "#DDEA4D" : "transparent"}`,
                    cursor: "pointer",
                    transition: "color 0.1s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (activeType !== type) (e.currentTarget as HTMLButtonElement).style.color = "#aaaaaa";
                  }}
                  onMouseLeave={(e) => {
                    if (activeType !== type) (e.currentTarget as HTMLButtonElement).style.color = "#555555";
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Trust filter */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.5rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#DDEA4D",
                  padding: "0 1rem 0.5rem",
                  borderBottom: "1px solid #1a1a1a",
                  marginBottom: "0.25rem",
                }}
              >
                TRUST
              </div>
              {[
                { label: "All Claws", value: false },
                { label: "Verified Only", value: true },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => setVerifiedOnly(opt.value)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.5rem 1rem",
                    fontFamily: "'GeistMono', monospace",
                    fontSize: "0.6875rem",
                    letterSpacing: "0.05em",
                    background: verifiedOnly === opt.value ? "rgba(212,255,0,0.05)" : "transparent",
                    color: verifiedOnly === opt.value ? "#DDEA4D" : "#555555",
                    borderTop: "none",
                    borderRight: "none",
                    borderBottom: "1px solid #111111",
                    borderLeft: `2px solid ${verifiedOnly === opt.value ? "#DDEA4D" : "transparent"}`,
                    cursor: "pointer",
                    transition: "color 0.1s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (verifiedOnly !== opt.value) (e.currentTarget as HTMLButtonElement).style.color = "#aaaaaa";
                  }}
                  onMouseLeave={(e) => {
                    if (verifiedOnly !== opt.value) (e.currentTarget as HTMLButtonElement).style.color = "#555555";
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Builder CTA */}
            <div
              style={{
                margin: "0 0.75rem",
                padding: "1rem",
                background: "#0a0a0a",
                border: "1px solid #1e1e1e",
              }}
            >
              <div
                style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: "0.5rem",
                  letterSpacing: "0.05em",
                }}
              >
                BUILD ON GMI
              </div>
              <p
                style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.5625rem",
                  color: "#444444",
                  lineHeight: 1.6,
                  marginBottom: "0.75rem",
                  letterSpacing: "0.03em",
                }}
              >
                Deploy privately, then publish to the Marketplace.
              </p>
              <button
                onClick={() => setLocation("/deploy")}
                style={{
                  width: "100%",
                  background: "#DDEA4D",
                  color: "#000000",
                  border: "none",
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.5625rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "0.4375rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.375rem",
                }}
              >
                DEPLOY <IconArrow />
              </button>
            </div>
          </aside>

          {/* Claw grid */}
          <div style={{ flex: 1, padding: "1.5rem 2rem" }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "5rem 0",
                  fontFamily: "'GeistMono', monospace",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#444444", marginBottom: "0.5rem" }}>
                  // NO CLAWS FOUND
                </div>
                <div style={{ fontSize: "0.625rem", color: "#333333", letterSpacing: "0.05em" }}>
                  Try adjusting your search or filter
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: "'GeistMono', monospace",
                    fontSize: "0.5625rem",
                    color: "#444444",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: "1rem",
                    paddingBottom: "0.625rem",
                    borderBottom: "1px solid #1a1a1a",
                  }}
                >
                  {filtered.length} RESULT{filtered.length !== 1 ? "S" : ""} · SORTED BY RELEVANCE
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: "1px",
                    background: "#1a1a1a",
                  }}
                >
                  {filtered.map((claw) => (
                    <div key={claw.id} style={{ background: "#000000" }}>
                      <ClawCard claw={claw} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
