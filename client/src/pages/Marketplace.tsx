import { useState } from "react";
import { Search, Filter, X, ArrowRight, Zap, Star } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DeployModal from "@/components/DeployModal";

const ALL_CLAWS = [
  {
    id: "defi-arb",
    name: "DeFi Arbitrage Scout",
    category: "DeFi",
    description: "Monitors cross-chain price differentials and executes arbitrage strategies autonomously across 12 DEXs.",
    model: "Llama 3.1 70B",
    deployments: 2847,
    rating: 4.9,
    tags: ["DeFi", "Arbitrage", "Multi-chain"],
    latency: "~120ms",
    price: "Pay-per-exec",
  },
  {
    id: "code-reviewer",
    name: "Code Review Agent",
    category: "Developer Tools",
    description: "Performs deep static analysis, security audits, and suggests refactors with line-by-line explanations.",
    model: "DeepSeek-Coder V2",
    deployments: 5120,
    rating: 4.8,
    tags: ["Code", "Security", "CI/CD"],
    latency: "~800ms",
    price: "$49/mo",
  },
  {
    id: "enterprise-rag",
    name: "Enterprise RAG Pipeline",
    category: "Enterprise",
    description: "Ingests, indexes, and queries internal knowledge bases with citation-backed, hallucination-resistant responses.",
    model: "Qwen2.5 72B",
    deployments: 1203,
    rating: 4.9,
    tags: ["RAG", "Enterprise", "Knowledge"],
    latency: "~350ms",
    price: "Custom",
  },
  {
    id: "nft-monitor",
    name: "NFT Floor Monitor",
    category: "DeFi",
    description: "Tracks floor prices, whale movements, and rarity shifts across major NFT collections in real time.",
    model: "Mistral 7B",
    deployments: 987,
    rating: 4.6,
    tags: ["NFT", "DeFi", "Alerts"],
    latency: "~60ms",
    price: "Pay-per-exec",
  },
  {
    id: "support-agent",
    name: "Customer Support Agent",
    category: "Enterprise",
    description: "Handles Tier-1 support tickets autonomously, escalating complex issues with full context summaries.",
    model: "Llama 3.1 8B",
    deployments: 3401,
    rating: 4.7,
    tags: ["Support", "Enterprise", "Automation"],
    latency: "~200ms",
    price: "$99/mo",
  },
  {
    id: "data-pipeline",
    name: "Data Pipeline Orchestrator",
    category: "Developer Tools",
    description: "Designs, schedules, and monitors ETL pipelines. Detects anomalies and auto-heals broken jobs.",
    model: "DeepSeek-R1 32B",
    deployments: 678,
    rating: 4.8,
    tags: ["ETL", "Data", "Orchestration"],
    latency: "~500ms",
    price: "$149/mo",
  },
  {
    id: "gaming-npc",
    name: "Adaptive NPC Brain",
    category: "Gaming",
    description: "Generates contextually aware NPC dialogue, behavior trees, and quest logic for game environments.",
    model: "Qwen2.5 7B",
    deployments: 412,
    rating: 4.5,
    tags: ["Gaming", "NPC", "Dialogue"],
    latency: "~90ms",
    price: "Pay-per-exec",
  },
  {
    id: "contract-auditor",
    name: "Smart Contract Auditor",
    category: "DeFi",
    description: "Audits Solidity and Rust smart contracts for reentrancy, overflow, and access control vulnerabilities.",
    model: "DeepSeek-Coder V2",
    deployments: 1567,
    rating: 4.9,
    tags: ["DeFi", "Security", "Solidity"],
    latency: "~2.1s",
    price: "$199/mo",
  },
  {
    id: "doc-generator",
    name: "API Doc Generator",
    category: "Developer Tools",
    description: "Parses codebases and auto-generates OpenAPI specs, README files, and inline documentation.",
    model: "Llama 3.1 70B",
    deployments: 2234,
    rating: 4.7,
    tags: ["Docs", "API", "Developer Tools"],
    latency: "~1.2s",
    price: "$29/mo",
  },
];

const CATEGORIES = ["All", "DeFi", "Developer Tools", "Enterprise", "Gaming"];

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"deployments" | "rating">("deployments");
  const [deployTarget, setDeployTarget] = useState<(typeof ALL_CLAWS)[0] | null>(null);

  const filtered = ALL_CLAWS.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = activeCategory === "All" || c.category === activeCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* Header */}
      <div className="pt-24 pb-12 border-b border-gray-800">
        <div className="container">
          <div className="gmi-label mb-3">The Marketplace</div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-4xl md:text-5xl text-white mb-2">Claw Catalog</h1>
              <p className="text-gray-400 text-sm">
                {ALL_CLAWS.length} autonomous agents available · Powered by GMI Cluster Engine
              </p>
            </div>
            {/* Search */}
            <div className="relative max-w-sm w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search Claws..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-white text-sm pl-9 pr-4 py-2.5 focus:outline-none focus:border-lime font-mono-gmi placeholder-gray-600"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-800 bg-black sticky top-16 z-40">
        <div className="container py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={12} className="text-gray-500" />
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-xs px-3 py-1.5 font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-lime text-black"
                    : "text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort:</span>
            <button
              onClick={() => setSortBy("deployments")}
              className={`text-xs px-3 py-1.5 transition-colors ${
                sortBy === "deployments" ? "text-lime" : "text-gray-500 hover:text-white"
              }`}
            >
              Most Deployed
            </button>
            <button
              onClick={() => setSortBy("rating")}
              className={`text-xs px-3 py-1.5 transition-colors ${
                sortBy === "rating" ? "text-lime" : "text-gray-500 hover:text-white"
              }`}
            >
              Top Rated
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="container py-12">
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-600">
            <div className="font-mono-gmi text-sm mb-2">// No Claws found</div>
            <div className="text-xs">Try adjusting your search or filter</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-800">
            {filtered.map((claw) => (
              <div
                key={claw.id}
                className="group bg-black p-6 hover:bg-gray-950 transition-colors cursor-pointer border border-transparent hover:border-lime"
                style={{ margin: "1px" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="gmi-label text-gray-600">{claw.category}</span>
                  <div className="flex items-center gap-1 text-lime font-mono-gmi text-xs">
                    <Star size={10} fill="currentColor" />
                    {claw.rating}
                  </div>
                </div>

                <h3 className="font-display text-lg text-white mb-2 group-hover:text-lime transition-colors">
                  {claw.name}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-2">
                  {claw.description}
                </p>

                <div className="flex flex-wrap gap-1 mb-5">
                  {claw.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 border border-gray-800 text-gray-500 font-mono-gmi group-hover:border-gray-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5 border-t border-gray-800 pt-4">
                  {[
                    { label: "MODEL", value: claw.model },
                    { label: "LATENCY", value: claw.latency },
                    { label: "PRICE", value: claw.price },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className="text-xs text-gray-600 font-mono-gmi mb-0.5">{stat.label}</div>
                      <div className="text-xs text-gray-300 font-mono-gmi truncate">{stat.value}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-gray-600 font-mono-gmi text-xs">
                    <Zap size={10} />
                    {claw.deployments.toLocaleString()} deployments
                  </div>
                  <button
                    onClick={() => setDeployTarget(claw)}
                    className="btn-primary-lime text-xs px-4 py-2 flex items-center gap-1.5"
                  >
                    Deploy <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />

      {/* Deploy Modal */}
      {deployTarget && (
        <DeployModal claw={deployTarget} onClose={() => setDeployTarget(null)} />
      )}
    </div>
  );
}
