/* ─────────────────────────────────────────────────────────────────────────
   GMI CLAW MARKETPLACE — Home Page
   Design: Cyber Industrial Terminal
   - Pure Black (#000) canvas, Cyber Lime (#DDEA4D) accent
   - Geist Mono everywhere, Press Start 2P for display headings
   - 1px solid borders, zero border-radius, explicit grid lines
   - Bayer dithering background texture, point-cloud hero
   ───────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DeployModal from "@/components/DeployModal";

// ─── Inline pixel icons ───────────────────────────────────────────────────────
const IconArrow = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <path d="M2 6h7M6 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="square"/>
  </svg>
);
const IconStar = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);
const IconDeploy = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L8 8h3v8h2V8h3L12 2zM5 18h14v2H5v-2z"/>
  </svg>
);
const IconCopy = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 1H4C3 1 2 2 2 3v14h2V3h12V1zm3 4H8C7 5 6 6 6 7v14c0 1 1 2 2 2h11c1 0 2-1 2-2V7c0-1-1-2-2-2zm0 16H8V7h11v14z"/>
  </svg>
);
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
  </svg>
);
const IconZap = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);
const IconShield = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
  </svg>
);
const IconCode = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 3L2 9l6 6 1.5-1.5L4.5 9 9.5 4.5 8 3zm8 0l-1.5 1.5L19.5 9l-5 4.5L16 15l6-6-6-6z"/>
  </svg>
);
const IconChevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

// ─── Data ────────────────────────────────────────────────────────────────────

const ALL_CLAWS = [
  {
    id: "defi-arb",
    name: "DeFi Arbitrage Scout",
    category: "Developer",
    badge: "Featured",
    description:
      "Monitors cross-chain price differentials and executes arbitrage strategies autonomously across 12 DEXs.",
    author: "gmi-labs",
    stars: 284,
    deployments: "48.2k",
    model: "Llama 3.1 70B",
    tags: ["DeFi", "Arbitrage"],
    latency: "~120ms",
    price: "Pay-per-exec",
    rating: 4.9,
  },
  {
    id: "code-reviewer",
    name: "Code Review Agent",
    category: "Developer",
    badge: "Official",
    description:
      "Performs deep static analysis, security audits, and suggests refactors with line-by-line explanations.",
    author: "gmi-labs",
    stars: 512,
    deployments: "36.9k",
    model: "DeepSeek-Coder V2",
    tags: ["Code", "Security"],
    latency: "~800ms",
    price: "$49/mo",
    rating: 4.8,
  },
  {
    id: "enterprise-rag",
    name: "Enterprise RAG Pipeline",
    category: "Business",
    badge: "Featured",
    description:
      "Ingests, indexes, and queries internal knowledge bases with citation-backed, hallucination-resistant responses.",
    author: "gmi-labs",
    stars: 193,
    deployments: "24.4k",
    model: "Qwen2.5 72B",
    tags: ["RAG", "Enterprise"],
    latency: "~350ms",
    price: "Custom",
    rating: 4.9,
  },
  {
    id: "smart-contract-auditor",
    name: "Smart Contract Auditor",
    category: "Developer",
    badge: "",
    description:
      "Audits Solidity and Rust smart contracts for reentrancy, overflow, and access control vulnerabilities.",
    author: "0xsecurity",
    stars: 1567,
    deployments: "92k",
    model: "DeepSeek-Coder V2",
    tags: ["DeFi", "Security"],
    latency: "~2.1s",
    price: "$199/mo",
    rating: 4.9,
  },
  {
    id: "support-agent",
    name: "Customer Support Agent",
    category: "Business",
    badge: "",
    description:
      "Handles Tier-1 support tickets autonomously, escalating complex issues with full context summaries.",
    author: "enterprise-ai",
    stars: 907,
    deployments: "80.7k",
    model: "Llama 3.1 8B",
    tags: ["Support", "Enterprise"],
    latency: "~200ms",
    price: "$99/mo",
    rating: 4.7,
  },
  {
    id: "nft-monitor",
    name: "NFT Floor Monitor",
    category: "Developer",
    badge: "",
    description:
      "Tracks floor prices, whale movements, and rarity shifts across major NFT collections in real time.",
    author: "nft-tools",
    stars: 321,
    deployments: "79.6k",
    model: "Mistral 7B",
    tags: ["NFT", "DeFi"],
    latency: "~60ms",
    price: "Pay-per-exec",
    rating: 4.6,
  },
  {
    id: "data-pipeline",
    name: "Data Pipeline Orchestrator",
    category: "Developer",
    badge: "",
    description:
      "Designs, schedules, and monitors ETL pipelines. Detects anomalies and auto-heals broken jobs.",
    author: "dataops-ai",
    stars: 305,
    deployments: "76k",
    model: "DeepSeek-R1 32B",
    tags: ["ETL", "Data"],
    latency: "~500ms",
    price: "$149/mo",
    rating: 4.8,
  },
  {
    id: "gaming-npc",
    name: "Adaptive NPC Brain",
    category: "Creative",
    badge: "",
    description:
      "Generates contextually aware NPC dialogue, behavior trees, and quest logic for game environments.",
    author: "gameai-dev",
    stars: 274,
    deployments: "74.3k",
    model: "Qwen2.5 7B",
    tags: ["Gaming", "NPC"],
    latency: "~90ms",
    price: "Pay-per-exec",
    rating: 4.5,
  },
  {
    id: "doc-generator",
    name: "API Doc Generator",
    category: "Developer",
    badge: "",
    description:
      "Parses codebases and auto-generates OpenAPI specs, README files, and inline documentation.",
    author: "devtools-ai",
    stars: 215,
    deployments: "67.9k",
    model: "Llama 3.1 70B",
    tags: ["Docs", "API"],
    latency: "~1.2s",
    price: "$29/mo",
    rating: 4.7,
  },
];

const CATEGORIES = ["All", "Developer", "Productivity", "Business", "Creative"];

type Claw = (typeof ALL_CLAWS)[0];

// ─── Typewriter hook ─────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 55, startDelay = 300) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;

    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        indexRef.current += 1;
        setDisplayed(text.slice(0, indexRef.current));
        if (indexRef.current >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);

  return { displayed, done };
}

// ─── Claw Card ───────────────────────────────────────────────────────────────

function ClawCard({ claw, onDeploy }: { claw: Claw; onDeploy: () => void }) {
  const [hovered, setHovered] = useState(false);

  const categoryColor: Record<string, string> = {
    Developer: "#DDEA4D",
    Productivity: "#7dd3fc",
    Business: "#f9a8d4",
    Creative: "#c4b5fd",
  };
  const catColor = categoryColor[claw.category] || "#555555";

  return (
    <div
      className="flex flex-col cursor-pointer"
      style={{
        background: hovered ? "#0a0a0a" : "#000000",
        border: `1px solid ${hovered ? "#DDEA4D" : "#222222"}`,
        padding: "1.125rem",
        transition: "border-color 0.1s ease, background 0.1s ease",
        position: "relative",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top row: category tag + badge */}
      <div className="flex items-center justify-between mb-2.5">
        <span
          style={{
            fontSize: "0.5625rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: catColor,
            fontFamily: "'GeistMono', monospace",
            border: `1px solid ${catColor}33`,
            padding: "1px 6px",
          }}
        >
          {claw.category}
        </span>
        {claw.badge && (
          <span
            style={{
              fontSize: "0.5625rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: claw.badge === "Official" ? "#DDEA4D" : "#7ec8ff",
              fontFamily: "'GeistMono', monospace",
              border: `1px solid ${claw.badge === "Official" ? "#DDEA4D" : "#7ec8ff"}33`,
              padding: "1px 6px",
            }}
          >
            {claw.badge}
          </span>
        )}
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

      {/* Meta row */}
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
            fontSize: "0.625rem",
            color: "#444444",
            letterSpacing: "0.05em",
          }}
        >
          @{claw.author}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              fontFamily: "'GeistMono', monospace",
              fontSize: "0.625rem",
              color: "#DDEA4D",
            }}
          >
            <IconStar />
            {claw.stars >= 1000 ? `${(claw.stars / 1000).toFixed(1)}k` : claw.stars}
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              fontFamily: "'GeistMono', monospace",
              fontSize: "0.625rem",
              color: "#444444",
            }}
          >
            <IconDeploy />
            {claw.deployments}
          </span>
        </div>
      </div>

      {/* Hover deploy button */}
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeploy();
          }}
          style={{
            marginTop: "0.625rem",
            width: "100%",
            background: "#DDEA4D",
            color: "#000000",
            border: "none",
            padding: "0.4375rem",
            fontFamily: "'GeistMono', monospace",
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.375rem",
            cursor: "pointer",
          }}
        >
          DEPLOY <IconArrow />
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [deployTarget, setDeployTarget] = useState<Claw | null>(null);
  const [activeTab, setActiveTab] = useState<"npx" | "curl" | "pip">("npx");
  const [activeCategory, setActiveCategory] = useState("All");
  const [copied, setCopied] = useState(false);

  const { displayed: typedTitle, done: typingDone } = useTypewriter(
    "GMI CLAW MARKETPLACE",
    60,
    400
  );

  const installCmd = {
    npx: "npx openclaw@latest --cloud gmi",
    curl: "curl -fsSL https://gmi.ai/install.sh | bash",
    pip: "pip install openclaw && openclaw run --cloud gmi",
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(installCmd[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered =
    activeCategory === "All"
      ? ALL_CLAWS
      : ALL_CLAWS.filter((c) => c.category === activeCategory);

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#000000", color: "#ffffff" }}>
      <Navbar />

      {/* Main content — offset by sidebar */}
      <div style={{ flex: 1, marginLeft: "220px" }}>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section
          style={{
            borderBottom: "1px solid #222222",
            background: "#000000",
            backgroundImage:
              "radial-gradient(circle, rgba(221,234,77,0.08) 1px, transparent 1px), radial-gradient(circle, rgba(221,234,77,0.04) 1px, transparent 1px), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cpath d='M48 0 L48 48 M0 48 L48 48' stroke='%23DDEA4D' stroke-width='0.5' stroke-opacity='0.05'/%3E%3C/svg%3E\")",
            backgroundSize: "32px 32px, 8px 8px, 48px 48px",
            backgroundPosition: "0 0, 4px 4px, 0 0",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 0,
              borderBottom: "1px solid #222222",
            }}
          >
            {/* Left hero column */}
            <div
              style={{
                padding: "3.5rem 3rem",
                borderRight: "1px solid #222222",
              }}
            >
              {/* System label */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.5625rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#DDEA4D",
                  border: "1px solid rgba(212,255,0,0.2)",
                  padding: "3px 10px",
                  marginBottom: "2rem",
                }}
              >
                <span style={{ width: "5px", height: "5px", background: "#DDEA4D", display: "inline-block" }} />
                SYS:ONLINE · PRE-RELEASE · APR 2026
              </div>

              {/* Typewriter title */}
              <h1
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "1.5rem",
                  fontWeight: 400,
                  color: "#DDEA4D",
                  lineHeight: 1.8,
                  letterSpacing: "0.02em",
                  marginBottom: "1.5rem",
                  minHeight: "5rem",
                }}
              >
                {typedTitle}
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: "3px",
                    height: "0.85em",
                    background: "#DDEA4D",
                    marginLeft: "8px",
                    verticalAlign: "middle",
                    animation: typingDone ? "blink 1s step-end infinite" : "none",
                  }}
                />
              </h1>

              <p
                style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.8125rem",
                  color: "#555555",
                  lineHeight: 1.7,
                  marginBottom: "2rem",
                  maxWidth: "380px",
                }}
              >
                Browse, deploy, and monetize autonomous AI agents (Claws).
                Versioned like npm. Powered by GMI Cloud infrastructure.
              </p>

              {/* CTAs */}
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2.5rem" }}>
                <Link href="/marketplace">
                  <button
                    className="btn-primary-lime"
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    BROWSE CLAWS <IconArrow />
                  </button>
                </Link>
                <Link href="/deploy">
                  <button className="btn-outline-dashed">
                    DEPLOY A CLAW
                  </button>
                </Link>
              </div>

              {/* Stats row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 0,
                  border: "1px solid #222222",
                }}
              >
                {[
                  { n: "200+", label: "CLAWS" },
                  { n: "12K+", label: "DEPLOYMENTS" },
                  { n: "<30S", label: "DEPLOY TIME" },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    style={{
                      padding: "0.875rem 1rem",
                      borderRight: i < 2 ? "1px solid #222222" : "none",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: "0.875rem",
                        color: "#DDEA4D",
                        marginBottom: "0.25rem",
                        lineHeight: 1.4,
                      }}
                    >
                      {s.n}
                    </div>
                    <div
                      style={{
                        fontFamily: "'GeistMono', monospace",
                        fontSize: "0.5rem",
                        letterSpacing: "0.2em",
                        color: "#333333",
                        textTransform: "uppercase",
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Quick Start terminal */}
            <div
              style={{
                padding: "3.5rem 3rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {/* Terminal header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.875rem",
                  background: "#0d0d0d",
                  border: "1px solid #2a2a2a",
                  borderBottom: "1px solid #1a1a1a",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <span style={{ width: "8px", height: "8px", background: "#ff5f57", display: "inline-block" }} />
                  <span style={{ width: "8px", height: "8px", background: "#febc2e", display: "inline-block" }} />
                  <span style={{ width: "8px", height: "8px", background: "#28c840", display: "inline-block" }} />
                </div>
                <div
                  style={{
                    fontFamily: "'GeistMono', monospace",
                    fontSize: "0.5625rem",
                    letterSpacing: "0.15em",
                    color: "#333333",
                    textTransform: "uppercase",
                  }}
                >
                  QUICK START
                </div>
                <div style={{ display: "flex", gap: "2px" }}>
                  {(["npx", "curl", "pip"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        fontFamily: "'GeistMono', monospace",
                        fontSize: "0.5625rem",
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        border: "none",
                        cursor: "pointer",
                        textTransform: "uppercase",
                        ...(activeTab === tab
                          ? { background: "#DDEA4D", color: "#000000", fontWeight: 700 }
                          : { background: "transparent", color: "#444444" }),
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Terminal body */}
              <div
                style={{
                  background: "#000000",
                  border: "1px solid #2a2a2a",
                  borderTop: "none",
                  padding: "1.25rem",
                  minHeight: "80px",
                  position: "relative",
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.8125rem",
                }}
              >
                <span style={{ color: "#333333" }}>$ </span>
                <span style={{ color: "#DDEA4D" }}>{installCmd[activeTab]}</span>
                <button
                  onClick={handleCopy}
                  style={{
                    position: "absolute",
                    top: "0.75rem",
                    right: "0.75rem",
                    background: "#111111",
                    border: "1px solid #2a2a2a",
                    color: copied ? "#DDEA4D" : "#444444",
                    padding: "4px 6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Copy"
                >
                  {copied ? <IconCheck /> : <IconCopy />}
                </button>
              </div>

              {/* Terminal footer */}
              <div
                style={{
                  background: "#0a0a0a",
                  border: "1px solid #2a2a2a",
                  borderTop: "none",
                  padding: "0.75rem 1.25rem",
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.5625rem",
                  color: "#333333",
                  letterSpacing: "0.05em",
                  marginBottom: "1.25rem",
                }}
              >
                Works on macOS, Linux, and Windows. No API keys or config needed.
              </div>

              {/* Feature chips */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 0,
                  border: "1px solid #1a1a1a",
                }}
              >
                {[
                  { icon: <IconZap />, label: "GMI COMPUTE" },
                  { icon: <IconShield />, label: "200+ MODELS" },
                  { icon: <IconCode />, label: "OPENCLAW RT" },
                ].map((f, i) => (
                  <div
                    key={f.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.625rem 0.75rem",
                      borderRight: i < 2 ? "1px solid #1a1a1a" : "none",
                      fontFamily: "'GeistMono', monospace",
                      fontSize: "0.5rem",
                      letterSpacing: "0.12em",
                      color: "#444444",
                      textTransform: "uppercase",
                    }}
                  >
                    <span style={{ color: "#DDEA4D" }}>{f.icon}</span>
                    {f.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Featured Partners ──────────────────────────────────────────────── */}
        <section style={{ borderBottom: "1px solid #222222" }}>
          {/* Section header bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 3rem",
              borderBottom: "1px solid #222222",
              background: "#000000",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "5px",
                  height: "5px",
                  background: "#DDEA4D",
                }}
              />
              <span
                style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.5625rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#DDEA4D",
                }}
              >
                FEATURED PARTNERS
              </span>
              <span
                style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.5625rem",
                  letterSpacing: "0.1em",
                  color: "#333333",
                }}
              >
                — VERIFIED CLAWS
              </span>
            </div>
            <Link href="/marketplace">
              <span
                style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.625rem",
                  letterSpacing: "0.1em",
                  color: "#444444",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                VIEW ALL <IconChevron />
              </span>
            </Link>
          </div>

          {/* Partner cards — horizontal 3-column grid with dividers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 0,
            }}
          >
            {[
              {
                id: "neoclaw",
                name: "NeoClaw",
                publisher: "Gen Digital",
                description: "Agentic AI assistant built on the Norton Trust Layer. Executes real-world tasks — booking, ordering, research — with built-in spending controls and full observability.",
                pricing: "Early Access",
                tags: ["Productivity", "Consumer", "Agentic"],
                accent: "#DDEA4D",
              },
              {
                id: "openhuman",
                name: "OpenHuman",
                publisher: "TinyHuman",
                description: "Open-source agentic desktop assistant. One subscription for AI models, search, webhooks, and 3rd-party APIs — no terminal required. Local knowledge base, deep desktop integrations.",
                pricing: "Early Access",
                tags: ["Desktop", "Open Source", "Agentic"],
                accent: "#7dd3fc",
              },
              {
                id: "topify-claw",
                name: "Topify Claw",
                publisher: "Topify",
                description: "Automates music promotion workflows — playlist pitching, fan engagement campaigns, and streaming analytics — for independent artists and labels.",
                 pricing: "Early Access",
                tags: ["Music", "Marketing", "Automation"],
                accent: "#f9a8d4",
              },
            ].map((partner, i) => {
              const [hov, setHov] = useState(false);
              return (
                <Link key={partner.id} href={`/marketplace/${partner.id}`}>
                  <div
                    style={{
                      padding: "1.75rem 2rem",
                      borderRight: i < 2 ? "1px solid #222222" : "none",
                      background: hov ? "#080808" : "#000000",
                      borderBottom: hov ? `2px solid ${partner.accent}` : "2px solid transparent",
                      cursor: "pointer",
                      transition: "background 0.1s ease, border-bottom-color 0.1s ease",
                      display: "flex",
                      flexDirection: "column",
                      minHeight: "220px",
                    }}
                    onMouseEnter={() => setHov(true)}
                    onMouseLeave={() => setHov(false)}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.875rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                          <span
                            style={{
                              fontFamily: "'GeistMono', monospace",
                              fontSize: "0.5rem",
                              letterSpacing: "0.15em",
                              textTransform: "uppercase",
                              color: "#DDEA4D",
                              border: "1px solid rgba(221,234,77,0.2)",
                              padding: "1px 6px",
                            }}
                          >
                            ✓ VERIFIED
                          </span>
                        </div>
                        <div
                          style={{
                            fontFamily: "'GeistMono', monospace",
                            fontSize: "0.9375rem",
                            fontWeight: 700,
                            color: hov ? partner.accent : "#ffffff",
                            letterSpacing: "-0.01em",
                            transition: "color 0.1s ease",
                          }}
                        >
                          {partner.name}
                        </div>
                        <div
                          style={{
                            fontFamily: "'GeistMono', monospace",
                            fontSize: "0.5625rem",
                            color: "#444444",
                            letterSpacing: "0.05em",
                            marginTop: "2px",
                          }}
                        >
                          by {partner.publisher}
                        </div>
                      </div>
                      <div
                        style={{
                          fontFamily: "'GeistMono', monospace",
                          fontSize: "0.5625rem",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: partner.accent,
                          border: `1px solid ${partner.accent}33`,
                          padding: "3px 8px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {partner.pricing}
                      </div>
                    </div>

                    {/* Description */}
                    <p
                      style={{
                        fontFamily: "'GeistMono', monospace",
                        fontSize: "0.6875rem",
                        color: "#555555",
                        lineHeight: 1.65,
                        flex: 1,
                        marginBottom: "1rem",
                      }}
                    >
                      {partner.description}
                    </p>

                    {/* Tags */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "0.875rem" }}>
                      {partner.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontFamily: "'GeistMono', monospace",
                            fontSize: "0.5rem",
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "#444444",
                            border: "1px solid #1e1e1e",
                            padding: "2px 7px",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* CTA */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontFamily: "'GeistMono', monospace",
                        fontSize: "0.5625rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: partner.accent,
                      }}
                    >
                      VIEW CLAW <IconChevron />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Explore Claws ──────────────────────────────────────────────────── */}
        <section style={{ borderBottom: "1px solid #222222" }}>
          {/* Section header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 3rem",
              borderBottom: "1px solid #222222",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ display: "inline-block", width: "5px", height: "5px", background: "#DDEA4D" }} />
              <span
                style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.5625rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#DDEA4D",
                }}
              >
                EXPLORE CLAWS
              </span>
            </div>
            <Link href="/marketplace">
              <span
                style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.625rem",
                  letterSpacing: "0.1em",
                  color: "#444444",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                VIEW ALL <IconChevron />
              </span>
            </Link>
          </div>

          {/* Category filter tabs */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "1px solid #222222",
              padding: "0 3rem",
            }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "0.625rem 1.125rem",
                  border: "none",
                    borderBottom: activeCategory === cat ? "2px solid #DDEA4D" : "2px solid transparent",
                    background: "transparent",
                    color: activeCategory === cat ? "#DDEA4D" : "#444444",
                  cursor: "pointer",
                  marginBottom: "-1px",
                  transition: "color 0.1s ease",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Claw grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 0,
              padding: "0 3rem",
              paddingTop: "1.5rem",
              paddingBottom: "1.5rem",
            }}
          >
            {filtered.map((claw, i) => (
              <div
                key={claw.id}
                style={{
                  borderRight: (i + 1) % 3 !== 0 ? "1px solid #1a1a1a" : "none",
                  borderBottom: "1px solid #1a1a1a",
                  padding: "0.125rem",
                }}
              >
                <ClawCard claw={claw} onDeploy={() => setDeployTarget(claw)} />
              </div>
            ))}
          </div>

          {/* View all button */}
          <div
            style={{
              padding: "1.5rem 3rem",
              borderTop: "1px solid #1a1a1a",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Link href="/marketplace">
              <button className="btn-outline-dashed">
                VIEW ALL {ALL_CLAWS.length} CLAWS →
              </button>
            </Link>
          </div>
        </section>

        {/* ── Bottom CTA split ──────────────────────────────────────────────── */}
        <section style={{ borderBottom: "1px solid #222222" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 0,
            }}
          >
            {[
              {
                label: "FOR ENTERPRISES",
                title: "Deploy in\n30 Seconds",
                desc: "Deploy pre-built Claws in under 30 seconds. No ML team required. Pay only for what you use.",
                cta: "EXPLORE MARKETPLACE",
                href: "/marketplace",
              },
              {
                label: "FOR BUILDERS",
                title: "Build &\nMonetize",
                desc: "Package your agent logic as a Claw, publish to the marketplace, and earn from every deployment.",
                cta: "START BUILDING",
                href: "/dashboard",
              },
            ].map((item, i) => (
              <div
                key={item.label}
                style={{
                  padding: "3rem",
                  borderRight: i === 0 ? "1px solid #222222" : "none",
                  background: "#000000",
                }}
              >
                <div
                  style={{
                  fontFamily: "'GeistMono', monospace",
                  fontSize: "0.5rem",
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: "#DDEA4D",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ display: "inline-block", width: "4px", height: "4px", background: "#DDEA4D" }} />
                  {item.label}
                </div>
                <h3
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: "1rem",
                    fontWeight: 400,
                    color: "#ffffff",
                    lineHeight: 1.8,
                    marginBottom: "1rem",
                    whiteSpace: "pre-line",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontFamily: "'GeistMono', monospace",
                    fontSize: "0.75rem",
                    color: "#555555",
                    lineHeight: 1.7,
                    marginBottom: "1.75rem",
                    maxWidth: "340px",
                  }}
                >
                  {item.desc}
                </p>
                <Link href={item.href}>
                  <button
                    className="btn-primary-lime"
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    {item.cta} <IconArrow />
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <Footer />
      </div>

      {deployTarget && (
        <DeployModal claw={deployTarget} onClose={() => setDeployTarget(null)} />
      )}
    </div>
  );
}
