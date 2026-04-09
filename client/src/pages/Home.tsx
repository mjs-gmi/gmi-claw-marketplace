import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Star, Download, Zap, Shield, Code2, ChevronRight, Copy, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DeployModal from "@/components/DeployModal";

// ─── Data ────────────────────────────────────────────────────────────────────

const ALL_CLAWS = [
  {
    id: "defi-arb",
    name: "DeFi Arbitrage Scout",
    category: "DeFi",
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
    category: "Developer Tools",
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
    category: "Enterprise",
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
    category: "DeFi",
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
    category: "Enterprise",
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
    category: "DeFi",
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
    category: "Developer Tools",
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
    category: "Gaming",
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
    category: "Developer Tools",
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

const CATEGORIES = ["All", "DeFi", "Developer Tools", "Enterprise", "Gaming"];

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
  return (
    <div
      className="group flex flex-col cursor-pointer"
      style={{
        background: "#000",
        border: "1px solid #1e1e1e",
        padding: "1.25rem",
        transition: "border-color 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
    >
      {claw.badge && (
        <div className="mb-2.5">
          <span
            className="text-xs font-mono-gmi px-2 py-0.5"
            style={{
              background:
                claw.badge === "Official"
                  ? "rgba(221,234,77,0.12)"
                  : "rgba(100,180,255,0.1)",
              color: claw.badge === "Official" ? "#DDEA4D" : "#7ec8ff",
              border: `1px solid ${
                claw.badge === "Official"
                  ? "rgba(221,234,77,0.25)"
                  : "rgba(126,200,255,0.2)"
              }`,
            }}
          >
            {claw.badge}
          </span>
        </div>
      )}

      <h3
        className="font-display text-base text-white mb-2 leading-snug group-hover:text-[#DDEA4D] transition-colors"
        style={{ letterSpacing: "-0.01em" }}
      >
        {claw.name}
      </h3>

      <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-1 line-clamp-3">
        {claw.description}
      </p>

      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: "1px solid #1a1a1a" }}
      >
        <div className="font-mono-gmi text-xs" style={{ color: "#555" }}>
          @{claw.author}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono-gmi text-xs">
            <Star size={10} fill="#DDEA4D" stroke="none" />
            <span style={{ color: "#DDEA4D" }}>
              {claw.stars >= 1000
                ? `${(claw.stars / 1000).toFixed(1)}k`
                : claw.stars}
            </span>
          </div>
          <div className="flex items-center gap-1 font-mono-gmi text-xs text-gray-600">
            <Download size={10} />
            {claw.deployments}
          </div>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeploy();
        }}
        className="mt-3 w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "#DDEA4D", color: "#000" }}
      >
        Deploy <ArrowRight size={12} />
      </button>
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
    "GMI Claw Marketplace",
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
    <div
      className="min-h-screen flex"
      style={{ background: "#000", color: "#fff" }}
    >
      {/* Left sidebar nav */}
      <Navbar />

      {/* Main content — offset by sidebar width */}
      <div className="flex-1" style={{ marginLeft: "220px" }}>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section
          className="pt-16 pb-14"
          style={{ borderBottom: "1px solid #1a1a1a" }}
        >
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
              {/* Left: text */}
              <div>
                <div
                  className="inline-flex items-center gap-2 text-xs font-mono-gmi px-3 py-1 mb-6"
                  style={{
                    background: "rgba(221,234,77,0.08)",
                    color: "#DDEA4D",
                    border: "1px solid rgba(221,234,77,0.2)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#DDEA4D" }}
                  />
                  Pre-Release · April 2026
                </div>

                {/* Typewriter title */}
                <h1
                  className="font-display text-5xl md:text-6xl text-white mb-5"
                  style={{ lineHeight: 1.05, letterSpacing: "-0.025em", minHeight: "4.5rem" }}
                >
                  <span style={{ color: "#DDEA4D" }}>{typedTitle}</span>
                  {/* Blinking cursor — thin vertical bar, sized relative to font */}
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: "2px",
                      height: "0.75em",
                      background: "#DDEA4D",
                      marginLeft: "6px",
                      marginBottom: "0.1em",
                      verticalAlign: "text-bottom",
                      animation: typingDone ? "blink 1s step-end infinite" : "none",
                    }}
                  />
                </h1>

                <p
                  className="text-lg leading-relaxed mb-8 max-w-md"
                  style={{ color: "#666" }}
                >
                  Browse, deploy, and monetize autonomous AI agents (Claws).
                  Versioned like npm, powered by GMI Cloud infrastructure.
                </p>

                <div className="flex flex-wrap gap-3 mb-10">
                  <Link href="/marketplace">
                    <button
                      className="flex items-center gap-2 text-sm font-bold px-6 py-3"
                      style={{ background: "#DDEA4D", color: "#000" }}
                    >
                      Browse Claws <ArrowRight size={15} />
                    </button>
                  </Link>
                  <Link href="/deploy">
                    <button
                      className="flex items-center gap-2 text-sm font-medium px-6 py-3"
                      style={{ border: "1px solid #2a2a2a", color: "#666" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#DDEA4D";
                        (e.currentTarget as HTMLButtonElement).style.color = "#DDEA4D";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a";
                        (e.currentTarget as HTMLButtonElement).style.color = "#666";
                      }}
                    >
                      Deploy a Claw &lt;/&gt;
                    </button>
                  </Link>
                </div>

                {/* Stats row */}
                <div className="flex gap-8">
                  {[
                    { n: "200+", label: "Claws" },
                    { n: "12k+", label: "Deployments" },
                    { n: "< 30s", label: "Deploy time" },
                  ].map((s) => (
                    <div key={s.label}>
                      <div
                        className="font-display text-2xl"
                        style={{ color: "#DDEA4D", letterSpacing: "-0.02em" }}
                      >
                        {s.n}
                      </div>
                      <div className="text-xs font-mono-gmi" style={{ color: "#555" }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Quick Start widget */}
              <div
                style={{
                  background: "#0a0a0a",
                  border: "1px solid #2a2a2a",
                  padding: "1.5rem",
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#DDEA4D" }}
                  />
                  <div className="text-sm text-white font-semibold tracking-tight">
                    Quick Start
                  </div>
                </div>
                <div
                  className="text-xs font-mono-gmi mb-5"
                  style={{ color: "#555" }}
                >
                  Spin up OpenClaw on GMI Cloud — compute + models included.
                </div>

                {/* macOS dots + tab switcher row */}
                <div
                  className="flex items-center justify-between px-3 py-2 mb-0"
                  style={{ background: "#111", borderBottom: "1px solid #1a1a1a" }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
                  </div>
                  <div className="flex gap-1">
                    {(["npx", "curl", "pip"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className="text-xs font-mono-gmi px-2.5 py-1 transition-colors"
                        style={
                          activeTab === tab
                            ? { background: "#DDEA4D", color: "#000", fontWeight: 700 }
                            : { color: "#555" }
                        }
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Terminal command block */}
                <div
                  className="relative font-mono-gmi text-sm p-4"
                  style={{
                    background: "#000",
                    border: "1px solid #1a1a1a",
                    borderTop: "none",
                    minHeight: "72px",
                  }}
                >
                  <span style={{ color: "#555" }}>$ </span>
                  <span style={{ color: "#DDEA4D" }}>{installCmd[activeTab]}</span>
                  <button
                    onClick={handleCopy}
                    className="absolute top-3 right-3 p-1.5 transition-colors"
                    style={{
                      background: "#111",
                      border: "1px solid #222",
                      color: copied ? "#DDEA4D" : "#555",
                    }}
                    title="Copy"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>

                <div
                  className="text-xs font-mono-gmi mt-3 mb-5"
                  style={{ color: "#444" }}
                >
                  Works on macOS, Linux, and Windows. No API keys or config needed.
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: <Zap size={12} />, label: "GMI compute" },
                    { icon: <Shield size={12} />, label: "200+ models" },
                    { icon: <Code2 size={12} />, label: "OpenClaw runtime" },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center gap-1.5 font-mono-gmi text-xs"
                      style={{ color: "#555" }}
                    >
                      <span style={{ color: "#DDEA4D" }}>{f.icon}</span>
                      {f.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Category tabs + Claw grid ──────────────────────────────────────── */}
        <section className="py-12">
          <div className="container">
            <div className="flex items-center justify-between mb-6">
              <h2
                className="font-display text-2xl text-white"
                style={{ letterSpacing: "-0.02em" }}
              >
                Explore Claws
              </h2>
              <Link href="/marketplace">
                <span
                  className="flex items-center gap-1 text-sm font-mono-gmi cursor-pointer transition-colors"
                  style={{ color: "#555" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLSpanElement).style.color = "#DDEA4D")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLSpanElement).style.color = "#555")
                  }
                >
                  View all <ChevronRight size={14} />
                </span>
              </Link>
            </div>

            <div
              className="flex gap-1.5 flex-wrap mb-8 pb-6"
              style={{ borderBottom: "1px solid #1a1a1a" }}
            >
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="text-xs px-4 py-2 font-medium transition-colors"
                  style={
                    activeCategory === cat
                      ? { background: "#DDEA4D", color: "#000", fontWeight: 700 }
                      : { color: "#666", border: "1px solid #2a2a2a" }
                  }
                  onMouseEnter={(e) => {
                    if (activeCategory !== cat) {
                      (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#444";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeCategory !== cat) {
                      (e.currentTarget as HTMLButtonElement).style.color = "#666";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a";
                    }
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((claw) => (
                <ClawCard
                  key={claw.id}
                  claw={claw}
                  onDeploy={() => setDeployTarget(claw)}
                />
              ))}
            </div>

            <div className="text-center mt-10">
              <Link href="/marketplace">
                <button
                  className="text-sm font-medium px-8 py-3 transition-colors"
                  style={{ border: "1px solid #2a2a2a", color: "#666" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#DDEA4D";
                    (e.currentTarget as HTMLButtonElement).style.color = "#DDEA4D";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a";
                    (e.currentTarget as HTMLButtonElement).style.color = "#666";
                  }}
                >
                  View all {ALL_CLAWS.length} Claws →
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
        <section
          className="py-16"
          style={{ borderTop: "1px solid #1a1a1a" }}
        >
          <div className="container">
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-px"
              style={{ background: "#1a1a1a" }}
            >
              {[
                {
                  title: "For Enterprises",
                  desc: "Deploy pre-built Claws in under 30 seconds. No ML team required. Pay only for what you use.",
                  cta: "Explore Marketplace",
                  href: "/marketplace",
                },
                {
                  title: "For Builders",
                  desc: "Package your agent logic as a Claw, publish to the marketplace, and earn from every deployment.",
                  cta: "Start Building",
                  href: "/dashboard",
                },
              ].map((item) => (
                <div key={item.title} className="p-10" style={{ background: "#000" }}>
                  <h3
                    className="font-display text-2xl text-white mb-3"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {item.title}
                  </h3>
                  <p
                    className="text-sm leading-relaxed mb-6 max-w-sm"
                    style={{ color: "#555" }}
                  >
                    {item.desc}
                  </p>
                  <Link href={item.href}>
                    <button
                      className="flex items-center gap-2 text-sm font-bold px-5 py-2.5"
                      style={{ background: "#DDEA4D", color: "#000" }}
                    >
                      {item.cta} <ArrowRight size={14} />
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Footer />
      </div>

      {deployTarget && (
        <DeployModal claw={deployTarget} onClose={() => setDeployTarget(null)} />
      )}

      {/* Blinking cursor keyframe */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
