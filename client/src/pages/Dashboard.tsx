import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";

// ─── Tokens (Geist Sans + GMI Console palette, verbatim from Figma JSON) ──
const FONT = "'Geist', system-ui, sans-serif";
const C = {
  bg:        "#0a0a0a",
  fg:        "#fafafa",
  muted:     "#a3a3a3",
  border:    "#404040",
  borderSoft:"#262626",
  card:      "#171717",
  pillBg:    "rgba(82,82,82,0.3)",
  activeBg:  "rgba(255,255,255,0.12)",
  selectedYellow: "rgba(99,105,35,0.3)",
  ok:        "#34d399",
  err:       "#ef4444",
  lime:      "#DDEA4D",
  limeText:  "#0a0a0a",
} as const;

// ─── Mock data ────────────────────────────────────────────────────────────
// Status enum matches PRD F-03 swagger: pending · creating · running · stopping · stopped · error · deleted
// "idle" is a derived agent-level rollup (no instances), not a task status.
type TaskStatus = "pending" | "creating" | "running" | "stopping" | "stopped" | "error" | "deleted";
type AgentStatus = TaskStatus | "idle";

interface MyAgent {
  id: string;
  name: string;
  templateId: string;
  category: string;
  isTemplate?: boolean;
  hostMode?: "gmi" | "connect";
  maasKey?: string;          // populated for connect-mode agents (synced from Register flow)
  accessUrl?: string;        // populated for connect-mode agents
  registeredAt?: string;
}

// Mirrors the localStorage key written by DeployWizard's Connect-flow Submit
const REGISTERED_AGENTS_KEY = "gmi:registered-agents";

function loadRegisteredAgents(): MyAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(localStorage.getItem(REGISTERED_AGENTS_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

const MY_DEPLOYMENTS: MyAgent[] = [
  // Ships with the OpenClaw provider plugin — a hello-world template the user
  // can provision immediately to verify the plugin install worked.
  { id: "ag_openclaw_default", name: "OpenClaw · default template",
    templateId: "tpl_openclaw_default", category: "Code & Dev Tools",
    isTemplate: true },
  { id: "ag_openclaw_test", name: "Openclaw test", templateId: "d8772394-1a69-4cfd-8b97-f3c895db9e85",
    category: "Code & Dev Tools" },
  { id: "ag_openclaw_v3", name: "openclaw-v3", templateId: "tpl_8a1c-openclaw-v3",
    category: "Code & Dev Tools" },
  { id: "ag_hermes", name: "Hermes", templateId: "tpl_4f9b-hermes",
    category: "Research & Knowledge" },
  { id: "ag_tinyhuman", name: "test tinyhuman", templateId: "tpl_2d5e-tinyhuman",
    category: "Code & Dev Tools" },
];

interface InstanceConfig {
  envOverrides: { id: string; key: string; value: string }[];
  maxLifetime: string;   // e.g. "1h", "off"
  idleTimeout: string;   // e.g. "5min", "off"
}

interface Instance {
  id: string;
  agentId: string;
  status: TaskStatus;
  created: string;
  endpointUrl?: string;       // populated when status=running (per swagger F-03)
  config?: InstanceConfig;    // per-task override (PRD F-04 / F-09 — empty = template defaults)
}

const TEMPLATE_DEFAULT_CONFIG: InstanceConfig = {
  envOverrides: [],
  maxLifetime: "1h",
  idleTimeout: "5min",
};

function endpointFor(id: string): string {
  // Mock — F-02 standardizes a fully-qualified endpoint_url on read paths
  return `https://agentbox.gmi.cloud/t/${id.replace("inst_", "").slice(0, 12)}`;
}

const INITIAL_INSTANCES: Instance[] = [
  { id: "inst_a1b2c3d4-9876-5432-abcd-1122334455", agentId: "ag_hermes",
    status: "running", created: "2026-06-12 14:22:08",
    endpointUrl: endpointFor("inst_a1b2c3d4-9876-5432-abcd-1122334455") },
];

// Mock log tail (F-03 — `GET /tasks/{id}/logs`); deterministic from instance id
function mockLogsFor(inst: Instance): string[] {
  const t = inst.created.slice(11);
  const lines = [
    `[${t}] container_hub: pulling image…`,
    `[${t}] container_hub: image pulled (sha256:${inst.id.slice(-12)})`,
    `[${t}] runtime: starting container`,
    `[${t}] env: GMI_MAAS_API_KEY injected (auto)`,
    `[${t}] env: GMI_MAAS_BASE_URL = https://api.gmi-serving.com`,
    `[${t}] agent: ready · listening on :8080`,
  ];
  if (inst.status === "creating") return lines.slice(0, 3);
  if (inst.status === "error")    return [...lines.slice(0, 4), `[${t}] error: liveness probe failed (exit 1)`];
  if (inst.status === "stopping" || inst.status === "stopped")
    return [...lines, `[${t}] runtime: SIGTERM received · graceful shutdown`];
  return lines;
}

function fmtNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function newInstanceId(): string {
  // RFC4122-ish placeholder for demo purposes
  const r = () => Math.random().toString(16).slice(2, 10);
  return `inst_${r()}-${r().slice(0, 4)}-${r().slice(0, 4)}-${r().slice(0, 4)}-${r()}${r().slice(0, 4)}`;
}

interface AgentAggregate {
  active: number;
  error: number;
  creating: number;
  total: number;
  lastProvisioned: string | null;
}

function aggregateFor(instances: Instance[], agentId: string): AgentAggregate {
  const mine = instances.filter((i) => i.agentId === agentId);
  const active = mine.filter((i) => i.status === "running").length;
  const error = mine.filter((i) => i.status === "error").length;
  const creating = mine.filter((i) => i.status === "creating").length;
  const lastProvisioned = mine.length === 0
    ? null
    : mine.reduce((max, i) => (i.created > max ? i.created : max), mine[0].created);
  return { active, error, creating, total: mine.length, lastProvisioned };
}

// ─── Inline icons (lucide-style) ─────────────────────────────────────────
const IconSearch = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
const IconPlus = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconExternalLink = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </svg>
);
const IconLogs = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
const IconShell = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m4 7 6 5-6 5M13 17h7" />
  </svg>
);
const IconChart = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18M7 14l4-4 4 4 5-5" />
  </svg>
);
const IconConfig = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
const IconCopy = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

// ─── Sub-components ───────────────────────────────────────────────────────
function MaasKeyRow({ value, accessUrl }: { value: string; accessUrl?: string }) {
  const [revealed, setRevealed] = useState(false);
  const masked = value.length > 12 ? `${value.slice(0, 8)}${"•".repeat(20)}${value.slice(-4)}` : value;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 6 }}>
      <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        MaaS Key
      </span>
      <code style={{ fontFamily: "'GeistMono', monospace", fontSize: 12, color: C.fg, background: "rgba(125,211,252,0.06)", border: "1px solid rgba(125,211,252,0.25)", padding: "2px 8px", borderRadius: 6 }}>
        {revealed ? value : masked}
      </code>
      <button
        onClick={() => setRevealed((v) => !v)}
        style={{
          fontFamily: FONT, fontSize: 11, fontWeight: 500,
          color: C.muted, background: "transparent", border: "none",
          padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3,
        }}
      >
        {revealed ? "Hide" : "Reveal"}
      </button>
      <CopyChip value={value} />
      {accessUrl && (
        <a href={accessUrl} target="_blank" rel="noreferrer" style={{ fontFamily: FONT, fontSize: 11, fontWeight: 500, color: "#7dd3fc", textDecoration: "none", marginLeft: "auto" }}>
          {accessUrl} ↗
        </a>
      )}
    </div>
  );
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true); setTimeout(() => setCopied(false), 1500);
      }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: "transparent", border: "none",
        color: copied ? C.lime : C.muted,
        fontFamily: FONT, fontSize: 12, fontWeight: 500,
        cursor: "pointer", padding: "1px 4px", borderRadius: 4,
      }}
    >
      <IconCopy size={11} /> {copied ? "Copied" : "Copy"}
    </button>
  );
}

function MetricCard({ label, value, helper, accent }: {
  label: string; value: string; helper: string; accent: string;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "16px 18px",
        position: "relative",
        overflow: "hidden",
        display: "flex", flexDirection: "column", gap: 4,
        minHeight: 96,
      }}
    >
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: accent }} />
      <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, lineHeight: "20px" }}>{label}</div>
      <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 600, color: C.fg, lineHeight: "32px" }}>{value}</div>
      <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "16px" }}>{helper}</div>
    </div>
  );
}

function PillSegmented<T extends string>({
  options, active, onChange,
}: {
  options: { value: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: C.pillBg,
        border: `1px solid ${C.border}`,
        borderRadius: 999,
        padding: 3,
      }}
    >
      {options.map((opt) => {
        const isActive = opt.value === active;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              fontFamily: FONT, fontSize: 13, fontWeight: 500, lineHeight: "20px",
              background: isActive ? C.activeBg : "transparent",
              color: isActive ? C.fg : C.muted,
              border: "none",
              padding: "4px 12px",
              borderRadius: 999,
              cursor: "pointer",
              transition: "background .15s ease, color .15s ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function statusDot(status: AgentStatus): string {
  switch (status) {
    case "running":  return C.ok;       // green
    case "error":    return C.err;      // red
    case "pending":  return "#a3a3a3";  // neutral
    case "creating": return "#fbbf24";  // amber
    case "stopping": return "#fb923c";  // orange
    case "stopped":  return "#737373";  // grey
    case "deleted":  return "#525252";  // darker grey
    case "idle":     return "#737373";
  }
}

// ─── Left agent list item ─────────────────────────────────────────────────
function AgentListItem({
  agent, agg, selected, onClick,
}: {
  agent: MyAgent;
  agg: AgentAggregate;
  selected: boolean;
  onClick: () => void;
}) {
  const status: AgentStatus =
    agg.error > 0 ? "error" :
    agg.creating > 0 ? "creating" :
    agg.active > 0 ? "running" : "idle";

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: selected ? C.selectedYellow : C.card,
        border: `1px solid ${selected ? "rgba(221,234,77,0.35)" : C.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 6,
        fontFamily: FONT,
        transition: "background .15s ease, border-color .15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.fg, lineHeight: "20px" }}>{agent.name}</div>
        {agent.isTemplate && (
          <span
            style={{
              fontFamily: FONT, fontSize: 10, fontWeight: 600, lineHeight: "14px",
              color: C.lime,
              background: "rgba(221,234,77,0.10)",
              border: "1px solid rgba(221,234,77,0.45)",
              padding: "1px 6px",
              borderRadius: 999,
              letterSpacing: "0.06em",
            }}
          >
            TEMPLATE
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 6, height: 6, borderRadius: 999, background: statusDot(status), display: "inline-block",
            animation: status === "creating" ? "pulse 1.2s ease-in-out infinite" : "none",
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: "16px" }}>
          {status} · {agg.total} inst.
        </span>
      </div>
    </button>
  );
}

// ─── Logs pane — extracted from previous inline expansion ───────────────
function LogsPane({ inst }: { inst: Instance }) {
  const lines = mockLogsFor(inst);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Logs · last {lines.length} lines · GET /tasks/{inst.id.slice(0, 12)}…/logs
        </span>
        <CopyChip value={lines.join("\n")} />
      </div>
      <pre
        style={{
          margin: 0,
          fontFamily: "'GeistMono', monospace", fontSize: 12, lineHeight: "20px",
          color: C.fg,
          whiteSpace: "pre",
          overflowX: "auto",
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 6,
          padding: "10px 12px",
        }}
      >
        {lines.map((line) => (
          <div key={line} style={{ color: line.includes("error") ? "#fca5a5" : line.includes("env:") ? C.muted : C.fg }}>
            {line}
          </div>
        ))}
      </pre>
    </>
  );
}

// ─── Shell pane — mock interactive terminal ─────────────────────────────
function mockShellResponse(cmd: string, inst: Instance): string {
  const c = cmd.trim();
  if (!c) return "";
  if (c === "help") return "Available commands: help, ls, pwd, env, ps, cat, exit";
  if (c === "ls") return "Dockerfile  README.md  package.json  src/  bin/  node_modules/";
  if (c === "pwd") return "/app";
  if (c === "ps") return "PID   COMMAND\n  1   node server.js\n 12   /bin/sh\n 34   ps";
  if (c === "env") return `GMI_MAAS_API_KEY=********\nGMI_MAAS_BASE_URL=https://api.gmi-serving.com\nPORT=8080\nINSTANCE_ID=${inst.id.slice(0, 16)}…`;
  if (c.startsWith("cat ")) return `# ${c.slice(4)}\n(mock contents — read-only preview)`;
  if (c === "exit") return "Connection closed.";
  return `sh: command not found: ${c.split(" ")[0]}`;
}

function ShellPane({ inst }: { inst: Instance }) {
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<Array<{ type: "system" | "cmd" | "out"; text: string }>>([
    { type: "system", text: `Connected to ${inst.id.slice(0, 24)}… · Type 'help' for available commands.` },
  ]);

  const run = () => {
    const c = cmd.trim();
    if (!c) return;
    const out = mockShellResponse(c, inst);
    setHistory((h) => [...h, { type: "cmd", text: c }, { type: "out", text: out }]);
    setCmd("");
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Shell · POST /tasks/{inst.id.slice(0, 12)}…/exec (mock)
        </span>
        <span style={{ fontFamily: FONT, fontSize: 11, color: "#fbbf24" }}>preview · not in v1.1 PRD</span>
      </div>
      <div
        style={{
          background: "#000",
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 6,
          padding: "10px 12px",
          fontFamily: "'GeistMono', monospace", fontSize: 12, lineHeight: "20px",
          maxHeight: 200, overflowY: "auto",
        }}
      >
        {history.map((h, i) => (
          <div
            key={i}
            style={{
              color: h.type === "cmd" ? C.lime : h.type === "system" ? C.muted : C.fg,
              whiteSpace: "pre-wrap",
            }}
          >
            {h.type === "cmd" ? `$ ${h.text}` : h.text}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span style={{ color: C.lime }}>$</span>
          <input
            autoFocus
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") run(); }}
            placeholder="type a command…"
            style={{
              flex: 1,
              background: "transparent",
              color: C.fg,
              border: "none",
              outline: "none",
              fontFamily: "'GeistMono', monospace", fontSize: 12, lineHeight: "20px",
            }}
          />
        </div>
      </div>
    </>
  );
}

// ─── Metrics pane — 3 mock sparklines (CPU / Memory / RPS) ──────────────
function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h || 1;
}

function walk(n: number, seed: number, min: number, max: number): number[] {
  let s = seed;
  let v = (min + max) / 2;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    v += (r - 0.5) * (max - min) * 0.18;
    if (v < min) v = min + (min - v);
    if (v > max) v = max - (v - max);
    out.push(Math.round(v * 10) / 10);
  }
  return out;
}

function Sparkline({ label, current, suffix, data, color }: {
  label: string;
  current: string;
  suffix?: string;
  data: number[];
  color: string;
}) {
  const w = 240, h = 56;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h + 2}`).join(" ");
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "10px 12px",
        display: "flex", flexDirection: "column", gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: C.fg, letterSpacing: "-0.01em" }}>
          {current}<span style={{ fontSize: 11, fontWeight: 500, color: C.muted, marginLeft: 2 }}>{suffix}</span>
        </span>
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h + 4}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h + 4} ${points} ${w},${h + 4}`} fill={`url(#grad-${label})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ─── Config pane — show per-instance overrides (read-only) ─────────────
function ConfigPane({ inst }: { inst: Instance }) {
  const cfg = inst.config;
  const usedDefaults =
    !cfg ||
    (cfg.envOverrides.length === 0 &&
      cfg.maxLifetime === TEMPLATE_DEFAULT_CONFIG.maxLifetime &&
      cfg.idleTimeout === TEMPLATE_DEFAULT_CONFIG.idleTimeout);
  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Per-task config · overrides over template
        </span>
      </div>
      {usedDefaults ? (
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 6, padding: "14px 16px", fontFamily: FONT, fontSize: 13, color: C.muted }}>
          Used template defaults — no per-task overrides.
        </div>
      ) : (
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 6, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12, lineHeight: "18px" }}>
              <span style={{ color: C.muted }}>max_lifetime</span>
              <span style={{ color: cfg!.maxLifetime !== TEMPLATE_DEFAULT_CONFIG.maxLifetime ? "#7dd3fc" : C.fg, fontFamily: "'GeistMono', monospace" }}>{cfg!.maxLifetime}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12, lineHeight: "18px" }}>
              <span style={{ color: C.muted }}>idle_timeout</span>
              <span style={{ color: cfg!.idleTimeout !== TEMPLATE_DEFAULT_CONFIG.idleTimeout ? "#7dd3fc" : C.fg, fontFamily: "'GeistMono', monospace" }}>{cfg!.idleTimeout}</span>
            </div>
          </div>
          {cfg!.envOverrides.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 8 }}>
              <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
                env overrides · {cfg!.envOverrides.length}
              </div>
              {cfg!.envOverrides.map((e) => (
                <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, fontFamily: "'GeistMono', monospace", fontSize: 12, lineHeight: "20px" }}>
                  <span style={{ color: "#7dd3fc" }}>{e.key || "—"}</span>
                  <span style={{ color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.value || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Provision modal — per-task overrides (env + lifecycle) ─────────────
function ProvisionModal({
  open, agentName, onCancel, onSubmit,
}: {
  open: boolean;
  agentName: string;
  onCancel: () => void;
  onSubmit: (cfg: InstanceConfig) => void;
}) {
  const [env, setEnv] = useState<{ id: string; key: string; value: string }[]>([]);
  const [maxLifetime, setMaxLifetime] = useState(TEMPLATE_DEFAULT_CONFIG.maxLifetime);
  const [idleTimeout, setIdleTimeout] = useState(TEMPLATE_DEFAULT_CONFIG.idleTimeout);

  // Reset on close
  if (!open) return null;

  const addEnv = () => setEnv((e) => [...e, { id: `e${Math.random().toString(36).slice(2, 8)}`, key: "", value: "" }]);
  const updateEnv = (id: string, patch: Partial<{ key: string; value: string }>) =>
    setEnv((e) => e.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeEnv = (id: string) => setEnv((e) => e.filter((row) => row.id !== id));

  const close = () => {
    setEnv([]);
    setMaxLifetime(TEMPLATE_DEFAULT_CONFIG.maxLifetime);
    setIdleTimeout(TEMPLATE_DEFAULT_CONFIG.idleTimeout);
    onCancel();
  };

  const submit = () => {
    onSubmit({
      envOverrides: env.filter((e) => e.key.trim().length > 0),
      maxLifetime,
      idleTimeout,
    });
    setEnv([]);
    setMaxLifetime(TEMPLATE_DEFAULT_CONFIG.maxLifetime);
    setIdleTimeout(TEMPLATE_DEFAULT_CONFIG.idleTimeout);
  };

  const inputStyle: React.CSSProperties = {
    background: C.pillBg,
    border: `1px solid ${C.border}`,
    color: C.fg,
    fontFamily: "'GeistMono', monospace", fontSize: 12, fontWeight: 400, lineHeight: "18px",
    padding: "6px 10px",
    borderRadius: 6,
    outline: "none",
  };

  return (
    <div
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: "100%",
          background: C.cardSolid,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          display: "flex", flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>Create instance</h3>
          <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "4px 0 0", lineHeight: "16px" }}>
            Override template defaults for this task only. {agentName && <span>Agent: <span style={{ color: C.fg }}>{agentName}</span></span>}
          </p>
        </div>

        {/* Body — scrollable */}
        <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Env overrides */}
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>
                Environment overrides
                <span style={{ color: C.muted, fontWeight: 400, marginLeft: 6 }}>· optional</span>
              </label>
              <button
                onClick={addEnv}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontFamily: FONT, fontSize: 12, fontWeight: 500,
                  color: "#7dd3fc",
                  background: "rgba(125,211,252,0.08)",
                  border: "1px solid rgba(125,211,252,0.30)",
                  padding: "2px 10px", borderRadius: 999, cursor: "pointer",
                }}
              >
                + Add var
              </button>
            </div>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
              Merged over template env at task start. Locked GMI keys (<code style={{ fontFamily: "'GeistMono', monospace", color: C.fg }}>GMI_MAAS_*</code>) cannot be overridden.
            </span>
            {env.length === 0 ? (
              <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, padding: "6px 0" }}>
                No overrides — task will inherit template env.
              </div>
            ) : (
              env.map((row) => (
                <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 26px", gap: 6, alignItems: "center" }}>
                  <input
                    placeholder="KEY"
                    value={row.key}
                    onChange={(e) => updateEnv(row.id, { key: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    placeholder="value"
                    value={row.value}
                    onChange={(e) => updateEnv(row.id, { value: e.target.value })}
                    style={inputStyle}
                  />
                  <button
                    onClick={() => removeEnv(row.id)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: 4, display: "inline-flex" }}
                    aria-label="Remove"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </section>

          {/* Lifecycle overrides */}
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>
              Lifecycle overrides
              <span style={{ color: C.muted, fontWeight: 400, marginLeft: 6 }}>· optional</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 500, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>max_lifetime</span>
                <select
                  value={maxLifetime}
                  onChange={(e) => setMaxLifetime(e.target.value)}
                  style={{ ...inputStyle, fontFamily: FONT, appearance: "none", paddingRight: 24, cursor: "pointer" }}
                >
                  {["30min", "1h", "2h", "4h", "8h", "24h", "off"].map((v) => <option key={v} value={v}>{v === "off" ? "No limit" : v}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 500, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>idle_timeout</span>
                <select
                  value={idleTimeout}
                  onChange={(e) => setIdleTimeout(e.target.value)}
                  style={{ ...inputStyle, fontFamily: FONT, appearance: "none", paddingRight: 24, cursor: "pointer" }}
                >
                  {["1min", "5min", "15min", "30min", "1h", "off"].map((v) => <option key={v} value={v}>{v === "off" ? "Off" : v}</option>)}
                </select>
              </div>
            </div>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
              Hard caps for just this task. Leave at template defaults if not needed.
            </span>
          </section>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${C.borderSoft}` }}>
          <button
            onClick={close}
            style={{
              fontFamily: FONT, fontSize: 13, fontWeight: 500,
              background: "transparent", color: C.fg,
              border: `1px solid ${C.border}`,
              padding: "6px 14px", borderRadius: 8, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontFamily: FONT, fontSize: 13, fontWeight: 600,
              background: C.lime, color: C.limeText,
              border: "none",
              padding: "6px 16px", borderRadius: 8, cursor: "pointer",
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricsPane({ inst }: { inst: Instance }) {
  const cpu = useMemo(() => walk(60, seedFrom(inst.id + "cpu"), 5, 78), [inst.id]);
  const mem = useMemo(() => walk(60, seedFrom(inst.id + "mem"), 28, 72), [inst.id]);
  const rps = useMemo(() => walk(60, seedFrom(inst.id + "rps"), 0, 42), [inst.id]);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Metrics · last 60s · GET /tasks/{inst.id.slice(0, 12)}…/metrics/timeseries
        </span>
        <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>live · 1 Hz</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Sparkline label="CPU"        current={String(cpu[cpu.length - 1])} suffix="%"   data={cpu} color="#7dd3fc" />
        <Sparkline label="Memory"     current={String(mem[mem.length - 1])} suffix="%"   data={mem} color="#86efac" />
        <Sparkline label="Requests/s" current={String(rps[rps.length - 1])} suffix="/s"  data={rps} color="#c7a7ff" />
      </div>
    </>
  );
}

// ─── Monitor pane ─────────────────────────────────────────────────────────
function MonitorPane({
  agent, instances, onProvision, onTerminate,
}: {
  agent: MyAgent;
  instances: Instance[];
  onProvision: (agentId: string) => void;
  onTerminate: (instanceId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "running" | "error" | "creating">("all");
  type PanelKind = "logs" | "shell" | "metrics" | "config";
  const [expanded, setExpanded] = useState<{ id: string; panel: PanelKind } | null>(null);
  const togglePanel = (id: string, panel: PanelKind) => {
    setExpanded((curr) => (curr && curr.id === id && curr.panel === panel ? null : { id, panel }));
  };

  const agg = useMemo(() => aggregateFor(instances, agent.id), [instances, agent.id]);
  const mine = useMemo(() => instances.filter((i) => i.agentId === agent.id), [instances, agent.id]);
  const filtered = useMemo(() => {
    return mine.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (search && !i.id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [mine, filter, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Aggregate status */}
      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 12px" }}>
          Aggregate status
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <MetricCard
            label="Active"
            value={agg.active > 0 ? String(agg.active) : "—"}
            helper="status = running"
            accent="#22c55e"
          />
          <MetricCard
            label="Error"
            value={agg.error > 0 ? String(agg.error) : "—"}
            helper="red tab badge if > 0"
            accent="#ef4444"
          />
          <MetricCard
            label="Creating"
            value={agg.creating > 0 ? String(agg.creating) : "—"}
            helper="status = creating"
            accent="#fbbf24"
          />
          <MetricCard
            label="Last created"
            value={agg.lastProvisioned ? agg.lastProvisioned.slice(5, 16).replace(" ", "·") : "—"}
            helper="max(createdAt)"
            accent="#a3a3a3"
          />
        </div>
      </section>

      {/* Instance Set */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 12 }}>
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: 0 }}>
            Instance Set
          </h3>
          <button
            onClick={() => onProvision(agent.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontFamily: FONT, fontSize: 13, fontWeight: 600, lineHeight: "20px",
              background: C.lime, color: C.limeText,
              border: "none",
              padding: "6px 14px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create instance
          </button>
        </div>
        <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "16px", color: C.muted, margin: "0 0 12px" }}>
          Uses template defaults · per-task env passed via the SDK at task create.
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", flex: 1, maxWidth: 420 }}>
            <span style={{ position: "absolute", left: 10, color: C.muted, display: "flex" }}>
              <IconSearch />
            </span>
            <input
              type="text"
              placeholder="Fuzzy match: name or id"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                background: C.pillBg,
                border: `1px solid ${C.border}`,
                color: C.fg,
                fontFamily: FONT, fontSize: 14, fontWeight: 400, lineHeight: "20px",
                padding: "8px 12px 8px 32px",
                borderRadius: 8,
                outline: "none",
              }}
            />
          </div>
          <PillSegmented
            active={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "running", label: "Running" },
              { value: "error", label: "Error" },
              { value: "creating", label: "Creating" },
            ]}
          />
        </div>

        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1.4fr 1fr 1.4fr",
              padding: "10px 16px",
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.02)",
              fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: "16px",
            }}
          >
            <div>Instance ID</div>
            <div>Status</div>
            <div>Created</div>
            <div style={{ textAlign: "right" }}>Action</div>
          </div>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                fontFamily: FONT, fontSize: 14, fontWeight: 400, color: C.muted, textAlign: "center",
              }}
            >
              No instances yet — click <span style={{ color: C.lime, fontWeight: 600 }}>Create instance</span> to start one.
            </div>
          ) : (
            filtered.map((inst, i) => {
              const isExpandedOn = (p: PanelKind) => expanded?.id === inst.id && expanded?.panel === p;
              const panelBtn = (panel: PanelKind, label: string, icon: React.ReactNode) => (
                <button
                  onClick={() => togglePanel(inst.id, panel)}
                  style={{
                    fontFamily: FONT, fontSize: 11, fontWeight: 500,
                    background: isExpandedOn(panel) ? "rgba(125,211,252,0.10)" : "transparent",
                    color: isExpandedOn(panel) ? "#7dd3fc" : C.fg,
                    border: `1px solid ${isExpandedOn(panel) ? "rgba(125,211,252,0.35)" : C.border}`,
                    padding: "3px 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}
                >
                  {icon} {label}
                </button>
              );
              return (
                <div key={inst.id}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1.4fr 1fr 1.8fr",
                      padding: "10px 16px",
                      borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
                      fontFamily: FONT, fontSize: 13, fontWeight: 400, color: C.fg, lineHeight: "20px",
                      alignItems: "center",
                      animation: "row-fade-in 220ms ease-out",
                    }}
                  >
                    <div
                      title={inst.id}
                      style={{ fontFamily: "'GeistMono', monospace", fontSize: 12, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {inst.id.slice(0, 24)}…
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 6, height: 6, borderRadius: 999,
                            background: statusDot(inst.status),
                            animation: inst.status === "creating" ? "pulse 1.2s ease-in-out infinite" : "none",
                          }}
                        />
                        <span style={{ color: C.muted }}>{inst.status}</span>
                      </span>
                      {inst.status === "running" && inst.endpointUrl && (
                        <a
                          href={inst.endpointUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={inst.endpointUrl}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontFamily: FONT, fontSize: 11, fontWeight: 500,
                            color: "#7dd3fc",
                            background: "rgba(125,211,252,0.10)",
                            border: "1px solid rgba(125,211,252,0.35)",
                            padding: "2px 7px",
                            borderRadius: 999,
                            textDecoration: "none",
                          }}
                        >
                          Open
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 17 17 7M8 7h9v9" />
                          </svg>
                        </a>
                      )}
                    </div>
                    <div style={{ color: C.muted }}>{inst.created}</div>
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                      {panelBtn("metrics", "Metrics", <IconChart />)}
                      {panelBtn("shell", "Shell", <IconShell />)}
                      {panelBtn("logs", "Logs", <IconLogs />)}
                      {panelBtn("config", "Config", <IconConfig />)}
                      <button
                        onClick={() => onTerminate(inst.id)}
                        style={{
                          fontFamily: FONT, fontSize: 11, fontWeight: 500,
                          background: "transparent",
                          color: C.err,
                          border: `1px solid ${C.border}`,
                          padding: "3px 8px",
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        Terminate
                      </button>
                    </div>
                  </div>
                  {expanded?.id === inst.id && (
                    <div
                      style={{
                        background: "#0a0a0a",
                        borderTop: `1px solid ${C.borderSoft}`,
                        padding: "10px 16px 12px",
                        animation: "row-fade-in 180ms ease-out",
                      }}
                    >
                      {expanded.panel === "logs"    && <LogsPane inst={inst} />}
                      {expanded.panel === "shell"   && <ShellPane inst={inst} />}
                      {expanded.panel === "metrics" && <MetricsPane inst={inst} />}
                      {expanded.panel === "config"  && <ConfigPane inst={inst} />}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Integration pane ─────────────────────────────────────────────────────
function IntegrationPane({ agent }: { agent: MyAgent }) {
  const curl = [
    "# Create an instance",
    `curl -X POST https://api.gmicloud.ai/v1/agents/deployments/${agent.id}/tasks \\`,
    "  -H \"Authorization: Bearer $GMI_API_KEY\" \\",
    "  -H \"Content-Type: application/json\" \\",
    "  -d '{\"inputs\": {\"prompt\": \"hello\"}}'",
    "",
    "# Poll until running",
    "curl https://api.gmicloud.ai/v1/agents/tasks/$TASK_ID \\",
    "  -H \"Authorization: Bearer $GMI_API_KEY\"",
    "",
    "# Terminate",
    "curl -X DELETE https://api.gmicloud.ai/v1/agents/tasks/$TASK_ID \\",
    "  -H \"Authorization: Bearer $GMI_API_KEY\"",
  ].join("\n");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 4px" }}>
          Template ID
        </h3>
        <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 400, color: C.muted, margin: "0 0 12px" }}>
          Use this ID when calling the Agentbox API to create instances of this Agent.
        </p>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "10px 14px",
            fontFamily: "'GeistMono', monospace", fontSize: 13, color: C.fg,
          }}
        >
          <span style={{ flex: 1, overflowX: "auto" }}>{agent.templateId}</span>
          <CopyChip value={agent.templateId} />
        </div>
      </section>

      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 12px" }}>
          cURL — create → poll → terminate
        </h3>
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px",
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(0,0,0,0.2)",
            }}
          >
            <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>Terminal</span>
            <CopyChip value={curl} />
          </div>
          <pre
            style={{
              margin: 0, padding: "14px 16px",
              fontFamily: "'GeistMono', monospace", fontSize: 13, lineHeight: "22px",
              color: C.fg,
              whiteSpace: "pre", overflowX: "auto",
            }}
          >
            {curl}
          </pre>
        </div>
      </section>
    </div>
  );
}

// ─── Analytics pane ───────────────────────────────────────────────────────
function AnalyticsPane() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 12px" }}>
          Usage by model
        </h3>
        <div
          style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "20px 16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            height: 220,
            fontFamily: FONT, fontSize: 13, color: C.muted,
          }}
        >
          Chart placeholder — request volume over 1D / 7D / 30D / 90D
        </div>
      </section>

      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 12px" }}>
          API keys
        </h3>
        <div
          style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: "16px",
            fontFamily: FONT, fontSize: 13, color: C.muted,
          }}
        >
          No API keys created yet. Generate one to call this Agent over HTTP.
        </div>
      </section>
    </div>
  );
}

// ─── Right detail pane ────────────────────────────────────────────────────
function AgentDetailPane({
  agent, instances, onProvision, onTerminate,
}: {
  agent: MyAgent;
  instances: Instance[];
  onProvision: (agentId: string) => void;
  onTerminate: (instanceId: string) => void;
}) {
  const [tab, setTab] = useState<"monitor" | "integration" | "analytics">("monitor");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 600, lineHeight: "32px", color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>
              {agent.name}
            </h2>
            {agent.isTemplate && (
              <span
                style={{
                  fontFamily: FONT, fontSize: 11, fontWeight: 600, lineHeight: "16px",
                  color: C.lime,
                  background: "rgba(221,234,77,0.10)",
                  border: "1px solid rgba(221,234,77,0.45)",
                  padding: "2px 8px",
                  borderRadius: 999,
                  letterSpacing: "0.06em",
                }}
              >
                TEMPLATE
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: FONT, fontSize: 12, fontWeight: 500, lineHeight: "16px",
                color: "#c7a7ff",
                background: "rgba(199,167,255,0.10)",
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              {agent.category}
            </span>
            <span style={{ fontFamily: "'GeistMono', monospace", fontSize: 12, fontWeight: 500, color: C.muted, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {agent.templateId}
              <CopyChip value={agent.templateId} />
            </span>
            {agent.hostMode === "connect" && (
              <span
                style={{
                  fontFamily: FONT, fontSize: 11, fontWeight: 600, lineHeight: "14px",
                  color: "#7dd3fc",
                  background: "rgba(125,211,252,0.10)",
                  border: "1px solid rgba(125,211,252,0.30)",
                  padding: "1px 8px",
                  borderRadius: 999,
                  letterSpacing: "0.04em",
                }}
              >
                SELF-HOSTED
              </span>
            )}
          </div>
          {agent.hostMode === "connect" && agent.maasKey && (
            <MaasKeyRow value={agent.maasKey} accessUrl={agent.accessUrl} />
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            style={{
              fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
              background: "transparent", color: C.fg,
              border: `1px solid ${C.border}`,
              padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            }}
          >
            Unpublish
          </button>
          <button
            style={{
              fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
              background: "transparent", color: C.fg,
              border: `1px solid ${C.border}`,
              padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            }}
          >
            Edit listing
          </button>
          <button
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
              background: C.lime, color: C.limeText,
              border: "none",
              padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            }}
          >
            View public listing <IconExternalLink size={12} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <PillSegmented
        active={tab}
        onChange={setTab}
        options={[
          { value: "monitor", label: "Monitor" },
          { value: "integration", label: "Integration" },
          { value: "analytics", label: "Analytics" },
        ]}
      />

      {/* Body */}
      {tab === "monitor" && (
        <MonitorPane
          agent={agent}
          instances={instances}
          onProvision={onProvision}
          onTerminate={onTerminate}
        />
      )}
      {tab === "integration" && <IntegrationPane agent={agent} />}
      {tab === "analytics" && <AnalyticsPane />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [topTab, setTopTab] = useState<"deployments" | "uses">("deployments");
  const [filter, setFilter] = useState("");
  const [registered] = useState<MyAgent[]>(() => loadRegisteredAgents());
  // Newly-registered agents from Connect flow appear at the top, then the seed list
  const allAgents = useMemo(() => [...registered, ...MY_DEPLOYMENTS], [registered]);
  const [selectedId, setSelectedId] = useState<string>(allAgents[0]?.id ?? MY_DEPLOYMENTS[0].id);
  const [instances, setInstances] = useState<Instance[]>(INITIAL_INSTANCES);

  // Provision modal — open per-task override modal first, then provision on submit
  const [provisionForAgentId, setProvisionForAgentId] = useState<string | null>(null);

  const handleProvision = (agentId: string) => setProvisionForAgentId(agentId);

  const actuallyProvision = (agentId: string, config: InstanceConfig) => {
    const id = newInstanceId();
    const newInst: Instance = {
      id,
      agentId,
      status: "creating",
      created: fmtNow(),
      config,
    };
    setInstances((prev) => [newInst, ...prev]);
    setProvisionForAgentId(null);
    // Simulate the container booting; flip to running + hydrate endpoint_url after ~1.5s
    // (matches F-03: endpoint_url is populated on read paths once the task is running)
    setTimeout(() => {
      setInstances((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: "running", endpointUrl: endpointFor(id) } : i,
        ),
      );
    }, 1500);
  };

  const handleTerminate = (instanceId: string) => {
    setInstances((prev) => prev.filter((i) => i.id !== instanceId));
  };

  const list = useMemo(() => {
    const q = filter.toLowerCase();
    return allAgents.filter((a) => !q || a.name.toLowerCase().includes(q));
  }, [filter, allAgents]);

  const selected = list.find((a) => a.id === selectedId) ?? list[0];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.6); } }
        @keyframes row-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <Topbar />
      <Navbar />

      <div style={{ marginLeft: 210, paddingTop: 40, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Top tabs (My Deployments & Listings / Agents I Use) */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "0 32px" }}>
          {[
            { id: "deployments" as const, label: "My Deployments & Listings" },
            { id: "uses" as const, label: "Agents I Use" },
          ].map((t) => {
            const isActive = topTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTopTab(t.id)}
                style={{
                  fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
                  background: "transparent",
                  color: isActive ? C.fg : C.muted,
                  border: "none",
                  borderBottom: `2px solid ${isActive ? C.lime : "transparent"}`,
                  padding: "16px 18px",
                  cursor: "pointer",
                  marginBottom: "-1px",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body: split — left list pane / right detail pane */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "320px 1fr",
            gap: 24,
            padding: "24px 32px 32px",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Left pane */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <h1 style={{ fontFamily: FONT, fontSize: 20, fontWeight: 500, lineHeight: "28px", color: C.fg, margin: 0, letterSpacing: "-0.01em" }}>
              My Agents
            </h1>

            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: 10, color: C.muted, display: "flex" }}>
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Filter…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  width: "100%",
                  background: C.pillBg,
                  border: `1px solid ${C.border}`,
                  color: C.fg,
                  fontFamily: FONT, fontSize: 14, fontWeight: 400, lineHeight: "20px",
                  padding: "8px 12px 8px 32px",
                  borderRadius: 8,
                  outline: "none",
                }}
              />
            </div>

            <button
              onClick={() => setLocation("/deploy")}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
                background: C.lime, color: C.limeText,
                border: "none",
                padding: "8px 14px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <IconPlus /> List an agent
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {list.map((agent) => (
                <AgentListItem
                  key={agent.id}
                  agent={agent}
                  agg={aggregateFor(instances, agent.id)}
                  selected={agent.id === selected?.id}
                  onClick={() => setSelectedId(agent.id)}
                />
              ))}
              {list.length === 0 && (
                <div style={{ fontFamily: FONT, fontSize: 13, color: C.muted, padding: 12 }}>
                  No agents match this filter.
                </div>
              )}
            </div>
          </aside>

          {/* Right pane */}
          {selected ? (
            <AgentDetailPane
              agent={selected}
              instances={instances}
              onProvision={handleProvision}
              onTerminate={handleTerminate}
            />
          ) : (
            <div style={{ fontFamily: FONT, fontSize: 14, color: C.muted, padding: 32, textAlign: "center" }}>
              Select an agent to see its details.
            </div>
          )}
        </div>

        <Footer />
      </div>

      <ProvisionModal
        open={provisionForAgentId !== null}
        agentName={allAgents.find((a) => a.id === provisionForAgentId)?.name ?? ""}
        onCancel={() => setProvisionForAgentId(null)}
        onSubmit={(cfg) => {
          if (provisionForAgentId) actuallyProvision(provisionForAgentId, cfg);
        }}
      />
    </div>
  );
}
