import { useState } from "react";
import { Search, X, Star, Download, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DeployModal from "@/components/DeployModal";

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
    tags: ["DeFi", "Arbitrage", "Multi-chain"],
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
    tags: ["Code", "Security", "CI/CD"],
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
    tags: ["RAG", "Enterprise", "Knowledge"],
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
      {/* Badge */}
      {claw.badge && (
        <div className="mb-2.5">
          <span
            className="text-xs font-mono-gmi px-2 py-0.5"
            style={{
              background: claw.badge === "Official" ? "rgba(221,234,77,0.12)" : "rgba(100,180,255,0.1)",
              color: claw.badge === "Official" ? "#DDEA4D" : "#7ec8ff",
              border: `1px solid ${claw.badge === "Official" ? "rgba(221,234,77,0.25)" : "rgba(126,200,255,0.2)"}`,
            }}
          >
            {claw.badge}
          </span>
        </div>
      )}

      {/* Title */}
      <h3
        className="font-display text-base text-white mb-2 leading-snug group-hover:text-[#DDEA4D] transition-colors"
        style={{ letterSpacing: "-0.01em" }}
      >
        {claw.name}
      </h3>

      {/* Description */}
      <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-1 line-clamp-3">
        {claw.description}
      </p>

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: "1px solid #1a1a1a" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono-gmi text-xs text-gray-600">
            <span className="text-xs text-gray-600">by</span>
            <span style={{ color: "#888" }}>@{claw.author}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono-gmi text-xs">
            <Star size={10} fill="#DDEA4D" stroke="none" />
            <span style={{ color: "#DDEA4D" }}>
              {claw.stars >= 1000 ? `${(claw.stars / 1000).toFixed(1)}k` : claw.stars}
            </span>
          </div>
          <div className="flex items-center gap-1 font-mono-gmi text-xs text-gray-600">
            <Download size={10} />
            {claw.deployments}
          </div>
        </div>
      </div>

      {/* Deploy button — appears on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onDeploy(); }}
        className="mt-3 w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "#DDEA4D", color: "#000" }}
      >
        Deploy <ArrowRight size={12} />
      </button>
    </div>
  );
}

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"deployments" | "stars">("deployments");
  const [deployTarget, setDeployTarget] = useState<Claw | null>(null);

  const filtered = ALL_CLAWS.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = activeCategory === "All" || c.category === activeCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (sortBy === "stars") return b.stars - a.stars;
    // sort by deployments (string like "48.2k" → parse)
    const parse = (s: string) => parseFloat(s.replace("k", "")) * (s.includes("k") ? 1000 : 1);
    return parse(b.deployments) - parse(a.deployments);
  });

  return (
    <div className="min-h-screen" style={{ background: "#000", color: "#fff" }}>
      <Navbar />

      {/* Page header */}
      <div className="pt-20 pb-10" style={{ borderBottom: "1px solid #1a1a1a" }}>
        <div className="container">
          <div
            className="inline-block text-xs font-mono-gmi px-3 py-1 mb-4"
            style={{
              background: "rgba(221,234,77,0.08)",
              color: "#DDEA4D",
              border: "1px solid rgba(221,234,77,0.2)",
            }}
          >
            The Marketplace
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1
                className="font-display text-4xl text-white mb-2"
                style={{ letterSpacing: "-0.03em" }}
              >
                Claw Catalog
              </h1>
              <p className="text-gray-500 text-sm font-mono-gmi">
                {ALL_CLAWS.length} autonomous agents available · Powered by GMI Cluster Engine
              </p>
            </div>

            {/* Search */}
            <div className="relative max-w-xs w-full">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type="text"
                placeholder="Search Claws..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-white text-sm pl-9 pr-9 py-2.5 focus:outline-none font-mono-gmi placeholder-gray-700"
                style={{
                  background: "#0d0d0d",
                  border: "1px solid #2a2a2a",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar — sticky, matches clawhub top-nav style */}
      <div
        className="sticky z-40"
        style={{ top: "3.5rem", background: "#000", borderBottom: "1px solid #1a1a1a" }}
      >
        <div className="container py-3 flex items-center justify-between gap-4 flex-wrap">
          {/* Category pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="text-xs px-3 py-1.5 font-medium transition-colors"
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

          {/* Sort */}
          <div className="flex items-center gap-1 font-mono-gmi text-xs text-gray-600">
            <span className="mr-1">Sort:</span>
            {[
              { key: "deployments" as const, label: "Most Deployed" },
              { key: "stars" as const, label: "Top Rated" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className="px-3 py-1.5 transition-colors"
                style={{ color: sortBy === s.key ? "#DDEA4D" : "#555" }}
                onMouseEnter={(e) => { if (sortBy !== s.key) (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = sortBy === s.key ? "#DDEA4D" : "#555"; }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid — clawhub 3-col uniform grid */}
      <div className="container py-10">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="font-mono-gmi text-sm text-gray-600 mb-2">// No Claws found</div>
            <div className="text-xs text-gray-700">Try adjusting your search or filter</div>
          </div>
        ) : (
          <>
            <div className="font-mono-gmi text-xs text-gray-600 mb-6">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
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
          </>
        )}
      </div>

      <Footer />

      {deployTarget && (
        <DeployModal claw={deployTarget} onClose={() => setDeployTarget(null)} />
      )}
    </div>
  );
}
