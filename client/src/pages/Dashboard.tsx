import { useState, useEffect, useRef } from "react";
import {
  Activity, Zap, DollarSign, Clock, BarChart2, Terminal,
  TrendingUp, Server, RefreshCw, Plus, ArrowRight, CheckCircle, AlertTriangle,
  Copy, Globe, Lock, FileText, ExternalLink
} from "lucide-react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";

// ─── Odometer animation ───────────────────────────────────────────────────────
const ROLL_CSS = `
  @keyframes gmi-roll-down {
    0%   { transform: translateY(-110%); opacity: 0.4; }
    100% { transform: translateY(0%);    opacity: 1;   }
  }
`;

function RollingNumber({ value, style }: { value: string; style?: React.CSSProperties }) {
  const prevRef = useRef(value);
  const tickRef = useRef(0);
  const [ticks, setTicks] = useState<Record<number, number>>({});

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (prev === value) return;
    const vArr = value.split("").reverse();
    const pArr = prev.split("").reverse();
    const changed: Record<number, number> = {};
    vArr.forEach((ch, ri) => {
      if (/\d/.test(ch) && ch !== pArr[ri]) {
        const fwdIdx = value.length - 1 - ri;
        tickRef.current += 1;
        changed[fwdIdx] = tickRef.current;
      }
    });
    if (Object.keys(changed).length) setTicks((t) => ({ ...t, ...changed }));
  }, [value]);

  return (
    <span style={{ display: "inline-flex", ...style }}>
      {value.split("").map((ch, i) => {
        const isDigit = /\d/.test(ch);
        const tick = ticks[i];
        return (
          <span key={i} style={{ display: "inline-block", overflow: isDigit ? "hidden" : "visible", lineHeight: "inherit" }}>
            <span key={tick ?? "s"} style={{ display: "block", animation: tick ? `gmi-roll-down 0.22s cubic-bezier(0.16,1,0.3,1) both` : undefined }}>
              {ch}
            </span>
          </span>
        );
      })}
    </span>
  );
}

// ─── Mock data ────────────────────────────────────────────────────────────────
// Marketplace state: Unlisted | Published | Unpublished
const PROJECTS = [
  { id: "dep-001", name: "contract-review-v2", infraState: "running" as const, marketplaceState: "published" as const, tier: "Tier C", minContainers: 1, maxContainers: 5, calls: "12,847", latency: "340ms", dailyCost: "$4.32", model: "Qwen2.5 72B", privateUrl: "https://contract-review-v2.private.gmi.ai", maasKey: "gmi_maas_sk_abc123", listingName: "Contract Review Agent" },
  { id: "dep-002", name: "code-review-agent", infraState: "running" as const, marketplaceState: "published" as const, tier: "Tier B", minContainers: 2, maxContainers: 10, calls: "7,832", latency: "812ms", dailyCost: "$8.64", model: "DeepSeek-Coder V2", privateUrl: "https://code-review-agent.private.gmi.ai", maasKey: "gmi_maas_sk_def456", listingName: "Code Review Agent" },
  { id: "dep-003", name: "rag-pipeline-v1", infraState: "stopped" as const, marketplaceState: "unlisted" as const, tier: "Tier C", minContainers: 1, maxContainers: 3, calls: "203", latency: "342ms", dailyCost: "$0.00", model: "Llama 3.1 70B", privateUrl: "https://rag-pipeline-v1.private.gmi.ai", maasKey: "gmi_maas_sk_ghi789", listingName: null },
];

const DEPLOYMENTS = PROJECTS.map(p => ({ id: p.id, name: p.listingName || p.name, status: p.infraState === "running" ? "running" : "idle", tier: p.tier, calls: p.calls, latency: p.latency, cost: p.dailyCost }));

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

type LogLine = { time: string; level: "INFO" | "WARN" | "ERROR"; msg: string };
const LOGS_DATA: Record<string, { containers: string[]; logs: Record<string, LogLine[]> }> = {
  "dep-001": {
    containers: ["container-1", "container-2"],
    logs: {
      "container-1": [
        { time: "23:14:02", level: "INFO",  msg: "Contract review complete: 3 clauses flagged" },
        { time: "23:14:01", level: "INFO",  msg: "Processing document (14 pages)..." },
        { time: "23:13:50", level: "INFO",  msg: "Health check passed" },
        { time: "23:13:40", level: "INFO",  msg: "Invocation complete in 312ms" },
        { time: "23:13:20", level: "INFO",  msg: "New invocation received" },
      ],
      "container-2": [
        { time: "23:14:00", level: "INFO",  msg: "Health check passed" },
        { time: "23:13:45", level: "INFO",  msg: "Idle — waiting for requests" },
        { time: "23:13:10", level: "INFO",  msg: "Container scaled up (autoscale trigger)" },
      ],
    },
  },
  "dep-002": {
    containers: ["container-1", "container-2", "container-3"],
    logs: {
      "container-1": [
        { time: "23:13:58", level: "INFO",  msg: "Code review complete: PR #847 — 3 issues found" },
        { time: "23:13:38", level: "INFO",  msg: "Processing PR #846 diff (1,240 lines)" },
        { time: "23:13:30", level: "ERROR", msg: "Timeout on PR #845 — retrying (1/3)" },
      ],
      "container-2": [
        { time: "23:13:55", level: "WARN",  msg: "High memory usage detected (78% of limit)" },
        { time: "23:13:40", level: "INFO",  msg: "Health check passed" },
        { time: "23:13:05", level: "INFO",  msg: "Invocation complete in 820ms" },
      ],
      "container-3": [
        { time: "23:13:50", level: "INFO",  msg: "Health check passed" },
        { time: "23:13:30", level: "INFO",  msg: "Idle — no requests in last 2 minutes" },
        { time: "23:12:45", level: "INFO",  msg: "Container started" },
      ],
    },
  },
  "dep-003": {
    containers: ["container-1"],
    logs: {
      "container-1": [
        { time: "23:13:45", level: "INFO",  msg: "Idle — no requests in last 5 minutes" },
        { time: "23:12:30", level: "INFO",  msg: "Health check passed" },
        { time: "23:10:00", level: "INFO",  msg: "Container started" },
      ],
    },
  },
};

// ─── Live KPI hook ────────────────────────────────────────────────────────────
function useLiveKPI() {
  const [invocations, setInvocations] = useState(20882);
  const [costCents, setCostCents] = useState(29300);
  const [latency, setLatency] = useState(498);
  const [uptime, setUptime] = useState(99.97);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    function triggerFlash(field: string) {
      setFlash(field);
      setTimeout(() => setFlash(null), 450);
    }
    const id = setInterval(() => {
      const r = Math.random();
      if (r < 0.40) { setInvocations(v => v + Math.floor(Math.random() * 4) + 1); triggerFlash("invocations"); }
      else if (r < 0.65) { setCostCents(v => v + Math.floor(Math.random() * 8) + 2); triggerFlash("cost"); }
      else if (r < 0.85) { setLatency(v => Math.max(260, Math.min(820, v + Math.floor(Math.random() * 22) - 11))); triggerFlash("latency"); }
      else { setUptime(v => parseFloat(Math.max(99.90, Math.min(100.00, v + (Math.random() * 0.006 - 0.003))).toFixed(2))); triggerFlash("uptime"); }
    }, 1600);
    return () => clearInterval(id);
  }, []);

  return {
    flash,
    kpi: [
      { id: "invocations", label: "Total Invocations",  value: invocations.toLocaleString(), icon: <Zap size={16} />,        delta: "+18% vs last month"   },
      { id: "cost",        label: "Monthly Infra Cost", value: `$${(costCents / 100).toFixed(2)}`,  icon: <DollarSign size={16} />, delta: "On track for $320 cap" },
      { id: "uptime",      label: "Avg Uptime",         value: `${uptime.toFixed(2)}%`,              icon: <Activity size={16} />,  delta: "All systems healthy"  },
      { id: "latency",     label: "Avg Latency",        value: `${latency}ms`,                       icon: <Clock size={16} />,     delta: "-22ms vs last week"   },
    ],
  };
}

// ─── Live Marketplace stats hook ──────────────────────────────────────────────
function useLiveMarketplaceStats() {
  const [impressions, setImpressions] = useState(4210);
  const [ctr, setCtr] = useState(6.3);
  const [conversions, setConversions] = useState(38);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    function triggerFlash(field: string) {
      setFlash(field);
      setTimeout(() => setFlash(null), 450);
    }
    const id = setInterval(() => {
      const r = Math.random();
      if (r < 0.45) { setImpressions(v => v + Math.floor(Math.random() * 3) + 1); triggerFlash("impressions"); }
      else if (r < 0.70) { setCtr(v => parseFloat(Math.max(4.5, Math.min(9.0, v + (Math.random() * 0.1 - 0.05))).toFixed(1))); triggerFlash("ctr"); }
      else if (r < 0.88) { setConversions(v => v + 1); triggerFlash("conversions"); }
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return {
    flash,
    stats: [
      { id: "impressions", label: "Impressions (7d)",   value: impressions.toLocaleString() },
      { id: "ctr",         label: "Click-through Rate", value: `${ctr}%`                   },
      { id: "conversions", label: "Paid Conversions",   value: String(conversions)          },
      { id: "rank",        label: "Marketplace Rank",   value: "#3 in Integration"          },
    ],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function InfraStateBadge({ state }: { state: "running" | "stopped" | "provisioning" }) {
  const map = {
    running:      { color: "#DDEA4D", bg: "rgba(221,234,77,0.08)",  dot: true,  label: "Running (Private)" },
    stopped:      { color: "#999",    bg: "#0d0d0d",                dot: false, label: "Stopped"           },
    provisioning: { color: "#facc15", bg: "rgba(250,204,21,0.08)",  dot: true,  label: "Provisioning"      },
  };
  const s = map[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono-gmi px-2 py-0.5" style={{ color: s.color, background: s.bg }}>
      {s.dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color, animation: "pulse 2s infinite" }} />}
      {s.label}
    </span>
  );
}

function MarketplaceStateBadge({ state }: { state: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    unlisted:    { color: "#999",    bg: "#0d0d0d"                  },
    published:   { color: "#DDEA4D", bg: "rgba(221,234,77,0.08)"   },
    unpublished: { color: "#999",    bg: "#0d0d0d"                  },
  };
  const s = map[state] || { color: "#999", bg: "#0d0d0d" };
  const labels: Record<string, string> = { unlisted: "Not Listed", published: "Published", unpublished: "Unpublished" };
  return (
    <span className="inline-flex items-center text-xs font-mono-gmi px-2 py-0.5" style={{ color: s.color, background: s.bg }}>
      {labels[state] || state}
    </span>
  );
}

// ─── Dashboard nav ────────────────────────────────────────────────────────────
type Tab = "overview" | "analytics" | "costs" | "logs" | "marketplace";
const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",     label: "Overview",                icon: <Activity size={14} />   },
  { id: "analytics",    label: "Usage Analytics",         icon: <BarChart2 size={14} />  },
  { id: "costs",        label: "Infrastructure Costs",    icon: <Server size={14} />     },
  { id: "logs",         label: "Run Logs",                icon: <Terminal size={14} />   },
  { id: "marketplace",  label: "Marketplace Performance", icon: <TrendingUp size={14} /> },
];

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewTab() {
  const [, setLocation] = useLocation();
  const [selectedProject, setSelectedProject] = useState(PROJECTS[0].id);
  const project = PROJECTS.find(p => p.id === selectedProject)!;
  const { kpi, flash } = useLiveKPI();

  return (
    <div className="space-y-8">
      {/* Live KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: "#1a1a1a" }}>
        {kpi.map((k) => {
          const isFlashing = flash === k.id;
          return (
            <div key={k.id} className="p-5" style={{ background: isFlashing ? "rgba(221,234,77,0.05)" : "#000", transition: "background 0.15s ease" }}>
              <div className="flex items-center justify-between mb-3">
                <div style={{ color: isFlashing ? "#DDEA4D" : "#999", transition: "color 0.15s ease" }}>{k.icon}</div>
                <div className="gmi-label text-right" style={{ color: "#999" }}>{k.label}</div>
              </div>
              <RollingNumber value={k.value} style={{ fontFamily: "'GeistMono', monospace", fontSize: "1.5rem", color: isFlashing ? "#DDEA4D" : "#ffffff", transition: "color 0.15s ease", marginBottom: "0.25rem" }} />
              <div className="text-xs font-mono-gmi" style={{ color: "#999" }}>{k.delta}</div>
            </div>
          );
        })}
      </div>

      {/* Project selector */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base text-white">Claw Projects</h2>
          <button onClick={() => setLocation("/deploy")} className="btn-primary-lime px-3 py-1.5 text-xs font-bold flex items-center gap-1.5">
            <Plus size={11} /> Register a Claw
          </button>
        </div>
        <div className="space-y-2">
          {PROJECTS.map((p) => (
            <button key={p.id} onClick={() => setSelectedProject(p.id)} className="w-full text-left p-4 transition-all"
              style={{ background: selectedProject === p.id ? "rgba(221,234,77,0.04)" : "#0a0a0a", border: `1px solid ${selectedProject === p.id ? "rgba(221,234,77,0.3)" : "#1e1e1e"}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono-gmi text-sm text-white">{p.name}</div>
                  <div className="font-mono-gmi text-xs mt-0.5" style={{ color: "#999" }}>{p.tier}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <InfraStateBadge state={p.infraState} />
                  <MarketplaceStateBadge state={p.marketplaceState} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected project detail */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base text-white">{project.name}</h2>
          <span className="gmi-label">Project Dashboard</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px mb-6" style={{ background: "#1a1a1a" }}>
          {[
            { label: "Infrastructure State", value: project.infraState === "running" ? "Running (Private)" : "Stopped", color: project.infraState === "running" ? "#DDEA4D" : "#999" },
            { label: "Marketplace State", value: { unlisted: "Not Listed", published: "Published", unpublished: "Unpublished" }[project.marketplaceState] || project.marketplaceState, color: project.marketplaceState === "published" ? "#DDEA4D" : "#888" },
            { label: "Daily Cost", value: project.dailyCost, color: "#fff" },
            { label: "Avg Latency", value: project.latency, color: "#fff" },
          ].map((item) => (
            <div key={item.label} className="p-4" style={{ background: "#000" }}>
              <div className="gmi-label mb-2" style={{ color: "#888" }}>{item.label}</div>
              <div className="font-mono-gmi text-lg font-bold" style={{ color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-2 mb-6">
          {[{ label: "Private Endpoint", value: project.privateUrl }, { label: "GMI MaaS API Key", value: project.maasKey.slice(0, 20) + "••••••••" }].map((row) => (
            <div key={row.label} className="p-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
              <div className="font-mono-gmi text-xs uppercase tracking-widest mb-2" style={{ color: "#999" }}>{row.label}</div>
              <div className="flex items-center justify-between gap-4">
                <code className="font-mono-gmi text-xs text-white break-all">{row.value}</code>
                <button onClick={() => { navigator.clipboard.writeText(row.value); toast.success("Copied"); }} className="shrink-0 flex items-center gap-1.5 font-mono-gmi text-xs px-3 py-1.5" style={{ border: "1px solid #2a2a2a", color: "#888" }}>
                  <Copy size={11} /> Copy
                </button>
              </div>
            </div>
          ))}
        </div>

        {project.marketplaceState === "unlisted" && (
          <div className="flex items-center justify-between p-5" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
            <div>
              <div className="font-display text-sm text-white mb-1">Ready to go public?</div>
              <div className="text-xs font-mono-gmi" style={{ color: "#999" }}>Create a Marketplace Listing — published instantly after submission.</div>
            </div>
            <button onClick={() => setLocation("/list-claw")} className="btn-primary-lime px-4 py-2.5 text-xs font-bold flex items-center gap-1.5">
              <FileText size={12} /> Create Listing
            </button>
          </div>
        )}
        {project.marketplaceState === "published" && (
          <div className="flex items-center justify-between p-5" style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.2)" }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#DDEA4D", animation: "pulse 2s infinite" }} />
                <div className="font-display text-sm text-white">{project.listingName} is live</div>
              </div>
              <div className="text-xs font-mono-gmi" style={{ color: "#999" }}>Your Claw is publicly available on the GMI Marketplace.</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toast.info("Opening Marketplace listing...")} className="flex items-center gap-1.5 font-mono-gmi text-xs px-3 py-2" style={{ border: "1px solid #2a2a2a", color: "#888" }}>
                <ExternalLink size={11} /> View Listing
              </button>
              <button onClick={() => toast.success("Unpublished")} className="flex items-center gap-1.5 font-mono-gmi text-xs px-3 py-2" style={{ border: "1px solid #2a2a2a", color: "#888" }}>
                <Lock size={11} /> Unpublish
              </button>
            </div>
          </div>
        )}
      </div>

      {/* All Projects table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-white">All Projects</h2>
          <button className="btn-outline-dashed text-xs px-3 py-1.5 flex items-center gap-1.5" onClick={() => toast.info("Refreshed")}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
        <div style={{ border: "1px solid #1a1a1a" }}>
          <div className="grid grid-cols-6 gap-4 px-5 py-3" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
            {["Project", "Infra State", "Marketplace", "Tier", "Invocations", "Daily Cost"].map((h) => (
              <div key={h} className="gmi-label text-xs" style={{ color: "#888" }}>{h}</div>
            ))}
          </div>
          {PROJECTS.map((p) => (
            <div key={p.id} className="grid gap-4 px-5 py-4 items-center" style={{ borderBottom: "1px solid #111", gridTemplateColumns: "1.5fr 1fr 1fr 0.8fr 0.8fr 0.8fr" }}>
              <div className="font-mono-gmi text-sm text-white">{p.name}</div>
              <div><InfraStateBadge state={p.infraState} /></div>
              <div><MarketplaceStateBadge state={p.marketplaceState} /></div>
              <div className="font-mono-gmi text-xs" style={{ color: "#aaa" }}>{p.tier}</div>
              <div className="font-mono-gmi text-xs" style={{ color: "#aaa" }}>{p.calls}</div>
              <div className="font-mono-gmi text-xs" style={{ color: "#DDEA4D" }}>{p.dailyCost}/day</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between p-5" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
        <div>
          <div className="font-display text-sm text-white mb-1">Register a new Claw</div>
          <div className="text-xs font-mono-gmi" style={{ color: "#999" }}>Configure infrastructure privately. Publish to Marketplace after testing.</div>
        </div>
        <button onClick={() => setLocation("/deploy")} className="btn-primary-lime px-4 py-2.5 text-xs font-bold flex items-center gap-1.5">
          <Plus size={12} /> Register a Claw
        </button>
      </div>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function AnalyticsTab() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-white">Weekly Invocations — Last 7 Days</h2>
          <span className="text-xs font-mono-gmi px-2 py-0.5" style={{ color: "#888", border: "1px solid #222", background: "#0a0a0a" }}>⚠ Sample Data</span>
        </div>
        <div style={{ border: "1px solid #1a1a1a", background: "#000", padding: "1.5rem" }}>
          <div className="flex items-end gap-3 h-48">
            {WEEKLY.map((w) => {
              const pct = (w.val / MAX_WEEKLY) * 100;
              const isFri = w.day === "Fri";
              return (
                <div key={w.day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="font-mono-gmi text-xs" style={{ color: "#999" }}>{w.val >= 1000 ? `${(w.val / 1000).toFixed(1)}k` : w.val}</div>
                  <div className="w-full flex items-end" style={{ height: "140px" }}>
                    <div className="w-full transition-all" style={{ height: `${pct}%`, background: isFri ? "#DDEA4D" : "#1e1e1e", border: isFri ? "none" : "1px solid #2a2a2a" }} />
                  </div>
                  <div className="font-mono-gmi text-xs" style={{ color: isFri ? "#DDEA4D" : "#999" }}>{w.day}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div>
        <h2 className="font-display text-lg text-white mb-4">Invocations by Claw</h2>
        <div style={{ border: "1px solid #1a1a1a" }}>
          {DEPLOYMENTS.map((dep, i) => (
            <div key={dep.id} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: i < DEPLOYMENTS.length - 1 ? "1px solid #111" : "none" }}>
              <div className="flex-1">
                <div className="text-sm text-white mb-1">{dep.name}</div>
                <div className="h-1.5 w-full" style={{ background: "#111" }}>
                  <div style={{ height: "100%", width: `${(parseInt(dep.calls.replace(/,/g, "")) / 20882) * 100}%`, background: "#DDEA4D" }} />
                </div>
              </div>
              <div className="font-mono-gmi text-xs w-16 text-right" style={{ color: "#aaa" }}>{dep.calls}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Costs ────────────────────────────────────────────────────────────────────
function CostsTab() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-white">Infrastructure Cost Breakdown</h2>
        <span className="text-xs font-mono-gmi px-2 py-0.5" style={{ color: "#888", border: "1px solid #222", background: "#0a0a0a" }}>⚠ Sample Data</span>
      </div>
      <div className="p-6" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
        <div className="gmi-label mb-2">Total This Month</div>
        <div className="font-mono-gmi text-4xl text-white mb-1">$293</div>
        <div className="text-xs font-mono-gmi" style={{ color: "#999" }}>Billing cycle: Apr 1 – Apr 30</div>
      </div>
      <div style={{ border: "1px solid #1a1a1a" }}>
        <div className="grid grid-cols-3 gap-4 px-5 py-3" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
          {["Line Item", "Type", "Amount"].map((h) => <div key={h} className="gmi-label text-xs" style={{ color: "#888" }}>{h}</div>)}
        </div>
        {COST_BREAKDOWN.map((item, i) => (
          <div key={item.label} className="grid grid-cols-3 gap-4 px-5 py-4 items-center" style={{ borderBottom: i < COST_BREAKDOWN.length - 1 ? "1px solid #111" : "none" }}>
            <div className="text-sm text-white">{item.label}</div>
            <div className="font-mono-gmi text-xs" style={{ color: "#999" }}>{item.label.includes("Container") ? "Compute" : item.label.includes("MaaS") ? "MaaS" : "Network"}</div>
            <div className="font-mono-gmi text-xs" style={{ color: "#DDEA4D" }}>{item.amount}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between p-5" style={{ background: "#0a0a0a", border: "1px solid rgba(221,234,77,0.15)" }}>
        <div>
          <div className="font-display text-sm mb-1" style={{ color: "#DDEA4D" }}>Switch to Reserved Plan</div>
          <div className="text-xs font-mono-gmi" style={{ color: "#999" }}>Commit monthly, save up to 20% on compute costs.</div>
        </div>
        <button className="text-xs font-bold px-4 py-2.5 flex items-center gap-1.5" style={{ background: "#DDEA4D", color: "#000" }} onClick={() => toast.info("Reserved plan coming soon!")}>
          Learn More <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
function LogsTab() {
  const [selectedClaw, setSelectedClaw] = useState<string>(PROJECTS[0].id);
  const [selectedContainer, setSelectedContainer] = useState<string>("container-1");

  const clawData = LOGS_DATA[selectedClaw];
  const containers = clawData?.containers ?? [];
  const lines: LogLine[] = clawData?.logs[selectedContainer] ?? [];

  function selectClaw(id: string) { setSelectedClaw(id); setSelectedContainer("container-1"); }
  const levelColor = (l: string) => l === "WARN" ? "#facc15" : l === "ERROR" ? "#f87171" : "#DDEA4D";

  return (
    <div style={{ border: "1px solid #1a1a1a" }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #1a1a1a", background: "#0a0a0a" }}>
        <h2 className="font-display text-base text-white">Run Logs</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono-gmi px-2 py-0.5" style={{ color: "#888", border: "1px solid #222", background: "#000" }}>⚠ Sample Data</span>
          <div className="flex items-center gap-1.5 font-mono-gmi text-xs" style={{ color: "#DDEA4D" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#DDEA4D", animation: "pulse 2s infinite" }} />
            LIVE
          </div>
        </div>
      </div>

      {/* Claw selector */}
      <div className="flex items-center" style={{ borderBottom: "1px solid #1a1a1a", background: "#050505", overflowX: "auto" }}>
        <span className="font-mono-gmi shrink-0" style={{ fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#777", padding: "0.5rem 0.875rem" }}>CLAW</span>
        {PROJECTS.map((p) => {
          const isActive = selectedClaw === p.id;
          return (
            <button key={p.id} onClick={() => selectClaw(p.id)} className="font-mono-gmi shrink-0"
              style={{ fontSize: "0.5625rem", letterSpacing: "0.06em", padding: "0.5rem 0.875rem", background: "transparent", color: isActive ? "#fff" : "#999", border: "none", borderBottom: `2px solid ${isActive ? "#DDEA4D" : "transparent"}`, cursor: "pointer", whiteSpace: "nowrap" }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#aaa"; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#999"; }}
            >{p.name}</button>
          );
        })}
      </div>

      {/* Container selector */}
      <div className="flex items-center" style={{ borderBottom: "1px solid #1a1a1a", background: "#000", overflowX: "auto" }}>
        <span className="font-mono-gmi shrink-0" style={{ fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#777", padding: "0.4rem 0.875rem" }}>CONTAINER</span>
        {containers.map((c) => {
          const isActive = selectedContainer === c;
          return (
            <button key={c} onClick={() => setSelectedContainer(c)} className="font-mono-gmi shrink-0"
              style={{ fontSize: "0.5625rem", letterSpacing: "0.06em", padding: "0.4rem 0.875rem", background: isActive ? "rgba(221,234,77,0.05)" : "transparent", color: isActive ? "#DDEA4D" : "#888", border: "none", borderBottom: `2px solid ${isActive ? "#DDEA4D" : "transparent"}`, cursor: "pointer", whiteSpace: "nowrap" }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#aaa"; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "#888"; }}
            >{c}</button>
          );
        })}
      </div>

      {/* Log output */}
      <div style={{ background: "#000", padding: "1rem 1.25rem", minHeight: "300px" }}>
        {lines.length === 0
          ? <div className="font-mono-gmi text-xs" style={{ color: "#777" }}>// no logs for this container</div>
          : <div className="space-y-1.5">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-3 font-mono-gmi text-xs">
                  <span className="shrink-0" style={{ color: "#888", minWidth: "56px" }}>{line.time}</span>
                  <span className="shrink-0" style={{ color: levelColor(line.level), minWidth: "52px" }}>[{line.level}]</span>
                  <span style={{ color: line.level === "ERROR" ? "#f87171" : line.level === "WARN" ? "#facc15" : "#aaa" }}>{line.msg}</span>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

// ─── Marketplace Performance ──────────────────────────────────────────────────
function MarketplaceTab() {
  const { stats, flash } = useLiveMarketplaceStats();
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-white">Marketplace Performance</h2>
        <div className="flex items-center gap-1.5 font-mono-gmi text-xs" style={{ color: "#DDEA4D" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#DDEA4D", animation: "pulse 2s infinite" }} />
          LIVE
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: "#1a1a1a" }}>
        {stats.map((s) => {
          const isFlashing = flash === s.id;
          return (
            <div key={s.id} className="p-5" style={{ background: isFlashing ? "rgba(221,234,77,0.05)" : "#000", transition: "background 0.15s ease" }}>
              <div className="gmi-label mb-3" style={{ color: "#888" }}>{s.label}</div>
              <RollingNumber value={s.value} style={{ fontFamily: "'GeistMono', monospace", fontSize: "1.5rem", color: isFlashing ? "#DDEA4D" : "#ffffff", transition: "color 0.15s ease" }} />
            </div>
          );
        })}
      </div>
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
            <div key={item.check} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: i < 5 ? "1px solid #111" : "none" }}>
              {item.ok ? <CheckCircle size={14} style={{ color: "#DDEA4D" }} /> : <AlertTriangle size={14} style={{ color: "#facc15" }} />}
              <span className="text-sm font-mono-gmi" style={{ color: item.ok ? "#888" : "#facc15" }}>{item.check}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const tabComponents: Record<Tab, React.ReactNode> = {
    overview: <OverviewTab />, analytics: <AnalyticsTab />, costs: <CostsTab />, logs: <LogsTab />, marketplace: <MarketplaceTab />,
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#000", color: "#fff" }}>
      <style>{ROLL_CSS}</style>
      <Navbar />
      <div className="flex-1" style={{ marginLeft: "220px" }}>
        <div className="pt-8 pb-16">
          <div className="container">
            <div className="mb-8 pt-4">
              <div className="gmi-label mb-2">Developer Console</div>
              <div className="flex items-end justify-between">
                <h1 className="font-display text-4xl text-white" style={{ letterSpacing: "-0.03em" }}>My Claws</h1>
                <div className="hidden md:flex items-center gap-2 font-mono-gmi text-xs" style={{ color: "#999" }}>
                  <div className="w-2 h-2 rounded-full bg-lime animate-pulse" />
                  All systems operational
                </div>
              </div>
            </div>
            <div className="flex gap-10">
              <aside className="w-52 shrink-0">
                <nav className="space-y-0.5">
                  {NAV.map((item) => (
                    <button key={item.id} onClick={() => setActiveTab(item.id)} className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 text-sm font-mono-gmi transition-colors"
                      style={{ background: activeTab === item.id ? "rgba(221,234,77,0.08)" : "transparent", color: activeTab === item.id ? "#DDEA4D" : "#aaa", borderLeft: `2px solid ${activeTab === item.id ? "#DDEA4D" : "transparent"}` }}
                      onMouseEnter={(e) => { if (activeTab !== item.id) (e.currentTarget as HTMLButtonElement).style.color = "#aaa"; }}
                      onMouseLeave={(e) => { if (activeTab !== item.id) (e.currentTarget as HTMLButtonElement).style.color = "#aaa"; }}
                    >
                      {item.icon}{item.label}
                    </button>
                  ))}
                </nav>
                <div className="my-6" style={{ borderTop: "1px solid #1a1a1a" }} />
                <div className="space-y-0.5">
                  {[{ label: "Marketplace", href: "/marketplace" }, { label: "Register a Claw", href: "/deploy" }].map((link) => (
                    <a key={link.label} href={link.href} className="block px-3 py-2 text-xs font-mono-gmi transition-colors" style={{ color: "#999" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#aaa")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#999")}
                    >{link.label}</a>
                  ))}
                </div>
              </aside>
              <div className="flex-1 min-w-0">{tabComponents[activeTab]}</div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
