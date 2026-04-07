import { Link } from "wouter";
import { useState, useEffect } from "react";
import { ArrowRight, Zap, Shield, Code2, ChevronRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663324630024/6kTbiFcTmophGkVmfgPX9K/hero-bg-ZyirAztKSiCrab98axLPJW.png";
const CLAW_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663324630024/6kTbiFcTmophGkVmfgPX9K/claw-abstract-45v3rDKqZGUXwbDmWkRejA.png";

const TYPEWRITER_TEXTS = [
  "Deploy Autonomous AI Agents.",
  "Build Production-Ready Claws.",
  "Scale Without Integration Tax.",
];

const FEATURED_CLAWS = [
  {
    id: "defi-arb",
    name: "DeFi Arbitrage Scout",
    category: "DeFi",
    description: "Monitors cross-chain price differentials and executes arbitrage strategies autonomously.",
    model: "Llama 3.1 70B",
    deployments: "2,847",
    rating: "4.9",
    tags: ["DeFi", "Arbitrage", "Multi-chain"],
  },
  {
    id: "code-reviewer",
    name: "Code Review Agent",
    category: "Developer Tools",
    description: "Performs deep static analysis, security audits, and suggests refactors with explanations.",
    model: "DeepSeek-Coder V2",
    deployments: "5,120",
    rating: "4.8",
    tags: ["Code", "Security", "CI/CD"],
  },
  {
    id: "enterprise-rag",
    name: "Enterprise RAG Pipeline",
    category: "Enterprise",
    description: "Ingests, indexes, and queries internal knowledge bases with citation-backed responses.",
    model: "Qwen2.5 72B",
    deployments: "1,203",
    rating: "4.9",
    tags: ["RAG", "Enterprise", "Knowledge"],
  },
];

function TypewriterText() {
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    const current = TYPEWRITER_TEXTS[textIndex];
    const speed = isDeleting ? 40 : 70;

    const timer = setTimeout(() => {
      if (!isDeleting && charIndex < current.length) {
        setDisplayed(current.slice(0, charIndex + 1));
        setCharIndex((c) => c + 1);
      } else if (!isDeleting && charIndex === current.length) {
        setTimeout(() => setIsDeleting(true), 1800);
      } else if (isDeleting && charIndex > 0) {
        setDisplayed(current.slice(0, charIndex - 1));
        setCharIndex((c) => c - 1);
      } else if (isDeleting && charIndex === 0) {
        setIsDeleting(false);
        setTextIndex((i) => (i + 1) % TYPEWRITER_TEXTS.length);
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, textIndex]);

  return (
    <span className="text-lime">
      {displayed}
      <span className="animate-pulse">|</span>
    </span>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />

        <div className="container relative z-10 py-32">
          <div className="max-w-3xl">
            <div className="gmi-label mb-6">GMI Claw Marketplace — Pre-Release</div>
            <h1 className="font-display text-5xl md:text-7xl leading-[1.05] mb-6 text-white">
              The Autonomous
              <br />
              AI Agent Platform.
            </h1>
            <p className="text-xl md:text-2xl font-display text-lime mb-4 min-h-[2.5rem]">
              <TypewriterText />
            </p>
            <p className="text-base text-gray-400 mb-10 max-w-xl leading-relaxed">
              Discover, deploy, and monetize autonomous AI agents (Claws) on the world's first purpose-built agent marketplace — powered by GMI Cloud infrastructure.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/marketplace">
                <button className="btn-primary-lime flex items-center gap-2 text-sm font-bold px-6 py-3">
                  Explore Marketplace <ArrowRight size={16} />
                </button>
              </Link>
              <button className="btn-outline-dashed flex items-center gap-2 text-sm">
                Build a Claw <Code2 size={16} />
              </button>
            </div>

            {/* Stats row */}
            <div className="mt-16 flex flex-wrap gap-8 border-t border-gray-800 pt-8">
              {[
                { label: "Claws Available", value: "200+" },
                { label: "Active Deployments", value: "12,400+" },
                { label: "Avg Deploy Time", value: "< 30s" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="font-mono-gmi text-2xl font-medium text-lime">{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1 uppercase tracking-widest">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Claw image — right side */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[45%] opacity-60 pointer-events-none hidden lg:block">
          <img src={CLAW_IMG} alt="GMI Claw" className="w-full h-auto" />
        </div>
      </section>

      {/* ── What is a Claw ── */}
      <section className="section-light py-24">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="gmi-label mb-4" style={{ color: "#000", opacity: 0.5 }}>The Foundation</div>
              <h2 className="font-display text-4xl md:text-5xl text-black leading-tight mb-6">
                What is a Claw?
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">
                A <strong>Claw</strong> is a self-contained autonomous AI entity: a combination of a <strong>Framework</strong> (the agent's reasoning architecture) and a <strong>Skill</strong> (a specialized capability or tool). Together, they form a deployable, production-ready agent.
              </p>
              <p className="text-gray-600 leading-relaxed mb-8">
                Unlike traditional AI integrations that require weeks of setup, Claws deploy in under 30 seconds with zero infrastructure overhead. Every Claw runs on GMI's purpose-built compute infrastructure — no API keys, no configuration, no integration tax.
              </p>
              <div className="flex items-center gap-2 text-black font-medium text-sm">
                <Link href="/marketplace" className="flex items-center gap-1 hover:text-lime transition-colors" style={{ color: "inherit" }}>
                  Browse the Marketplace <ChevronRight size={16} />
                </Link>
              </div>
            </div>

            {/* Formula visual */}
            <div className="bg-black p-8 dot-bg">
              <div className="font-mono-gmi text-xs text-gray-500 mb-6 uppercase tracking-widest">// Claw = Framework + Skill</div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="claw-card p-6 flex-1 min-w-[140px]">
                  <div className="text-lime text-xs font-mono-gmi mb-2">FRAMEWORK</div>
                  <div className="text-white font-display text-lg">ReAct Loop</div>
                  <div className="text-gray-500 text-xs mt-2">Reasoning architecture</div>
                </div>
                <div className="text-lime font-display text-3xl">+</div>
                <div className="claw-card p-6 flex-1 min-w-[140px]">
                  <div className="text-lime text-xs font-mono-gmi mb-2">SKILL</div>
                  <div className="text-white font-display text-lg">DeFi Scout</div>
                  <div className="text-gray-500 text-xs mt-2">Specialized capability</div>
                </div>
                <div className="text-lime font-display text-3xl">=</div>
                <div className="border border-lime p-6 flex-1 min-w-[140px]" style={{ background: "rgba(200,255,0,0.05)" }}>
                  <div className="text-lime text-xs font-mono-gmi mb-2">CLAW</div>
                  <div className="text-white font-display text-lg">Autonomous Entity</div>
                  <div className="text-gray-500 text-xs mt-2">Ready to deploy</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Claws ── */}
      <section className="section-dark py-24">
        <div className="container">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="gmi-label mb-3">The Marketplace</div>
              <h2 className="font-display text-4xl md:text-5xl text-white">Featured Claws</h2>
            </div>
            <Link href="/marketplace">
              <button className="btn-outline-dashed hidden md:flex items-center gap-2">
                View All <ArrowRight size={14} />
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-800">
            {FEATURED_CLAWS.map((claw) => (
              <div key={claw.id} className="claw-card p-6 group cursor-pointer" style={{ background: "#0a0a0a" }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="gmi-label text-gray-500">{claw.category}</div>
                  <div className="font-mono-gmi text-xs text-lime">★ {claw.rating}</div>
                </div>
                <h3 className="font-display text-xl text-white mb-3 group-hover:text-lime transition-colors">
                  {claw.name}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">{claw.description}</p>
                <div className="flex flex-wrap gap-1 mb-4">
                  {claw.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 border border-gray-700 text-gray-400 font-mono-gmi">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="border-t border-gray-800 pt-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-600 font-mono-gmi">MODEL</div>
                    <div className="text-xs text-gray-300 font-mono-gmi">{claw.model}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-600 font-mono-gmi">DEPLOYMENTS</div>
                    <div className="text-xs text-lime font-mono-gmi">{claw.deployments}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Two Ways to Engage ── */}
      <section className="section-light py-24">
        <div className="container">
          <div className="text-center mb-16">
            <div className="gmi-label mb-4" style={{ color: "#000", opacity: 0.5 }}>Two Ways to Engage</div>
            <h2 className="font-display text-4xl md:text-5xl text-black">How Will You Use Claw?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Track A: User */}
            <div className="bg-black p-8 border border-gray-800 group hover:border-lime transition-colors">
              <div className="gmi-label mb-4">Track A — Enterprise User</div>
              <h3 className="font-display text-3xl text-white mb-4">Use a Claw</h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                Browse the catalog, select a Claw that fits your use case, and deploy it to your workflow in seconds. No AI expertise required.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "One-click deployment",
                  "Pre-configured for production",
                  "Pay per execution or flat monthly",
                  "Monitor performance in real-time",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="text-lime font-mono-gmi">→</span> {item}
                  </li>
                ))}
              </ul>
              <Link href="/marketplace">
                <button className="btn-primary-lime w-full text-center">
                  Browse Marketplace
                </button>
              </Link>
            </div>

            {/* Track B: Developer */}
            <div className="bg-black p-8 border border-gray-800 group hover:border-lime transition-colors">
              <div className="gmi-label mb-4">Track B — Claw Builder</div>
              <h3 className="font-display text-3xl text-white mb-4">Build a Claw</h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                Use the GMI Developer Toolkit (MaaS) to build, test, and publish your own Claws. Earn revenue every time your Claw is deployed.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Full SDK & CLI access",
                  "Serverless GPU compute included",
                  "Revenue share on deployments",
                  "Version control & rollback",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="text-lime font-mono-gmi">→</span> {item}
                  </li>
                ))}
              </ul>
              <button className="btn-outline-dashed w-full" onClick={() => {}}>
                Start Building (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Infrastructure ── */}
      <section className="section-dark py-24">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="gmi-label mb-4">Purpose-Built Infrastructure</div>
              <h2 className="font-display text-4xl md:text-5xl text-white mb-6">
                Zero Integration Tax.
                <br />
                <span className="text-lime">Infinite Scale.</span>
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                The GMI Claw Marketplace runs on two proprietary infrastructure layers that eliminate the traditional AI deployment bottleneck.
              </p>
              <div className="space-y-6">
                {[
                  {
                    icon: <Code2 size={20} />,
                    title: "Developer Toolkit (MaaS)",
                    desc: "Model-as-a-Service layer. Access 200+ open-source models via a unified API. No model management, no versioning headaches.",
                  },
                  {
                    icon: <Zap size={20} />,
                    title: "Cluster Engine",
                    desc: "Dedicated GPU cluster orchestration. Burst to 1,000+ H100s on demand. Predictable latency, transparent pricing.",
                  },
                  {
                    icon: <Shield size={20} />,
                    title: "Enterprise Security",
                    desc: "SOC 2 Type II compliant. Private deployment options. Full audit logs and access controls.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="text-lime mt-0.5 shrink-0">{item.icon}</div>
                    <div>
                      <div className="font-display text-white font-semibold mb-1">{item.title}</div>
                      <div className="text-gray-400 text-sm leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Terminal preview */}
            <div className="bg-black border border-gray-800 p-0 overflow-hidden">
              <div className="bg-gray-900 px-4 py-3 flex items-center gap-2 border-b border-gray-800">
                <div className="w-3 h-3 rounded-full bg-red-500 opacity-60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-60" />
                <div className="w-3 h-3 rounded-full bg-green-500 opacity-60" />
                <span className="font-mono-gmi text-xs text-gray-500 ml-2">gmi-claw deploy</span>
              </div>
              <div className="p-6 space-y-1">
                {[
                  { text: "$ gmi claw deploy defi-arb-scout --env production", dim: false },
                  { text: "", dim: true },
                  { text: "✓ Resolving Claw manifest...", dim: true },
                  { text: "✓ Allocating compute (H100 × 2)...", dim: true },
                  { text: "✓ Injecting model weights (Llama 3.1 70B)...", dim: true },
                  { text: "✓ Running health checks...", dim: true },
                  { text: "", dim: true },
                  { text: "◆ Deployment complete in 24.3s", dim: false },
                  { text: "◆ Endpoint: https://api.gmi.ai/claws/defi-arb-scout", dim: false },
                  { text: "◆ Status: RUNNING", dim: false },
                ].map((line, i) => (
                  <div key={i} className={`terminal-line ${line.dim ? "dim" : ""}`}>
                    {line.text || "\u00A0"}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="section-light py-24">
        <div className="container text-center">
          <div className="gmi-label mb-4" style={{ color: "#000", opacity: 0.5 }}>Get Started Today</div>
          <h2 className="font-display text-4xl md:text-6xl text-black mb-6">
            Ready to Deploy Your
            <br />
            First Claw?
          </h2>
          <p className="text-gray-600 max-w-xl mx-auto mb-10 leading-relaxed">
            Join 500+ teams already running autonomous AI agents on GMI Cloud. Pre-release access is open now.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/marketplace">
              <button className="btn-primary-lime flex items-center gap-2 px-8 py-4 text-base font-bold">
                Explore the Marketplace <ArrowRight size={18} />
              </button>
            </Link>
            <button className="btn-outline-dashed px-8 py-4 text-base" style={{ borderColor: "#000", color: "#000" }}>
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
