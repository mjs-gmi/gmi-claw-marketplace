import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import CopyButton from "@/components/CopyButton";
import { C as baseC, FONT, MONO } from "@/lib/tokens";
import { SEED_AGENTS } from "@/lib/seedAgents";
import { PlanBadge, DiscountedPrice } from "@/components/PlanUI";
import { discountPriceString, CODING_AGENT_PLAN } from "@/lib/modelsPlan";

// ─── Tokens — shared base from @/lib/tokens, plus a few page-local keys.
const C = {
  ...baseC,
  card:      "#171717",              // page-specific (opaque, not translucent)
  activeBg:  "rgba(255,255,255,0.12)",
  selectedYellow: "rgba(99,105,35,0.3)",
  err:       "#ef4444",              // page-specific
};

// ─── Mock data ────────────────────────────────────────────────────────────
// Status enum matches PRD F-03 swagger: pending · creating · running · stopping · stopped · error · deleted
// "idle" is a derived agent-level rollup (no instances), not a task status.
// Runtime 2.0 lifecycle states (PRD §4.1). "stopping"/"stopped" retained for
// legacy log helpers; the R1 lifecycle uses suspend/resume/delete semantics.
type TaskStatus =
  | "pending" | "creating" | "running"
  | "suspending" | "suspended" | "resuming"
  | "deleting" | "deleted" | "error"
  | "stopping" | "stopped";
type AgentStatus = TaskStatus | "idle";

// Normalized Console label mapping (PRD §4.1 — API states are authoritative,
// Console labels are presentation only).
function statusLabel(status: AgentStatus): string {
  switch (status) {
    case "pending":
    case "creating":   return "CREATING";
    case "running":    return "RUNNING";
    case "suspending": return "SUSPENDING";
    case "suspended":  return "SUSPENDED";
    case "resuming":   return "RESUMING";
    case "deleting":   return "DELETING";
    case "deleted":    return "DELETED";
    case "error":      return "ERROR";
    case "idle":       return "IDLE";
    case "stopping":   return "SUSPENDING";
    case "stopped":    return "SUSPENDED";
  }
}

// Per PRD M4: a registered agent lives in one of four listing states until human
// review approves it. Default after Register = "draft" (only visible to owner).
type ListingState = "draft" | "pending_review" | "live" | "rejected";

interface MyAgent {
  id: string;
  name: string;
  templateId: string;
  category: string;
  isTemplate?: boolean;
  verified?: boolean;        // blue check next to the name (curated / approved agent)
  displayStatus?: AgentStatus; // rollup label shown when the agent has 0 live instances
  hostMode?: "gmi" | "connect";
  maasKey?: string;          // populated for connect-mode agents (synced from Register flow)
  accessUrl?: string;        // populated for connect-mode agents
  registeredAt?: string;
  listingState?: ListingState;  // M4 state machine — default "draft"
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

// Demo seed deployments so the prototype renders a populated state (mirrors the
// GMI Console "My Agents" reference). The new-user empty-state logic below is
// retained — it simply doesn't trigger while these demo agents are present.
// Sourced from the shared SEED_AGENTS so ListClaw's register-first guard stays
// in sync (both views agree the user already has these agents).
const MY_DEPLOYMENTS: MyAgent[] = SEED_AGENTS;

interface InstanceConfig {
  name?: string;         // optional instance name (e.g. "prod-worker-1")
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
  // ── Runtime 2.0 lifecycle (PRD §2) ──────────────────────────────────────
  maxActive?: string;             // F-02 Maximum active runtime: "1h"|"6h"|"24h"|"48h"|"off"
  maxRuntimeAction?: "suspend" | "delete"; // F-02 default action at the limit
  lifecycleStartedAt?: string;    // anchor for active-time-remaining countdown
  suspendedAt?: string;           // F-05 retention clock start (set on entering suspended)
  retentionDays?: number;         // F-05 suspended-disk retention window
  keep?: boolean;                 // F-05 Keep from auto-deletion (pauses retention)
  lastError?: string;             // §5.4 Activity and errors
  unconfirmed?: boolean;          // §4.1 unknown provider outcome
}

const TEMPLATE_DEFAULT_CONFIG: InstanceConfig = {
  envOverrides: [],
  maxLifetime: "1h",   // F-02 / Q1 — Organization fallback default
  idleTimeout: "off",  // F-03 — inactivity policy Off by default
};

function endpointFor(id: string): string {
  // Mock — F-02 standardizes a fully-qualified endpoint_url on read paths
  return `https://agentbox.gmi.cloud/t/${id.replace("inst_", "").slice(0, 12)}`;
}

// Seed instances for the demo "Hermes" agent so My Agents renders a populated
// state matching the console: 2 running instances → Active 2, a populated
// Instance Set table, and the row action (⋮) menu. fmtDate / endpointFor are
// hoisted function declarations; new Date() at module load is fine in the browser.
const _seedDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtDate(d);
};
const _seedMinsAgo = (n: number): string => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - n);
  return fmtDate(d);
};
const INITIAL_INSTANCES: Instance[] = [
  {
    id: "8b62347b-4c1a-4e9f-a2d7-6f0b1e5a3c36",
    agentId: "agent_hermes",
    status: "running",
    created: _seedDaysAgo(5),
    endpointUrl: endpointFor("8b62347b-4c1a-4e9f-a2d7-6f0b1e5a3c36"),
    maxActive: "1h",
    maxRuntimeAction: "suspend",
    lifecycleStartedAt: _seedMinsAgo(17), // ~43 min active time remaining
  },
  {
    id: "1e1bd452-9a3c-4b8e-bf21-7d40c9e6095a",
    agentId: "agent_hermes",
    status: "running",
    created: _seedDaysAgo(6),
    endpointUrl: endpointFor("1e1bd452-9a3c-4b8e-bf21-7d40c9e6095a"),
    maxActive: "off",
    maxRuntimeAction: "suspend",
  },
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

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function fmtNow(): string {
  return fmtDate(new Date());
}

// Relative "Nd ago" label for instance timestamps (matches the console's
// Created column + Last provisioned card). Falls back to the raw string.
function agoLabel(created: string): string {
  const then = new Date(created.replace(" ", "T")).getTime();
  if (Number.isNaN(then)) return created;
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Middle-truncate a long instance id → "8b62347b…3c36" (matches the console).
function midId(id: string): string {
  const s = id.replace(/^inst_/, "");
  return s.length > 16 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}

// Parse a duration token ("15min"|"1h"|"48h"|"off") → minutes (0 = off/none).
function durationMins(v?: string): number {
  if (!v || v === "off") return 0;
  const m = /^(\d+)\s*(min|h)$/.exec(v.trim());
  if (!m) return 0;
  return m[2] === "h" ? Number(m[1]) * 60 : Number(m[1]);
}
// Human label for a duration token, for policy helper text.
function durationLabel(v?: string): string {
  if (!v || v === "off") return "No automatic limit";
  const m = /^(\d+)\s*(min|h)$/.exec(v.trim());
  if (!m) return v;
  const n = Number(m[1]);
  return m[2] === "h" ? `${n} hour${n > 1 ? "s" : ""}` : `${n} min`;
}
// Round a minute count up to a coarse "N min / N h remaining" label.
function remainingLabel(mins: number): string {
  if (mins <= 0) return "limit reached";
  if (mins < 60) return `${mins} min remaining`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${h}h ${rem}m remaining` : `${h}h remaining`;
}

// F-02 Lifecycle column — active-time remaining for a Running runtime.
function activeRemaining(inst: Instance): string {
  const total = durationMins(inst.maxActive);
  if (total === 0) return "No automatic limit";
  const start = inst.lifecycleStartedAt ? new Date(inst.lifecycleStartedAt.replace(" ", "T")).getTime() : Date.now();
  const elapsed = Math.floor((Date.now() - start) / 60000);
  return `${remainingLabel(total - elapsed)} active`;
}

// F-05 Lifecycle column — retention state for a Suspended runtime.
function retentionState(inst: Instance): string {
  if (inst.keep) return "Kept from auto-deletion";
  const days = inst.retentionDays ?? 30;
  const start = inst.suspendedAt ? new Date(inst.suspendedAt.replace(" ", "T")).getTime() : Date.now();
  const elapsedDays = Math.floor((Date.now() - start) / 86400000);
  const left = Math.max(0, days - elapsedDays);
  return `Deletes in ${left} day${left === 1 ? "" : "s"}`;
}

function newInstanceId(): string {
  // RFC4122-ish placeholder for demo purposes
  const r = () => Math.random().toString(16).slice(2, 10);
  return `inst_${r()}-${r().slice(0, 4)}-${r().slice(0, 4)}-${r().slice(0, 4)}-${r()}${r().slice(0, 4)}`;
}
function newSnapshotId(): string {
  const r = () => Math.random().toString(16).slice(2, 10);
  return `snap_${r()}${r().slice(0, 4)}`;
}

// ─── Snapshot lifecycle (PRD §3 / §5.5) ─────────────────────────────────────
// Organization-owned, independent copies of a runtime disk. creating → ready.
type SnapshotStatus = "creating" | "ready" | "failed" | "deleting";
interface Snapshot {
  id: string;
  name: string;
  sourceAgentId: string;
  sourceAgentName: string;
  sourceRuntimeId: string;
  sourceDeleted?: boolean;   // source runtime/agent gone — snapshot still usable (F-08)
  category: string;          // captured runtime category — drives restore compatibility
  createdAt: string;
  sizeGiB: number;
  retentionDays: number;     // F-10 retention window
  status: SnapshotStatus;
  error?: string;
}
const INITIAL_SNAPSHOTS: Snapshot[] = [
  {
    id: "snap_7c3f9a21b8e4",
    name: "hermes-baseline",
    sourceAgentId: "agent_hermes",
    sourceAgentName: "Hermes",
    sourceRuntimeId: "8b62347b-4c1a-4e9f-a2d7-6f0b1e5a3c36",
    category: "Code & Dev Tools",
    createdAt: _seedDaysAgo(3),
    sizeGiB: 4.2,
    retentionDays: 30,
    status: "ready",
  },
];
// F-10 snapshot size estimate → "Requires up to X GiB" (mock: OS + used bytes + margin).
function estimateSnapshotGiB(): number {
  return 4.2;
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
const IconSnapshot = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" />
  </svg>
);
const IconKeep = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17v5" /><path d="M9 10.76V6a3 3 0 0 1 6 0v4.76a2 2 0 0 0 .89 1.66l1.2.8A2 2 0 0 1 18 14.9V15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-.1a2 2 0 0 1 .91-1.68l1.2-.8A2 2 0 0 0 9 10.76z" />
  </svg>
);
const IconSuspend = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const IconResume = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4l14 8-14 8V4z" />
  </svg>
);
const IconTrash = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

// ─── Sub-components ───────────────────────────────────────────────────────
function MaasKeyRow({ value, accessUrl }: { value: string; accessUrl?: string }) {
  const [revealed, setRevealed] = useState(false);
  const masked = value.length > 12 ? `${value.slice(0, 8)}${"•".repeat(20)}${value.slice(-4)}` : value;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 6 }}>
      <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        GMI Models key
      </span>
      <code style={{ fontFamily: "'GeistMono', monospace", fontSize: 12, color: C.fg, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.borderSoft}`, padding: "2px 8px", borderRadius: 6 }}>
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
      <CopyButton value={value} />
      {accessUrl && (
        <a href={accessUrl} target="_blank" rel="noreferrer" style={{ fontFamily: FONT, fontSize: 11, fontWeight: 500, color: C.muted, textDecoration: "none", marginLeft: "auto" }}>
          {accessUrl} ↗
        </a>
      )}
    </div>
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
    case "running":    return C.ok;       // green
    case "error":      return C.err;      // red
    case "pending":    return "#a3a3a3";  // neutral
    case "creating":   return "#fbbf24";  // amber
    case "suspending": return "#fbbf24";  // amber (transitioning)
    case "resuming":   return "#fbbf24";  // amber (transitioning)
    case "suspended":  return "#60a5fa";  // blue — compute stopped, disk retained
    case "deleting":   return "#fb923c";  // orange
    case "stopping":   return "#fb923c";  // orange
    case "stopped":    return "#737373";  // grey
    case "deleted":    return "#525252";  // darker grey
    case "idle":       return "#737373";
  }
}

// ─── NEW feature badge — small lime pill marking Runtime 2.0 additions ──────
function NewBadge({ style }: { style?: React.CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center",
        fontFamily: FONT, fontSize: 9, fontWeight: 700, lineHeight: "12px",
        letterSpacing: "0.08em",
        color: C.limeText, background: C.lime,
        padding: "1px 5px", borderRadius: 4,
        verticalAlign: "middle",
        ...style,
      }}
    >
      NEW
    </span>
  );
}

// ─── Lifecycle timeline — 3-stage visual (Active → Suspended → Auto-delete).
// Mirrors how Codespaces / Daytona frame "when does my runtime go away".
// durationLabel is a hoisted function declaration (defined later in the module).
function LifecycleTimeline({ maxActive, retentionDays = 30 }: { maxActive?: string; retentionDays?: number }) {
  const activeSub = !maxActive || maxActive === "off" ? "No limit" : `≤ ${durationLabel(maxActive)}`;
  const stages = [
    { label: "Active",      sub: activeSub,                    color: C.ok },
    { label: "Suspended",   sub: `Disk kept ${retentionDays}d`, color: "#60a5fa" },
    { label: "Auto-delete", sub: "After retention",            color: C.muted },
  ];
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start",
        background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`,
        borderRadius: 8, padding: "12px 14px 10px",
      }}
    >
      {stages.map((s, i) => (
        <div key={s.label} style={{ display: "flex", alignItems: "flex-start", flex: i < stages.length - 1 ? 1 : "0 0 auto" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 88, flexShrink: 0 }}>
            <span style={{ width: 12, height: 12, borderRadius: 999, background: s.color, boxShadow: `0 0 0 3px ${s.color}22` }} />
            <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.fg, lineHeight: "16px" }}>{s.label}</span>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, textAlign: "center", lineHeight: "14px" }}>{s.sub}</span>
          </div>
          {i < stages.length - 1 && (
            <div style={{ flex: 1, height: 2, background: C.border, marginTop: 5, borderRadius: 2 }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Left agent list item ─────────────────────────────────────────────────
// ─── New-user welcome (right pane when 0 agents registered) ─────────────
// Per PRD F-02: 0 agents → primary CTA "Start from a template →" deep-links
// to /marketplace?starter=true (filtered to Starter / Official). Secondary
// CTA lets users register from scratch.
function NewUserWelcome({
  onStartFromTemplate, onListAnAgent,
}: {
  onStartFromTemplate: () => void;
  onListAnAgent: () => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "48px 32px",
      minHeight: 360,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        background: "rgba(221,234,77,0.10)",
        border: `1px solid rgba(221,234,77,0.35)`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: C.lime,
        marginBottom: 16,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          <path d="M14 17.5h7M17.5 14v7" />
        </svg>
      </div>
      <h2 style={{
        fontFamily: FONT, fontSize: 18, fontWeight: 600, color: C.fg, margin: 0,
        letterSpacing: "-0.01em",
      }}>
        You haven't registered any agents yet
      </h2>
      <p style={{
        fontFamily: FONT, fontSize: 13, fontWeight: 400, color: C.muted,
        margin: "6px 0 24px", textAlign: "center", maxWidth: 420, lineHeight: "20px",
      }}>
        Pick a curated starter template from the catalog and deploy your own copy in seconds,
        or register a new agent from scratch.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={onStartFromTemplate}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: FONT, fontSize: 14, fontWeight: 600, lineHeight: "20px",
            background: C.lime, color: C.limeText,
            border: "none",
            padding: "9px 18px", borderRadius: 8, cursor: "pointer",
          }}
        >
          Start from a template →
        </button>
        <button
          onClick={onListAnAgent}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
            background: "transparent", color: C.muted,
            border: `1px solid ${C.border}`,
            padding: "9px 16px", borderRadius: 8, cursor: "pointer",
          }}
        >
          Or register from scratch
        </button>
      </div>
    </div>
  );
}

// ─── Listing-state badge — PRD M4 review state machine ──────────────────
// Compact pill that surfaces where a registered agent sits in the marketplace
// review lifecycle. "draft" is the post-Register default. "pending_review"
// after user clicks "List on Agentbox". "live" / "rejected" set by ops.
function ListingStateBadge({ state }: { state?: ListingState }) {
  // No badge when state is missing — keeps the row clean for seed/template entries.
  if (!state) return null;
  if (state === "draft") {
    return (
      <span
        title="Draft — registered, not yet listed on Agentbox"
        style={{
          fontFamily: FONT, fontSize: 10, fontWeight: 600, lineHeight: "14px",
          color: C.muted,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${C.border}`,
          padding: "1px 6px",
          borderRadius: 999,
          letterSpacing: "0.06em",
        }}
      >
        DRAFT
      </span>
    );
  }
  if (state === "pending_review") {
    return (
      <span
        title="Submitted for review — human will check before going live"
        style={{
          fontFamily: FONT, fontSize: 10, fontWeight: 600, lineHeight: "14px",
          color: C.warn,
          background: "rgba(251,191,36,0.10)",
          border: "1px solid rgba(251,191,36,0.45)",
          padding: "1px 6px",
          borderRadius: 999,
          letterSpacing: "0.06em",
        }}
      >
        PENDING REVIEW
      </span>
    );
  }
  if (state === "live") {
    return (
      <span
        title="Live on Agentbox"
        style={{
          fontFamily: FONT, fontSize: 10, fontWeight: 600, lineHeight: "14px",
          color: C.ok,
          background: "rgba(52,211,153,0.10)",
          border: "1px solid rgba(52,211,153,0.45)",
          padding: "1px 6px",
          borderRadius: 999,
          letterSpacing: "0.06em",
        }}
      >
        LIVE
      </span>
    );
  }
  return (
    <span
      title="Rejected — see reviewer note; edit to resubmit"
      style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 600, lineHeight: "14px",
        color: C.err,
        background: "rgba(248,113,113,0.10)",
        border: "1px solid rgba(248,113,113,0.45)",
        padding: "1px 6px",
        borderRadius: 999,
        letterSpacing: "0.06em",
      }}
    >
      REJECTED
    </span>
  );
}

function AgentListItem({
  agent, agg, selected, onClick, onEditTemplate, onDeleteTemplate,
}: {
  agent: MyAgent;
  agg: AgentAggregate;
  selected: boolean;
  onClick: () => void;
  onEditTemplate: (agent: MyAgent) => void;
  onDeleteTemplate: (agent: MyAgent) => void;
}) {
  const status: AgentStatus =
    agg.error > 0 ? "error" :
    agg.creating > 0 ? "creating" :
    agg.active > 0 ? "running" :
    (agent.displayStatus ?? "idle");

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      style={{
        position: "relative",
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.fg, lineHeight: "20px" }}>{agent.name}</div>
          {agent.verified && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6" style={{ flexShrink: 0 }} aria-label="Verified">
              <path d="M12 1l2.5 1.8 3-.4 1.2 2.8 2.8 1.2-.4 3L23 12l-1.8 2.5.4 3-2.8 1.2-1.2 2.8-3-.4L12 23l-2.5-1.8-3 .4-1.2-2.8L2.5 17.5l.4-3L1 12l1.9-2.5-.4-3 2.8-1.2L6.5 2.4l3 .4z"/>
              <path d="M10.6 14.6l-2.2-2.2-1.4 1.4 3.6 3.6 6-6-1.4-1.4z" fill="#fff"/>
            </svg>
          )}
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
          <ListingStateBadge state={agent.listingState} />
        </div>
        {/* Kebab menu — Edit / Delete template */}
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button
            aria-label="Template options"
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              width: 24, height: 24,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: menuOpen ? "rgba(255,255,255,0.06)" : "transparent",
              border: `1px solid ${menuOpen ? C.border : "transparent"}`,
              color: C.muted,
              borderRadius: 6, cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute", top: "calc(100% + 4px)", right: 0,
                background: C.cardSolid,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 4,
                display: "flex", flexDirection: "column",
                minWidth: 160,
                zIndex: 20,
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              }}
            >
              <button
                onClick={() => { setMenuOpen(false); onEditTemplate(agent); }}
                style={menuItemStyle(C.fg)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit template
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDeleteTemplate(agent); }}
                style={menuItemStyle("#f87171")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
                </svg>
                Delete template
              </button>
            </div>
          )}
        </div>
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
    </div>
  );
}

function menuItemStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8,
    fontFamily: FONT, fontSize: 13, fontWeight: 500, lineHeight: "18px",
    color,
    background: "transparent",
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  };
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
        <CopyButton value={lines.join("\n")} />
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

// ─── Runtime Detail pane (PRD §5.4) — Overview / Lifecycle / Persistence /
//     Activity. Opened via the row ⋮ "View Detail" action.
function DetailRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: FONT, fontSize: 12, lineHeight: "20px" }}>
      <span style={{ color: C.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ color: accent || C.fg, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

// ─── Listing actions — primary CTA inline + ⋮ menu for secondary ─────────
// "View public listing" is the high-frequency action (external link) so it
// stays inline as a lime CTA. "Edit listing" + "Unpublish" fold into a ⋮ menu
// to reduce button density on the agent detail header.
// Single "Listing ▼" dropdown sits next to "+ Instance" in the agent detail
// header. All listing actions live behind one trigger — no inline primary
// button — so the header stays tight even as state changes. State badge
// inside the trigger (DRAFT / PENDING / LIVE / REJECTED) tells the user where
// the listing is at a glance.
function ListingActions({ agentId, state }: { agentId: string; state?: ListingState }) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const goToListingForm = () => setLocation(`/list-claw?agentId=${encodeURIComponent(agentId)}`);

  const isDraft    = !state || state === "draft";
  const isPending  = state === "pending_review";
  const isLive     = state === "live";
  const isRejected = state === "rejected";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: FONT, fontSize: 13, fontWeight: 500, lineHeight: "20px",
          background: open ? "rgba(255,255,255,0.04)" : "transparent",
          color: C.fg,
          border: `1px solid ${C.border}`,
          padding: "5px 10px 5px 14px", borderRadius: 8, cursor: "pointer",
        }}
      >
        Listing
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.muted, transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0,
            background: C.cardSolid,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 4,
            minWidth: 180,
            zIndex: 30,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Order matches production: edit (most common) → view (read-only)
              → spacer → destructive. All items render neutral; only the
              destructive item is colored. */}
          {isDraft && (
            <button onClick={() => { setOpen(false); goToListingForm(); }} style={menuItemStyle(C.fg)}>
              Complete listing
            </button>
          )}
          {isPending && (
            <button onClick={() => { setOpen(false); goToListingForm(); }} style={menuItemStyle(C.fg)}>
              Edit pending listing
            </button>
          )}
          {isLive && (
            <>
              <button onClick={() => { setOpen(false); goToListingForm(); }} style={menuItemStyle(C.fg)}>
                Edit listing
              </button>
              <button onClick={() => setOpen(false)} style={menuItemStyle(C.fg)}>
                View public listing
              </button>
            </>
          )}
          {isRejected && (
            <button onClick={() => { setOpen(false); goToListingForm(); }} style={menuItemStyle(C.fg)}>
              Fix & resubmit
            </button>
          )}

          {/* Destructive — small separator above, only on submitted states */}
          {!isDraft && (
            <>
              <div style={{ height: 1, background: C.borderSoft, margin: "4px 6px" }} />
              <button onClick={() => setOpen(false)} style={menuItemStyle(C.err)}>
                {isLive ? "Unpublish" : "Withdraw"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Per-instance row ⋮ menu ─────────────────────────────────────────────
// Reusable view actions (Detail / Log / Monitoring) live here so the inline
// row stays focused on the net-new high-frequency actions (Open / Terminate).
type RowPanel = "config" | "logs" | "metrics" | "shell";
// Runtime 2.0 row actions (PRD §5.3 "More actions").
type RowAction = "suspend" | "resume" | "keep" | "delete" | "snapshot" | "convert";

function InstanceRowMenu({
  inst, activePanel, onSelect, onAction, canConvert = false, dropUp = false,
}: {
  inst: Instance;
  activePanel: "logs" | "shell" | "metrics" | "config" | null;
  onSelect: (panel: RowPanel) => void;
  onAction: (id: string, action: RowAction) => void;
  canConvert?: boolean;
  dropUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Lifecycle actions by state (PRD §5.3). Panels (view-only) always listed below.
  type MenuAction = { action: RowAction; label: string; icon: React.ReactNode; isNew?: boolean; danger?: boolean };
  const lifecycle: MenuAction[] = [];
  if (inst.status === "running") {
    lifecycle.push({ action: "snapshot", label: "Create snapshot", icon: <IconSnapshot />, isNew: true });
  }
  if (inst.status === "suspended") {
    lifecycle.push({ action: "keep", label: inst.keep ? "Cancel Keep" : "Keep", icon: <IconKeep />, isNew: true });
    if (canConvert) lifecycle.push({ action: "convert", label: "Convert to snapshot", icon: <IconSnapshot />, isNew: true });
  }
  const canDelete = inst.status === "running" || inst.status === "suspended" || inst.status === "error";
  if (canDelete) lifecycle.push({ action: "delete", label: "Delete", icon: <IconTrash />, danger: true });

  const panels: { key: RowPanel; label: string; icon: React.ReactNode }[] = [
    { key: "shell",   label: "Open Shell",   icon: <IconShell /> },
    { key: "logs",    label: "View Log",     icon: <IconLogs /> },
    { key: "metrics", label: "Monitoring",   icon: <IconChart /> },
    { key: "config",  label: "View Detail",  icon: <IconConfig /> },
  ];

  const itemStyle = (active: boolean, danger?: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 8,
    fontFamily: FONT, fontSize: 12, fontWeight: 500, lineHeight: "18px",
    color: danger ? C.err : active ? C.lime : C.fg,
    background: active ? "rgba(221,234,77,0.08)" : "transparent",
    border: "none", padding: "6px 10px", borderRadius: 6,
    cursor: "pointer", textAlign: "left", width: "100%",
  });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        aria-label={`Instance ${inst.id.slice(0, 8)} actions`}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 26, height: 24,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: open ? "rgba(255,255,255,0.06)" : "transparent",
          color: C.muted,
          border: `1px solid ${open ? C.border : "transparent"}`,
          borderRadius: 6, cursor: "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5"  r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            ...(dropUp ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
            right: 0,
            background: C.cardSolid,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 4,
            minWidth: 172,
            zIndex: 30,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column",
          }}
        >
          {lifecycle.map((it) => (
            <button
              key={it.action}
              onClick={() => { setOpen(false); onAction(inst.id, it.action); }}
              style={itemStyle(false, it.danger)}
            >
              {it.icon}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.isNew && <NewBadge />}
            </button>
          ))}
          {lifecycle.length > 0 && (
            <div style={{ height: 1, background: C.borderSoft, margin: "4px 6px" }} />
          )}
          {panels.map((it) => {
            const active = activePanel === it.key;
            return (
              <button key={it.key} onClick={() => { setOpen(false); onSelect(it.key); }} style={itemStyle(active)}>
                {it.icon} {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Confirm dialog — replaces native window.confirm() ──────────────────
// Single shared dialog for any destructive action (Terminate instance, Delete
// template). Driven by a `pending` object on the parent — open it by setting
// the object, close by setting it to null.
type ConfirmRequest = {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};
function ConfirmDialog({
  pending, onClose,
}: {
  pending: ConfirmRequest | null;
  onClose: () => void;
}) {
  if (!pending) return null;
  const isDestructive = pending.destructive !== false;
  const confirmBg = isDestructive ? C.err : C.lime;
  const confirmFg = isDestructive ? "#0a0a0a" : C.limeText;
  return (
    <div
      onClick={onClose}
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
          width: 440, maxWidth: "100%",
          background: C.cardSolid,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "20px 22px 18px",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isDestructive && (
            <span style={{
              width: 26, height: 26, borderRadius: 999,
              background: "rgba(248,113,113,0.14)",
              border: "1px solid rgba(248,113,113,0.45)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: C.err,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
            </span>
          )}
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0, lineHeight: "22px" }}>
            {pending.title}
          </h3>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 13, color: C.muted, lineHeight: "18px" }}>
          {pending.body}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              fontFamily: FONT, fontSize: 13, fontWeight: 500,
              background: "transparent", color: C.muted,
              border: `1px solid ${C.border}`,
              padding: "6px 14px", borderRadius: 8, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { pending.onConfirm(); onClose(); }}
            style={{
              fontFamily: FONT, fontSize: 13, fontWeight: 600,
              background: confirmBg, color: confirmFg,
              border: "none",
              padding: "6px 14px", borderRadius: 8, cursor: "pointer",
            }}
          >
            {pending.confirmLabel ?? (isDestructive ? "Delete" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Provision modal — per-task overrides (env + lifecycle) ─────────────
function ProvisionModal({
  open, agentName, image, onCancel, onSubmit,
}: {
  open: boolean;
  agentName: string;
  image?: string;
  onCancel: () => void;
  onSubmit: (cfg: InstanceConfig) => void;
}) {
  const [name, setName] = useState("");
  // Always start with one empty editable row at the bottom (matches the
  // reference UI — user can start typing without clicking "+ key" first).
  const [env, setEnv] = useState<{ id: string; key: string; value: string }[]>([
    { id: "e0", key: "", value: "" },
  ]);
  const [maxLifetime, setMaxLifetime] = useState(TEMPLATE_DEFAULT_CONFIG.maxLifetime);
  const [idleTimeout, setIdleTimeout] = useState(TEMPLATE_DEFAULT_CONFIG.idleTimeout);
  // Lifecycle defaults to a collapsed timeline + summary; controls reveal on Customize.
  const [showLifecycle, setShowLifecycle] = useState(false);
  // .env import — parse KEY=VALUE lines into override rows
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  // Reset on close
  if (!open) return null;

  const addEnv = () => setEnv((e) => [...e, { id: `e${Math.random().toString(36).slice(2, 8)}`, key: "", value: "" }]);
  const applyImport = () => {
    const lines = importText.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const parsed: { id: string; key: string; value: string }[] = [];
    for (const line of lines) {
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      // strip quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Skip GMI_MAAS_* — locked by platform
      if (/^GMI_MAAS_/i.test(key)) continue;
      parsed.push({ id: `e${Math.random().toString(36).slice(2, 8)}`, key, value });
    }
    if (parsed.length) setEnv((e) => [...e, ...parsed]);
    setImportText("");
    setImportOpen(false);
  };
  const updateEnv = (id: string, patch: Partial<{ key: string; value: string }>) =>
    setEnv((e) => e.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeEnv = (id: string) => setEnv((e) => e.filter((row) => row.id !== id));

  const resetState = () => {
    setName("");
    setEnv([{ id: "e0", key: "", value: "" }]);
    setMaxLifetime(TEMPLATE_DEFAULT_CONFIG.maxLifetime);
    setIdleTimeout(TEMPLATE_DEFAULT_CONFIG.idleTimeout);
    setShowLifecycle(false);
    setImportOpen(false);
    setImportText("");
  };

  const close = () => { resetState(); onCancel(); };

  const submit = () => {
    onSubmit({
      name: name.trim() || undefined,
      envOverrides: env.filter((e) => e.key.trim().length > 0),
      maxLifetime,
      idleTimeout,
    });
    resetState();
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
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>
            Launch instance {agentName && <span style={{ color: C.muted, fontWeight: 500 }}> — {agentName}</span>}
          </h3>
          <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "4px 0 0", lineHeight: "16px" }}>
            Provision a new container instance from this deployment.
          </p>
        </div>

        {/* Body — scrollable */}
        <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Image / Template — read-only, shown so the user knows what they're launching */}
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Image / Template
            </span>
            <code style={{
              ...inputStyle,
              color: C.muted,
              display: "flex", alignItems: "center",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {image || "ghcr.io/mjs-gmi/openclaw-gmi:latest"}
            </code>
          </section>

          {/* Model & pricing — Coding Agent Plan (repeat funnel at launch) */}
          {(() => {
            const d = discountPriceString(CODING_AGENT_PLAN.featuredModelInPrice);
            return (
              <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Model</span>
                  <PlanBadge />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(221,234,77,0.05)", border: "1px solid rgba(221,234,77,0.25)", borderRadius: 8, padding: "8px 12px" }}>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: C.fg }}>{CODING_AGENT_PLAN.featuredModelName}</span>
                  {d && <DiscountedPrice original={d.original} discounted={d.discounted} size={13} />}
                </div>
              </section>
            );
          })()}

          {/* Name — optional */}
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>
              Name <span style={{ color: C.muted, fontWeight: 400 }}>· optional</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. prod-worker-1"
              style={{ ...inputStyle, fontFamily: FONT, fontSize: 13 }}
            />
          </section>

          {/* Lifecycle — Runtime 2.0 F-02 / F-03 / F-05 (PRD §5.2) */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>Lifecycle</label>
              <NewBadge />
            </div>

            {/* Stage timeline — always visible; updates live with the selected settings */}
            <LifecycleTimeline maxActive={maxLifetime} retentionDays={30} />

            {!showLifecycle ? (
              /* Collapsed — one-line summary + Customize (defaults-first) */
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "16px" }}>
                  {durationLabel(maxLifetime)} active · suspend &amp; keep disk · 30-day retention
                  {idleTimeout !== "off" && <> · idle-suspend {durationLabel(idleTimeout)}</>}
                  <span style={{ color: C.borderSoft }}> · </span>Organization default
                </span>
                <button
                  onClick={() => setShowLifecycle(true)}
                  style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.lime, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                >
                  Customize
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </button>
              </div>
            ) : (
              /* Expanded — the two editable controls + read-only policy rows */
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Maximum active runtime (F-02) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.fg }}>Maximum active runtime</span>
                  <select value={maxLifetime} onChange={(e) => setMaxLifetime(e.target.value)} style={{ ...inputStyle, fontFamily: FONT, fontSize: 13, cursor: "pointer" }}>
                    <option value="1h">1 hour</option>
                    <option value="6h">6 hours</option>
                    <option value="24h">24 hours</option>
                    <option value="48h">48 hours</option>
                  </select>
                  <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                    {maxLifetime === "48h" ? "Maximum 48 hours · Set by your organization" : `${durationLabel(maxLifetime)} · Organization default`}
                  </span>
                </div>

                {/* Inactivity policy (F-03) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.fg }}>
                    When inactive for <span style={{ color: C.muted, fontWeight: 400 }}>· optional</span>
                  </span>
                  <select value={idleTimeout} onChange={(e) => setIdleTimeout(e.target.value)} style={{ ...inputStyle, fontFamily: FONT, fontSize: 13, cursor: "pointer" }}>
                    <option value="off">Off</option>
                    <option value="15min">15 min → Suspend</option>
                    <option value="30min">30 min → Suspend</option>
                    <option value="1h">1 hour → Suspend</option>
                  </select>
                  {idleTimeout !== "off" && (
                    <span style={{ fontFamily: FONT, fontSize: 11, color: C.warn, lineHeight: "16px" }}>
                      Only AgentBox command execution counts as activity in this release. Endpoint traffic and open connections do not reset the timer.
                    </span>
                  )}
                </div>

                {/* Read-only policy rows (F-02 action + F-05 retention) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12 }}>
                    <span style={{ color: C.muted }}>When the limit is reached</span>
                    <span style={{ color: C.fg, display: "inline-flex", alignItems: "center", gap: 5 }}><IconSuspend size={11} /> Suspend &amp; keep disk</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12 }}>
                    <span style={{ color: C.muted }}>Suspended disk retention</span>
                    <span style={{ color: C.fg }}>30 days · Enforced by org</span>
                  </div>
                </div>

                <button
                  onClick={() => { setShowLifecycle(false); setMaxLifetime(TEMPLATE_DEFAULT_CONFIG.maxLifetime); setIdleTimeout(TEMPLATE_DEFAULT_CONFIG.idleTimeout); }}
                  style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                  Collapse · use organization defaults
                </button>
              </div>
            )}
          </section>

          {/* Environment variables — table */}
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>
                Environment variables <span style={{ color: C.muted, fontWeight: 400 }}>· optional</span>
              </label>
              <button
                onClick={() => setImportOpen((o) => !o)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontFamily: FONT, fontSize: 12, fontWeight: 500,
                  color: importOpen ? C.muted : C.fg,
                  background: "transparent",
                  border: "none",
                  padding: "2px 4px", cursor: "pointer",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {importOpen ? "Cancel paste" : "Import .env"}
              </button>
            </div>

            {/* Paste .env panel — separate from row-by-row, shows when toggled */}
            {importOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 6, padding: "8px 10px" }}>
                <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Paste KEY=value · one per line
                </span>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={"OPENAI_API_KEY=sk-...\nDATABASE_URL=postgres://...\nLOG_LEVEL=debug"}
                  rows={4}
                  autoFocus
                  style={{
                    background: "#000",
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: "8px 10px",
                    fontFamily: "'GeistMono', monospace", fontSize: 12, lineHeight: "18px",
                    color: C.fg, outline: "none", resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
                    GMI_MAAS_* keys are skipped automatically.
                  </span>
                  <button onClick={applyImport} disabled={!importText.trim()} style={{
                    fontFamily: FONT, fontSize: 12, fontWeight: 600,
                    background: importText.trim() ? C.lime : "#3a3a1f",
                    color: importText.trim() ? C.limeText : "#666",
                    border: "none",
                    padding: "4px 14px", borderRadius: 6,
                    cursor: importText.trim() ? "pointer" : "not-allowed",
                  }}>Add to overrides</button>
                </div>
              </div>
            )}

            {/* Variables table */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
              {/* Table header */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1.4fr 26px", gap: 6,
                padding: "8px 10px",
                borderBottom: `1px solid ${C.borderSoft}`,
                background: "rgba(255,255,255,0.02)",
              }}>
                <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.04em" }}>Key</span>
                <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.04em" }}>Value</span>
                <span />
              </div>

              {/* Scrollable body — header + "+ key" stay put; rows scroll once the list grows */}
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {/* Locked rows — platform-managed env (cannot be overridden) */}
              {[
                { key: "GMI_MODELS",        value: "58e99bbf-78ba-480..." },
                { key: "GMI_MAAS_API_KEY",  value: "gmi_••••••••••••••••" },
                { key: "GMI_MAAS_BASE_URL", value: "https://api.gmi-serving.com" },
                { key: "DEPLOYMENT_TYPE",   value: "gmi-ce" },
              ].map((row) => (
                <div key={row.key} style={{
                  display: "grid", gridTemplateColumns: "1fr 1.4fr 26px", gap: 6,
                  padding: "6px 10px", alignItems: "center",
                  borderBottom: `1px solid ${C.borderSoft}`,
                }}>
                  <span style={{
                    fontFamily: "'GeistMono', monospace", fontSize: 12,
                    color: C.muted,
                    display: "inline-flex", alignItems: "center", gap: 6,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {row.key}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <span style={{
                    fontFamily: "'GeistMono', monospace", fontSize: 12,
                    color: C.muted,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {row.value}
                  </span>
                  <span />
                </div>
              ))}

              {/* Editable override rows */}
              {env.map((row) => (
                <div key={row.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 1.4fr 26px", gap: 6,
                  padding: "6px 10px", alignItems: "center",
                  borderBottom: `1px solid ${C.borderSoft}`,
                }}>
                  <input
                    placeholder="KEY"
                    value={row.key}
                    onChange={(e) => updateEnv(row.id, { key: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    placeholder="Value"
                    value={row.value}
                    onChange={(e) => updateEnv(row.id, { value: e.target.value })}
                    style={inputStyle}
                  />
                  <button
                    onClick={() => removeEnv(row.id)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: C.muted, padding: 4, display: "inline-flex" }}
                    aria-label="Remove"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              </div>

              {/* + key — add another empty editable row */}
              <button
                onClick={addEnv}
                style={{
                  width: "100%", textAlign: "left",
                  background: "transparent", border: "none",
                  padding: "8px 10px",
                  fontFamily: FONT, fontSize: 12, fontWeight: 500,
                  color: C.muted, cursor: "pointer",
                }}
              >
                + key
              </button>
            </div>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
              Variables from the deployment template can't be changed. You can only add new variables below.
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
            Create Instance
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

// ─── Instance Detail modal (PRD §5.4) — matches the console's Instance Detail
//     popup, plus Runtime 2.0 Lifecycle & Persistence sections (NEW).
function InstanceDetailModal({
  inst, deploymentName, onClose,
}: {
  inst: Instance | null;
  deploymentName: string;
  onClose: () => void;
}) {
  if (!inst) return null;
  const totalMins = durationMins(inst.maxActive);
  const start = inst.lifecycleStartedAt ? new Date(inst.lifecycleStartedAt.replace(" ", "T")).getTime() : null;
  const usedMins = start ? Math.max(0, Math.floor((Date.now() - start) / 60000)) : 0;
  const health =
    inst.status === "running" ? { label: "HEALTHY", color: C.ok }
    : inst.status === "error" ? { label: "UNHEALTHY", color: C.err }
    : { label: "—", color: C.muted };

  const lockedEnv = [
    { key: "GMI_MODELS",        value: "58e99bbf-78ba-4807-9be5-53e762de9212" },
    { key: "GMI_MAAS_API_KEY",  value: "gmi_••••••••••••••••" },
    { key: "GMI_MAAS_BASE_URL", value: "https://api.gmi-serving.com" },
    { key: "DEPLOYMENT_TYPE",   value: "gmi-ce" },
  ];
  const overrides = inst.config?.envOverrides ?? [];

  const row = (label: string, value: React.ReactNode, mono = false) => (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, padding: "9px 0", borderTop: `1px solid ${C.borderSoft}`, alignItems: "center" }}>
      <span style={{ fontFamily: FONT, fontSize: 13, color: C.muted }}>{label}</span>
      <span style={{ fontFamily: mono ? "'GeistMono', monospace" : FONT, fontSize: 13, color: C.fg, fontWeight: 500, wordBreak: "break-all" }}>{value}</span>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: "100%", background: C.cardSolid,
          border: `1px solid ${C.border}`, borderRadius: 10,
          display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>Instance Detail</h3>
          <p style={{ fontFamily: "'GeistMono', monospace", fontSize: 12, color: C.muted, margin: "4px 0 0" }}>{inst.id}</p>
        </div>

        <div style={{ padding: "8px 20px 16px", overflowY: "auto" }}>
          {/* Console fields */}
          {row("Task ID", inst.id, true)}
          {row("Display name", inst.config?.name || "—")}
          {row("Status", <span style={{ color: statusDot(inst.status), fontWeight: 600 }}>{statusLabel(inst.status)}</span>)}
          {row("Health", <span style={{ display: "inline-flex", fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: health.color, background: `${health.color}1f`, border: `1px solid ${health.color}55`, padding: "2px 8px", borderRadius: 6 }}>{health.label}</span>)}
          {row("Endpoint URL", inst.status === "suspended" ? "Unavailable while suspended" : (inst.endpointUrl || "—"), inst.status !== "suspended")}
          {row("Public IP", "—")}
          {row("IDC", "us-central-iowa1")}
          {row("Product", "gmi.container.intel.x4660.large", true)}
          {row("Container ID", inst.id, true)}
          {row("Deployment", deploymentName || "—")}
          {row("Created at", inst.created, true)}
          {row("Updated at", inst.created, true)}

          {/* Runtime 2.0 — Lifecycle (NEW) */}
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <h4 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>Lifecycle</h4>
              <NewBadge />
            </div>
            <DetailRow label="Maximum active runtime" value={durationLabel(inst.maxActive)} />
            <DetailRow label="Active time used" value={totalMins ? `${usedMins} min` : "—"} />
            <DetailRow label="Remaining" value={totalMins ? remainingLabel(totalMins - usedMins) : "No automatic limit"} />
            <DetailRow label="At the limit" value="Suspend & keep disk" />
            <DetailRow label="Inactivity policy" value={inst.config?.idleTimeout && inst.config.idleTimeout !== "off" ? `Suspend after ${durationLabel(inst.config.idleTimeout)}` : "Off"} />
          </div>

          {/* Runtime 2.0 — Persistence (NEW) */}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <h4 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>Persistence</h4>
              <NewBadge />
            </div>
            <DetailRow label="Disk retention" value={inst.status === "suspended" ? retentionState(inst) : "Not retained (running)"} accent={inst.keep ? C.lime : undefined} />
            <DetailRow label="Keep status" value={inst.keep ? "Kept — retention paused" : "Not kept"} accent={inst.keep ? C.lime : undefined} />
            <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px", marginTop: 2 }}>
              Storage charges apply while this disk is retained. Detailed charges remain in Usage &amp; Billing.
            </div>
          </div>

          {/* Environment Variables */}
          <div style={{ marginTop: 18 }}>
            <h4 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: "0 0 2px" }}>Environment Variables</h4>
            <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "0 0 10px", lineHeight: "16px" }}>
              Environment variables this container instance was provisioned with.
            </p>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 0.7fr", gap: 6, padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${C.borderSoft}`, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted }}>
                <span>Key</span><span>Value</span><span>Type</span>
              </div>
              {lockedEnv.map((e) => (
                <div key={e.key} style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 0.7fr", gap: 6, padding: "8px 10px", alignItems: "center", borderBottom: `1px solid ${C.borderSoft}`, fontFamily: "'GeistMono', monospace", fontSize: 12 }}>
                  <span style={{ color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.key}</span>
                  <span style={{ color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.value}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FONT, fontSize: 11, color: C.muted }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Locked
                  </span>
                </div>
              ))}
              {overrides.map((e) => (
                <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 0.7fr", gap: 6, padding: "8px 10px", alignItems: "center", borderBottom: `1px solid ${C.borderSoft}`, fontFamily: "'GeistMono', monospace", fontSize: 12 }}>
                  <span style={{ color: C.lime, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.key || "—"}</span>
                  <span style={{ color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.value || "—"}</span>
                  <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>Custom</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 20px", borderTop: `1px solid ${C.borderSoft}` }}>
          <button
            onClick={onClose}
            style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, background: C.lime, color: C.limeText, border: "none", padding: "6px 18px", borderRadius: 8, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Monitor pane ─────────────────────────────────────────────────────────
function MonitorPane({
  agent, instances, onProvision, onAction, canConvert = false,
}: {
  agent: MyAgent;
  instances: Instance[];
  onProvision: (agentId: string) => void;
  onAction: (id: string, action: RowAction) => void;
  canConvert?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "running" | "error" | "creating">("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc"); // Created column sort
  // "config" (View Detail) opens the Instance Detail modal; the rest are inline panels.
  type PanelKind = "logs" | "shell" | "metrics" | "config";
  const [expanded, setExpanded] = useState<{ id: string; panel: PanelKind } | null>(null);
  const [detailInst, setDetailInst] = useState<Instance | null>(null);
  const togglePanel = (id: string, panel: PanelKind) => {
    if (panel === "config") { setDetailInst(instances.find((i) => i.id === id) ?? null); return; }
    setExpanded((curr) => (curr && curr.id === id && curr.panel === panel ? null : { id, panel }));
  };

  const agg = useMemo(() => aggregateFor(instances, agent.id), [instances, agent.id]);
  const mine = useMemo(() => instances.filter((i) => i.agentId === agent.id), [instances, agent.id]);
  const filtered = useMemo(() => {
    const rows = mine.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (search) {
        const hay = `${i.config?.name ?? ""} ${i.id}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
    // `created` is "YYYY-MM-DD HH:MM:SS" — lexicographic order == chronological.
    rows.sort((a, b) =>
      sortDir === "desc" ? b.created.localeCompare(a.created) : a.created.localeCompare(b.created),
    );
    return rows;
  }, [mine, filter, search, sortDir]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Aggregate status — rollup across this agent's instances */}
      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 12px" }}>
          Aggregate status
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <MetricCard
            label="Active"
            value={String(agg.active)}
            helper="status = running"
            accent={C.ok}
          />
          <MetricCard
            label="Error"
            value={String(agg.error)}
            helper="red tab badge if > 0"
            accent={C.err}
          />
          <MetricCard
            label="Creating"
            value={String(agg.creating)}
            helper="status = creating"
            accent={C.warn}
          />
          <MetricCard
            label="Last provisioned"
            value={agg.lastProvisioned ? agoLabel(agg.lastProvisioned) : "—"}
            helper="max(createdAt)"
            accent={C.muted}
          />
        </div>
      </section>

      {/* Instance Set — header is just a label now; "+ Instance" lives in
          the agent detail header next to Listing ▼. */}
      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 4px" }}>
          Instance Set
        </h3>
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
            // overflow must stay visible so the row ⋮ action menu (absolutely
            // positioned, taller than the table) isn't clipped by the container.
            overflow: "visible",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1.5fr 0.9fr 1.35fr 0.85fr 1.25fr",
              padding: "10px 16px",
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.02)",
              fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: "16px",
              alignItems: "center",
            }}
          >
            <div>Instance Name</div>
            <div>Endpoint</div>
            <div>Status</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Lifecycle <NewBadge /></div>
            <button
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              title={`Sort by created — ${sortDir === "desc" ? "newest first" : "oldest first"}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "transparent", border: "none", padding: 0,
                font: "inherit", color: "inherit", cursor: "pointer",
                justifySelf: "start",
              }}
            >
              Created
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9, transform: sortDir === "asc" ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div style={{ textAlign: "right" }}>Action</div>
          </div>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "48px 16px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: FONT, fontSize: 13, fontWeight: 400, color: C.muted, lineHeight: "18px",
              }}
            >
              No instances yet
            </div>
          ) : (
            filtered.map((inst, i) => {
              return (
                <div key={inst.id}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1.5fr 0.9fr 1.35fr 0.85fr 1.25fr",
                      padding: "10px 16px",
                      borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
                      fontFamily: FONT, fontSize: 13, fontWeight: 400, color: C.fg, lineHeight: "20px",
                      alignItems: "center",
                      animation: "row-fade-in 220ms ease-out",
                    }}
                  >
                    <div
                      title={inst.config?.name || inst.id}
                      style={{ color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {inst.config?.name || midId(inst.id)}
                    </div>
                    <div
                      title={inst.status === "suspended" ? "Endpoint is unavailable while suspended" : inst.endpointUrl}
                      style={{ fontFamily: inst.status === "suspended" ? FONT : "'GeistMono', monospace", fontSize: 12, color: inst.endpointUrl && inst.status !== "suspended" ? C.muted : C.borderSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {inst.status === "suspended" ? "Unavailable while suspended"
                        : inst.endpointUrl ? inst.endpointUrl.replace(/^https?:\/\//, "") : "—"}
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center" }}>
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontFamily: FONT, fontSize: 11, fontWeight: 600, lineHeight: "16px",
                          letterSpacing: "0.04em", textTransform: "uppercase",
                          color: statusDot(inst.status),
                          background: `${statusDot(inst.status)}1f`,
                          border: `1px solid ${statusDot(inst.status)}55`,
                          padding: "2px 8px", borderRadius: 6,
                        }}
                      >
                        {(inst.status === "creating" || inst.status === "suspending" || inst.status === "resuming" || inst.status === "deleting") && (
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: statusDot(inst.status), animation: "pulse 1.2s ease-in-out infinite" }} />
                        )}
                        {statusLabel(inst.status)}
                      </span>
                    </div>
                    {/* Lifecycle — F-02 active-time (Running) / F-05 retention (Suspended) */}
                    <div
                      title={inst.status === "running" ? activeRemaining(inst) : inst.status === "suspended" ? retentionState(inst) : ""}
                      style={{ fontSize: 12, color: inst.keep ? C.lime : C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {inst.status === "running" ? activeRemaining(inst)
                        : inst.status === "suspended" ? retentionState(inst)
                        : "—"}
                    </div>
                    <div style={{ color: C.muted }}>{agoLabel(inst.created)}</div>
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                      {inst.status === "running" && inst.endpointUrl && (
                        <a
                          href={inst.endpointUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={inst.endpointUrl}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontFamily: FONT, fontSize: 11, fontWeight: 500,
                            color: C.fg, background: "transparent",
                            border: `1px solid ${C.border}`,
                            padding: "3px 9px", borderRadius: 6, textDecoration: "none",
                          }}
                        >
                          Open
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 17 17 7M8 7h9v9" />
                          </svg>
                        </a>
                      )}
                      {/* Primary lifecycle action per state (PRD §5.3) */}
                      {inst.status === "running" && (
                        <button
                          onClick={() => onAction(inst.id, "suspend")}
                          title="Suspend compute and keep the runtime disk."
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontFamily: FONT, fontSize: 11, fontWeight: 500,
                            color: C.fg, background: "transparent",
                            border: `1px solid ${C.border}`,
                            padding: "3px 9px", borderRadius: 6, cursor: "pointer",
                          }}
                        >
                          <IconSuspend /> Suspend
                        </button>
                      )}
                      {inst.status === "suspended" && (
                        <button
                          onClick={() => onAction(inst.id, "resume")}
                          title="Resume the runtime from its retained disk."
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontFamily: FONT, fontSize: 11, fontWeight: 600,
                            color: C.limeText, background: C.lime,
                            border: "none",
                            padding: "3px 10px", borderRadius: 6, cursor: "pointer",
                          }}
                        >
                          <IconResume /> Resume
                        </button>
                      )}
                      {inst.status === "error" && (
                        <button
                          onClick={() => togglePanel(inst.id, "config")}
                          style={{
                            fontFamily: FONT, fontSize: 11, fontWeight: 500,
                            color: C.fg, background: "transparent",
                            border: `1px solid ${C.border}`,
                            padding: "3px 9px", borderRadius: 6, cursor: "pointer",
                          }}
                        >
                          View error
                        </button>
                      )}
                      <InstanceRowMenu
                        inst={inst}
                        canConvert={canConvert}
                        dropUp={filtered.length > 1 && i >= filtered.length - 1}
                        activePanel={expanded?.id === inst.id ? expanded.panel : null}
                        onSelect={(panel) => togglePanel(inst.id, panel)}
                        onAction={onAction}
                      />
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
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <InstanceDetailModal
        inst={detailInst}
        deploymentName={agent.name}
        onClose={() => setDetailInst(null)}
      />
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
      {/* Current model & Plan eligibility — Coding Agent Plan (ongoing management) */}
      {(() => {
        const d = discountPriceString(CODING_AGENT_PLAN.featuredModelInPrice);
        return (
          <section style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: 0 }}>Model &amp; Plan</h3>
              <PlanBadge />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 13 }}>
              <span style={{ color: C.muted }}>Current model</span>
              <span style={{ color: C.fg }}>{CODING_AGENT_PLAN.featuredModelName}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, fontFamily: FONT, fontSize: 13 }}>
              <span style={{ color: C.muted }}>Your token price</span>
              {d && <DiscountedPrice original={d.original} discounted={d.discounted} size={13} />}
            </div>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
              {CODING_AGENT_PLAN.name} is active — {CODING_AGENT_PLAN.discountPct}% off is applied automatically at billing.
            </span>
          </section>
        );
      })()}

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
          <CopyButton value={agent.templateId} />
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
            <CopyButton value={curl} />
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
  agent, instances, onProvision, onAction, canConvert = false,
}: {
  agent: MyAgent;
  instances: Instance[];
  onProvision: (agentId: string) => void;
  onAction: (id: string, action: RowAction) => void;
  canConvert?: boolean;
}) {
  const [tab, setTab] = useState<"monitor" | "integration" | "analytics">("monitor");
  // + Instance + Listing ▼ now share the top-right of the agent header.
  // Provisioning is the highest-frequency action so it gets the lime fill;
  // listing actions sit behind a single dropdown next to it.
  const headerActions = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={() => onProvision(agent.id)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: FONT, fontSize: 13, fontWeight: 600, lineHeight: "20px",
          background: C.lime, color: C.limeText,
          border: "none",
          padding: "6px 14px", borderRadius: 8, cursor: "pointer",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Instance
      </button>
      <ListingActions agentId={agent.id} state={agent.listingState} />
    </div>
  );

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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: FONT, fontSize: 12, fontWeight: 500, lineHeight: "16px",
                color: C.fg,
                background: C.pillBg,
                border: `1px solid ${C.border}`,
                padding: "3px 10px",
                borderRadius: 6,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 2, background: "#a3e635", display: "inline-block" }} />
              {agent.category}
            </span>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: MONO, fontSize: 12, fontWeight: 500, lineHeight: "16px",
                color: C.muted,
                background: C.pillBg,
                border: `1px solid ${C.border}`,
                padding: "3px 10px",
                borderRadius: 6,
              }}
            >
              {agent.templateId}
              <CopyButton value={agent.templateId} />
            </span>
            {agent.hostMode === "connect" && (
              <span
                style={{
                  fontFamily: FONT, fontSize: 11, fontWeight: 600, lineHeight: "14px",
                  color: C.muted,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${C.border}`,
                  padding: "1px 8px",
                  borderRadius: 999,
                  letterSpacing: "0.04em",
                }}
              >
                CONNECT WITH GMI
              </span>
            )}
          </div>
          {agent.hostMode === "connect" && agent.maasKey && (
            <MaasKeyRow value={agent.maasKey} accessUrl={agent.accessUrl} />
          )}
        </div>

        {headerActions}
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
          onAction={onAction}
          canConvert={canConvert}
        />
      )}
      {tab === "integration" && <IntegrationPane agent={agent} />}
      {tab === "analytics" && <AnalyticsPane />}
    </div>
  );
}

// ─── Snapshot status color + label ─────────────────────────────────────────
function snapshotColor(s: SnapshotStatus): string {
  switch (s) {
    case "ready":    return C.ok;
    case "creating": return "#fbbf24";
    case "failed":   return C.err;
    case "deleting": return "#fb923c";
  }
}

// ─── Restore modal — Create Runtime from a snapshot (PRD F-08 / §5.5) ───────
function RestoreSnapshotModal({
  snapshot, agents, onClose, onLaunch,
}: {
  snapshot: Snapshot | null;
  agents: MyAgent[];
  onClose: () => void;
  onLaunch: (targetAgentId: string) => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  if (!snapshot) return null;
  // Compatibility: the target Agent must match the snapshot's captured category.
  const withCompat = agents.map((a) => ({
    agent: a,
    compatible: a.category === snapshot.category,
    reason: a.category === snapshot.category ? "" : `Incompatible — captured a ${snapshot.category} runtime`,
  })).sort((a, b) => Number(b.compatible) - Number(a.compatible));
  const anyCompatible = withCompat.some((x) => x.compatible);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: "100%", background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 10, display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>Create Runtime from snapshot</h3>
          <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "4px 0 0" }}>
            <span style={{ fontFamily: MONO }}>{snapshot.name}</span> · restores filesystem state into a compatible Agent
          </p>
        </div>
        <div style={{ padding: "14px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.fg }}>Target Agent</span>
          {!anyCompatible && (
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "10px 12px", lineHeight: "18px" }}>
              No compatible Agent is available. Create New Agent from Snapshot is not supported in this release.
            </div>
          )}
          {withCompat.map(({ agent, compatible, reason }) => {
            const selected = targetId === agent.id;
            return (
              <button
                key={agent.id}
                disabled={!compatible}
                onClick={() => compatible && setTargetId(agent.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left",
                  background: selected ? "rgba(221,234,77,0.10)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${selected ? C.lime : C.borderSoft}`,
                  borderRadius: 8, padding: "10px 12px",
                  cursor: compatible ? "pointer" : "not-allowed", opacity: compatible ? 1 : 0.5,
                  fontFamily: FONT,
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{agent.name}</span>
                  <span style={{ fontSize: 11, color: compatible ? C.muted : C.err }}>{compatible ? agent.category : reason}</span>
                </span>
                {compatible && <span style={{ fontSize: 11, fontWeight: 600, color: C.lime }}>Compatible</span>}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${C.borderSoft}` }}>
          <button onClick={onClose} style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, background: "transparent", color: C.fg, border: `1px solid ${C.border}`, padding: "6px 14px", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
          <button
            onClick={() => targetId && onLaunch(targetId)}
            disabled={!targetId}
            style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, background: targetId ? C.lime : "#3a3a1f", color: targetId ? C.limeText : "#666", border: "none", padding: "6px 16px", borderRadius: 8, cursor: targetId ? "pointer" : "not-allowed" }}
          >
            Create Runtime
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Organization Snapshots view (PRD §5.5) ─────────────────────────────────
function OrganizationSnapshots({
  snapshots, onRestore, onDelete,
}: {
  snapshots: Snapshot[];
  onRestore: (s: Snapshot) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, lineHeight: "30px", color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>Organization Snapshots</h1>
        <NewBadge />
      </div>
      <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: 0 }}>
        Reusable, independent copies of a runtime disk — restore into a compatible Agent. Snapshots outlive their source runtime.
      </p>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "visible", marginTop: 4 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.5fr 0.9fr 0.7fr 1fr 1fr", padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)", fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>
          <div>Snapshot</div><div>Source</div><div>Created</div><div>Size</div><div>Expiry</div><div style={{ textAlign: "right" }}>Actions</div>
        </div>
        {snapshots.length === 0 ? (
          <div style={{ padding: "48px 16px", textAlign: "center", fontFamily: FONT, fontSize: 13, color: C.muted }}>
            No snapshots yet. Create one from a running runtime in My Agents.
          </div>
        ) : (
          snapshots.map((s, i) => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.5fr 0.9fr 0.7fr 1fr 1fr", padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`, alignItems: "center", fontFamily: FONT, fontSize: 13, color: C.fg }}>
              <div style={{ fontFamily: MONO, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
              <div style={{ color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.sourceAgentName}
                {s.sourceDeleted && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: C.muted, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, padding: "0 5px", borderRadius: 4 }}>Deleted</span>}
                <span style={{ display: "block", fontFamily: MONO, fontSize: 11, color: C.borderSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{midId(s.sourceRuntimeId)}</span>
              </div>
              <div style={{ color: C.muted }}>{agoLabel(s.createdAt)}</div>
              <div style={{ color: C.muted }}>{s.status === "ready" ? `${s.sizeGiB} GiB` : "—"}</div>
              <div style={{ color: C.muted }}>{s.status === "ready" ? `${s.retentionDays}d` : "—"}</div>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: snapshotColor(s.status), background: `${snapshotColor(s.status)}1f`, border: `1px solid ${snapshotColor(s.status)}55`, padding: "2px 8px", borderRadius: 6, marginRight: 4 }}>
                  {s.status === "creating" && <span style={{ width: 6, height: 6, borderRadius: 999, background: snapshotColor(s.status), animation: "pulse 1.2s ease-in-out infinite" }} />}
                  {s.status}
                </span>
                {s.status === "ready" && (
                  <button onClick={() => onRestore(s)} style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.limeText, background: C.lime, border: "none", padding: "3px 10px", borderRadius: 6, cursor: "pointer" }}>Create Runtime</button>
                )}
                {(s.status === "ready" || s.status === "failed") && (
                  <button onClick={() => onDelete(s.id)} style={{ fontFamily: FONT, fontSize: 11, fontWeight: 500, color: C.err, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 9px", borderRadius: 6, cursor: "pointer" }}>Delete</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [topTab, setTopTab] = useState<"deployments" | "uses" | "snapshots">("deployments");
  const [filter, setFilter] = useState("");
  const [registered, setRegistered] = useState<MyAgent[]>(() => loadRegisteredAgents());
  const [hiddenSeedIds, setHiddenSeedIds] = useState<Set<string>>(new Set());

  // Single shared destructive-action confirm dialog. Setting `confirm` opens it.
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const handleEditTemplate = (agent: MyAgent) => {
    // Opens the wizard in Edit-template mode, pre-filled from this agent.
    setLocation(`/deploy?edit=${encodeURIComponent(agent.id)}&name=${encodeURIComponent(agent.name)}`);
  };
  const performDeleteTemplate = (agent: MyAgent) => {
    const isRegistered = registered.some((a) => a.id === agent.id);
    if (isRegistered) {
      const next = registered.filter((a) => a.id !== agent.id);
      setRegistered(next);
      try { localStorage.setItem(REGISTERED_AGENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    } else {
      // Seed deployment: hide from runtime list (cannot truly delete sample data)
      setHiddenSeedIds((s) => {
        const next = new Set(s);
        next.add(agent.id);
        return next;
      });
    }
    if (selectedId === agent.id) {
      const remaining = [...registered.filter((a) => a.id !== agent.id), ...MY_DEPLOYMENTS.filter((a) => !hiddenSeedIds.has(a.id) && a.id !== agent.id)];
      if (remaining[0]) setSelectedId(remaining[0].id);
    }
  };
  const handleDeleteTemplate = (agent: MyAgent) => {
    setConfirm({
      title: "Delete template?",
      body: (
        <>
          You're about to delete the template{" "}
          <span style={{ color: C.fg, fontFamily: MONO }}>{agent.name}</span>.
          This cannot be undone. Existing running instances will not be affected.
        </>
      ),
      confirmLabel: "Delete template",
      destructive: true,
      onConfirm: () => performDeleteTemplate(agent),
    });
  };
  // Newly-registered agents from Connect flow appear at the top, then the seed list
  // (seed entries the user has deleted at runtime are hidden via hiddenSeedIds).
  const allAgents = useMemo(
    () => [...registered, ...MY_DEPLOYMENTS.filter((a) => !hiddenSeedIds.has(a.id))],
    [registered, hiddenSeedIds],
  );
  // allAgents may be empty for a brand-new user — no fallback to MY_DEPLOYMENTS now that it's empty.
  const [selectedId, setSelectedId] = useState<string>(allAgents[0]?.id ?? "");
  const [instances, setInstances] = useState<Instance[]>(INITIAL_INSTANCES);
  // Snapshot lifecycle (PRD §3 / §5.5)
  const [snapshots, setSnapshots] = useState<Snapshot[]>(INITIAL_SNAPSHOTS);
  const [restoreSnapshot, setRestoreSnapshot] = useState<Snapshot | null>(null);

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
      maxActive: config.maxLifetime,          // F-02 Maximum active runtime
      maxRuntimeAction: "suspend",            // F-02 default action at the limit
    };
    setInstances((prev) => [newInst, ...prev]);
    setProvisionForAgentId(null);
    // Simulate the container booting; flip to running + hydrate endpoint_url after ~1.5s
    // (matches F-03: endpoint_url is populated on read paths once the task is running)
    setTimeout(() => {
      setInstances((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: "running", endpointUrl: endpointFor(id), lifecycleStartedAt: fmtNow() } : i,
        ),
      );
    }, 1500);
  };

  // ── Runtime 2.0 lifecycle mutations (PRD §2). Simulated provider timing. ──
  const patchInstance = (id: string, patch: Partial<Instance>) =>
    setInstances((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const performSuspend = (id: string) => {
    // running → suspending → suspended (F-04); disk retained, retention clock starts (F-05)
    patchInstance(id, { status: "suspending" });
    setTimeout(() => patchInstance(id, {
      status: "suspended", endpointUrl: undefined,
      suspendedAt: fmtNow(), retentionDays: 30, keep: false,
    }), 1200);
  };
  const performResume = (id: string) => {
    // suspended → resuming → running (F-04); new endpoint, Keep cleared
    patchInstance(id, { status: "resuming" });
    setTimeout(() => setInstances((prev) => prev.map((i) =>
      i.id === id
        ? { ...i, status: "running", endpointUrl: endpointFor(i.id), keep: false, suspendedAt: undefined, lifecycleStartedAt: fmtNow() }
        : i,
    )), 1500);
  };
  const performDelete = (id: string) => {
    // running/suspended/failed → deleting → deleted (F-06); deleted is hidden by default
    patchInstance(id, { status: "deleting" });
    setTimeout(() => setInstances((prev) => prev.filter((i) => i.id !== id)), 1200);
  };

  const handleAction = (id: string, action: RowAction) => {
    const inst = instances.find((i) => i.id === id);
    const shortId = midId(id);
    switch (action) {
      case "suspend":
        setConfirm({
          title: "Suspend this runtime?",
          body: (
            <>
              Compute will stop and the disk will be retained. Memory, running processes, and
              live connections will not be preserved. Configured startup behavior will run on resume.
            </>
          ),
          confirmLabel: "Suspend",
          destructive: false,
          onConfirm: () => performSuspend(id),
        });
        break;
      case "resume":
        performResume(id);
        break;
      case "keep":
        // F-05 Keep pauses retention; cleared automatically on a successful Resume.
        patchInstance(id, { keep: !inst?.keep });
        break;
      case "delete":
        setConfirm({
          title: "Delete this runtime?",
          body: (
            <>
              Runtime <span style={{ color: C.fg, fontFamily: MONO }}>{shortId}</span> will be
              permanently deleted, including its retained disk. This cannot be undone.
              {inst?.status === "running" ? " Tip — create a snapshot first if you may need this state again." : ""}
            </>
          ),
          confirmLabel: "Delete",
          destructive: true,
          onConfirm: () => performDelete(id),
        });
        break;
      case "snapshot":
      case "convert": {
        // F-07 Create snapshot (from Running) / F-11 Convert (from Suspended).
        const est = estimateSnapshotGiB();
        setConfirm({
          title: action === "convert" ? "Convert to snapshot?" : "Create snapshot?",
          body: (
            <>
              A reusable, independent snapshot of this runtime's disk will be created.
              Requires up to <span style={{ color: C.fg, fontWeight: 600 }}>{est} GiB</span> of snapshot capacity;
              billing starts when it reaches Ready.
              {action === "convert" ? " The runtime stays suspended." : " The source runtime is unaffected."}
            </>
          ),
          confirmLabel: action === "convert" ? "Convert" : "Create snapshot",
          destructive: false,
          onConfirm: () => createSnapshotFrom(id),
        });
        break;
      }
    }
  };

  // ── Snapshot mutations (PRD §3) ──────────────────────────────────────────
  const createSnapshotFrom = (instanceId: string) => {
    const inst = instances.find((i) => i.id === instanceId);
    if (!inst) return;
    const agent = allAgents.find((a) => a.id === inst.agentId);
    const sid = newSnapshotId();
    const snap: Snapshot = {
      id: sid,
      name: `${(agent?.name || "runtime").toLowerCase().replace(/\s+/g, "-")}-${sid.slice(-4)}`,
      sourceAgentId: inst.agentId,
      sourceAgentName: agent?.name || "—",
      sourceRuntimeId: inst.id,
      category: agent?.category || "Code & Dev Tools",
      createdAt: fmtNow(),
      sizeGiB: estimateSnapshotGiB(),
      retentionDays: 30,
      status: "creating",
    };
    setSnapshots((prev) => [snap, ...prev]);
    setTopTab("snapshots"); // jump to Organization Snapshots so the user sees it
    // Billing starts only at Ready (F-07): creating → ready after ~1.6s.
    setTimeout(() => setSnapshots((prev) => prev.map((s) => (s.id === sid ? { ...s, status: "ready" } : s))), 1600);
  };
  const deleteSnapshot = (sid: string) => {
    setSnapshots((prev) => prev.map((s) => (s.id === sid ? { ...s, status: "deleting" } : s)));
    setTimeout(() => setSnapshots((prev) => prev.filter((s) => s.id !== sid)), 900);
  };
  const launchFromSnapshot = (snapshot: Snapshot, targetAgentId: string) => {
    // F-08 — new runtime with a fresh identity, target Agent config authoritative.
    setRestoreSnapshot(null);
    setTopTab("deployments");
    setSelectedId(targetAgentId);
    actuallyProvision(targetAgentId, { ...TEMPLATE_DEFAULT_CONFIG, name: `from-${snapshot.name}` });
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
            { id: "deployments" as const, label: "My Deployments & Listings", isNew: false },
            { id: "uses" as const, label: "Agents I Use", isNew: false },
            { id: "snapshots" as const, label: "Organization Snapshots", isNew: true },
          ].map((t) => {
            const isActive = topTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTopTab(t.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
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
                {t.isNew && <NewBadge />}
              </button>
            );
          })}
        </div>

        {topTab === "snapshots" && (
          <div style={{ padding: "20px 32px 32px", flex: 1, minHeight: 0 }}>
            <OrganizationSnapshots
              snapshots={snapshots}
              onRestore={(s) => setRestoreSnapshot(s)}
              onDelete={deleteSnapshot}
            />
          </div>
        )}

        {/* Body: split — left list pane / right detail pane */}
        {topTab !== "snapshots" && (
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
            <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, lineHeight: "30px", color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>
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
              onClick={() => setLocation("/list-claw")}
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
              List an agent
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {list.map((agent) => (
                <AgentListItem
                  key={agent.id}
                  agent={agent}
                  agg={aggregateFor(instances, agent.id)}
                  selected={agent.id === selected?.id}
                  onClick={() => setSelectedId(agent.id)}
                  onEditTemplate={handleEditTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                />
              ))}
              {list.length === 0 && allAgents.length > 0 && (
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
              onAction={handleAction}
              canConvert
            />
          ) : allAgents.length === 0 ? (
            <NewUserWelcome
              onStartFromTemplate={() => setLocation("/marketplace?starter=true")}
              onListAnAgent={() => setLocation("/deploy")}
            />
          ) : (
            <div style={{ fontFamily: FONT, fontSize: 14, color: C.muted, padding: 32, textAlign: "center" }}>
              Select an agent to see its details.
            </div>
          )}
        </div>
        )}

        <Footer />
      </div>

      <RestoreSnapshotModal
        snapshot={restoreSnapshot}
        agents={allAgents}
        onClose={() => setRestoreSnapshot(null)}
        onLaunch={(targetAgentId) => restoreSnapshot && launchFromSnapshot(restoreSnapshot, targetAgentId)}
      />

      <ProvisionModal
        open={provisionForAgentId !== null}
        agentName={allAgents.find((a) => a.id === provisionForAgentId)?.name ?? ""}
        image={(allAgents.find((a) => a.id === provisionForAgentId) as any)?.dockerImage}
        onCancel={() => setProvisionForAgentId(null)}
        onSubmit={(cfg) => {
          if (provisionForAgentId) actuallyProvision(provisionForAgentId, cfg);
        }}
      />

      <ConfirmDialog pending={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
