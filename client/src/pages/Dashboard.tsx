import { useState, useEffect, useRef } from "react";
import {
  Activity, Zap, DollarSign, Clock, BarChart2, Terminal,
  TrendingUp, Server, RefreshCw, Plus, ArrowRight, CheckCircle, AlertTriangle,
  Copy, Globe, Lock, FileText, ExternalLink, Search, Link2, Package,
} from "lucide-react";
import { ALL_CLAWS, getBadgeConfig, type Claw } from "@/lib/clawData";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";

// ─── Odometer ────────────────────────────────────────────────────────────────
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
type InfraState = "running" | "stopped" | "provisioning";
type MktState   = "published" | "unlisted" | "unpublished" | "draft";
type BadgeKind  = "Verified" | "GMI CE" | "MaaS";

interface Project {
  id: string; name: string; listingName: string | null;
  infraState: InfraState; marketplaceState: MktState;
  badge: BadgeKind; tier: string; templateId: string;
  instances: number; calls: string; latency: string; dailyCost: string;
  model: string; privateUrl: string; maasKey: string;
}

const PROJECTS: Project[] = [
  { id: "dep-001", name: "contract-review-v2",  listingName: "Contract Review Agent", infraState: "running",  marketplaceState: "published",   badge: "Verified", tier: "Tier C", templateId: "tpl_9f3a-771e-…", instances: 2,  calls: "12,847", latency: "340ms", dailyCost: "$4.32", model: "Qwen2.5 72B",       privateUrl: "https://contract-review-v2.private.gmi.ai",  maasKey: "gmi_maas_sk_abc123" },
  { id: "dep-002", name: "code-review-agent",    listingName: "Code Review Agent",     infraState: "running",  marketplaceState: "published",   badge: "GMI CE",   tier: "Tier B", templateId: "tpl_2b4c-88fa-…", instances: 3,  calls: "7,832",  latency: "812ms", dailyCost: "$8.64", model: "DeepSeek-Coder V2", privateUrl: "https://code-review-agent.private.gmi.ai",   maasKey: "gmi_maas_sk_def456" },
  { id: "dep-003", name: "rag-pipeline-v1",      listingName: null,                    infraState: "stopped",  marketplaceState: "unlisted",    badge: "GMI CE",   tier: "Tier C", templateId: "tpl_5d1e-cc20-…", instances: 0,  calls: "203",    latency: "342ms", dailyCost: "$0.00", model: "Llama 3.1 70B",    privateUrl: "https://rag-pipeline-v1.private.gmi.ai",     maasKey: "gmi_maas_sk_ghi789" },
  { id: "dep-004", name: "brief2slides",         listingName: "Brief2Slides",          infraState: "running",  marketplaceState: "unpublished", badge: "GMI CE",   tier: "Tier C", templateId: "tpl_7a2b-dd11-…", instances: 1,  calls: "441",    latency: "290ms", dailyCost: "$1.20", model: "Llama 3.1 8B",     privateUrl: "https://brief2slides.private.gmi.ai",        maasKey: "gmi_maas_sk_jkl012" },
  { id: "dep-005", name: "salesdraft",           listingName: "SalesDraft",            infraState: "stopped",  marketplaceState: "draft",       badge: "MaaS",     tier: "Tier C", templateId: "tpl_3c9f-ee44-…", instances: 0,  calls: "0",      latency: "—",     dailyCost: "$0.00", model: "Mixtral 8×7B",     privateUrl: "https://salesdraft.private.gmi.ai",          maasKey: "gmi_maas_sk_mno345" },
];

const WEEKLY = [
  { day: "Mon", val: 1420 }, { day: "Tue", val: 1890 }, { day: "Wed", val: 2430 },
  { day: "Thu", val: 2710 }, { day: "Fri", val: 3640 }, { day: "Sat", val: 1750 }, { day: "Sun", val: 1510 },
];
const MAX_WEEKLY = Math.max(...WEEKLY.map((w) => w.val));

const COST_BREAKDOWN = [
  { label: "Container (Option C × 2)", amount: "$184" },
  { label: "MaaS — Qwen2.5 72B",       amount: "$62"  },
  { label: "MaaS — DeepSeek-Coder V2", amount: "$35"  },
  { label: "Egress",                   amount: "$12"  },
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
  "dep-003": { containers: ["container-1"], logs: { "container-1": [{ time: "23:13:45", level: "INFO", msg: "Idle — no requests in last 5 minutes" }] } },
  "dep-004": { containers: ["container-1"], logs: { "container-1": [{ time: "23:14:10", level: "INFO", msg: "Health check passed" }] } },
  "dep-005": { containers: [],             logs: {} },
};

// ─── Live hooks ───────────────────────────────────────────────────────────────
function useLiveMonitor() {
  const [latency, setLatency]   = useState(340);
  const [calls,   setCalls]     = useState(12847);
  const [uptime,  setUptime]    = useState(99.97);
  const [flash,   setFlash]     = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.random();
      const f = (k: string) => { setFlash(k); setTimeout(() => setFlash(null), 450); };
      if (r < 0.4) { setCalls(v => v + Math.floor(Math.random() * 4) + 1); f("calls"); }
      else if (r < 0.7) { setLatency(v => Math.max(200, Math.min(900, v + Math.floor(Math.random() * 20) - 10))); f("latency"); }
      else { setUptime(v => parseFloat(Math.max(99.90, Math.min(100, v + (Math.random() * 0.004 - 0.002))).toFixed(2))); f("uptime"); }
    }, 1800);
    return () => clearInterval(id);
  }, []);
  return { flash, latency, calls, uptime };
}

function useLivePerformance() {
  const [impressions, setImpressions] = useState(18200);
  const [ctr,         setCtr]         = useState(4.3);
  const [conversions, setConversions] = useState(21);
  const [flash,       setFlash]       = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.random();
      const f = (k: string) => { setFlash(k); setTimeout(() => setFlash(null), 450); };
      if (r < 0.45) { setImpressions(v => v + Math.floor(Math.random() * 5) + 1); f("impressions"); }
      else if (r < 0.70) { setCtr(v => parseFloat(Math.max(3, Math.min(9, v + (Math.random() * 0.1 - 0.05))).toFixed(1))); f("ctr"); }
      else { setConversions(v => v + 1); f("conversions"); }
    }, 2400);
    return () => clearInterval(id);
  }, []);
  return { flash, impressions, ctr, conversions };
}

// ─── Badges ───────────────────────────────────────────────────────────────────
function BadgeChip({ kind }: { kind: BadgeKind }) {
  const map: Record<BadgeKind, { color: string; bg: string }> = {
    Verified: { color: "#DDEA4D", bg: "rgba(221,234,77,0.1)"  },
    "GMI CE": { color: "#7ec8ff", bg: "rgba(126,200,255,0.1)" },
    MaaS:     { color: "#c084fc", bg: "rgba(192,132,252,0.1)" },
  };
  const s = map[kind];
  return (
    <span className="inline-flex items-center gap-1 font-mono-gmi text-xs px-2 py-0.5"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}33` }}>
      <CheckCircle size={9} /> {kind}
    </span>
  );
}

function InfraDot({ state }: { state: InfraState }) {
  const map = {
    running:      { color: "#DDEA4D", label: "running"      },
    stopped:      { color: "#555",    label: "idle"         },
    provisioning: { color: "#facc15", label: "provisioning" },
  };
  const s = map[state];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono-gmi text-xs" style={{ color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color, animation: state === "running" ? "pulse 2s infinite" : undefined }} />
      {s.label}
    </span>
  );
}

function MktBadge({ state }: { state: MktState }) {
  const map: Record<MktState, { color: string; label: string }> = {
    published:   { color: "#DDEA4D", label: "published"   },
    unlisted:    { color: "#555",    label: "unlisted"     },
    unpublished: { color: "#888",    label: "unpublished"  },
    draft:       { color: "#888",    label: "draft"        },
  };
  const s = map[state];
  return <span className="font-mono-gmi text-xs" style={{ color: s.color }}>{s.label}</span>;
}

// ─── Detail sub-tabs ──────────────────────────────────────────────────────────
type DetailTab = "monitor" | "integration" | "analytics" | "performance";
const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "monitor",     label: "Monitor"     },
  { id: "integration", label: "Integration" },
  { id: "analytics",   label: "Analytics"   },
  { id: "performance", label: "Performance" },
];

// ─── Monitor tab ─────────────────────────────────────────────────────────────
function MonitorTab({ project }: { project: Project }) {
  const { flash, latency, calls, uptime } = useLiveMonitor();
  const logData = LOGS_DATA[project.id];
  const containers = logData?.containers ?? [];
  const [selectedContainer, setSelectedContainer] = useState(containers[0] ?? "");
  const lines: LogLine[] = logData?.logs[selectedContainer] ?? [];
  const levelColor = (l: string) => l === "WARN" ? "#facc15" : l === "ERROR" ? "#f87171" : "#DDEA4D";

  const kpis = [
    { id: "calls",   label: "Total Calls · 30d",  value: calls.toLocaleString() },
    { id: "latency", label: "Avg Latency",         value: `${latency}ms`         },
    { id: "uptime",  label: "Uptime",              value: `${uptime.toFixed(2)}%` },
    { id: "inst",    label: "Active Instances",    value: String(project.instances) },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-px" style={{ background: "#1a1a1a" }}>
        {kpis.map((k) => {
          const isFlash = flash === k.id;
          return (
            <div key={k.id} className="p-4" style={{ background: isFlash ? "rgba(221,234,77,0.05)" : "#000", transition: "background 0.15s" }}>
              <div className="font-mono-gmi text-xs mb-2" style={{ color: "#888", letterSpacing: "0.08em", textTransform: "uppercase" }}>{k.label}</div>
              <RollingNumber value={k.value} style={{ fontFamily: "'GeistMono', monospace", fontSize: "1.25rem", color: isFlash ? "#DDEA4D" : "#fff", transition: "color 0.15s" }} />
            </div>
          );
        })}
      </div>

      {/* Endpoint */}
      <div className="p-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
        <div className="font-mono-gmi text-xs uppercase tracking-widest mb-2" style={{ color: "#888" }}>Private Endpoint</div>
        <div className="flex items-center justify-between gap-4">
          <code className="font-mono-gmi text-xs text-white break-all">{project.privateUrl}</code>
          <button onClick={() => { navigator.clipboard.writeText(project.privateUrl); toast.success("Copied"); }}
            className="shrink-0 flex items-center gap-1.5 font-mono-gmi text-xs px-3 py-1.5" style={{ border: "1px solid #2a2a2a", color: "#888" }}>
            <Copy size={11} /> Copy
          </button>
        </div>
      </div>

      {/* Logs */}
      <div style={{ border: "1px solid #1a1a1a" }}>
        <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
          <span className="font-display text-sm text-white">Run Logs</span>
          <div className="flex items-center gap-1.5 font-mono-gmi text-xs" style={{ color: "#DDEA4D" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#DDEA4D", animation: "pulse 2s infinite" }} /> LIVE
          </div>
        </div>
        {containers.length > 0 && (
          <div className="flex items-center" style={{ borderBottom: "1px solid #1a1a1a", background: "#050505", overflowX: "auto" }}>
            <span className="font-mono-gmi shrink-0 text-xs px-3 py-2" style={{ color: "#555", fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>CONTAINER</span>
            {containers.map((c) => {
              const active = selectedContainer === c;
              return (
                <button key={c} onClick={() => setSelectedContainer(c)}
                  className="font-mono-gmi shrink-0 text-xs px-3 py-2"
                  style={{ color: active ? "#DDEA4D" : "#888", borderBottom: `2px solid ${active ? "#DDEA4D" : "transparent"}`, background: "transparent", whiteSpace: "nowrap" }}>
                  {c}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ background: "#000", padding: "1rem 1.25rem", minHeight: "160px" }}>
          {lines.length === 0
            ? <div className="font-mono-gmi text-xs" style={{ color: "#555" }}>// no logs</div>
            : lines.map((line, i) => (
                <div key={i} className="flex gap-3 font-mono-gmi text-xs mb-1.5">
                  <span className="shrink-0" style={{ color: "#888", minWidth: "56px" }}>{line.time}</span>
                  <span className="shrink-0" style={{ color: levelColor(line.level), minWidth: "52px" }}>[{line.level}]</span>
                  <span style={{ color: line.level === "ERROR" ? "#f87171" : line.level === "WARN" ? "#facc15" : "#aaa" }}>{line.msg}</span>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── Integration tab ──────────────────────────────────────────────────────────
function IntegrationTab({ project }: { project: Project }) {
  const snippet = `import requests

response = requests.post(
    "${project.privateUrl}/invoke",
    headers={
        "Authorization": "Bearer ${project.maasKey.slice(0, 20)}••••",
        "Content-Type": "application/json",
    },
    json={"input": "your input here"},
)
print(response.json())`;

  return (
    <div className="space-y-6">
      <div className="p-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
        <div className="font-mono-gmi text-xs uppercase tracking-widest mb-2" style={{ color: "#888" }}>GMI MaaS API Key</div>
        <div className="flex items-center justify-between gap-4">
          <code className="font-mono-gmi text-xs text-white">{project.maasKey.slice(0, 20)}••••••••</code>
          <button onClick={() => { navigator.clipboard.writeText(project.maasKey); toast.success("Copied"); }}
            className="shrink-0 flex items-center gap-1.5 font-mono-gmi text-xs px-3 py-1.5" style={{ border: "1px solid #2a2a2a", color: "#888" }}>
            <Copy size={11} /> Copy
          </button>
        </div>
      </div>

      <div style={{ border: "1px solid #1a1a1a" }}>
        <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
          <span className="font-mono-gmi text-xs uppercase tracking-widest" style={{ color: "#888" }}>Python · Quick Start</span>
          <button onClick={() => { navigator.clipboard.writeText(snippet); toast.success("Copied"); }}
            className="flex items-center gap-1.5 font-mono-gmi text-xs px-3 py-1.5" style={{ border: "1px solid #2a2a2a", color: "#888" }}>
            <Copy size={11} /> Copy
          </button>
        </div>
        <pre className="p-4 text-xs overflow-x-auto" style={{ background: "#000", color: "#aaa", fontFamily: "'GeistMono', monospace", lineHeight: 1.6 }}>{snippet}</pre>
      </div>

      <div className="flex items-start gap-3 p-4 font-mono-gmi text-xs" style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.15)", color: "#999" }}>
        <Link2 size={12} className="shrink-0 mt-0.5" style={{ color: "#DDEA4D" }} />
        <span>Full API reference and SDK docs at <span className="underline cursor-pointer" style={{ color: "#DDEA4D" }}>docs.gmicloud.ai/claw</span></span>
      </div>
    </div>
  );
}

// ─── Analytics tab ────────────────────────────────────────────────────────────
function AnalyticsTab({ project }: { project: Project }) {
  const totalCalls = parseInt(project.calls.replace(/,/g, ""));
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="font-display text-base text-white">Weekly Invocations — Last 7 Days</span>
        <span className="font-mono-gmi text-xs px-2 py-0.5" style={{ color: "#888", border: "1px solid #222", background: "#0a0a0a" }}>⚠ Sample Data</span>
      </div>
      <div style={{ border: "1px solid #1a1a1a", background: "#000", padding: "1.5rem" }}>
        <div className="flex items-end gap-3 h-40">
          {WEEKLY.map((w) => {
            const pct = (w.val / MAX_WEEKLY) * 100;
            const isFri = w.day === "Fri";
            return (
              <div key={w.day} className="flex-1 flex flex-col items-center gap-2">
                <div className="font-mono-gmi text-xs" style={{ color: "#999" }}>{w.val >= 1000 ? `${(w.val / 1000).toFixed(1)}k` : w.val}</div>
                <div className="w-full flex items-end" style={{ height: "100px" }}>
                  <div className="w-full" style={{ height: `${pct}%`, background: isFri ? "#DDEA4D" : "#1e1e1e", border: isFri ? "none" : "1px solid #2a2a2a" }} />
                </div>
                <div className="font-mono-gmi text-xs" style={{ color: isFri ? "#DDEA4D" : "#999" }}>{w.day}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ border: "1px solid #1a1a1a" }}>
        <div className="grid grid-cols-3 px-4 py-2.5" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
          {["Metric", "Value", "vs Last Month"].map(h => (
            <div key={h} className="font-mono-gmi text-xs uppercase tracking-widest" style={{ color: "#888" }}>{h}</div>
          ))}
        </div>
        {[
          { metric: "Total Invocations", value: project.calls,    delta: "+18%" },
          { metric: "Avg Latency",       value: project.latency,  delta: "-22ms" },
          { metric: "Daily Cost",        value: project.dailyCost, delta: "+$0.40" },
        ].map((row) => (
          <div key={row.metric} className="grid grid-cols-3 px-4 py-3" style={{ borderBottom: "1px solid #111" }}>
            <div className="font-mono-gmi text-sm text-white">{row.metric}</div>
            <div className="font-mono-gmi text-sm" style={{ color: "#DDEA4D" }}>{row.value}</div>
            <div className="font-mono-gmi text-xs" style={{ color: "#888" }}>{row.delta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Performance tab ──────────────────────────────────────────────────────────
function PerformanceTab({ project }: { project: Project }) {
  const { flash, impressions, ctr, conversions } = useLivePerformance();

  const kpis = [
    { id: "impressions", label: "IMPRESSIONS · 30D", value: impressions >= 1000 ? `${(impressions / 1000).toFixed(1)}K` : String(impressions), sub: "card views" },
    { id: "ctr",         label: "CTR",               value: `${ctr}%`,                                                                          sub: "card → detail" },
    { id: "conversions", label: "CONVERSIONS",        value: `${conversions}%`,                                                                  sub: "detail → access" },
    { id: "rank",        label: "CATEGORY RANK",      value: "#4",                                                                               sub: "Developer · P1" },
  ];

  // Impressions vs Access chart (mock)
  const chartData = [12, 18, 22, 28, 35, 42, 50, 58, 65, 72, 80, 88, 95, 105, 115, 125, 138, 150, 162, 175, 188, 200, 215, 230, 248, 265, 282, 300, 320, 340];
  const accessData = [4, 6, 8, 10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 41, 45, 49, 53, 57, 62, 67, 72, 77, 83, 89, 95, 102, 109, 116, 124, 132];
  const maxVal = Math.max(...chartData);
  const w = 100 / chartData.length;

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-4 gap-px" style={{ background: "#1a1a1a" }}>
        {kpis.map((k) => {
          const isFlash = flash === k.id;
          return (
            <div key={k.id} className="p-4" style={{ background: isFlash ? "rgba(221,234,77,0.05)" : "#000", transition: "background 0.15s" }}>
              <div className="font-mono-gmi text-xs mb-3 uppercase tracking-widest" style={{ color: "#888" }}>{k.label}</div>
              <RollingNumber value={k.value} style={{ fontFamily: "'GeistMono', monospace", fontSize: "1.75rem", fontWeight: 700, color: isFlash ? "#DDEA4D" : "#fff", transition: "color 0.15s", display: "block", marginBottom: "0.25rem" }} />
              <div className="font-mono-gmi text-xs" style={{ color: "#555" }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Impressions vs Access chart */}
      <div style={{ border: "1px solid #1a1a1a" }}>
        <div className="px-4 py-3" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
          <span className="font-mono-gmi text-xs uppercase tracking-widest" style={{ color: "#888" }}>Impressions vs Access (30d)</span>
        </div>
        <div className="p-4" style={{ background: "#000" }}>
          <svg viewBox={`0 0 100 40`} preserveAspectRatio="none" style={{ width: "100%", height: "120px" }}>
            {/* Impressions line */}
            <polyline
              points={chartData.map((v, i) => `${i * w + w / 2},${40 - (v / maxVal) * 38}`).join(" ")}
              fill="none" stroke="#555" strokeWidth="0.8" strokeDasharray="1.5 1"
            />
            {/* Access line */}
            <polyline
              points={accessData.map((v, i) => `${i * w + w / 2},${40 - (v / maxVal) * 38}`).join(" ")}
              fill="none" stroke="#DDEA4D" strokeWidth="0.8"
            />
          </svg>
          <div className="flex items-center gap-6 mt-2">
            <div className="flex items-center gap-1.5 font-mono-gmi text-xs" style={{ color: "#555" }}>
              <div className="w-5 h-px" style={{ borderTop: "1.5px dashed #555" }} /> Impressions
            </div>
            <div className="flex items-center gap-1.5 font-mono-gmi text-xs" style={{ color: "#DDEA4D" }}>
              <div className="w-5 h-px" style={{ background: "#DDEA4D" }} /> Access
            </div>
          </div>
        </div>
      </div>

      {/* Listing health */}
      {project.marketplaceState === "published" && (
        <div style={{ border: "1px solid #1a1a1a" }}>
          <div className="px-4 py-3" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
            <span className="font-mono-gmi text-xs uppercase tracking-widest" style={{ color: "#888" }}>Listing Health</span>
          </div>
          {[
            { check: "Claw is deployed and accessible", ok: true  },
            { check: "Full description provided",       ok: true  },
            { check: "Type label assigned",             ok: true  },
            { check: "Publisher contact on file",       ok: true  },
            { check: "Sample outputs added",            ok: false },
          ].map((item, i) => (
            <div key={item.check} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < 4 ? "1px solid #111" : "none" }}>
              {item.ok ? <CheckCircle size={13} style={{ color: "#DDEA4D" }} /> : <AlertTriangle size={13} style={{ color: "#facc15" }} />}
              <span className="font-mono-gmi text-sm" style={{ color: item.ok ? "#888" : "#facc15" }}>{item.check}</span>
            </div>
          ))}
        </div>
      )}
      {project.marketplaceState !== "published" && (
        <div className="flex items-start gap-3 p-4 font-mono-gmi text-xs" style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#888" }}>
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>Performance data is only available for published listings.</span>
        </div>
      )}
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({
  project, mktState, onUnpublish, onRepublish, onList,
}: {
  project: Project;
  mktState: MktState;
  onUnpublish: () => void;
  onRepublish: () => void;
  onList: () => void;
}) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<DetailTab>("monitor");

  const tabContent: Record<DetailTab, React.ReactNode> = {
    monitor:     <MonitorTab     project={project} />,
    integration: <IntegrationTab project={project} />,
    analytics:   <AnalyticsTab   project={project} />,
    performance: <PerformanceTab project={project} />,
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Detail header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-display text-2xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
            {project.listingName || project.name}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <BadgeChip kind={project.badge} />
            {project.listingName && (
              <span className="font-mono-gmi text-xs px-2 py-0.5" style={{ background: "#111", color: "#555", border: "1px solid #222" }}>
                {project.templateId}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {mktState === "published" && (
            <>
              <button
                onClick={() => setLocation(`/marketplace`)}
                className="flex items-center gap-1.5 font-mono-gmi text-xs px-3 py-2"
                style={{ border: "1px solid #2a2a2a", color: "#888" }}
              >
                View public listing <ExternalLink size={10} />
              </button>
              <button
                onClick={onUnpublish}
                className="flex items-center gap-1.5 font-mono-gmi text-xs px-3 py-2"
                style={{ border: "1px solid #2a2a2a", color: "#888" }}
              >
                Unpublish
              </button>
            </>
          )}
          {mktState === "unpublished" && (
            <>
              <span className="font-mono-gmi text-xs" style={{ color: "#555" }}>Unpublished</span>
              <button
                onClick={onRepublish}
                className="flex items-center gap-1.5 font-mono-gmi text-xs px-3 py-2"
                style={{ border: "1px solid rgba(221,234,77,0.3)", color: "#DDEA4D", background: "rgba(221,234,77,0.06)" }}
              >
                <Globe size={11} /> Re-publish
              </button>
            </>
          )}
          {(mktState === "unlisted" || mktState === "draft") && (
            <button
              onClick={onList}
              className="btn-primary-lime flex items-center gap-1.5 font-mono-gmi text-xs px-4 py-2"
            >
              <FileText size={11} /> List this Claw
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-0 mb-6" style={{ borderBottom: "1px solid #1a1a1a" }}>
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="font-mono-gmi text-sm px-4 py-2.5 transition-colors"
            style={{
              color: activeTab === t.id ? "#fff" : "#888",
              borderBottom: `2px solid ${activeTab === t.id ? "#DDEA4D" : "transparent"}`,
              background: "transparent",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1">{tabContent[activeTab]}</div>
    </div>
  );
}

// ─── Claws I Use data ────────────────────────────────────────────────────────
// PRD F-13: Zone B — Claws I Use
// V1 scope: read-only. Shows Recently Used (last 10), Frequency (30-day invocations),
// Last Accessed timestamp, Availability status. No API key, no owner-side metrics.
interface UsedClaw {
  clawId: string;
  invocations30d: number;   // PRD: Frequency — invocation count per Claw, 30-day window
  lastAccessed: string;     // PRD: Last Accessed — timestamp of most recent session
}

// Sorted by recency (PRD: Recently Used = last 10 Claws accessed, sorted by recency)
const USED_CLAWS: UsedClaw[] = [
  { clawId: "meeting-intelligence",  invocations30d: 47,  lastAccessed: "30 min ago"  },
  { clawId: "topify-claw",           invocations30d: 23,  lastAccessed: "2 hours ago" },
  { clawId: "code-review-agent",     invocations30d: 11,  lastAccessed: "5 hours ago" },
  { clawId: "enterprise-rag",        invocations30d: 4,   lastAccessed: "1 day ago"   },
];

// ─── Claws I Use panel ────────────────────────────────────────────────────────
function ClawsIUsePanel() {
  const [, setLocation] = useLocation();
  const [selectedClawId, setSelectedClawId] = useState<string>(USED_CLAWS[0].clawId);
  const [filter, setFilter] = useState("");

  // Enrich with Claw data from catalog
  const enriched = USED_CLAWS
    .map(u => ({ ...u, claw: ALL_CLAWS.find(c => c.id === u.clawId) }))
    .filter(u => u.claw);

  const filtered = enriched.filter(u =>
    !filter ||
    u.claw!.name.toLowerCase().includes(filter.toLowerCase()) ||
    u.claw!.publisher.toLowerCase().includes(filter.toLowerCase())
  );

  const selected = enriched.find(u => u.clawId === selectedClawId);
  const claw = selected?.claw;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar — recently used list, sorted by recency */}
      <div className="flex flex-col shrink-0" style={{ width: "260px", borderRight: "1px solid #1a1a1a" }}>
        <div className="px-3 py-3" style={{ borderBottom: "1px solid #1a1a1a" }}>
          <div className="relative">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#666" }} />
            <input
              type="text"
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-transparent text-xs text-white font-mono-gmi outline-none"
              style={{ border: "1px solid #1e1e1e" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#333")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
            />
          </div>
        </div>
        <div className="font-mono-gmi text-xs px-3 py-2" style={{ color: "#777", letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid #111" }}>
          RECENTLY USED
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(u => {
            const c = u.claw!;
            const isVerified = c.infrastructurePath === "gmi_ce_maas";
            const badge = getBadgeConfig(c.infrastructurePath);
            const isSelected = selectedClawId === u.clawId;
            return (
              <button
                key={u.clawId}
                onClick={() => setSelectedClawId(u.clawId)}
                className="w-full text-left px-3 py-3 transition-all"
                style={{
                  background: isSelected ? "rgba(221,234,77,0.05)" : "transparent",
                  borderLeft: `2px solid ${isSelected ? "#DDEA4D" : "transparent"}`,
                  borderBottom: "1px solid #111",
                }}
              >
                <div className="font-mono-gmi text-sm font-bold mb-1.5" style={{ color: isSelected ? "#fff" : "#ddd" }}>
                  {c.name}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isVerified && (
                    <span className="inline-flex items-center gap-1 font-mono-gmi" style={{ fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase", color: badge.color, border: `1px solid ${badge.border}`, background: badge.bg, padding: "1px 5px" }}>
                      <CheckCircle size={8} /> {badge.label}
                    </span>
                  )}
                  <span className="font-mono-gmi text-xs" style={{ color: "#777" }}>@{c.publisher}</span>
                </div>
                <div className="font-mono-gmi text-xs mt-1" style={{ color: "#888" }}>
                  {u.lastAccessed}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-3 py-6 font-mono-gmi text-xs text-center" style={{ color: "#666" }}>No claws match</div>
          )}
        </div>
        <div className="p-3" style={{ borderTop: "1px solid #1a1a1a" }}>
          <button
            onClick={() => setLocation("/marketplace")}
            className="w-full flex items-center justify-center gap-1.5 font-mono-gmi text-xs py-2"
            style={{ border: "1px solid rgba(221,234,77,0.3)", color: "#DDEA4D", background: "rgba(221,234,77,0.04)" }}
          >
            <Package size={11} /> Browse Marketplace
          </button>
        </div>
      </div>

      {/* Right detail — PRD F-13 fields only */}
      <div className="flex-1 overflow-y-auto p-8">
        {!claw || !selected ? (
          <div className="flex items-center justify-center h-full font-mono-gmi text-xs" style={{ color: "#666" }}>Select a Claw</div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-2xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>{claw.name}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {claw.infrastructurePath === "gmi_ce_maas" && (() => {
                    const b = getBadgeConfig(claw.infrastructurePath);
                    return (
                      <span className="inline-flex items-center gap-1 font-mono-gmi text-xs px-2 py-0.5" style={{ color: b.color, border: `1px solid ${b.border}`, background: b.bg, fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        <CheckCircle size={8} /> {b.label}
                      </span>
                    );
                  })()}
                  <span className="font-mono-gmi text-xs" style={{ color: "#888" }}>@{claw.publisher}</span>
                </div>
              </div>
              {/* PRD: Click Claw → Detail Page (F-02) */}
              <button
                onClick={() => setLocation(`/marketplace/${claw.id}`)}
                className="flex items-center gap-1.5 font-mono-gmi text-xs px-3 py-2 shrink-0"
                style={{ border: "1px solid #2a2a2a", color: "#aaa" }}
              >
                View listing <ExternalLink size={10} />
              </button>
            </div>

            {/* PRD F-13 metrics: Frequency · Last Accessed · Availability */}
            <div className="grid grid-cols-3 gap-px" style={{ background: "#1a1a1a" }}>
              {[
                { label: "Frequency (30d)",  value: `${selected.invocations30d} invocations` },
                { label: "Last Accessed",    value: selected.lastAccessed },
                { label: "Availability",     value: claw.availability === "available" ? "Available" : claw.availability === "early_access" ? "Early Access" : "Unavailable",
                  color: claw.availability === "available" ? "#DDEA4D" : claw.availability === "early_access" ? "#fb923c" : "#666" },
              ].map(k => (
                <div key={k.label} className="p-4" style={{ background: "#000" }}>
                  <div className="font-mono-gmi mb-2 uppercase tracking-widest" style={{ color: "#777", fontSize: "0.5rem" }}>{k.label}</div>
                  <div className="font-mono-gmi text-sm font-bold" style={{ color: (k as any).color ?? "#fff" }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="p-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
              <div className="font-mono-gmi text-xs uppercase tracking-widest mb-2" style={{ color: "#777" }}>About</div>
              <p className="font-mono-gmi text-sm leading-relaxed" style={{ color: "#bbb" }}>{claw.description}</p>
            </div>

            {/* Tags */}
            {claw.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {claw.tags.map(tag => (
                  <span key={tag} className="font-mono-gmi text-xs px-2 py-0.5" style={{ border: "1px solid #1e1e1e", color: "#888" }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [zone, setZone]                     = useState<"mine" | "using">("mine");
  const [selectedId, setSelectedId]         = useState(PROJECTS[0].id);
  const [filter, setFilter]                 = useState("");
  const [marketplaceStates, setMktStates]   = useState<Record<string, MktState>>(
    () => Object.fromEntries(PROJECTS.map(p => [p.id, p.marketplaceState])) as Record<string, MktState>
  );
  const [unpublishTarget, setUnpublishTarget] = useState<string | null>(null);

  const getState = (id: string): MktState => marketplaceStates[id] ?? "unlisted";
  const setState = (id: string, s: MktState) => setMktStates(prev => ({ ...prev, [id]: s }));

  const filtered = PROJECTS.filter(p =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || (p.listingName || "").toLowerCase().includes(filter.toLowerCase())
  );

  const project = PROJECTS.find(p => p.id === selectedId) ?? PROJECTS[0];
  const mktState = getState(selectedId);

  return (
    <div className="min-h-screen flex" style={{ background: "#000", color: "#fff" }}>
      <style>{ROLL_CSS}</style>
      <Topbar />
      <Navbar />

      <div className="flex-1 flex flex-col" style={{ marginLeft: "210px", paddingTop: "40px" }}>
        {/* Page header */}
        <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: "1px solid #1a1a1a" }}>
          <div>
            <div className="gmi-label mb-1">My Claws</div>
            <h1 className="font-display text-2xl text-white" style={{ letterSpacing: "-0.03em" }}>My Claws</h1>
          </div>
          <button
            onClick={() => setLocation("/deploy")}
            className="btn-primary-lime flex items-center gap-1.5 font-mono-gmi text-xs px-4 py-2.5 font-bold"
          >
            <Plus size={12} /> Register Claw
          </button>
        </div>

        {/* Zone tabs */}
        <div className="flex items-center px-8" style={{ borderBottom: "1px solid #1a1a1a" }}>
          {[
            { id: "mine",  label: "My Deployments & Listings" },
            { id: "using", label: "Claws I Use" },
          ].map(z => (
            <button
              key={z.id}
              onClick={() => setZone(z.id as "mine" | "using")}
              className="font-mono-gmi text-xs px-4 py-3 transition-colors"
              style={{
                color: zone === z.id ? "#fff" : "#555",
                borderBottom: `2px solid ${zone === z.id ? "#DDEA4D" : "transparent"}`,
                background: "transparent",
                marginBottom: "-1px",
              }}
            >
              {z.label}
            </button>
          ))}
        </div>

        {/* Body — switches between zones */}
        {zone === "using" ? (
          <ClawsIUsePanel />
        ) : (
        /* My Deployments master-detail body */
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Claw list */}
          <div className="flex flex-col shrink-0" style={{ width: "260px", borderRight: "1px solid #1a1a1a" }}>
            {/* Filter */}
            <div className="px-3 py-3" style={{ borderBottom: "1px solid #1a1a1a" }}>
              <div className="relative">
                <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#555" }} />
                <input
                  type="text"
                  placeholder="Filter..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-transparent text-xs text-white font-mono-gmi outline-none"
                  style={{ border: "1px solid #1e1e1e" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#333")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
                />
              </div>
            </div>

            <div className="font-mono-gmi text-xs px-3 py-2" style={{ color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", borderBottom: "1px solid #111" }}>
              MY CLAWS
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.map((p) => {
                const ms = getState(p.id);
                const isSelected = selectedId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className="w-full text-left px-3 py-3 transition-all"
                    style={{
                      background: isSelected ? "rgba(221,234,77,0.05)" : "transparent",
                      borderLeft: `2px solid ${isSelected ? "#DDEA4D" : "transparent"}`,
                      borderBottom: "1px solid #111",
                    }}
                  >
                    <div className="font-mono-gmi text-sm font-bold mb-1.5" style={{ color: isSelected ? "#fff" : "#ccc" }}>
                      {p.listingName || p.name}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <BadgeChip kind={p.badge} />
                      <InfraDot state={p.infraState} />
                      {p.instances > 0 && (
                        <span className="font-mono-gmi text-xs" style={{ color: "#555" }}>{p.instances} inst.</span>
                      )}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-6 font-mono-gmi text-xs text-center" style={{ color: "#555" }}>No claws match "{filter}"</div>
              )}
            </div>
          </div>

          {/* Right: Detail panel */}
          <div className="flex-1 overflow-y-auto p-8">
            <DetailPanel
              project={project}
              mktState={mktState}
              onUnpublish={() => setUnpublishTarget(project.id)}
              onRepublish={() => { setState(project.id, "published"); toast.success("Re-published to Marketplace"); }}
              onList={() => setLocation(`/list-claw?from=dashboard&projectName=${encodeURIComponent(project.name)}&projectId=${encodeURIComponent(project.id)}&useMaaS=true`)}
            />
          </div>
        </div>
        )}

        <Footer />
      </div>

      {/* Unpublish confirm dialog */}
      {unpublishTarget && (() => {
        const t = PROJECTS.find(p => p.id === unpublishTarget)!;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.8)" }}>
            <div className="w-full max-w-md p-8" style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 flex items-center justify-center" style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)" }}>
                  <Lock size={14} style={{ color: "#ff8080" }} />
                </div>
                <h2 className="font-display text-lg text-white">Unpublish Listing?</h2>
              </div>
              <p className="font-mono-gmi text-sm text-gray-400 leading-relaxed mb-6">
                <span className="text-white">{t.listingName || t.name}</span> will be immediately hidden from the Marketplace.
                Existing users who have already integrated it won't be affected, but new users won't be able to discover it.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setUnpublishTarget(null)} className="btn-outline-dashed px-5 py-2 text-xs">
                  Cancel
                </button>
                <button
                  onClick={() => { setState(unpublishTarget, "unpublished"); setUnpublishTarget(null); toast.success("Listing unpublished", { description: "Hidden from Marketplace. You can re-publish anytime." }); }}
                  className="flex items-center gap-1.5 font-mono-gmi text-xs px-5 py-2"
                  style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", color: "#ff8080" }}
                >
                  <Lock size={11} /> Confirm Unpublish
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
