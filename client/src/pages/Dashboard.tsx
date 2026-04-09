import { useState } from "react";
import {
  Activity, Zap, DollarSign, Clock, BarChart2, Terminal,
  TrendingUp, Server, RefreshCw, Plus, ArrowRight, CheckCircle, AlertTriangle
} from "lucide-react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";

// ─── Mock data ────────────────────────────────────────────────────────────────

const DEPLOYMENTS = [
  { id: "dep-001", name: "Contract Review Claw", status: "running", tier: "Option C", calls: "12,847", latency: "340ms", cost: "$184", model: "Qwen2.5 72B" },
  { id: "dep-002", name: "Code Review Agent", status: "running", tier: "Option B", calls: "7,832", latency: "812ms", cost: "$97", model: "DeepSeek-Coder V2" },
  { id: "dep-003", name: "Enterprise RAG Pipeline", status: "idle", tier: "Option C", calls: "203", latency: "342ms", cost: "$12", model: "Llama 3.1 70B" },
];

const KPI = [
  { label: "Total Invocations", value: "20,882", icon: <Zap size={16} />, delta: "+18% vs last month" },
  { label: "Monthly Infra Cost", value: "$293", icon: <DollarSign size={16} />, delta: "On track for $320 cap" },
  { label: "Avg Uptime", value: "99.97%", icon: <Activity size={16} />, delta: "All systems healthy" },
  { label: "Avg Latency", value: "498ms", icon: <Clock size={16} />, delta: "-22ms vs last week" },
];

const WEEKLY = [
  { day: "Mon", val: 1420 }, { day: "Tue", val: 1890 }, { day: "Wed", val: 2430 },
  { day: "Thu", val: 2710 }, { day: "Fri", val: 3640 }, { day: "Sat", val: 1750 }, { day: "Sun", val: 1510 },
];
const MAX_WEEKLY = Math.max(...WEEKLY.map((w) => w.val));

const COST_BREAKDOWN = [
  { label: "Container (Option C × 2)", amount: "$184" },
  { label: "MaaS — Qwen2.5 72B", amount: "$62" },
  { label: "MaaS — DeepSeek-Coder V2", amount: "$35" },
  { label: "Egress", amount: "$12" },
];

const LOGS = [
  { time: "23:14:02", level: "INFO", msg: "dep-001 | Contract review complete: 3 clauses flagged" },
  { time: "23:14:01", level: "INFO", msg: "dep-001 | Processing document (14 pages)..." },
  { time: "23:13:58", level: "INFO", msg: "dep-002 | Code review complete: PR #847 — 3 issues found" },
  { time: "23:13:55", level: "WARN", msg: "dep-002 | High memory usage detected (78% of limit)" },
  { time: "23:13:50", level: "INFO", msg: "dep-001 | Health check passed" },
  { time: "23:13:45", level: "INFO", msg: "dep-003 | Idle — no requests in last 5 minutes" },
  { time: "23:13:40", level: "INFO", msg: "dep-001 | Invocation complete in 312ms" },
  { time: "23:13:38", level: "INFO", msg: "dep-002 | Processing PR #846 diff (1,240 lines)" },
  { time: "23:13:30", level: "ERROR", msg: "dep-002 | Timeout on PR #845 — retrying (1/3)" },
  { time: "23:13:20", level: "INFO", msg: "dep-001 | New invocation received" },
];

const MARKETPLACE_STATS = [
  { label: "Impressions (7d)", value: "4,210" },
  { label: "Click-through Rate", value: "6.3%" },
  { label: "Paid Conversions", value: "38" },
  { label: "Marketplace Rank", value: "#3 in Integration" },
];

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

type Tab = "overview" | "analytics" | "costs" | "logs" | "marketplace";

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Activity size={14} /> },
  { id: "analytics", label: "Usage Analytics", icon: <BarChart2 size={14} /> },
  { id: "costs", label: "Infrastructure Costs", icon: <Server size={14} /> },
  { id: "logs", label: "Run Logs", icon: <Terminal size={14} /> },
  { id: "marketplace", label: "Marketplace Performance", icon: <TrendingUp size={14} /> },
];

// ─── Sub-views ────────────────────────────────────────────────────────────────

function OverviewTab() {
  const [, setLocation] = useLocation();
  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: "#1a1a1a" }}>
        {KPI.map((k) => (
          <div key={k.label} className="p-5" style={{ background: "#000" }}>
            <div className="flex items-center justify-between mb-3">
              <div style={{ color: "#555" }}>{k.icon}</div>
              <div className="gmi-label text-gray-700 text-right">{k.label}</div>
            </div>
            <div className="font-mono-gmi text-2xl text-white mb-1">{k.value}</div>
            <div className="text-xs text-gray-600 font-mono-gmi">{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Active Claws table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-white">Active Claws</h2>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono-gmi px-2 py-0.5"
              style={{ color: "#888", border: "1px solid #222", background: "#0a0a0a" }}
            >
              ⚠ Sample Data
            </span>
            <button
              className="btn-outline-dashed text-xs px-3 py-1.5 flex items-center gap-1.5"
              onClick={() => toast.info("Refreshed")}
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>
        <div style={{ border: "1px solid #1a1a1a" }}>
          <div
            className="grid grid-cols-6 gap-4 px-5 py-3"
            style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}
          >
            {["Claw", "Status", "Tier", "Invocations", "Latency", "Cost/mo"].map((h) => (
              <div key={h} className="gmi-label text-gray-600 text-xs">{h}</div>
            ))}
          </div>
          {DEPLOYMENTS.map((dep) => (
            <div
              key={dep.id}
              className="grid grid-cols-6 gap-4 px-5 py-4 items-center"
              style={{ borderBottom: "1px solid #111" }}
            >
              <div>
                <div className="font-medium text-white text-sm">{dep.name}</div>
                <div className="text-xs text-gray-600 font-mono-gmi mt-0.5">{dep.model}</div>
              </div>
              <div>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-mono-gmi px-2 py-0.5"
                  style={
                    dep.status === "running"
                      ? { color: "#DDEA4D", background: "rgba(221,234,77,0.08)" }
                      : { color: "#555", background: "#0d0d0d" }
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: dep.status === "running" ? "#DDEA4D" : "#444",
                      animation: dep.status === "running" ? "pulse 2s infinite" : "none",
                    }}
                  />
                  {dep.status}
                </span>
              </div>
              <div className="font-mono-gmi text-xs text-gray-400">{dep.tier}</div>
              <div className="font-mono-gmi text-xs text-gray-300">{dep.calls}</div>
              <div className="font-mono-gmi text-xs text-gray-300">{dep.latency}</div>
              <div className="font-mono-gmi text-xs" style={{ color: "#DDEA4D" }}>{dep.cost}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Deploy CTA */}
      <div
        className="flex items-center justify-between p-5"
        style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
      >
        <div>
          <div className="font-display text-sm text-white mb-1">Deploy another Claw</div>
          <div className="text-xs text-gray-600 font-mono-gmi">Configure compute, storage, and model in 4 steps.</div>
        </div>
        <button
          onClick={() => setLocation("/deploy")}
          className="btn-primary-lime px-4 py-2.5 text-xs font-bold flex items-center gap-1.5"
        >
          <Plus size={12} /> New Deployment
        </button>
      </div>
    </div>
  );
}

function AnalyticsTab() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-white">Weekly Invocations — Last 7 Days</h2>
          <span className="text-xs font-mono-gmi px-2 py-0.5" style={{ color: "#888", border: "1px solid #222", background: "#0a0a0a" }}>
            ⚠ Sample Data
          </span>
        </div>
        <div style={{ border: "1px solid #1a1a1a", background: "#000", padding: "1.5rem" }}>
          {/* Bar chart */}
          <div className="flex items-end gap-3 h-48">
            {WEEKLY.map((w) => {
              const pct = (w.val / MAX_WEEKLY) * 100;
              const isFri = w.day === "Fri";
              return (
                <div key={w.day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="font-mono-gmi text-xs text-gray-600">{w.val >= 1000 ? `${(w.val / 1000).toFixed(1)}k` : w.val}</div>
                  <div className="w-full flex items-end" style={{ height: "140px" }}>
                    <div
                      className="w-full transition-all"
                      style={{
                        height: `${pct}%`,
                        background: isFri ? "#DDEA4D" : "#1e1e1e",
                        border: isFri ? "none" : "1px solid #2a2a2a",
                      }}
                    />
                  </div>
                  <div className="font-mono-gmi text-xs" style={{ color: isFri ? "#DDEA4D" : "#555" }}>{w.day}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Per-Claw breakdown */}
      <div>
        <h2 className="font-display text-lg text-white mb-4">Invocations by Claw</h2>
        <div style={{ border: "1px solid #1a1a1a" }}>
          {DEPLOYMENTS.map((dep, i) => (
            <div
              key={dep.id}
              className="flex items-center gap-4 px-5 py-4"
              style={{ borderBottom: i < DEPLOYMENTS.length - 1 ? "1px solid #111" : "none" }}
            >
              <div className="flex-1">
                <div className="text-sm text-white mb-1">{dep.name}</div>
                <div className="h-1.5 w-full" style={{ background: "#111" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(parseInt(dep.calls.replace(/,/g, "")) / 20882) * 100}%`,
                      background: "#DDEA4D",
                    }}
                  />
                </div>
              </div>
              <div className="font-mono-gmi text-xs text-gray-400 w-16 text-right">{dep.calls}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CostsTab() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-white">Infrastructure Cost Breakdown</h2>
        <span className="text-xs font-mono-gmi px-2 py-0.5" style={{ color: "#888", border: "1px solid #222", background: "#0a0a0a" }}>
          ⚠ Sample Data
        </span>
      </div>

      {/* Total */}
      <div className="p-6" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
        <div className="gmi-label mb-2">Total This Month</div>
        <div className="font-mono-gmi text-4xl text-white mb-1">$293</div>
        <div className="text-xs text-gray-600 font-mono-gmi">Billing cycle: Apr 1 – Apr 30</div>
      </div>

      {/* Line items */}
      <div style={{ border: "1px solid #1a1a1a" }}>
        <div className="grid grid-cols-3 gap-4 px-5 py-3" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
          {["Line Item", "Type", "Amount"].map((h) => (
            <div key={h} className="gmi-label text-gray-600 text-xs">{h}</div>
          ))}
        </div>
        {COST_BREAKDOWN.map((item, i) => (
          <div
            key={item.label}
            className="grid grid-cols-3 gap-4 px-5 py-4 items-center"
            style={{ borderBottom: i < COST_BREAKDOWN.length - 1 ? "1px solid #111" : "none" }}
          >
            <div className="text-sm text-white">{item.label}</div>
            <div className="font-mono-gmi text-xs text-gray-500">
              {item.label.includes("Container") ? "Compute" : item.label.includes("MaaS") ? "MaaS" : "Network"}
            </div>
            <div className="font-mono-gmi text-xs" style={{ color: "#DDEA4D" }}>{item.amount}</div>
          </div>
        ))}
      </div>

      {/* Reserved plan upsell */}
      <div
        className="flex items-center justify-between p-5"
        style={{ background: "#0a0a0a", border: "1px solid rgba(221,234,77,0.15)" }}
      >
        <div>
          <div className="font-display text-sm mb-1" style={{ color: "#DDEA4D" }}>Switch to Reserved Plan</div>
          <div className="text-xs text-gray-600 font-mono-gmi">Commit monthly, save up to 20% on compute costs.</div>
        </div>
        <button
          className="text-xs font-bold px-4 py-2.5 flex items-center gap-1.5"
          style={{ background: "#DDEA4D", color: "#000" }}
          onClick={() => toast.info("Reserved plan coming soon!")}
        >
          Learn More <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}

function LogsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-white">Run Logs</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono-gmi px-2 py-0.5" style={{ color: "#888", border: "1px solid #222", background: "#0a0a0a" }}>
            ⚠ Sample Data
          </span>
          <div className="flex items-center gap-1.5 font-mono-gmi text-xs" style={{ color: "#DDEA4D" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#DDEA4D", animation: "pulse 2s infinite" }} />
            LIVE
          </div>
        </div>
      </div>
      <div style={{ background: "#000", border: "1px solid #1a1a1a", padding: "1.25rem", minHeight: "360px" }}>
        <div className="space-y-2">
          {LOGS.map((line, i) => (
            <div key={i} className="flex gap-3 font-mono-gmi text-xs">
              <span className="text-gray-600 shrink-0">{line.time}</span>
              <span
                className="shrink-0 w-14"
                style={{
                  color: line.level === "WARN" ? "#facc15" : line.level === "ERROR" ? "#f87171" : "#DDEA4D",
                }}
              >
                [{line.level}]
              </span>
              <span style={{ color: line.level === "ERROR" ? "#f87171" : "#666" }}>{line.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketplaceTab() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-white">Marketplace Performance</h2>
        <span className="text-xs font-mono-gmi px-2 py-0.5" style={{ color: "#888", border: "1px solid #222", background: "#0a0a0a" }}>
          ⚠ Sample Data
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: "#1a1a1a" }}>
        {MARKETPLACE_STATS.map((s) => (
          <div key={s.label} className="p-5" style={{ background: "#000" }}>
            <div className="gmi-label text-gray-700 mb-3">{s.label}</div>
            <div className="font-mono-gmi text-2xl text-white">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Listing health */}
      <div>
        <h3 className="font-display text-base text-white mb-4">Listing Health</h3>
        <div style={{ border: "1px solid #1a1a1a" }}>
          {[
            { check: "Claw is deployed and accessible", ok: true },
            { check: "Full description provided", ok: true },
            { check: "Type label assigned", ok: true },
            { check: "Pricing clearly stated", ok: true },
            { check: "Publisher contact on file", ok: true },
            { check: "Sample outputs added", ok: false },
          ].map((item, i) => (
            <div
              key={item.check}
              className="flex items-center gap-3 px-5 py-3"
              style={{ borderBottom: i < 5 ? "1px solid #111" : "none" }}
            >
              {item.ok ? (
                <CheckCircle size={14} style={{ color: "#DDEA4D" }} />
              ) : (
                <AlertTriangle size={14} style={{ color: "#facc15" }} />
              )}
              <span className="text-sm font-mono-gmi" style={{ color: item.ok ? "#888" : "#facc15" }}>
                {item.check}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const tabComponents: Record<Tab, React.ReactNode> = {
    overview: <OverviewTab />,
    analytics: <AnalyticsTab />,
    costs: <CostsTab />,
    logs: <LogsTab />,
    marketplace: <MarketplaceTab />,
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#000", color: "#fff" }}>
      <Navbar />

      <div className="flex-1" style={{ marginLeft: "220px" }}>
      <div className="pt-8 pb-16">
        <div className="container">
          {/* Page header */}
          <div className="mb-8 pt-4">
            <div className="gmi-label mb-2">Developer Console</div>
            <div className="flex items-end justify-between">
              <h1 className="font-display text-4xl text-white" style={{ letterSpacing: "-0.03em" }}>
                My Claws
              </h1>
              <div className="hidden md:flex items-center gap-2 font-mono-gmi text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-lime animate-pulse" />
                All systems operational
              </div>
            </div>
          </div>

          {/* Layout: left sidebar + content */}
          <div className="flex gap-10">
            {/* Left sidebar */}
            <aside className="w-52 shrink-0">
              {/* Claw selector */}
              <div
                className="p-3 mb-6"
                style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
              >
                <div className="gmi-label mb-2">Active Claw</div>
                <div className="font-mono-gmi text-xs text-white truncate">contract-review-claw</div>
                <div className="font-mono-gmi text-xs text-gray-600 mt-0.5">v2.1.0 · running</div>
              </div>

              {/* Nav tabs */}
              <nav className="space-y-0.5">
                {NAV.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 text-sm font-mono-gmi transition-colors"
                    style={{
                      background: activeTab === item.id ? "rgba(221,234,77,0.08)" : "transparent",
                      color: activeTab === item.id ? "#DDEA4D" : "#666",
                      borderLeft: `2px solid ${activeTab === item.id ? "#DDEA4D" : "transparent"}`,
                    }}
                    onMouseEnter={(e) => { if (activeTab !== item.id) (e.currentTarget as HTMLButtonElement).style.color = "#aaa"; }}
                    onMouseLeave={(e) => { if (activeTab !== item.id) (e.currentTarget as HTMLButtonElement).style.color = "#666"; }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* Separator */}
              <div className="my-6" style={{ borderTop: "1px solid #1a1a1a" }} />

              {/* Quick links */}
              <div className="space-y-0.5">
                {[
                  { label: "Marketplace", href: "/marketplace" },
                  { label: "List a Claw", href: "/list-claw" },
                  { label: "New Deployment", href: "/deploy" },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="block px-3 py-2 text-xs font-mono-gmi transition-colors"
                    style={{ color: "#555" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#aaa")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {tabComponents[activeTab]}
            </div>
          </div>
        </div>
      </div>

      <Footer />
      </div>
    </div>
  );
}
