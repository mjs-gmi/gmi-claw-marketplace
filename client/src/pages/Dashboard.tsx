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
// Console labels are presentation only). Backend keeps suspend/suspended field
// names; the UI presents them as Pause/Paused (Runtime 2.0 PRD v2.3).
function statusLabel(status: AgentStatus): string {
  switch (status) {
    case "pending":
    case "creating":   return "starting";
    case "running":    return "running";
    case "suspending": return "pausing";
    case "suspended":  return "paused";
    case "resuming":   return "resuming";
    case "deleting":   return "deleting";
    case "deleted":    return "deleted";
    // API state is `failed` (PRD §4.1). Console label matches the API word so
    // support and customers name the same thing.
    case "error":      return "failed";
    case "idle":       return "Idle";
    case "stopping":   return "pausing";
    case "stopped":    return "paused";
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
  endpoints?: AgentEndpoint[];  // Register → Networking endpoint definitions
  region?: string;              // Register → region id (read-only in runtime)
  tier?: string;                // Register → compute tier id (read-only in runtime)
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

// ─── Backend capability flags (capability-driven, provider-agnostic).
// In production these ride on the instance read path (`capabilities`). Here they
// are prototype constants so the UI is capability-gated rather than provider-aware.
const CAP = {
  // P-04 Snapshot retention is Conditional R1 — off until Q16 and commercial
  // review are approved. When off, snapshots have no auto-expiry (§4.3).
  snapshotAutoRetention: false,
  // F-07 / §4.1 — capture from a Suspended Runtime is conditional on Q8. While
  // off, Snapshot is Running-only and AgentBox never silently resumes a
  // Suspended Runtime: Resume → Snapshot → Suspend stays three explicit steps.
  snapshotFromSuspended: false,
  // F-07 R1 gate is an Organization COUNT limit checked before capture — not a
  // pre-reserved storage quota. Storage bills per GiB from Ready (§4.5).
  orgSnapshotLimit: 20,
};

// ─── Release tag — which release a surface belongs to (PRD §1 delivery scope).
// The prototype is reviewed release-by-release, so every net-new surface says
// whether it ships in R0, R1, or on the independent model-selection track.
type Release = "R0" | "R1" | "R1?" | "IND";
const RELEASE_META: Record<Release, { label: string; title: string; color: string }> = {
  R0:    { label: "R0",  title: "Ships in R0 — the create → exec → file → delete → usage loop", color: "#34d399" },
  R1:    { label: "R1",  title: "Ships in R1", color: "#7dd3fc" },
  "R1?": { label: "R1?", title: "Conditional in R1 — pending an open question or commercial review", color: "#fbbf24" },
  IND:   { label: "IND", title: "Independent track — never blocks the R1 release", color: "#c7a7ff" },
};

// ─── Endpoints & Access (Networking spec — R1 minimal) ─────────────────────
// Register declares the HTTP services an Agent exposes (Name / Internal port /
// Protocol / Private·Public). Access (Instance Detail) shows the live URL, status,
// and credentials for each endpoint on a running instance. Register = what the
// Agent exposes; Access = the running instance's actual URL, status, and token.
type EndpointVisibility = "private" | "public";
interface AgentEndpoint {
  id: string;
  name: string;          // e.g. "web"
  internalPort: string;  // e.g. "3000"
  protocol: string;      // HTTP | HTTPS | TCP
  visibility: EndpointVisibility;
}
// Fallback when an agent has no endpoints on its template (older seed / legacy).
const ENDPOINTS_FALLBACK: AgentEndpoint[] = [
  { id: "ep0", name: "web", internalPort: "8080", protocol: "HTTP", visibility: "private" },
];
function endpointsForAgent(agent?: { endpoints?: AgentEndpoint[] }): AgentEndpoint[] {
  return agent?.endpoints?.length ? agent.endpoints : ENDPOINTS_FALLBACK;
}
// Live URL for an endpoint on a specific instance (mock — {name}-rtm-{id}.gmi.cloud).
function endpointUrlFor(instId: string, ep: AgentEndpoint): string {
  const sid = instId.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  return `https://${ep.name}-rtm-${sid}.gmi.cloud`;
}
// Endpoint availability derived from runtime state. Visibility (Private/Public) and
// Availability are SEPARATE dimensions — never merged into one badge. F-06: the
// Endpoint has its OWN state machine, independent of Runtime state — a Running
// Runtime does NOT guarantee its Endpoint is Available.
type EndpointState = "pending" | "available" | "unavailable" | "error" | "revoked";
const ENDPOINT_STATE_META: Record<EndpointState, { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "#fbbf24" },
  available:   { label: "Available",   color: "#34d399" },
  unavailable: { label: "Unavailable", color: "#9a9a9a" },
  error:       { label: "Error",       color: "#ef4444" },
  revoked:     { label: "Revoked",     color: "#737373" },
};
// Per-endpoint state. Runtime lifecycle sets hard constraints (deleted→revoked,
// suspended→unavailable, transitioning→pending); while Running the endpoint state
// is independent and mocked deterministically so the demo shows Running ≠ Available.
function endpointState(inst: Instance, ep: AgentEndpoint): EndpointState {
  const s = inst.status;
  if (s === "deleting" || s === "deleted") return "revoked";
  if (s === "suspended" || s === "suspending") return "unavailable";
  if (s === "creating" || s === "pending" || s === "resuming") return "pending";
  if (s === "error") return "error";
  let h = 0; const k = ep.id + inst.id;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  const roll = h % 12;
  if (roll === 0) return "pending";      // route still coming up
  if (roll === 1) return "error";        // tunnel/route error
  if (roll === 2) return "unavailable";  // port not listening
  return "available";
}

// Region id → readable IDC label (mirrors Register's REGIONS). Falls back to the id.
const REGION_LABELS: Record<string, string> = {
  "us-ia-iowa-1": "IOWA IDC-1",
  "us-or-portland": "Portland IDC-1",
  "eu-de-frankfurt": "Frankfurt IDC-1",
  "ap-sg-singapore": "Singapore IDC-1",
};
function regionLabel(region?: string): string {
  if (!region) return "—";
  return REGION_LABELS[region] ? `${REGION_LABELS[region]} · ${region}` : region;
}
// Compute tier id → product SKU shown in Instance Details. Falls back to Container.
const PRODUCT_BY_TIER: Record<string, string> = {
  container: "gmi.container.intel.x4660.large",
  standard: "gmi.standard.intel.x8.xlarge",
  performance: "gmi.performance.intel.x16.2xlarge",
};
function productForTier(tier?: string): string {
  return PRODUCT_BY_TIER[tier ?? "container"] ?? PRODUCT_BY_TIER.container;
}

// F-08 Model selection — selectable set = Org available models (LLMs). `plan` = in
// the active Coding Plan; `featured` = the Agent Version's default pick (one). No
// external/BYO models. Resolved value injected as locked env GMI_MODEL_ID.
interface LaunchModel { id: string; name: string; plan?: boolean; featured?: boolean }
// Stands in for the available-models API response, filtered to LLMs. Ordering in
// every picker: In your Coding Plan → Featured → the rest (F-08 rule 1).
const LAUNCH_MODELS: LaunchModel[] = [
  { id: "deepseek-v4-flash", name: "DeepSeek-V4-Flash", plan: true, featured: true },
  { id: "claude-opus-48", name: "Claude Opus 4.8", plan: true },
  { id: "gpt-55", name: "GPT-5.5" },
];
const FEATURED_MODEL = LAUNCH_MODELS.find((m) => m.featured) ?? LAUNCH_MODELS[0];
function launchModel(id?: string): LaunchModel | undefined {
  return LAUNCH_MODELS.find((m) => m.id === id);
}
// Human name for any stored id — including one the API no longer returns.
function modelDisplayName(id?: string): string {
  if (!id) return FEATURED_MODEL.name;
  return launchModel(id)?.name ?? id;
}

// ─── F-08 Saved Launch Configuration (launcher / Organization-owned) ─────────
// A launcher's reusable "how I run this Agent". Holds their default model per
// Agent and its own model_selection_status. Precedence at create:
//   per-Runtime override > Saved Launch Configuration > Agent Version default.
// Rule 4 — no silent substitution: if the saved model stops being returned by
// the available-models API the config stays stored but becomes action_required,
// and creation is blocked until the user confirms another model. The Featured
// model may be preselected but is never applied automatically.
type ModelSelectionStatus = "ok" | "action_required";
interface SavedLaunchConfig { model: string; status: ModelSelectionStatus }
const INITIAL_SAVED_CONFIGS: Record<string, SavedLaunchConfig> = {
  agent_hermes: { model: "claude-opus-48", status: "ok" },
  // Saved a model the available-models API no longer returns → action_required.
  // This agent's Template is Ready, so the model gate is the only thing blocking
  // create — the two launch gates stay legible separately.
  agent_hermes_mingjun: { model: "qwen-25-72b", status: "action_required" },
  agent_openclaw: { model: "deepseek-v4-flash", status: "ok" },
};
// Agent Version name — the developer-owned layer (also the Snapshot lineage
// field and the Console snapshot-name prefix).
const AGENT_VERSIONS: Record<string, string> = {
  agent_hermes: "hermes-v1",
  agent_hermes_mingjun: "hermes-mingjun-v1",
  agent_openclaw: "openclaw-v5",
};
function agentVersionName(agentId: string, agentName?: string): string {
  return AGENT_VERSIONS[agentId]
    ?? `${(agentName || "agent").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-v1`;
}
// Resolve a Saved Launch Configuration against the live available-models list.
function resolveSavedConfig(cfg?: SavedLaunchConfig): SavedLaunchConfig {
  if (!cfg) return { model: FEATURED_MODEL.id, status: "ok" };
  return launchModel(cfg.model) ? { ...cfg, status: "ok" } : { ...cfg, status: "action_required" };
}

// ─── §4.7 Customer metadata ─────────────────────────────────────────────────
// Optional customer-defined key/value map on Runtimes and Snapshots. Set at
// create, updatable afterwards, returned by Get/List, filterable in List. Fully
// opaque to AgentBox — never parsed for routing, quota, billing attribution, or
// authorization. organization_id stays the only tenant of record (§4.6).
interface MetaEntry { id: string; key: string; value: string }
const METADATA_MAX_ENTRIES = 20;   // limits are API-contract owned; mocked here
const METADATA_SECRET_NOTE = "Metadata is visible in the Console, API responses, logs, and support tooling — do not put secrets here.";
function newMetaId(): string { return `m${Math.random().toString(36).slice(2, 8)}`; }
// Filter helper for List surfaces: "key=value", "key=", or a bare substring.
function metadataMatches(entries: MetaEntry[] | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const rows = entries ?? [];
  const eq = q.indexOf("=");
  if (eq > 0) {
    const k = q.slice(0, eq).trim();
    const v = q.slice(eq + 1).trim();
    return rows.some((r) => r.key.toLowerCase() === k && (!v || r.value.toLowerCase().includes(v)));
  }
  return rows.some((r) => `${r.key}=${r.value}`.toLowerCase().includes(q));
}

interface InstanceConfig {
  name?: string;         // optional instance name (e.g. "prod-worker-1")
  envOverrides: { id: string; key: string; value: string }[];
  maxLifetime: string;   // e.g. "1h", "off"
  idleTimeout: string;   // e.g. "5min", "off"
  endpointActivity?: boolean; // P-02: declared-Endpoint traffic counts as activity (D-05 opt-out)
  model?: string;        // F-08 resolved model id (injected as GMI_MODEL_ID)
  metadata?: MetaEntry[]; // §4.7 customer metadata
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
  // §4.1 — three separate fields, never a tenth state: runtime.state (status),
  // runtime.confirmation_status (unconfirmed) and latest_operation.status.
  latestOperation?: { kind: string; status: "in_progress" | "succeeded" | "failed" | "unknown"; at: string };
}

const TEMPLATE_DEFAULT_CONFIG: InstanceConfig = {
  envOverrides: [],
  maxLifetime: "1h",       // P-01 — Organization fallback default
  idleTimeout: "off",      // P-02 — inactivity suspend Off by default
  endpointActivity: true,  // P-02 — Endpoint traffic counts by default (D-05)
  metadata: [],
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
    // §4.7 — how an orchestrator maps this Runtime back to its own tenant/job.
    config: {
      ...TEMPLATE_DEFAULT_CONFIG,
      metadata: [
        { id: "m1", key: "tenant", value: "acme-corp" },
        { id: "m2", key: "job", value: "nightly-scrape" },
      ],
    },
  },
  {
    id: "1e1bd452-9a3c-4b8e-bf21-7d40c9e6095a",
    agentId: "agent_hermes",
    status: "running",
    created: _seedDaysAgo(6),
    endpointUrl: endpointFor("1e1bd452-9a3c-4b8e-bf21-7d40c9e6095a"),
    maxActive: "off",
    maxRuntimeAction: "suspend",
    config: {
      ...TEMPLATE_DEFAULT_CONFIG,
      metadata: [{ id: "m3", key: "tenant", value: "globex" }],
    },
  },
  // Suspended runtime near its retention expiry — drives the 7/3/1 risk state.
  {
    id: "3f9a2c74-1b6d-4e8a-9c05-2a7f1e4b8d10",
    agentId: "agent_hermes",
    status: "suspended",
    created: _seedDaysAgo(20),
    maxActive: "1h",
    maxRuntimeAction: "suspend",
    suspendedAt: _seedDaysAgo(28), // 30-day retention → ~2 days left (danger tier)
    retentionDays: 30,
  },
  // Failed creation (§4.2) — record remains deletable, Retry available.
  {
    id: "a1c8e5f2-7d34-4b90-8e16-9f2b3c6a0d55",
    agentId: "agent_hermes",
    status: "error",
    created: _seedMinsAgo(6),
    maxActive: "1h",
    maxRuntimeAction: "suspend",
    lastError: "Initialization deadline exceeded — startup probe never became ready.",
  },
  // Unknown provider outcome (§4.2) — last confirmed state kept, unconfirmed=true.
  {
    id: "b2d9f6a3-8e45-4c01-9f27-0a3c4d7b1e66",
    agentId: "agent_hermes",
    status: "running",
    created: _seedMinsAgo(3),
    endpointUrl: endpointFor("b2d9f6a3-8e45-4c01-9f27-0a3c4d7b1e66"),
    maxActive: "6h",
    maxRuntimeAction: "suspend",
    lifecycleStartedAt: _seedMinsAgo(3),
    unconfirmed: true,
    latestOperation: { kind: "create", status: "unknown", at: _seedMinsAgo(3) },
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

// PRD v2.3 — Paused instances are NEVER auto-deleted. They persist until the user
// Resumes or Deletes them; storage keeps billing the whole time. No countdown.
const PAUSED_DISK_GIB = 40; // mocked retained-disk size behind the cost estimate
function pausedCostMo(_inst: Instance): number {
  // ≈ $0.10 / GiB-month. Flat mock so the demo reads a stable ≈$4/mo.
  return Math.max(1, Math.round(PAUSED_DISK_GIB * 0.10));
}
// Lifecycle-column text for a paused runtime — cost reminder, no expiry.
function pausedLifecycleLabel(): string {
  return "Paused · Storage charges continue";
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

// ─── F-07 Snapshot ──────────────────────────────────────────────────────────
// Immutable, Organization-owned, point-in-time disk copy. creating → ready.
// The Snapshot ID is canonical: nothing is ever addressed by name. The display
// name is optional at the API, editable, and Organization-unique when present.
type SnapshotStatus = "creating" | "ready" | "failed" | "deleting";
interface Snapshot {
  id: string;                   // immutable, system-generated, canonical reference
  name?: string;                // optional — Console falls back to the ID
  description?: string;
  sourceAgentId: string;
  sourceAgentName: string;
  sourceAgentVersion: string;   // lineage metadata — survives rename / cleared name
  sourceRuntimeId: string;
  sourceDeleted?: boolean;      // source runtime/agent gone — snapshot still usable
  category: string;             // captured runtime category (launch-eligibility check)
  region: string;               // inherited automatically, never selected at capture
  runtimeClass: string;
  architecture: string;
  createdAt: string;
  readyAt?: string;             // retention (P-04) counts from Ready, not from create
  billableGiB?: number | null;  // nullable — compressed size may arrive after Ready
  retentionDays: number;        // P-04 retention window (conditional on Q16)
  status: SnapshotStatus;
  error?: string;
  metadata?: MetaEntry[];       // §4.7 customer metadata
}
const INITIAL_SNAPSHOTS: Snapshot[] = [
  {
    id: "snap_7c3f9a21b8e4",
    name: "hermes-deps-installed",
    description: "Playwright + chromium preinstalled so cold starts skip the 90s install.",
    sourceAgentId: "agent_hermes",
    sourceAgentName: "Hermes",
    sourceAgentVersion: "hermes-v1",
    sourceRuntimeId: "8b62347b-4c1a-4e9f-a2d7-6f0b1e5a3c36",
    category: "Code & Dev Tools",
    region: "us-ia-iowa-1",
    runtimeClass: "container",
    architecture: "linux/amd64",
    createdAt: _seedDaysAgo(3),
    readyAt: _seedDaysAgo(3),
    billableGiB: 4.2,
    retentionDays: 30,
    status: "ready",
    metadata: [{ id: "ms1", key: "tenant", value: "acme-corp" }],
  },
  {
    // Name omitted via the API — the Console labels it by ID (F-07 naming rules).
    id: "snap_2b8d47f1c9a0",
    sourceAgentId: "agent_hermes",
    sourceAgentName: "Hermes",
    sourceAgentVersion: "hermes-v1",
    sourceRuntimeId: "1e1bd452-9a3c-4b8e-bf21-7d40c9e6095a",
    category: "Code & Dev Tools",
    region: "us-ia-iowa-1",
    runtimeClass: "container",
    architecture: "linux/amd64",
    createdAt: _seedDaysAgo(27),  // 30-day retention → ~3 days left (risk tier)
    readyAt: _seedDaysAgo(27),
    billableGiB: null,            // compressed size never reported — stays "Pending"
    retentionDays: 30,
    status: "ready",
  },
];
// Console label — name when present, otherwise the canonical ID (F-07).
function snapshotLabel(s: Snapshot): string {
  return s.name && s.name.trim() ? s.name.trim() : s.id;
}
// Capture-time size estimate → "Requires up to X GiB" (mock: OS + used + margin).
function estimateSnapshotGiB(): number {
  return 4.2;
}
// F-07 name rules — 1–64 chars, lowercase letters, digits, hyphen, underscore;
// unique within the Organization; duplicates are rejected, never overwritten.
const SNAPSHOT_NAME_RE = /^[a-z0-9_-]{1,64}$/;
function snapshotNameError(name: string, taken: string[]): string | null {
  const v = name.trim();
  if (!v) return null; // clearing the name is valid — the Console falls back to the ID
  if (v.length > 64) return "Maximum 64 characters.";
  if (!SNAPSHOT_NAME_RE.test(v)) return "Use lowercase letters, digits, hyphen, or underscore.";
  if (taken.includes(v)) return "A Snapshot with this name already exists in your Organization.";
  return null;
}
// Console pre-fill: <agent-version-name>-<source-instance-short-id>-<YYYYMMDD-HHMM>
// in the Organization's display timezone. The user may overwrite or clear it.
function snapshotNamePrefill(agentVersion: string, instId: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  const short = `i${instId.replace(/[^a-z0-9]/gi, "").slice(0, 6)}`;
  return `${agentVersion}-${short}-${stamp}`;
}
// Snapshot retention expiry (P-04) — counts from Ready; 7/3/1 risk color.
function snapshotDaysLeft(s: Snapshot): number {
  const anchor = s.readyAt ?? s.createdAt;
  const start = new Date(anchor.replace(" ", "T")).getTime();
  const elapsed = Math.floor((Date.now() - start) / 86400000);
  return Math.max(0, s.retentionDays - elapsed);
}
function riskColor(daysLeft: number): { color: string; warn: boolean } {
  if (daysLeft <= 1) return { color: C.err, warn: true };
  if (daysLeft <= 3) return { color: "#fb923c", warn: true };
  if (daysLeft <= 7) return { color: C.warn, warn: true };
  return { color: C.muted, warn: false };
}

// ─── Cost estimates (PRD §4.5 metering; exact billing lives in Usage & Billing) ──
// Mock rates — the reliability of a $/month figure is a Decision needed (review).
const SUSPENDED_STORAGE_PER_GIB_MO = 0.08;
const SNAPSHOT_STORAGE_PER_GIB_MO = 0.05;
const SUSPENDED_DISK_GIB = 10;   // mock retained-disk size per suspended runtime
const HRS_PER_MONTH = 730;
const CONTAINER_RATE_HR = 0.0098; // Container tier $/hr (matches Register's Live Cost)
interface CostBreakdown { computeMo: number; suspendedMo: number; snapMo: number; total: number; suspendedGiB: number; snapGiB: number }
function agentCostBreakdown(agentId: string, instances: Instance[], snapshots: Snapshot[]): CostBreakdown {
  const rate = CONTAINER_RATE_HR;
  const mine = instances.filter((i) => i.agentId === agentId);
  const activeCompute = mine.filter((i) => i.status === "running" || i.status === "resuming" || i.status === "suspending").length;
  const computeMo = activeCompute * rate * HRS_PER_MONTH;
  const suspendedGiB = mine.filter((i) => i.status === "suspended").length * SUSPENDED_DISK_GIB;
  const suspendedMo = suspendedGiB * SUSPENDED_STORAGE_PER_GIB_MO;
  // Snapshot storage bills from Ready on the provider-reported billable size —
  // a Snapshot whose size hasn't been reported yet contributes nothing (§4.5).
  const snapGiB = snapshots
    .filter((s) => s.sourceAgentId === agentId && s.status === "ready")
    .reduce((a, s) => a + (s.billableGiB ?? 0), 0);
  const snapMo = snapGiB * SNAPSHOT_STORAGE_PER_GIB_MO;
  return { computeMo, suspendedMo, snapMo, total: computeMo + suspendedMo + snapMo, suspendedGiB, snapGiB };
}
const usd = (n: number) => `$${n.toFixed(2)}`;

// ─── Runtime Image readiness (PRD Resource Model / E1) ──────────────────────
// A Runtime Image is the Docker image an Agent references to create instances —
// part of Agent configuration, not a navigable resource. Two internal state
// machines gate Launch: image validation, then provider runtime preparation.
type ImageValidation = "pending" | "validating" | "valid" | "incompatible" | "failed";
type RuntimePrep = "not_started" | "preparing" | "ready" | "failed" | "stale";
interface RuntimeImage {
  url: string;
  tag: string;
  digest: string;      // immutable digest
  registry: string;
  architecture: string;
  validation: ImageValidation;
  preparation: RuntimePrep;
  lastValidated: string;
  compatibilityIssue?: string;
}
// Customer-facing copy (exact per spec).
const VALIDATION_LABEL: Record<ImageValidation, string> = {
  pending: "Pending validation", validating: "Validating image", valid: "Valid",
  incompatible: "Incompatible", failed: "Unable to validate",
};
const PREP_LABEL: Record<RuntimePrep, string> = {
  not_started: "Not started", preparing: "Preparing runtime", ready: "Ready",
  failed: "Preparation failed", stale: "Revalidation required",
};
function validationColor(v: ImageValidation): string {
  return v === "valid" ? C.ok : v === "incompatible" || v === "failed" ? C.err : C.warn;
}
function prepColor(p: RuntimePrep): string {
  return p === "ready" ? C.ok : p === "failed" ? C.err : p === "stale" ? "#fb923c" : C.warn;
}
// Launch gate (F-01): image valid AND runtime prepared.
function isLaunchable(img?: RuntimeImage): boolean {
  return img?.validation === "valid" && img?.preparation === "ready";
}
const INITIAL_RUNTIME_IMAGES: Record<string, RuntimeImage> = {
  agent_hermes: {
    url: "ghcr.io/mjs-gmi/hermes-gmi", tag: "v5", digest: "sha256:0bf9bdf13d544665a7188cce1423ab11c0de",
    registry: "ghcr.io", architecture: "linux/amd64", validation: "valid", preparation: "ready",
    lastValidated: _seedDaysAgo(2),
  },
  agent_hermes_mingjun: {
    url: "ghcr.io/mjs-gmi/hermes-gmi", tag: "v6-rc1", digest: "sha256:b73c1e082f4a4d198c6b5a9e0f21d7c4a1b2",
    registry: "ghcr.io", architecture: "linux/amd64", validation: "valid", preparation: "ready",
    lastValidated: _seedMinsAgo(4),
  },
  agent_openclaw: {
    url: "ghcr.io/mjs-gmi/openclaw-gmi", tag: "v5-mode-none", digest: "sha256:d87723941a694cfd8b97f3c895db9e85aa10",
    registry: "ghcr.io", architecture: "linux/arm64", validation: "incompatible", preparation: "not_started",
    lastValidated: _seedMinsAgo(9),
    compatibilityIssue: "Image architecture linux/arm64 is not supported by the selected region (needs linux/amd64).",
  },
};

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
const IconRestart = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
  </svg>
);
const IconNetwork = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2.4" /><circle cx="5" cy="19" r="2.4" /><circle cx="19" cy="19" r="2.4" />
    <path d="M12 7.4v4.2M12 11.6 6.4 17M12 11.6 17.6 17" />
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

// ─── Release badge — which release a surface belongs to (PRD §1) ─────────────
function ReleaseBadge({ r, style }: { r: Release; style?: React.CSSProperties }) {
  const m = RELEASE_META[r];
  return (
    <span
      title={m.title}
      style={{
        display: "inline-flex", alignItems: "center",
        fontFamily: FONT, fontSize: 9, fontWeight: 700, lineHeight: "12px",
        letterSpacing: "0.08em",
        color: m.color, background: `${m.color}1f`, border: `1px solid ${m.color}55`,
        padding: "1px 5px", borderRadius: 4,
        verticalAlign: "middle",
        ...style,
      }}
    >
      {m.label}
    </span>
  );
}

// ─── §4.7 Customer metadata editor — shared by create and detail surfaces ────
function MetadataEditor({
  entries, onChange, note = METADATA_SECRET_NOTE, compact = false,
}: {
  entries: MetaEntry[];
  onChange: (next: MetaEntry[]) => void;
  note?: string;
  compact?: boolean;
}) {
  const cell: React.CSSProperties = {
    background: C.pillBg, border: `1px solid ${C.border}`, color: C.fg,
    fontFamily: MONO, fontSize: 12, padding: "6px 10px", borderRadius: 6, outline: "none",
    minWidth: 0, width: "100%",
  };
  const atLimit = entries.length >= METADATA_MAX_ENTRIES;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 26px", gap: 6, padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${C.borderSoft}`, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted }}>
          <span>Key</span><span>Value</span><span />
        </div>
        {entries.length === 0 && (
          <div style={{ padding: "10px", fontFamily: FONT, fontSize: 11.5, color: C.muted }}>
            No metadata. Add a key to map this resource back to your own user, job, or tenant.
          </div>
        )}
        {entries.map((row) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 26px", gap: 6, padding: "6px 10px", alignItems: "center", borderBottom: `1px solid ${C.borderSoft}` }}>
            <input
              placeholder="tenant"
              value={row.key}
              onChange={(e) => onChange(entries.map((r) => (r.id === row.id ? { ...r, key: e.target.value } : r)))}
              style={cell}
            />
            <input
              placeholder="acme-corp"
              value={row.value}
              onChange={(e) => onChange(entries.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)))}
              style={cell}
            />
            <button
              onClick={() => onChange(entries.filter((r) => r.id !== row.id))}
              aria-label="Remove metadata entry"
              style={{ background: "transparent", border: "none", cursor: "pointer", color: C.muted, padding: 4, display: "inline-flex" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
        <button
          disabled={atLimit}
          onClick={() => onChange([...entries, { id: newMetaId(), key: "", value: "" }])}
          style={{
            width: "100%", textAlign: "left", background: "transparent", border: "none",
            padding: "8px 10px", fontFamily: FONT, fontSize: 12, fontWeight: 500,
            color: atLimit ? "#5a5a5a" : C.muted, cursor: atLimit ? "not-allowed" : "pointer",
          }}
        >
          {atLimit ? `Maximum ${METADATA_MAX_ENTRIES} entries` : "+ metadata"}
        </button>
      </div>
      {!compact && (
        <span style={{ fontFamily: FONT, fontSize: 11, color: C.warn, lineHeight: "15px" }}>{note}</span>
      )}
    </div>
  );
}

// ─── Lifecycle timeline — 2-stage visual (Active → Paused).
// PRD v2.3: paused instances are never auto-deleted — they persist until Resume
// or Delete, and storage keeps billing. durationLabel is hoisted below.
function LifecycleTimeline({ maxActive }: { maxActive?: string }) {
  const activeSub = !maxActive || maxActive === "off" ? "No limit" : `≤ ${durationLabel(maxActive)}`;
  const stages = [
    { label: "Active", sub: activeSub,                                    color: C.ok },
    { label: "Paused", sub: "Storage billing continues until Resume or Delete", color: "#60a5fa" },
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
          {agg.active === 0 ? "No running instances" : `${agg.active} running instance${agg.active === 1 ? "" : "s"}`}
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

// ─── Logs pane ───────────────────────────────────────────────────────────────
// R0 release gate (§1.2): a failed create's reason, exec output, and the
// state-change history must be readable from the API and the Console, with no
// backend access. Readable in every state, including Deleted.
function stateHistory(inst: Instance): { at: string; label: string; tone?: "err" | "warn" }[] {
  const out: { at: string; label: string; tone?: "err" | "warn" }[] = [
    { at: inst.created, label: "pending — Runtime record persisted, ID returned" },
    { at: inst.created, label: "initializing — provisioning with the provider" },
  ];
  if (inst.lifecycleStartedAt) out.push({ at: inst.lifecycleStartedAt, label: "running — readiness passed, compute metering started" });
  if (inst.suspendedAt) out.push({ at: inst.suspendedAt, label: "suspended — compute stopped, disk retained" });
  if (inst.status === "error") out.push({ at: inst.created, label: `failed — ${inst.lastError ?? "startup failed"}`, tone: "err" });
  if (inst.unconfirmed) out.push({ at: inst.latestOperation?.at ?? inst.created, label: `${inst.latestOperation?.kind ?? "operation"} — provider outcome unknown, last confirmed state kept while we reconcile`, tone: "warn" });
  if (inst.status === "deleting" || inst.status === "deleted") out.push({ at: fmtNow(), label: "deleting — releasing compute, disk, and provider artifacts" });
  if (inst.status === "deleted") out.push({ at: fmtNow(), label: "deleted — release confirmed, metering stopped, final usage emitted" });
  return out;
}
function LogsPane({ inst }: { inst: Instance }) {
  const lines = mockLogsFor(inst);
  const history = stateHistory(inst);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Logs <ReleaseBadge r="R0" /> · GET /runtimes/{midId(inst.id)}/logs
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

      {/* State-change history — the third thing the R0 Logs gate requires */}
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          State history
        </span>
        {history.map((h, i) => (
          <div key={`${h.label}-${i}`} style={{ display: "flex", gap: 8, alignItems: "baseline", fontFamily: FONT, fontSize: 11.5, lineHeight: "16px" }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.borderSoft, flexShrink: 0 }}>{h.at.slice(5, 16)}</span>
            <span style={{ color: h.tone === "err" ? "#fca5a5" : h.tone === "warn" ? C.warn : C.fg }}>{h.label}</span>
          </div>
        ))}
        <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
          Logs, details, and this history stay readable in every state — including after Delete, for the retention period.
        </span>
      </div>
    </>
  );
}

// ─── F-02 Command execution ─────────────────────────────────────────────────
// Mock provider behavior for one exec. Mirrors the field set fixed in the PRD:
// out = execution_id, status, exit_code, stdout, stderr, stdout_truncated,
// stderr_truncated, termination_reason.
type ExecStatus = "running" | "succeeded" | "failed" | "timed_out" | "cancelled";
interface Execution {
  id: string;
  command: string;
  status: ExecStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  terminationReason?: string;
}
const EXEC_STATUS_COLOR: Record<ExecStatus, string> = {
  running: "#fbbf24", succeeded: C.ok, failed: C.err, timed_out: "#fb923c", cancelled: "#737373",
};
function newExecutionId(): string {
  const r = () => Math.random().toString(16).slice(2, 8);
  return `exec_${r()}${r()}`;
}
function mockExec(cmd: string, inst: Instance): Execution {
  const c = cmd.trim();
  const base = { id: newExecutionId(), command: c, stderr: "", stdoutTruncated: false, stderrTruncated: false };
  // execution_timeout is server-side: it kills the process group and returns
  // timed_out with partial output. The Runtime stays Running (rule 4).
  if (/\bsleep\b|\btrain\b/.test(c)) {
    return { ...base, status: "timed_out", exitCode: null, stdout: "step 1/50 …\nstep 2/50 …", stderr: "", terminationReason: "execution_timeout (300s) — process group killed" };
  }
  if (/\bfind\b|\bdump\b|\byes\b/.test(c)) {
    return { ...base, status: "succeeded", exitCode: 0, stdout: "…\n(1.9 MB of output)", stdoutTruncated: true };
  }
  if (c === "ls") return { ...base, status: "succeeded", exitCode: 0, stdout: "Dockerfile  README.md  package.json  src/  bin/  input/  output/" };
  if (c === "pwd") return { ...base, status: "succeeded", exitCode: 0, stdout: "/app" };
  if (c === "ps") return { ...base, status: "succeeded", exitCode: 0, stdout: "PID   COMMAND\n  1   node server.js\n 27   sh -c ps" };
  // Rule 9 — platform-injected secret values are exact-match redacted from
  // output, logs, and audit. Only the platform's own values are covered.
  if (c === "env") {
    return { ...base, status: "succeeded", exitCode: 0, stdout: `GMI_MAAS_API_KEY=[redacted]\nGMI_MAAS_BASE_URL=https://api.gmi-serving.com\nGMI_MODEL_ID=${inst.config?.model ?? FEATURED_MODEL.id}\nPORT=8080` };
  }
  if (c.startsWith("cat ")) return { ...base, status: "succeeded", exitCode: 0, stdout: `# ${c.slice(4)}\n(mock contents)` };
  if (c.startsWith("python") || c.startsWith("node") || c.startsWith("./")) {
    return { ...base, status: "succeeded", exitCode: 0, stdout: "wrote /app/output/result.json (3 records)" };
  }
  // Rule 2 — a non-zero exit is a failed command, not a failed API call.
  return { ...base, status: "failed", exitCode: 127, stdout: "", stderr: `sh: command not found: ${c.split(" ")[0]}` };
}

// Run Command (§4.8, backed by exec F-02) — ONE command per submission, Running
// only. Deliberately not a terminal: no persistent session, stdin, PTY, retained
// cd, or Ctrl-C. Q-18 tracks the real shell story.
function ShellPane({ inst }: { inst: Instance }) {
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<Execution[]>([]);

  const run = () => {
    const c = cmd.trim();
    if (!c) return;
    setHistory((h) => [mockExec(c, inst), ...h].slice(0, 4));
    setCmd("");
  };

  const field = (label: string, value: React.ReactNode, color?: string) => (
    <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
      {label} <span style={{ fontFamily: MONO, color: color ?? C.fg }}>{value}</span>
    </span>
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Run Command <ReleaseBadge r="R0" /> · POST /runtimes/{midId(inst.id)}/exec
        </span>
        <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>one command per submission</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); }}
          placeholder="e.g. python main.py --input /app/input/in.json"
          style={{ flex: 1, background: C.pillBg, color: C.fg, border: `1px solid ${C.border}`, outline: "none", borderRadius: 8, padding: "8px 10px", fontFamily: MONO, fontSize: 12 }}
        />
        <button onClick={run} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, background: C.lime, color: C.limeText, border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>Run</button>
      </div>
      <span style={{ display: "block", marginTop: 6, fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
        Replaces Open Shell for Runtime 2.0 instances. Not a terminal — no persistent session, stdin, PTY, retained <span style={{ fontFamily: MONO }}>cd</span>, or Ctrl-C.
        Over the parallel execution cap a run is rejected immediately as retryable, never silently queued.
        Closing this pane does not stop the command, and every result stays retrievable by
        <span style={{ fontFamily: MONO }}> execution_id</span> after the Runtime is suspended, fails, or is deleted.
        Suspend and Delete cancel a running execution; the result is kept.
      </span>
      {history.map((ex, i) => (
        <div key={ex.id} style={{ marginTop: 10, background: "#000", border: `1px solid ${i === 0 ? C.border : C.borderSoft}`, borderRadius: 6, padding: "10px 12px", fontFamily: MONO, fontSize: 12, lineHeight: "20px", opacity: i === 0 ? 1 : 0.72 }}>
          <div style={{ color: C.lime }}>$ {ex.command}</div>
          {ex.stdout && <div style={{ color: C.fg, whiteSpace: "pre-wrap" }}>{ex.stdout}</div>}
          {ex.stderr && <div style={{ color: "#fca5a5", whiteSpace: "pre-wrap" }}>{ex.stderr}</div>}
          {(ex.stdoutTruncated || ex.stderrTruncated) && (
            <div style={{ color: C.warn, fontFamily: FONT, fontSize: 11, marginTop: 2 }}>
              Output truncated at the size limit — {ex.stdoutTruncated ? "stdout_truncated" : "stderr_truncated"}: true. The call still succeeded.
            </div>
          )}
          {ex.terminationReason && (
            <div style={{ color: "#fdba74", fontFamily: FONT, fontSize: 11, marginTop: 2 }}>
              {ex.terminationReason} · the Runtime stays Running.
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.borderSoft}` }}>
            {field("execution_id", ex.id)}
            {field("status", ex.status, EXEC_STATUS_COLOR[ex.status])}
            {field("exit_code", ex.exitCode === null ? "null" : ex.exitCode, ex.exitCode === 0 ? C.ok : ex.exitCode === null ? C.muted : C.err)}
          </div>
        </div>
      ))}
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
        {isLive ? "Manage Listing" : "Publish Agent"}
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
// Secondary lifecycle verbs only. Every *view* (details, logs, run, usage,
// endpoints, files) is one row click away in the drawer, so nothing is reachable
// through this menu alone.
// §4.8 — for 2.0 instances the old "Terminate" control IS F-04 Delete: same path,
// same semantics, and no surface may offer a terminate that leaves storage behind.
type RowAction = "suspend" | "resume" | "keep" | "delete" | "snapshot" | "convert" | "retry";

function InstanceRowMenu({
  inst, onAction, onOpenDetail, canConvert = false, dropUp = false,
}: {
  inst: Instance;
  onAction: (id: string, action: RowAction) => void;
  onOpenDetail: (id: string, tab?: DrawerTab) => void;
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

  // Lifecycle actions by state — the §4.1 transition matrix is authoritative.
  type MenuAction = { action: RowAction; label: string; icon: React.ReactNode; release?: Release; danger?: boolean; title?: string };
  const lifecycle: MenuAction[] = [];
  if (inst.status === "running") {
    lifecycle.push({ action: "snapshot", label: "Save as Snapshot", icon: <IconSnapshot />, release: "R1" });
  }
  // Snapshot from Suspended is conditional on Q8. While it's unresolved AgentBox
  // never silently resumes: Resume → Snapshot → Suspend stays three steps.
  if (inst.status === "suspended" && CAP.snapshotFromSuspended && canConvert) {
    lifecycle.push({ action: "convert", label: "Save as Snapshot", icon: <IconSnapshot />, release: "R1?" });
  }
  // F-04 / §4.2 — Delete is available from every non-terminal state, confirmed or
  // not, and is never rejected as a lifecycle conflict. Deleting is an idempotent
  // no-op, so the entry drops once release is already under way.
  if (inst.status !== "deleted" && inst.status !== "deleting") {
    lifecycle.push({
      action: "delete", label: "Delete Instance", icon: <IconTrash />, danger: true,
      title: "Available in every state — an in-flight or unconfirmed operation is aborted or awaited internally, then release proceeds.",
    });
  }

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
          width: 26, height: 26,
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
              title={it.title}
              onClick={() => { setOpen(false); onAction(inst.id, it.action); }}
              style={itemStyle(false, it.danger)}
            >
              {it.icon}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.release && <ReleaseBadge r={it.release} />}
            </button>
          ))}
          {lifecycle.length > 0 && (
            <div style={{ height: 1, background: C.borderSoft, margin: "4px 6px" }} />
          )}
          {/* Kept as a fallback path to the drawer for keyboard/menu users —
              the row itself is the primary way in. */}
          <button onClick={() => { setOpen(false); onOpenDetail(inst.id); }} style={itemStyle(false)}>
            <IconConfig /> Open detail
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Confirm dialog — replaces native window.confirm() ──────────────────
// Single shared dialog for any destructive action (Delete instance, Delete
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
  open, agentName, agentVersion, image, endpoints, savedConfig, onCancel, onSubmit,
}: {
  open: boolean;
  agentName: string;
  agentVersion: string;
  image?: string;
  endpoints: AgentEndpoint[];
  savedConfig: SavedLaunchConfig;
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
  // P-02 — declared-Endpoint traffic counts as activity by default (D-05 opt-out).
  const [endpointActivity, setEndpointActivity] = useState(true);
  // F-08 — starts from the Saved Launch Configuration; this field is the optional
  // per-Runtime override. Empty means the saved model is action_required and the
  // launcher has to confirm one before create is allowed (rule 4).
  const [model, setModel] = useState("");
  // §4.7 — customer metadata, set at create.
  const [meta, setMeta] = useState<MetaEntry[]>([]);
  // Lifecycle defaults to a collapsed timeline + summary; controls reveal on Customize.
  const [showLifecycle, setShowLifecycle] = useState(false);
  // .env import — parse KEY=VALUE lines into override rows
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const modelBlocked = savedConfig.status === "action_required";
  // Re-seed the model field from the launcher's saved default each time the modal
  // opens, so switching Agents can't carry a stale selection across.
  useEffect(() => {
    if (open) setModel(savedConfig.status === "ok" ? savedConfig.model : "");
  }, [open, savedConfig.model, savedConfig.status]);

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
    setEndpointActivity(true);
    setModel(savedConfig.status === "ok" ? savedConfig.model : "");
    setMeta([]);
    setShowLifecycle(false);
    setImportOpen(false);
    setImportText("");
  };

  const close = () => { resetState(); onCancel(); };

  const canCreate = model !== "";
  const submit = () => {
    if (!canCreate) return;
    onSubmit({
      name: name.trim() || undefined,
      envOverrides: env.filter((e) => e.key.trim().length > 0),
      maxLifetime,
      idleTimeout,
      endpointActivity,
      model,
      metadata: meta.filter((m) => m.key.trim().length > 0),
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

  // A filled-in form shouldn't be destroyed by a stray click, so the backdrop
  // only dismisses while the form is still untouched.
  const dirty =
    name.trim() !== "" ||
    env.some((e) => e.key.trim() || e.value.trim()) ||
    meta.some((m) => m.key.trim() || m.value.trim()) ||
    maxLifetime !== TEMPLATE_DEFAULT_CONFIG.maxLifetime ||
    idleTimeout !== TEMPLATE_DEFAULT_CONFIG.idleTimeout ||
    (savedConfig.status === "ok" && model !== savedConfig.model) ||
    (savedConfig.status === "action_required" && model !== "");

  return (
    <>
      {/* Dimmed backdrop — this panel is a transient task, unlike the instance
          drawer which reserves layout width and lets you keep browsing. */}
      <div
        onClick={() => { if (!dirty) close(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 950,
          background: "rgba(0,0,0,0.5)",
          cursor: dirty ? "default" : "pointer",
        }}
      />
      <aside
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: DRAWER_WIDTH, maxWidth: "100%",
          zIndex: 960,
          background: C.cardSolid,
          borderLeft: `1px solid ${C.border}`,
          boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
          display: "flex", flexDirection: "column",
          animation: "drawer-in 180ms ease-out",
        }}
      >
        {/* Header */}
        <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.fg, margin: 0 }}>
              Launch instance {agentName && <span style={{ color: C.muted, fontWeight: 500 }}> — {agentName}</span>}
            </h3>
            <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "4px 0 0", lineHeight: "16px" }}>
              Provision a new container instance from this deployment.
            </p>
          </div>
          <button
            onClick={close}
            aria-label="Close launch panel"
            style={{ flexShrink: 0, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, cursor: "pointer" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, minHeight: 0, padding: "16px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Runtime Template (F-01) — read-only. In R1 a Runtime launches from a
              Ready Template produced by the Agent Version build: the image pull and
              dependency install happen at register time, never at create time. */}
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Runtime Template <span style={{ letterSpacing: "normal", textTransform: "none", fontWeight: 500 }}>· {agentVersion}</span>
            </span>
            <code style={{
              ...inputStyle,
              color: C.muted,
              display: "flex", alignItems: "center",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {image || "ghcr.io/mjs-gmi/openclaw-gmi:latest"}
            </code>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
              Prepared when the Agent Version was registered — no image pull or dependency install at launch.
            </span>
          </section>

          {/* Model selection (F-08) — precedence: this per-Runtime override >
              Saved Launch Configuration > the Agent Version's default. The resolved
              value is injected as locked GMI_MODEL_ID. */}
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Model</span>
              <ReleaseBadge r="IND" />
              <PlanBadge />
            </div>
            {modelBlocked && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 8, padding: "9px 11px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.err} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.fg, lineHeight: "17px" }}>
                  <span style={{ fontWeight: 600 }}>Action required</span> — the model saved for this Agent
                  (<span style={{ fontFamily: MONO }}>{savedConfig.model}</span>) is no longer offered to your Organization.
                  Your saved configuration is kept, but no Runtime is created until you confirm another model.
                  Nothing is substituted for you.
                </span>
              </div>
            )}
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                ...inputStyle, fontFamily: FONT, fontSize: 13, cursor: "pointer",
                borderColor: modelBlocked && !model ? "rgba(248,113,113,0.55)" : C.border,
              }}
            >
              {modelBlocked && <option value="">Select a model to continue</option>}
              <optgroup label="In your Coding Plan">
                {LAUNCH_MODELS.filter((m) => m.plan).sort((a, b) => Number(!!b.featured) - Number(!!a.featured)).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.featured ? " · Featured" : ""}</option>
                ))}
              </optgroup>
              {LAUNCH_MODELS.some((m) => !m.plan) && (
                <optgroup label="Other models">
                  {LAUNCH_MODELS.filter((m) => !m.plan).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
              {savedConfig.status === "ok"
                ? <>Saved default for this Agent: <span style={{ color: C.fg }}>{modelDisplayName(savedConfig.model)}</span>. </>
                : null}
              Injected as locked <span style={{ fontFamily: MONO }}>GMI_MODEL_ID</span> · applies only to Runtimes created after this change; running Runtimes are unaffected.
            </span>
          </section>

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
            <LifecycleTimeline maxActive={maxLifetime} />

            {!showLifecycle ? (
              /* Collapsed — one-line summary + Customize (defaults-first) */
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "16px" }}>
                  {durationLabel(maxLifetime)} active · pause &amp; keep disk · storage billing continues
                  {idleTimeout !== "off" && <> · pause when idle {durationLabel(idleTimeout)}</>}
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

                {/* Pause when inactive (P1-7) — optional toggle + timeout */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={idleTimeout !== "off"}
                      onChange={(e) => setIdleTimeout(e.target.checked ? "15min" : "off")}
                      style={{ accentColor: C.lime, width: 15, height: 15, cursor: "pointer" }}
                    />
                    <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.fg }}>
                      Pause when inactive <span style={{ color: C.muted, fontWeight: 400 }}>· optional</span>
                    </span>
                  </label>
                  {idleTimeout !== "off" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 23 }}>
                      <select value={idleTimeout} onChange={(e) => setIdleTimeout(e.target.value)} style={{ ...inputStyle, fontFamily: FONT, fontSize: 13, cursor: "pointer" }}>
                        <option value="15min">15 min</option>
                        <option value="30min">30 min</option>
                        <option value="1h">1 hour</option>
                      </select>
                      {/* P-02 activity definition — exec and file I/O always reset the
                          timer; declared-Endpoint traffic counts by default (D-05). */}
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={endpointActivity}
                          onChange={(e) => setEndpointActivity(e.target.checked)}
                          style={{ accentColor: C.lime, width: 14, height: 14, marginTop: 2, cursor: "pointer" }}
                        />
                        <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.fg, lineHeight: "16px" }}>
                          Count traffic to declared Endpoints as activity
                          <span style={{ color: C.muted }}> · on by default</span>
                        </span>
                      </label>
                      <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                        Run Command and file transfer always reset the timer. Health checks, probes, rejected requests, and platform traffic never do.
                        This policy only pauses a Runtime — it never deletes one.
                      </span>
                    </div>
                  )}
                </div>

                {/* Read-only policy row — action at the active limit (never deletes) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12 }}>
                    <span style={{ color: C.muted }}>When the limit is reached</span>
                    <span style={{ color: C.fg, display: "inline-flex", alignItems: "center", gap: 5 }}><IconSuspend size={11} /> Pause &amp; keep disk</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12 }}>
                    <span style={{ color: C.muted }}>While paused</span>
                    <span style={{ color: C.fg }}>Storage billing continues until Resume or Delete</span>
                  </div>
                  <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                    Set at launch and fixed for this Runtime in R1. Running and pausing time count toward the limit, paused time doesn't,
                    and a successful Resume resets the clock. Deleting at the limit would need an explicit opt-in — it is never the default.
                  </span>
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

          {/* Endpoints — declared on the Agent (Register → Networking), read-only here */}
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: C.muted, display: "inline-flex" }}><IconNetwork size={13} /></span>
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Endpoints</span>
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 0.7fr 0.8fr", gap: 6, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${C.borderSoft}`, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted }}>
                <span>Name</span><span>Port</span><span>Protocol</span><span>Access</span>
              </div>
              {endpoints.map((ep) => (
                <div key={ep.id} style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 0.7fr 0.8fr", gap: 6, padding: "7px 10px", borderBottom: `1px solid ${C.borderSoft}`, alignItems: "center", fontFamily: "'GeistMono', monospace", fontSize: 12, color: C.fg }}>
                  <span>{ep.name}</span><span>:{ep.internalPort}</span><span>{ep.protocol}</span>
                  <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: ep.visibility === "public" ? "#fbbf24" : "#7dd3fc" }}>{ep.visibility === "public" ? "Public" : "Private"}</span>
                </div>
              ))}
            </div>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
              Endpoints come from the Agent. Their live URLs and tokens appear under Access once the instance is running —
              and a Running instance does not guarantee its Endpoint is Available.
            </span>
          </section>

          {/* Customer metadata (§4.7) — opaque key/value map, filterable in List */}
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>
                Metadata <span style={{ color: C.muted, fontWeight: 400 }}>· optional</span>
              </label>
              <ReleaseBadge r="R0" />
            </div>
            <MetadataEditor entries={meta} onChange={setMeta} />
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
              Opaque to AgentBox — never used for routing, quota, billing attribution, or access control. Returned by Get and List, and filterable in the instance list.
            </span>
          </section>
        </div>

        {/* Footer — pinned so Create is reachable without scrolling to the end */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderTop: `1px solid ${C.borderSoft}`, background: C.cardSolid }}>
          {/* F-01 acceptance — the call returns a durable Runtime ID immediately and
              never waits on provider acceptance; Running is only reported once
              readiness passes, and transition time is not billed (§4.5). */}
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px", maxWidth: 290 }}>
            Returns a Runtime ID right away in Pending. Running is reported only after readiness passes; starting time is not billed.
          </span>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
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
              disabled={!canCreate}
              title={canCreate ? undefined : "Confirm a model before creating a Runtime"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: FONT, fontSize: 13, fontWeight: 600,
                background: canCreate ? C.lime : "#3a3a1f", color: canCreate ? C.limeText : "#6b6b52",
                border: "none",
                padding: "6px 16px", borderRadius: 8, cursor: canCreate ? "pointer" : "not-allowed",
              }}
            >
              Create Instance
            </button>
          </div>
        </div>
      </aside>
    </>
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

// ─── Access section (Networking spec §2) — live endpoints for this instance ──
// Shows each endpoint's actual URL, Visibility (Private/Public) and Availability as
// SEPARATE badges, plus the private-endpoint access token (created once, rotatable).
function tokenTail(id: string): string {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().slice(0, 4).padStart(4, "0");
}
function newToken(): string {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "gmi_ep_"; for (let i = 0; i < 24; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
function MiniCopy({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { try { navigator.clipboard?.writeText(value); } catch { /* ignore */ } setOk(true); setTimeout(() => setOk(false), 1200); }}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FONT, fontSize: 11, fontWeight: 500, color: ok ? C.ok : C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
    >
      {ok ? "Copied" : "Copy"}
    </button>
  );
}

// F-03 Basic File I/O — single-file upload/download on a Running Runtime. No
// directory browser. Files follow the Runtime disk lifecycle (not persistence).
function FilesSection({ inst }: { inst: Instance }) {
  const running = inst.status === "running";
  const [path, setPath] = useState("/app/output/result.json");
  const [msg, setMsg] = useState<string | null>(null);
  const cellInput: React.CSSProperties = {
    flex: 1, minWidth: 0, background: running ? C.pillBg : "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
    color: running ? C.fg : C.muted, fontFamily: "'GeistMono', monospace", fontSize: 12, padding: "7px 10px", borderRadius: 8, outline: "none",
  };
  const btn = (label: string): React.CSSProperties => ({
    fontFamily: FONT, fontSize: 12, fontWeight: 600, background: running ? "transparent" : "transparent",
    color: running ? C.fg : "#5a5a5a", border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px",
    cursor: running ? "pointer" : "not-allowed", whiteSpace: "nowrap",
  });
  return (
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h4 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>Files</h4>
        <ReleaseBadge r="R1" />
        <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>R0 ships single-file upload/download over the API only</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={path} disabled={!running} onChange={(e) => setPath(e.target.value)} placeholder="/app/path/to/file" style={cellInput} />
        <button disabled={!running} onClick={() => setMsg(`Uploaded to ${path}`)} style={btn("Upload")}>Choose file…</button>
        <button disabled={!running} onClick={() => setMsg(`Downloaded ${path}`)} style={btn("Download")}>Download file</button>
      </div>
      {!running && <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>File transfer is available only while the instance is Running. Suspend and Delete cancel an in-flight transfer.</span>}
      {running && msg && <span style={{ fontFamily: FONT, fontSize: 11, color: C.ok }}>{msg} (mock)</span>}
      <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
        A path plus a file picker — one file at a time, no directory browser. A failed or oversize upload leaves no partial file;
        a failed download errors rather than silently truncating.
      </span>
      <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
        Files are stored on this Runtime. Deleting the Runtime permanently deletes files unless saved through a Snapshot or exported.
      </span>
    </div>
  );
}

function AccessSection({ inst, endpoints }: { inst: Instance; endpoints: AgentEndpoint[] }) {
  const [rotating, setRotating] = useState<AgentEndpoint | null>(null);
  const [rotated, setRotated] = useState<string | null>(null); // one-time new token to show
  const [tokenOwner, setTokenOwner] = useState<string | null>(null); // which endpoint it belongs to
  // F-06 — access may be tightened without restarting the Runtime. Declared
  // visibility is a default, not a lock: a launcher may only make it stricter.
  // Going Public needs Agent policy, Organization policy, and permission.
  const [visOverride, setVisOverride] = useState<Record<string, EndpointVisibility>>({});
  const [deleted, setDeleted] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<AgentEndpoint | null>(null);

  const linkBtn = (label: string, enabled: boolean, onClick?: () => void, primary = false): React.ReactNode => (
    <button
      disabled={!enabled}
      onClick={onClick}
      style={{
        fontFamily: FONT, fontSize: 12, fontWeight: 600,
        background: primary && enabled ? C.lime : "transparent",
        color: !enabled ? "#5a5a5a" : primary ? C.limeText : C.fg,
        border: `1px solid ${primary && enabled ? C.lime : C.border}`,
        padding: "5px 12px", borderRadius: 7, cursor: enabled ? "pointer" : "not-allowed",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: C.muted, display: "inline-flex" }}><IconNetwork size={14} /></span>
        <h4 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>Access</h4>
        <ReleaseBadge r="R1" />
        <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 11, color: C.muted }}>{endpoints.length} endpoint{endpoints.length === 1 ? "" : "s"}</span>
      </div>

      {endpoints.map((ep) => {
        const url = endpointUrlFor(inst.id, ep);
        const visibility = visOverride[ep.id] ?? ep.visibility;
        const isPublic = visibility === "public";
        const tightened = visibility !== ep.visibility;
        const st = deleted.includes(ep.id) ? "revoked" : endpointState(inst, ep); // F-06 — independent of Runtime state
        const meta = ENDPOINT_STATE_META[st];
        const canOpen = st === "available";
        const revoked = st === "revoked";
        // curl with GMI authentication — "copy an authenticated request".
        const authRequest = `curl ${url} \\\n  -H "Authorization: Bearer $GMI_ENDPOINT_TOKEN"`;
        const note =
          deleted.includes(ep.id) ? "Deleted — the route, authenticated access, and any signed links are revoked. This URL is never reused for another tenant." :
          revoked ? "Revoked — this endpoint was torn down with the instance." :
          (st === "unavailable" && (inst.status === "suspended" || inst.status === "suspending"))
            ? "Unavailable while the instance is suspended. The URL will remain unchanged after it resumes." :
          st === "unavailable" ? `Service unavailable — check the app is listening on 0.0.0.0:${ep.internalPort}.` :
          st === "pending" ? "Route is starting — the URL is reserved and becomes reachable shortly." :
          st === "error" ? "Endpoint error — route or tunnel failed. The URL is unchanged; retrying automatically." :
          null;
        return (
          <div key={ep.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, opacity: revoked ? 0.6 : 1 }}>
            {/* Header: name + two SEPARATE badges — Visibility · Endpoint state */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>{ep.name}</span>
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: isPublic ? "#fbbf24" : "#7dd3fc", background: isPublic ? "rgba(251,191,36,0.14)" : "rgba(125,211,252,0.14)", border: `1px solid ${isPublic ? "rgba(251,191,36,0.45)" : "rgba(125,211,252,0.45)"}`, padding: "1px 7px", borderRadius: 5 }}>{isPublic ? "Public" : "Private"}</span>
              <span title="Endpoint state — independent of the instance's runtime state" style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: meta.color, background: `${meta.color}1f`, border: `1px solid ${meta.color}55`, padding: "1px 7px", borderRadius: 5 }}>{meta.label}</span>
            </div>

            {/* URL + copy */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: "'GeistMono', monospace", fontSize: 12, color: revoked ? C.muted : C.fg, textDecoration: revoked ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
              {!revoked && <MiniCopy value={url} />}
            </div>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>Internal port {ep.internalPort} · {ep.protocol}</span>

            {isPublic && !revoked && (
              <div style={{ fontFamily: FONT, fontSize: 11, color: "#fbbf24", lineHeight: "15px" }}>
                ⚠ Anyone with this URL can access the service.
              </div>
            )}

            {note && (
              <div style={{ fontFamily: FONT, fontSize: 11, color: st === "error" ? C.err : C.muted, lineHeight: "16px" }}>{note}</div>
            )}

            {!isPublic && !revoked && (
              /* Private → GMI-managed authentication (D-11). Reset invalidates
                 existing access without changing the URL. */
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontFamily: FONT, fontSize: 11, color: C.muted }}>
                <span>GMI authentication · token ending in <span style={{ fontFamily: MONO, color: C.fg }}>••••{tokenTail(ep.id)}</span></span>
                <button onClick={() => setRotating(ep)} title="Invalidates existing authenticated access. The URL does not change." style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.fg, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Reset access</button>
              </div>
            )}

            {/* Actions — Open needs Available; visibility can only be tightened */}
            {!revoked && (
              <div style={{ display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                {linkBtn("Open endpoint", canOpen, () => window.open(url, "_blank"), true)}
                {!isPublic && linkBtn("Copy authenticated request", true, () => { try { navigator.clipboard?.writeText(authRequest); } catch { /* ignore */ } })}
                {isPublic
                  ? linkBtn("Make Private", true, () => setVisOverride((v) => ({ ...v, [ep.id]: "private" })))
                  : linkBtn("Make Public", false, undefined)}
                {linkBtn("Delete endpoint", true, () => setConfirmDelete(ep))}
              </div>
            )}

            {!revoked && !isPublic && ep.visibility === "private" && (
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
                Making this Endpoint Public requires Agent policy, Organization policy, and sufficient permission — access can always be tightened, never loosened, from here.
                Signed links with an explicit expiry are conditional in R1.
              </span>
            )}
            {tightened && (
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.ok, lineHeight: "15px" }}>
                Tightened to Private for this Runtime — applied without a restart. The Agent's declared default is unchanged.
              </span>
            )}

            {/* Inline confirmations — the drawer is already a panel, so these
                never open a second dialog on top of it. */}
            {rotating?.id === ep.id && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.fg, lineHeight: "17px" }}>
                  Reset access? Existing authenticated access stops working immediately, including anything already issued. The URL does not change.
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  {linkBtn("Reset access", true, () => { setRotated(newToken()); setTokenOwner(ep.id); setRotating(null); }, true)}
                  {linkBtn("Cancel", true, () => setRotating(null))}
                </div>
              </div>
            )}
            {confirmDelete?.id === ep.id && (
              <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.fg, lineHeight: "17px" }}>
                  Delete <span style={{ fontFamily: MONO }}>{ep.name}</span>? The route, authenticated access, and any signed links are revoked.
                  The URL is never reused for another tenant, and the Runtime keeps running.
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setDeleted((d) => [...d, ep.id]); setConfirmDelete(null); }}
                    style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, background: C.err, color: "#0a0a0a", border: "none", padding: "5px 12px", borderRadius: 7, cursor: "pointer" }}
                  >
                    Delete endpoint
                  </button>
                  {linkBtn("Cancel", true, () => setConfirmDelete(null))}
                </div>
              </div>
            )}
            {rotated && rotating === null && confirmDelete === null && tokenOwner === ep.id && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase" }}>New access token</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 12, color: C.fg, overflow: "hidden", textOverflow: "ellipsis" }}>{rotated}</span>
                  <MiniCopy value={rotated} />
                </div>
                <span style={{ fontFamily: FONT, fontSize: 11, color: C.warn, lineHeight: "16px" }}>
                  Copy this token now — you will not be able to view it again.
                </span>
                <div style={{ display: "flex" }}>{linkBtn("Done", true, () => { setRotated(null); setTokenOwner(null); })}</div>
              </div>
            )}
          </div>
        );
      })}

      <p style={{ fontFamily: FONT, fontSize: 11, color: C.muted, margin: 0, lineHeight: "15px" }}>
        Endpoints are declared on the Agent (Register → Networking) and versioned with it — declaration changes affect only new Runtimes.
        Listening on an undeclared port never exposes it. The URL, visibility, and authentication survive Pause/Resume; Delete revokes them.
      </p>

    </div>
  );
}

// ─── Instance drawer (PRD §5.4) ──────────────────────────────────────────────
// Opens from a row click — no ⋮ → View Details hop — and slides in beside the
// list so the list stays visible and the next instance is one click away.
// Everything that used to be stacked in one scrolling popup is grouped into
// tabs, and the endpoint confirmations are inline instead of a second modal.
type DrawerTab = "overview" | "access" | "files" | "run" | "logs" | "config";
const DRAWER_TABS: { key: DrawerTab; label: string; runningOnly?: boolean }[] = [
  { key: "overview", label: "Overview" },
  { key: "access",   label: "Access" },
  { key: "files",    label: "Files" },
  { key: "run",      label: "Run",  runningOnly: true },
  { key: "logs",     label: "Logs" },
  { key: "config",   label: "Config" },
];
const DRAWER_WIDTH = 560;

function InstanceDrawer({
  inst, deploymentName, agentVersion, endpoints, idc, product, tab, onTab,
  onAction, onPatchMetadata, onClose,
}: {
  inst: Instance | null;
  deploymentName: string;
  agentVersion: string;
  endpoints: AgentEndpoint[];
  idc: string;
  product: string;
  tab: DrawerTab;
  onTab: (t: DrawerTab) => void;
  onAction: (id: string, action: RowAction) => void;
  onPatchMetadata: (id: string, next: MetaEntry[]) => void;
  onClose: () => void;
}) {
  if (!inst) return null;
  const running = inst.status === "running";
  const totalMins = durationMins(inst.maxActive);
  const start = inst.lifecycleStartedAt ? new Date(inst.lifecycleStartedAt.replace(" ", "T")).getTime() : null;
  const usedMins = start ? Math.max(0, Math.floor((Date.now() - start) / 60000)) : 0;
  const health =
    running ? { label: "HEALTHY", color: C.ok }
    : inst.status === "error" ? { label: "UNHEALTHY", color: C.err }
    : { label: "—", color: C.muted };

  const lockedEnv = [
    { key: "GMI_MODELS",        value: "58e99bbf-78ba-4807-9be5-53e762de9212" },
    { key: "GMI_MAAS_API_KEY",  value: "gmi_••••••••••••••••" },
    { key: "GMI_MAAS_BASE_URL", value: "https://api.gmi-serving.com" },
    { key: "DEPLOYMENT_TYPE",   value: "gmi-ce" },
  ];
  const overrides = inst.config?.envOverrides ?? [];

  // Task ID / Container ID / Access URL are deliberately absent: the row this
  // drawer opened from already shows the ID and the Access URL.
  const row = (label: string, value: React.ReactNode, mono = false) => (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, padding: "8px 0", borderTop: `1px solid ${C.borderSoft}`, alignItems: "center" }}>
      <span style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted }}>{label}</span>
      <span style={{ fontFamily: mono ? MONO : FONT, fontSize: 12.5, color: C.fg, fontWeight: 500, wordBreak: "break-all" }}>{value}</span>
    </div>
  );

  const actionBtn = (label: string, icon: React.ReactNode, action: RowAction, kind: "primary" | "ghost" | "danger") => (
    <button
      onClick={() => onAction(inst.id, action)}
      title={action === "delete" ? "Available in every state, confirmed or not — never rejected as a lifecycle conflict." : undefined}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: FONT, fontSize: 12.5, fontWeight: kind === "primary" ? 600 : 500,
        background: kind === "primary" ? C.lime : "transparent",
        color: kind === "primary" ? C.limeText : kind === "danger" ? C.err : C.fg,
        border: kind === "primary" ? "none" : `1px solid ${C.border}`,
        padding: "5px 11px", borderRadius: 7, cursor: "pointer",
      }}
    >
      {icon} {label}
    </button>
  );

  const visibleTabs = DRAWER_TABS.filter((t) => !t.runningOnly || running);
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : "overview";

  return (
    <aside
      style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: DRAWER_WIDTH, maxWidth: "100%",
        zIndex: 900,
        background: C.cardSolid,
        borderLeft: `1px solid ${C.border}`,
        boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
        display: "flex", flexDirection: "column",
        animation: "drawer-in 180ms ease-out",
      }}
    >
      {/* Header — identity, the three §4.1 status fields, and the lifecycle verbs */}
      <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {inst.config?.name || midId(inst.id)}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {inst.id}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close instance detail"
            style={{ flexShrink: 0, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, cursor: "pointer" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: statusDot(inst.status), background: `${statusDot(inst.status)}1f`, border: `1px solid ${statusDot(inst.status)}55`, padding: "2px 8px", borderRadius: 6 }}>
            {statusLabel(inst.status)}
          </span>
          {inst.unconfirmed && (
            <span title="Unknown provider outcome — last confirmed state shown while we reconcile (§4.1)" style={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 600, color: C.warn, background: `${C.warn}1f`, border: `1px solid ${C.warn}55`, padding: "1px 6px", borderRadius: 4 }}>
              Confirmation pending
            </span>
          )}
          {inst.latestOperation && (
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
              last op: <span style={{ color: inst.latestOperation.status === "unknown" ? C.warn : C.fg }}>{inst.latestOperation.kind} · {inst.latestOperation.status.replace("_", " ")}</span>
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          {running && actionBtn("Pause", <IconSuspend />, "suspend", "ghost")}
          {inst.status === "suspended" && actionBtn("Resume", <IconResume />, "resume", "primary")}
          {running && actionBtn("Create Snapshot", <IconSnapshot />, "snapshot", "ghost")}
          {(inst.status === "error" || inst.unconfirmed) && actionBtn("Retry", <IconRestart />, "retry", "ghost")}
          {inst.status !== "deleted" && inst.status !== "deleting" && actionBtn("Delete", <IconTrash />, "delete", "danger")}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "0 12px", borderBottom: `1px solid ${C.borderSoft}`, overflowX: "auto" }}>
        {visibleTabs.map((t) => {
          const on = t.key === activeTab;
          return (
            <button
              key={t.key}
              onClick={() => onTab(t.key)}
              style={{
                fontFamily: FONT, fontSize: 12.5, fontWeight: on ? 600 : 500,
                color: on ? C.fg : C.muted,
                background: "transparent", border: "none",
                borderBottom: `2px solid ${on ? C.lime : "transparent"}`,
                padding: "10px 10px", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 18px 22px" }}>
        {activeTab === "overview" && (
          <>
            {row("Deployment", deploymentName || "—")}
            {row("Agent Version", agentVersion, true)}
            {row("Model", modelDisplayName(inst.config?.model) + " · GMI_MODEL_ID")}
            {row("Health", <span style={{ display: "inline-flex", fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: health.color, background: `${health.color}1f`, border: `1px solid ${health.color}55`, padding: "2px 8px", borderRadius: 6 }}>{health.label}</span>)}
            {row("IDC", idc)}
            {row("Product", product, true)}
            {row("Public IP", "—")}
            {row("Created at", inst.created, true)}
            {row("Updated at", inst.latestOperation?.at ?? inst.created, true)}

            {/* Lifecycle (P-01 / P-02) */}
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <h4 style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: C.fg, margin: 0 }}>Lifecycle</h4>
                <ReleaseBadge r="R1" />
              </div>
              <DetailRow label="Maximum active runtime" value={durationLabel(inst.maxActive)} />
              <DetailRow label="Active time used" value={totalMins ? `${usedMins} min` : "—"} />
              <DetailRow label="Remaining" value={totalMins ? remainingLabel(totalMins - usedMins) : "No automatic limit"} />
              <DetailRow label="At the limit" value="Pause & keep disk" />
              <DetailRow label="Inactivity policy" value={inst.config?.idleTimeout && inst.config.idleTimeout !== "off" ? `Pause after ${durationLabel(inst.config.idleTimeout)}` : "Off"} />
            </div>

            {/* Storage & billing (§4.5) */}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              <h4 style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: C.fg, margin: 0 }}>Storage &amp; billing</h4>
              <DetailRow
                label="Storage"
                value={inst.status === "suspended" ? `Paused · charges continue (≈$${pausedCostMo(inst)}/mo)` : "Active (running)"}
                accent={inst.status === "suspended" ? "#60a5fa" : undefined}
              />
              <DetailRow label="Auto-deletion" value="Never — kept until you Resume or Delete" />
              <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px", marginTop: 2 }}>
                Starting, pausing, and resuming time is not billed. Compute metering starts when Running is confirmed and stops on a
                confirmed Pause or release. Resume is a fresh boot of the same disk: the ID and files are kept, memory, processes, and
                live connections are not. Exact charges live in Usage &amp; Billing.
              </div>
            </div>

            {/* Resource usage — glanceable here instead of its own row panel */}
            {running && (
              <div style={{ marginTop: 18 }}>
                <MetricsPane inst={inst} />
              </div>
            )}
          </>
        )}

        {activeTab === "access" && <AccessSection inst={inst} endpoints={endpoints} />}
        {activeTab === "files"  && <FilesSection inst={inst} />}
        {activeTab === "run"    && <ShellPane inst={inst} />}
        {activeTab === "logs"   && <LogsPane inst={inst} />}

        {activeTab === "config" && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <h4 style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: C.fg, margin: 0 }}>Metadata</h4>
                <ReleaseBadge r="R0" />
              </div>
              <MetadataEditor
                entries={inst.config?.metadata ?? []}
                onChange={(next) => onPatchMetadata(inst.id, next)}
              />
            </div>

            <div style={{ marginTop: 20 }}>
              <h4 style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: C.fg, margin: "0 0 2px" }}>Environment variables</h4>
              <p style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted, margin: "0 0 10px", lineHeight: "16px" }}>
                What this instance was created with. Platform keys are locked; overrides were fixed at create.
              </p>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 0.7fr", gap: 6, padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${C.borderSoft}`, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted }}>
                  <span>Key</span><span>Value</span><span>Type</span>
                </div>
                {lockedEnv.map((e) => (
                  <div key={e.key} style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 0.7fr", gap: 6, padding: "8px 10px", alignItems: "center", borderBottom: `1px solid ${C.borderSoft}`, fontFamily: MONO, fontSize: 11.5 }}>
                    <span style={{ color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.key}</span>
                    <span style={{ color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.value}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FONT, fontSize: 11, color: C.muted }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Locked
                    </span>
                  </div>
                ))}
                {overrides.map((e) => (
                  <div key={e.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 0.7fr", gap: 6, padding: "8px 10px", alignItems: "center", borderBottom: `1px solid ${C.borderSoft}`, fontFamily: MONO, fontSize: 11.5 }}>
                    <span style={{ color: C.lime, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.key || "—"}</span>
                    <span style={{ color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.value || "—"}</span>
                    <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>Custom</span>
                  </div>
                ))}
                {overrides.length === 0 && (
                  <div style={{ padding: "9px 10px", fontFamily: FONT, fontSize: 11.5, color: C.muted }}>No custom overrides.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

// ─── Monitor pane ─────────────────────────────────────────────────────────
function MonitorPane({
  agent, instances, onProvision, onAction, onOpenDetail, activeInstanceId, canConvert = false,
}: {
  agent: MyAgent;
  instances: Instance[];
  onProvision: (agentId: string) => void;
  onAction: (id: string, action: RowAction) => void;
  // A row click opens the drawer. Logs / Run Command / resource usage live there
  // too, so nothing expands inline and no view is reachable through ⋮ only.
  onOpenDetail: (id: string, tab?: DrawerTab) => void;
  activeInstanceId: string | null;
  canConvert?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "running" | "paused" | "inprogress" | "error">("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc"); // Launched column sort

  const agg = useMemo(() => aggregateFor(instances, agent.id), [instances, agent.id]);
  const mine = useMemo(() => instances.filter((i) => i.agentId === agent.id), [instances, agent.id]);
  const filtered = useMemo(() => {
    const rows = mine.filter((i) => {
      // PRD v2.3 filter groups (Status/Lifecycle/operation kept as separate concepts).
      const inProgress = ["creating", "pending", "suspending", "resuming", "deleting"].includes(i.status);
      if (filter === "running" && i.status !== "running") return false;
      if (filter === "paused" && i.status !== "suspended") return false;
      if (filter === "inprogress" && !inProgress) return false;
      if (filter === "error" && !(i.status === "error" || i.unconfirmed)) return false;
      if (search) {
        // §4.7 — List must be filterable by metadata key and value, or the field
        // is unusable at fleet scale. "key=value" filters metadata explicitly;
        // anything else falls back to name / ID / metadata substring.
        const hay = `${i.config?.name ?? ""} ${i.id}`.toLowerCase();
        const q = search.toLowerCase();
        if (q.includes("=")) return metadataMatches(i.config?.metadata, q);
        if (!hay.includes(q) && !metadataMatches(i.config?.metadata, q)) return false;
      }
      return true;
    });
    // `created` is "YYYY-MM-DD HH:MM:SS" — lexicographic order == chronological.
    rows.sort((a, b) =>
      sortDir === "desc" ? b.created.localeCompare(a.created) : a.created.localeCompare(b.created),
    );
    return rows;
  }, [mine, filter, search, sortDir]);

  // Shared row-action button styles so every action reads as one consistent set
  // (uniform height, padding, radius) instead of ad-hoc per-button inline styles.
  const rowBtnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
    height: 26, padding: "0 10px", borderRadius: 7,
    fontFamily: FONT, fontSize: 12, fontWeight: 500, lineHeight: "26px",
    cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap",
  };
  const rowBtnGhost: React.CSSProperties = { ...rowBtnBase, color: C.fg, background: "transparent", border: `1px solid ${C.border}` };
  const rowBtnPrimary: React.CSSProperties = { ...rowBtnBase, color: C.limeText, background: C.lime, border: "none", fontWeight: 600 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Instance Overview — rollup across this agent's instances */}
      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 12px" }}>
          Instance Overview
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <MetricCard label="Running" value={String(agg.active)} helper="status = running" accent={C.ok} />
          <MetricCard label="Error" value={String(agg.error)} helper="red tab badge if > 0" accent={C.err} />
          <MetricCard label="Starting" value={String(agg.creating)} helper="status = starting" accent={C.warn} />
          <MetricCard label="Last Launched" value={agg.lastProvisioned ? agoLabel(agg.lastProvisioned) : "—"} helper="max(createdAt)" accent={C.muted} />
        </div>
      </section>

      {/* Instances — header is just a label now; "+ Instance" lives in
          the agent detail header next to Manage Listing ▼. */}
      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 4px" }}>
          Instances
        </h3>
        <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "16px", color: C.muted, margin: "0 0 12px" }}>
          Create returns a Runtime ID immediately in Pending — Running is reported only once readiness passes.
          Filter by customer metadata with <span style={{ fontFamily: MONO }}>key=value</span>.
          Snapshotting a paused instance means Resume → Snapshot → Pause: three explicit steps, never a silent resume.
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", flex: 1, maxWidth: 420 }}>
            <span style={{ position: "absolute", left: 10, color: C.muted, display: "flex" }}>
              <IconSearch />
            </span>
            <input
              type="text"
              placeholder="Search by name, ID, or metadata (tenant=acme)"
              title="Metadata filter — type key=value to filter by customer metadata (§4.7)"
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
              { value: "paused", label: "Paused" },
              { value: "inprogress", label: "In progress" },
              { value: "error", label: "Failed·Unconfirmed" },
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
            <div>Instance</div>
            <div>Access URL</div>
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
              Launched
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9, transform: sortDir === "asc" ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div style={{ textAlign: "right" }}>Actions</div>
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
              const active = inst.id === activeInstanceId;
              return (
                <div key={inst.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    title="Open instance detail"
                    onClick={() => onOpenDetail(inst.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenDetail(inst.id); } }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1.5fr 0.9fr 1.35fr 0.85fr 1.25fr",
                      padding: "10px 16px",
                      borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
                      borderLeft: `2px solid ${active ? C.lime : "transparent"}`,
                      background: active ? "rgba(221,234,77,0.06)" : "transparent",
                      fontFamily: FONT, fontSize: 13, fontWeight: 400, color: C.fg, lineHeight: "20px",
                      alignItems: "center",
                      cursor: "pointer",
                      animation: "row-fade-in 220ms ease-out",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        title={inst.config?.name || inst.id}
                        style={{ color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {inst.config?.name || midId(inst.id)}
                      </div>
                      {/* §4.7 — metadata is how an orchestrator recognizes its own
                          resources in a fleet list, so it shows on the row. */}
                      {(inst.config?.metadata?.length ?? 0) > 0 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 2, overflow: "hidden" }}>
                          {inst.config!.metadata!.slice(0, 2).map((m) => (
                            <span
                              key={m.id}
                              title={`${m.key}=${m.value}`}
                              onClick={(e) => { e.stopPropagation(); setSearch(`${m.key}=${m.value}`); }}
                              style={{ fontFamily: MONO, fontSize: 10, color: C.muted, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.borderSoft}`, borderRadius: 4, padding: "0 5px", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 96 }}
                            >
                              {m.key}={m.value}
                            </span>
                          ))}
                          {inst.config!.metadata!.length > 2 && (
                            <span style={{ fontFamily: FONT, fontSize: 10, color: C.muted }}>+{inst.config!.metadata!.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div
                      title={inst.status === "suspended" ? "Endpoint is unavailable while suspended" : inst.endpointUrl}
                      style={{ fontFamily: inst.status === "suspended" ? FONT : "'GeistMono', monospace", fontSize: 12, color: inst.endpointUrl && inst.status !== "suspended" ? C.muted : C.borderSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {inst.status === "suspended" ? "Unavailable while paused"
                        : inst.endpointUrl ? inst.endpointUrl.replace(/^https?:\/\//, "") : "—"}
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center" }}>
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontFamily: FONT, fontSize: 11, fontWeight: 600, lineHeight: "16px",
                          letterSpacing: "0.04em",
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
                      {inst.unconfirmed && (
                        <span
                          title="Unknown provider outcome — last confirmed state shown while we reconcile (§4.1)"
                          style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 3, fontFamily: FONT, fontSize: 10, fontWeight: 600, color: C.warn, background: `${C.warn}1f`, border: `1px solid ${C.warn}55`, padding: "1px 6px", borderRadius: 4 }}
                        >
                          Confirmation pending
                        </span>
                      )}
                    </div>
                    {/* Lifecycle — active-runtime limit (Running) vs paused cost reminder.
                        PRD v2.3: paused instances are never auto-deleted — no countdown. */}
                    {(() => {
                      if (inst.status === "running") {
                        return <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={activeRemaining(inst)}>{activeRemaining(inst)}</div>;
                      }
                      if (inst.status === "suspended") {
                        const label = `${pausedLifecycleLabel()} (≈$${pausedCostMo(inst)}/mo)`;
                        return (
                          <div title={label} style={{ fontSize: 12, color: "#60a5fa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {label}
                          </div>
                        );
                      }
                      return <div style={{ fontSize: 12, color: C.muted }}>—</div>;
                    })()}
                    <div style={{ color: C.muted }}>{agoLabel(inst.created)}</div>
                    {/* Row actions stop propagation so they never double as "open detail" */}
                    <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                      {inst.status === "running" && inst.endpointUrl && (
                        <a href={inst.endpointUrl} target="_blank" rel="noreferrer" title={inst.endpointUrl} style={rowBtnGhost}>
                          Open ↗
                        </a>
                      )}
                      {/* One primary lifecycle verb per state; the rest live in the drawer */}
                      {inst.status === "running" && (
                        <button onClick={() => onAction(inst.id, "suspend")} title="Pause compute and keep the instance files." style={rowBtnGhost}>
                          <IconSuspend /> Pause
                        </button>
                      )}
                      {inst.status === "suspended" && (
                        <button onClick={() => onAction(inst.id, "resume")} title="Resume the instance from its kept files." style={rowBtnPrimary}>
                          <IconResume /> Resume
                        </button>
                      )}
                      {inst.status === "error" && (
                        <button onClick={() => onOpenDetail(inst.id, "logs")} title="Open the failure reason and state history" style={rowBtnGhost}>
                          View error
                        </button>
                      )}
                      {(inst.status === "error" || inst.unconfirmed) && (
                        <button onClick={() => onAction(inst.id, "retry")} title={inst.unconfirmed ? "Re-check the provider outcome" : "Retry creation"} style={rowBtnPrimary}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                          Retry
                        </button>
                      )}
                      <InstanceRowMenu
                        inst={inst}
                        canConvert={canConvert}
                        dropUp={filtered.length > 1 && i >= filtered.length - 1}
                        onAction={onAction}
                        onOpenDetail={onOpenDetail}
                      />
                    </div>
                  </div>
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
  // R0 quick start — the whole release loop as copyable calls. R0 does not ship
  // without the exec step, and every call carries a request_id so a retry can
  // never produce a second Runtime, execution, file, or charge (§4.2).
  const curl = [
    "# 0. Authenticate — organization_id is derived from the key, never sent",
    "export GMI_API_KEY=...   # https://console.gmicloud.ai/api-keys",
    "",
    "# 1. Create a Runtime → durable runtime_id, state = pending",
    `curl -X POST https://api.gmicloud.ai/v1/agents/${agent.id}/runtimes \\`,
    "  -H \"Authorization: Bearer $GMI_API_KEY\" -H \"Content-Type: application/json\" \\",
    "  -d '{\"request_id\": \"req-001\", \"metadata\": {\"tenant\": \"acme-corp\"}}'",
    "",
    "# 2. Wait for Ready — exec and file transfer work the moment state = running",
    "curl https://api.gmicloud.ai/v1/runtimes/$RUNTIME_ID \\",
    "  -H \"Authorization: Bearer $GMI_API_KEY\"",
    "  # -> state, confirmation_status, latest_operation, metadata",
    "",
    "# 3. Upload the input file (single file, at most once per request_id)",
    "curl -X PUT \"https://api.gmicloud.ai/v1/runtimes/$RUNTIME_ID/files?path=/app/input/in.json\" \\",
    "  -H \"Authorization: Bearer $GMI_API_KEY\" -H \"X-Request-Id: req-002\" \\",
    "  --data-binary @in.json",
    "",
    "# 4. Exec — synchronous wait; status: running means keep the execution_id",
    "curl -X POST https://api.gmicloud.ai/v1/runtimes/$RUNTIME_ID/exec \\",
    "  -H \"Authorization: Bearer $GMI_API_KEY\" -H \"Content-Type: application/json\" \\",
    "  -d '{\"command\": \"python main.py --input /app/input/in.json\",",
    "       \"cwd\": \"/app\", \"execution_timeout\": 300, \"request_id\": \"req-003\"}'",
    "  # -> execution_id, status, exit_code, stdout, stderr, stdout_truncated",
    "",
    "# 5. Result + logs — readable without backend access, even after Delete",
    "curl https://api.gmicloud.ai/v1/executions/$EXECUTION_ID -H \"Authorization: Bearer $GMI_API_KEY\"",
    "curl https://api.gmicloud.ai/v1/runtimes/$RUNTIME_ID/logs -H \"Authorization: Bearer $GMI_API_KEY\"",
    "",
    "# 6. Download the output file",
    "curl -o result.json \\",
    "  \"https://api.gmicloud.ai/v1/runtimes/$RUNTIME_ID/files?path=/app/output/result.json\" \\",
    "  -H \"Authorization: Bearer $GMI_API_KEY\"",
    "",
    "# 7. Delete — Deleted is reported only after release is confirmed",
    "curl -X DELETE https://api.gmicloud.ai/v1/runtimes/$RUNTIME_ID \\",
    "  -H \"Authorization: Bearer $GMI_API_KEY\"",
    "",
    "# 8. Final usage — the record is final after Delete and stops growing",
    "curl https://api.gmicloud.ai/v1/runtimes/$RUNTIME_ID/usage \\",
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
          <CopyButton value={agent.templateId} />
        </div>
      </section>

      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 4px", flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: 0 }}>
            Quick start — the R0 loop
          </h3>
          <ReleaseBadge r="R0" />
        </div>
        <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: "0 0 12px", lineHeight: "18px" }}>
          Authenticate → create → ready → upload input → exec → result / logs → download output → delete → final usage.
          Reusing a <span style={{ fontFamily: MONO }}>request_id</span> never creates a second Runtime, execution, file, or charge.
          AgentBox never defines which commands are valid — the command comes from your own image.
        </p>
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
            <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>bash</span>
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

// ─── Analytics pane — cost + usage by model + usage by API key ─────────────
function AnalyticsPane({ agent, instances, snapshots }: { agent: MyAgent; instances: Instance[]; snapshots: Snapshot[] }) {
  const cost = agentCostBreakdown(agent.id, instances, snapshots);
  const costLines = [
    { label: "Compute", note: "per active instance", val: cost.computeMo },
    { label: "Paused storage", note: `${cost.suspendedGiB} GiB`, val: cost.suspendedMo },
    { label: "Snapshot storage", note: `${cost.snapGiB.toFixed(1)} GiB`, val: cost.snapMo },
  ];
  const planPrice = discountPriceString(CODING_AGENT_PLAN.featuredModelInPrice);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Est. cost — the aggregate month-to-date estimate (PRD §4.5) */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 12px" }}>
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: 0 }}>Est. cost</h3>
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>estimate · exact charges in Usage &amp; Billing</span>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {costLines.map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontFamily: FONT, fontSize: 13, color: C.fg }}>{l.label} <span style={{ color: C.muted, fontSize: 11 }}>· {l.note}</span></span>
              <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: l.val > 0 ? C.fg : C.muted }}>{usd(l.val)}<span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}>/mo</span></span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 8, marginTop: 2 }}>
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>Est. total</span>
            <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: C.fg, letterSpacing: "-0.01em" }}>{usd(cost.total)}<span style={{ fontSize: 12, fontWeight: 500, color: C.muted }}>/mo</span></span>
          </div>
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>MaaS tokens billed pay-per-token, shown under Usage by model.</span>
        </div>
        {/* §4.5 Billing integrity — the customer-facing half of the contract. */}
        <ul style={{ margin: "10px 0 0", padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 4, fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
          <li>Every meter starts and stops on a confirmed state — never on request acceptance.</li>
          <li>Starting, pausing, and resuming time is free to you; GMI absorbs the provider cost for those states.</li>
          <li>Paused Runtimes bill retained disk only, from confirmed Pause until Resume or confirmed release.</li>
          <li>Snapshot storage bills from Ready — never during capture — on the reported billable size.</li>
          <li>Unconfirmed periods accrue provisional usage only; nothing is invoiced until reconciliation settles it.</li>
          <li>Failed, retried, or delayed operations never produce a duplicate or incorrect charge.</li>
        </ul>
      </section>

      {/* Usage by model — with the Coding Agent Plan rate in context */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 12px", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: 0 }}>Usage by model</h3>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <PlanBadge />
            <span style={{ fontFamily: FONT, fontSize: 12, color: C.muted }}>{CODING_AGENT_PLAN.featuredModelName}</span>
            {planPrice && <DiscountedPrice original={planPrice.original} discounted={planPrice.discounted} size={12} />}
          </div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 16px", display: "flex", alignItems: "center", justifyContent: "center", height: 220, fontFamily: FONT, fontSize: 13, color: C.muted }}>
          Chart placeholder — token volume by model over 1D / 7D / 30D / 90D
        </div>
      </section>

      {/* Usage by API key */}
      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 12px" }}>
          Usage by API key
        </h3>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px", fontFamily: FONT, fontSize: 13, color: C.muted }}>
          No API keys created yet. Generate one to call this Agent over HTTP.
        </div>
      </section>
    </div>
  );
}

// ─── Right detail pane ────────────────────────────────────────────────────
function AgentDetailPane({
  agent, instances, snapshots, image, savedConfig, onProvision, onAction, onOpenDetail, activeInstanceId,
  onSaveModel, onRevalidate, onRetryPrep, onReplaceImage, canConvert = false,
}: {
  agent: MyAgent;
  instances: Instance[];
  snapshots: Snapshot[];
  image?: RuntimeImage;
  savedConfig: SavedLaunchConfig;
  onProvision: (agentId: string) => void;
  onAction: (id: string, action: RowAction) => void;
  onOpenDetail: (id: string, tab?: DrawerTab) => void;
  activeInstanceId: string | null;
  onSaveModel: (agentId: string, model: string) => void;
  onRevalidate: (agentId: string) => void;
  onRetryPrep: (agentId: string) => void;
  onReplaceImage: (agentId: string) => void;
  canConvert?: boolean;
}) {
  const [tab, setTab] = useState<"monitor" | "integration" | "analytics">("monitor");
  // F-01 launch gate: the Template must be Ready. F-08 rule 4 adds a second gate —
  // an action_required saved model blocks creation until the launcher confirms one.
  const templateReady = isLaunchable(image);
  const modelBlocked = savedConfig.status === "action_required";
  const launchable = templateReady && !modelBlocked;
  // + Instance + Listing ▼ now share the top-right of the agent header.
  // Provisioning is the highest-frequency action so it gets the lime fill;
  // listing actions sit behind a single dropdown next to it.
  const headerActions = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={() => launchable && onProvision(agent.id)}
        disabled={!launchable}
        title={
          launchable ? "Launch a new instance"
            : modelBlocked ? "Blocked — confirm a model in the saved launch configuration below, then launch"
            : "Launch is available once the Runtime Template is validated and prepared"
        }
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: FONT, fontSize: 13, fontWeight: 600, lineHeight: "20px",
          background: launchable ? C.lime : "#3a3a1f", color: launchable ? C.limeText : "#6b6b52",
          border: "none",
          padding: "6px 14px", borderRadius: 8, cursor: launchable ? "pointer" : "not-allowed",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
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

      {/* Runtime Template — built from this Agent Version's config at register
          time; image pull and dependency install happen here, never at create.
          A Snapshot is the other thing entirely: captured from a live instance's
          disk (F-07). Image-based builds always belong to this track. */}
      {image && (() => {
        const notReady = !templateReady;
        const fields: [string, React.ReactNode][] = [
          ["Image", <span style={{ fontFamily: MONO }}>{image.url}:{image.tag}</span>],
          ["Digest", <span style={{ fontFamily: MONO, color: C.muted }}>{image.digest.slice(0, 26)}…</span>],
          ["Registry", image.registry],
          ["Architecture", image.architecture],
          ["Last validated", agoLabel(image.lastValidated)],
        ];
        return (
          <section style={{ border: `1px solid ${notReady ? "rgba(251,191,36,0.35)" : C.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, background: notReady ? "rgba(251,191,36,0.04)" : "transparent" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ display: "inline-flex", alignItems: "baseline", gap: 8, fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.fg, margin: 0 }}>
                Runtime Template
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: C.muted }}>{agentVersionName(agent.id, agent.name)}</span>
              </h3>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {[
                  { label: VALIDATION_LABEL[image.validation], color: validationColor(image.validation) },
                  { label: PREP_LABEL[image.preparation], color: prepColor(image.preparation) },
                ].map((s) => (
                  <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: s.color, background: `${s.color}1f`, border: `1px solid ${s.color}55`, padding: "2px 8px", borderRadius: 6 }}>
                    {(image.validation === "validating" || image.preparation === "preparing") && s.color === C.warn && (
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.color, animation: "pulse 1.2s ease-in-out infinite" }} />
                    )}
                    {s.label}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "6px 24px" }}>
              {fields.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: FONT, fontSize: 12, lineHeight: "20px" }}>
                  <span style={{ color: C.muted }}>{k}</span>
                  <span style={{ color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                </div>
              ))}
            </div>

            {image.compatibilityIssue && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontFamily: FONT, fontSize: 12, color: C.fg, lineHeight: "17px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "8px 12px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.err} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                <span><span style={{ fontWeight: 600 }}>Compatibility issue</span> — {image.compatibilityIssue}</span>
              </div>
            )}

            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
              Prepared once, at register time — creating a Runtime from a Ready Template pulls no image and installs no dependencies.
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {notReady && (
                <span style={{ flex: 1, minWidth: 180, fontFamily: FONT, fontSize: 11.5, color: C.warn, lineHeight: "16px" }}>
                  {image.validation === "incompatible" ? "Resolve the compatibility issue to enable Launch."
                    : image.preparation === "failed" ? "Preparation failed — retry to enable Launch."
                    : image.preparation === "stale" ? "Revalidation required before Launch."
                    : "Launch will be available once validation and preparation complete."}
                </span>
              )}
              {(image.preparation === "failed" || image.preparation === "stale") && (
                <button onClick={() => onRetryPrep(agent.id)} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.limeText, background: C.lime, border: "none", padding: "5px 12px", borderRadius: 7, cursor: "pointer" }}>Retry preparation</button>
              )}
              <button onClick={() => onRevalidate(agent.id)} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.fg, background: "transparent", border: `1px solid ${C.border}`, padding: "5px 12px", borderRadius: 7, cursor: "pointer" }}>Revalidate</button>
              <button onClick={() => onReplaceImage(agent.id)} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.fg, background: "transparent", border: `1px solid ${C.border}`, padding: "5px 12px", borderRadius: 7, cursor: "pointer" }}>Replace Image</button>
            </div>
          </section>
        );
      })()}

      {/* F-08 Saved Launch Configuration — launcher-owned, one model default per
          Agent. Changing it never rebuilds a Template, mutates a Snapshot, or
          alters the shared Agent for other launchers. */}
      <section style={{ border: `1px solid ${modelBlocked ? "rgba(248,113,113,0.4)" : C.border}`, background: modelBlocked ? "rgba(248,113,113,0.04)" : "transparent", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.fg, margin: 0 }}>Saved launch configuration</h3>
          <ReleaseBadge r="IND" />
          <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 11, color: C.muted }}>yours — not the Agent's</span>
        </div>

        {modelBlocked ? (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.err} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
            <span style={{ fontFamily: FONT, fontSize: 12, color: C.fg, lineHeight: "17px" }}>
              <span style={{ fontWeight: 600 }}>Action required</span> — <span style={{ fontFamily: MONO }}>{savedConfig.model}</span> is
              no longer offered to your Organization. Your configuration is kept as-is, and new Runtimes are blocked until you confirm a
              replacement. Nothing is substituted automatically.
            </span>
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, minWidth: 92 }}>Default model</span>
          <select
            value={modelBlocked ? "" : savedConfig.model}
            onChange={(e) => e.target.value && onSaveModel(agent.id, e.target.value)}
            style={{
              flex: 1, minWidth: 220, maxWidth: 340,
              background: C.pillBg, border: `1px solid ${modelBlocked ? "rgba(248,113,113,0.55)" : C.border}`,
              color: C.fg, fontFamily: FONT, fontSize: 13, padding: "6px 10px", borderRadius: 6, cursor: "pointer", outline: "none",
            }}
          >
            {modelBlocked && <option value="">Select a replacement model</option>}
            <optgroup label="In your Coding Plan">
              {LAUNCH_MODELS.filter((m) => m.plan).sort((a, b) => Number(!!b.featured) - Number(!!a.featured)).map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.featured ? " · Featured" : ""}</option>
              ))}
            </optgroup>
            {LAUNCH_MODELS.some((m) => !m.plan) && (
              <optgroup label="Other models">
                {LAUNCH_MODELS.filter((m) => !m.plan).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <PlanBadge />
        </div>

        <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
          Applies only to Runtimes created after the change — running Runtimes keep the model they started with, and there is no
          hot-switching (delete and create instead). Resolved as: per-Runtime override → this default → the Agent Version's Featured model,
          then injected as locked <span style={{ fontFamily: MONO }}>GMI_MODEL_ID</span>. The Agent must read that variable or switching is a silent no-op.
        </span>
      </section>

      {/* Tabs */}
      <PillSegmented
        active={tab}
        onChange={setTab}
        options={[
          { value: "monitor", label: "Overview" },
          { value: "integration", label: "API" },
          { value: "analytics", label: "Usage" },
        ]}
      />

      {/* Body */}
      {tab === "monitor" && (
        <MonitorPane
          agent={agent}
          instances={instances}
          onProvision={onProvision}
          onAction={onAction}
          onOpenDetail={onOpenDetail}
          activeInstanceId={activeInstanceId}
          canConvert={canConvert}
        />
      )}
      {tab === "integration" && <IntegrationPane agent={agent} />}
      {tab === "analytics" && <AnalyticsPane agent={agent} instances={instances} snapshots={snapshots} />}
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

// ─── F-07 Create Snapshot form ───────────────────────────────────────────────
// Capture starts from Runtime Detail and does not change the source Runtime's
// state. The user provides a name and an optional description; everything else —
// source Runtime, source Agent Version, Organization, region, runtime class,
// architecture — is inherited. Image, compute, storage, entrypoint and version
// number are never selected here.
function CreateSnapshotModal({
  inst, agentName, agentVersion, region, runtimeClass, architecture,
  existingNames, snapshotCount, onCancel, onCreate,
}: {
  inst: Instance | null;
  agentName: string;
  agentVersion: string;
  region: string;
  runtimeClass: string;
  architecture: string;
  existingNames: string[];
  snapshotCount: number;
  onCancel: () => void;
  onCreate: (input: { name: string; description: string; metadata: MetaEntry[] }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [meta, setMeta] = useState<MetaEntry[]>([]);
  // Re-prefill each time the form opens for a different Runtime.
  useEffect(() => {
    if (inst) {
      setName(snapshotNamePrefill(agentVersion, inst.id));
      setDescription("");
      setMeta([]);
    }
  }, [inst?.id, agentVersion]);

  if (!inst) return null;
  const nameErr = snapshotNameError(name, existingNames);
  const atLimit = snapshotCount >= CAP.orgSnapshotLimit;
  const canCreate = !nameErr && !atLimit;
  const est = estimateSnapshotGiB();

  const inputStyle: React.CSSProperties = {
    background: C.pillBg, border: `1px solid ${C.border}`, color: C.fg,
    fontFamily: MONO, fontSize: 12, padding: "7px 10px", borderRadius: 6, outline: "none", width: "100%",
  };
  const inherited: [string, string][] = [
    ["Source Runtime", midId(inst.id)],
    ["Source Agent Version", agentVersion],
    ["Region", region],
    ["Runtime class", runtimeClass],
    ["Architecture", architecture],
  ];

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 540, maxWidth: "100%", background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 10, display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>
            Create Snapshot <ReleaseBadge r="R1" />
          </h3>
          <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "4px 0 0", lineHeight: "17px" }}>
            Capture this Runtime's filesystem so you can launch new Runtimes without repeating setup. {agentName} · {midId(inst.id)} keeps running.
          </p>
        </div>

        <div style={{ padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {atLimit && (
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.fg, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 8, padding: "9px 11px", lineHeight: "17px" }}>
              Your Organization is at its Snapshot count limit ({snapshotCount}/{CAP.orgSnapshotLimit}). Delete a Snapshot to capture a new one.
            </div>
          )}

          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>
              Name <span style={{ color: C.muted, fontWeight: 400 }}>· optional</span>
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="leave empty to label by ID" style={{ ...inputStyle, borderColor: nameErr ? "rgba(248,113,113,0.55)" : C.border }} />
            {nameErr ? (
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.err, lineHeight: "15px" }}>{nameErr}</span>
            ) : (
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
                {name.trim()
                  ? "1–64 characters · lowercase letters, digits, hyphen, underscore · unique in your Organization · renameable later."
                  : "No name — this Snapshot will show as its ID in the Console. The ID is the canonical reference either way."}
              </span>
            )}
          </section>

          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>
              Description <span style={{ color: C.muted, fontWeight: 400 }}>· optional</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. deps installed, model weights cached"
              style={{ ...inputStyle, fontFamily: FONT, fontSize: 13, resize: "vertical" }}
            />
          </section>

          {/* Inherited automatically — never selected at capture time */}
          <section style={{ display: "flex", flexDirection: "column", gap: 6, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "11px 12px" }}>
            <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Inherited from the source</span>
            {inherited.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: FONT, fontSize: 12, lineHeight: "18px" }}>
                <span style={{ color: C.muted }}>{k}</span>
                <span style={{ color: C.fg, fontFamily: MONO, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
              </div>
            ))}
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
              Snapshots have no version number of their own — versioning belongs to the Agent Version, and one Version may have many Snapshots.
            </span>
          </section>

          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>
                Metadata <span style={{ color: C.muted, fontWeight: 400 }}>· optional</span>
              </label>
              <ReleaseBadge r="R0" />
            </div>
            <MetadataEditor entries={meta} onChange={setMeta} />
          </section>

          {/* Exact disclosure required by F-07 */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "10px 12px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.warn} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
            <span style={{ fontFamily: FONT, fontSize: 12, color: C.fg, lineHeight: "17px" }}>
              Snapshots preserve the Runtime filesystem only. Memory, running processes, active connections, and temporary secrets are not preserved.
              Stop or flush stateful applications before capture where that matters — application-consistent state is not guaranteed.
            </span>
          </div>

          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
            Capture is asynchronous: you get a Snapshot ID in Creating, and it becomes usable only from Ready.
            Requires up to <span style={{ color: C.fg, fontWeight: 600 }}>{est} GiB</span>; storage billing starts when the provider confirms capture,
            and the billable size may be reported after Ready. A failed capture creates no usable Snapshot, no provider storage, and no charge.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 20px", borderTop: `1px solid ${C.borderSoft}` }}>
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
            Snapshots {snapshotCount}/{CAP.orgSnapshotLimit} in your Organization
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCancel} style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, background: "transparent", color: C.fg, border: `1px solid ${C.border}`, padding: "6px 14px", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
            <button
              onClick={() => canCreate && onCreate({ name: name.trim(), description: description.trim(), metadata: meta.filter((m) => m.key.trim()) })}
              disabled={!canCreate}
              style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, background: canCreate ? C.lime : "#3a3a1f", color: canCreate ? C.limeText : "#6b6b52", border: "none", padding: "6px 16px", borderRadius: 8, cursor: canCreate ? "pointer" : "not-allowed" }}
            >
              Create Snapshot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Restore modal — Create Runtime from a snapshot (PRD F-08 / §5.5) ───────
function RestoreSnapshotModal({
  snapshot, agents, onClose, onLaunch,
}: {
  snapshot: Snapshot | null;
  agents: MyAgent[];
  onClose: () => void;
  onLaunch: (targetAgentId: string, version: string) => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  if (!snapshot) return null;
  // F-07 eligibility: the source Agent Version, or an explicitly compatible
  // Version of the SAME Agent. Cross-Agent launch is Post-R1, so no other Agent
  // is ever offered here. Runtime class, architecture, region and provider
  // requirements are validated before any resource is created.
  const sourceAgent = agents.find((a) => a.id === snapshot.sourceAgentId);
  const versions = sourceAgent
    ? [
        { id: snapshot.sourceAgentVersion, note: "Source version — always eligible" },
        { id: `${snapshot.sourceAgentVersion}-patch2`, note: "Marked compatible by the developer" },
      ]
    : [];
  const anyCompatible = versions.length > 0;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: "100%", background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 10, display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>Launch New Instance</h3>
          <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "4px 0 0" }}>
            <span style={{ fontFamily: MONO }}>{snapshotLabel(snapshot)}</span> · loads the captured filesystem into a Version of the same Agent
          </p>
        </div>
        <div style={{ padding: "14px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.fg }}>
            Target Agent Version {sourceAgent && <span style={{ color: C.muted, fontWeight: 400 }}>· {sourceAgent.name}</span>}
          </span>
          {!anyCompatible && (
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "10px 12px", lineHeight: "18px" }}>
              The source Agent for this Snapshot is no longer available, so there is no eligible target.
              A Snapshot can only launch into the same Agent — cross-Agent launch is Post-R1, and creating a new Agent from a Snapshot is not supported.
            </div>
          )}
          {versions.map((v) => {
            const selected = targetId === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setTargetId(v.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left",
                  background: selected ? "rgba(221,234,77,0.10)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${selected ? C.lime : C.borderSoft}`,
                  borderRadius: 8, padding: "10px 12px",
                  cursor: "pointer", fontFamily: FONT,
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.fg, fontFamily: MONO }}>{v.id}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{v.note}</span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.lime }}>Eligible</span>
              </button>
            );
          })}
          {anyCompatible && (
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
              Only Versions of this Agent are eligible. Region, runtime class, and architecture
              ({snapshot.region} · {snapshot.runtimeClass} · {snapshot.architecture}) are validated before any resource is created.
            </span>
          )}

          {/* What restores / re-applied · secrets · cost · permission (PRD F-08 / §4.4) */}
          {anyCompatible && (() => {
            const d = discountPriceString(CODING_AGENT_PLAN.featuredModelInPrice);
            return (
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 9, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "11px 12px" }}>
                <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "17px" }}>
                  <span style={{ color: C.fg, fontWeight: 600 }}>Snapshot provides</span> filesystem state · <span style={{ color: C.fg, fontWeight: 600 }}>Target Version provides</span> startup command, permissions, network, Endpoints, lifecycle and fresh secrets. The new Runtime gets its own ID, Endpoints and access.
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "17px" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1, color: C.warn }}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  <span><span style={{ color: C.fg, fontWeight: 600 }}>Secrets are injected fresh</span> — never taken from the Snapshot. Credentials that were written to the captured disk may still be there.</span>
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "17px" }}>
                  Each launch is independent and there is no batch API. Sending the same request twice produces one Runtime, not two.
                  A failed launch leaves this Snapshot Ready and unchanged.
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontFamily: FONT, fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Est. cost</span>
                  <span style={{ color: C.fg }}>Target compute + MaaS{d ? <> · <span style={{ color: C.lime, fontWeight: 600 }}>{d.discounted}</span></> : ""}</span>
                </div>
                <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
                  Requires permission on both the snapshot and the Target Agent.
                </div>
              </div>
            );
          })()}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${C.borderSoft}` }}>
          <button onClick={onClose} style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, background: "transparent", color: C.fg, border: `1px solid ${C.border}`, padding: "6px 14px", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
          <button
            onClick={() => targetId && sourceAgent && onLaunch(sourceAgent.id, targetId)}
            disabled={!targetId}
            style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, background: targetId ? C.lime : "#3a3a1f", color: targetId ? C.limeText : "#666", border: "none", padding: "6px 16px", borderRadius: 8, cursor: targetId ? "pointer" : "not-allowed" }}
          >
            Launch New Instance
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
  const [q, setQ] = useState("");
  const rows = snapshots.filter((s) => {
    if (!q.trim()) return true;
    const query = q.toLowerCase();
    if (query.includes("=")) return metadataMatches(s.metadata, query);
    const hay = `${snapshotLabel(s)} ${s.id} ${s.description ?? ""} ${s.sourceAgentVersion}`.toLowerCase();
    return hay.includes(query) || metadataMatches(s.metadata, query);
  });
  const cols = "1.5fr 1.4fr 1fr 0.8fr 1.1fr 1fr";
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, lineHeight: "30px", color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>Snapshots</h1>
        <ReleaseBadge r="R1" />
      </div>
      <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: 0, lineHeight: "19px" }}>
        Immutable, Organization-owned, point-in-time copies of a Runtime's disk. Launch a new Runtime from one into the same Agent —
        this is where Launch and Delete happen. Snapshots outlive their source Runtime, and the Snapshot ID is the canonical reference
        for API, SDK, launch, update, and delete. Nothing is ever addressed by name.
      </p>

      {/* R1 gate is an Organization COUNT limit checked before capture — storage
          is billed per GiB from Ready, not pre-reserved (F-07 / §4.5). */}
      {(() => {
        const committed = snapshots.filter((s) => s.status === "ready" || s.status === "creating");
        const gib = committed.reduce((a, s) => a + (s.billableGiB ?? 0), 0);
        const reported = committed.filter((s) => s.billableGiB != null).length;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "6px 12px" }}>
              Count <span style={{ color: C.fg }}>{committed.length}/{CAP.orgSnapshotLimit}</span>
              <span style={{ color: C.borderSoft }}>·</span>
              Billed storage <span style={{ color: C.fg }}>{gib.toFixed(1)} GiB</span>
              {reported < committed.length && <span style={{ color: C.muted }}>({committed.length - reported} size pending)</span>}
            </div>
            <div style={{ position: "relative", display: "flex", alignItems: "center", flex: 1, minWidth: 220, maxWidth: 360 }}>
              <span style={{ position: "absolute", left: 10, color: C.muted, display: "flex" }}><IconSearch /></span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, ID, or metadata (tenant=acme)"
                style={{ width: "100%", background: C.pillBg, border: `1px solid ${C.border}`, color: C.fg, fontFamily: FONT, fontSize: 13, padding: "7px 12px 7px 30px", borderRadius: 8, outline: "none" }}
              />
            </div>
          </div>
        );
      })()}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "visible", marginTop: 4 }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)", fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>
          <div>Snapshot</div><div>Source</div><div>Placement</div><div>Size</div><div>Created · Ready</div><div style={{ textAlign: "right" }}>Actions</div>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: "48px 16px", textAlign: "center", fontFamily: FONT, fontSize: 13, color: C.muted }}>
            {snapshots.length === 0
              ? "No snapshots yet. Capture one from a running instance in My Agents → Instance Detail."
              : "No snapshots match this filter."}
          </div>
        ) : (
          rows.map((s, i) => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: cols, padding: "12px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`, alignItems: "center", fontFamily: FONT, fontSize: 13, color: C.fg }}>
              <div style={{ minWidth: 0 }}>
                <div title={snapshotLabel(s)} style={{ fontFamily: MONO, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{snapshotLabel(s)}</div>
                {s.name && <div title={s.id} style={{ fontFamily: MONO, fontSize: 10.5, color: C.borderSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.id}</div>}
                {s.description && <div title={s.description} style={{ fontFamily: FONT, fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description}</div>}
              </div>
              <div style={{ color: C.muted, minWidth: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.fg }}>{s.sourceAgentVersion}</span>
                {s.sourceDeleted && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: C.muted, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, padding: "0 5px", borderRadius: 4 }}>Agent deleted</span>}
                <span style={{ display: "block", fontFamily: MONO, fontSize: 11, color: C.borderSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{midId(s.sourceRuntimeId)}</span>
              </div>
              <div style={{ color: C.muted, fontSize: 11.5, minWidth: 0 }}>
                <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{REGION_LABELS[s.region] ?? s.region}</span>
                <span style={{ display: "block", fontFamily: MONO, fontSize: 10.5, color: C.borderSoft }}>{s.runtimeClass} · {s.architecture}</span>
              </div>
              <div style={{ color: C.muted }} title={s.billableGiB == null ? "Compressed size is computed asynchronously — readiness never waits on usage reporting" : undefined}>
                {s.status !== "ready" ? "—" : s.billableGiB == null ? <span style={{ color: C.warn }}>Pending</span> : `${s.billableGiB} GiB`}
              </div>
              <div style={{ color: C.muted, fontSize: 11.5 }}>
                <span style={{ display: "block" }}>{agoLabel(s.createdAt)}</span>
                <span style={{ display: "block", color: C.borderSoft }}>{s.readyAt ? `ready ${agoLabel(s.readyAt)}` : "not ready"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                <span
                  title={CAP.snapshotAutoRetention ? `Deletes in ${snapshotDaysLeft(s)} days` : "No automatic expiry — retention (P-04) is conditional on Q16 and commercial review"}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: snapshotColor(s.status), background: `${snapshotColor(s.status)}1f`, border: `1px solid ${snapshotColor(s.status)}55`, padding: "2px 8px", borderRadius: 6, marginRight: 4 }}
                >
                  {s.status === "creating" && <span style={{ width: 6, height: 6, borderRadius: 999, background: snapshotColor(s.status), animation: "pulse 1.2s ease-in-out infinite" }} />}
                  {s.status}
                </span>
                {CAP.snapshotAutoRetention && s.status === "ready" && (() => {
                  const left = snapshotDaysLeft(s);
                  const r = riskColor(left);
                  return <span style={{ fontFamily: FONT, fontSize: 11, color: r.color }}>{left}d left</span>;
                })()}
                {/* Launch is blocked while Creating — a Snapshot is usable only from Ready */}
                {s.status === "ready" && (
                  <button onClick={() => onRestore(s)} style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.limeText, background: C.lime, border: "none", padding: "3px 10px", borderRadius: 6, cursor: "pointer" }}>Launch New Instance</button>
                )}
                {/* Delete is permission-gated and blocked while Creating */}
                {(s.status === "ready" || s.status === "failed") && (
                  <button onClick={() => onDelete(s.id)} style={{ fontFamily: FONT, fontSize: 11, fontWeight: 500, color: C.err, background: "transparent", border: `1px solid ${C.border}`, padding: "3px 9px", borderRadius: 6, cursor: "pointer" }}>Delete</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
        A Snapshot is captured from a live Runtime's disk. It is not a Template — Templates are built from developer config at
        Register → Agent Version build and are reproducible by construction. Renaming or clearing a name never breaks the link to the
        source Agent Version. Deleting a Snapshot prevents future launches and stops its storage metering; Runtimes already launched
        from it own their own disk and are unaffected.
      </span>
    </section>
  );
}

// ─── Operation feedback toasts (PRD §4.2) ──────────────────────────────────
type ToastKind = "progress" | "success" | "error" | "unconfirmed";
interface ToastMsg { id: string; kind: ToastKind; msg: string }
function toastColor(k: ToastKind): string {
  return k === "success" ? C.ok : k === "error" ? C.err : k === "unconfirmed" ? C.warn : C.muted;
}
function Toaster({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 2000, display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.cardSolid, border: `1px solid ${toastColor(t.kind)}55`, borderLeft: `3px solid ${toastColor(t.kind)}`, borderRadius: 8, padding: "10px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", animation: "row-fade-in 180ms ease-out" }}>
          {t.kind === "progress"
            ? <span style={{ width: 12, height: 12, border: `2px solid ${C.border}`, borderTopColor: C.fg, borderRadius: 999, display: "inline-block", flexShrink: 0, animation: "spin 0.8s linear infinite" }} />
            : <span style={{ width: 8, height: 8, borderRadius: 999, background: toastColor(t.kind), flexShrink: 0 }} />}
          <span style={{ fontFamily: FONT, fontSize: 13, color: C.fg, lineHeight: "18px" }}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Notification entry (PRD §4.3) — resources nearing auto-deletion ────────
function NotificationBell({
  instances, snapshots, onOpenSnapshots,
}: {
  instances: Instance[];
  snapshots: Snapshot[];
  onOpenSnapshots: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // PRD v2.3: instances NEVER appear as expiring. Two groups instead:
  //  1) Expiring soon — snapshots only (they still auto-delete at retention).
  //  2) Paused instances — cost reminders (storage keeps billing; no deletion).
  const expiring = (CAP.snapshotAutoRetention ? snapshots : [])
    .filter((s) => s.status === "ready" && snapshotDaysLeft(s) <= 7)
    .map((s) => ({ id: s.id, name: snapshotLabel(s), left: snapshotDaysLeft(s) }))
    .sort((a, b) => a.left - b.left);
  const paused = instances
    .filter((i) => i.status === "suspended")
    .map((i) => ({ id: i.id, name: midId(i.id), cost: pausedCostMo(i) }));
  const count = expiring.length + paused.length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={count ? `${count} notification${count === 1 ? "" : "s"}` : "No notifications"}
        style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: open ? "rgba(255,255,255,0.06)" : "transparent", color: count ? C.warn : C.muted, border: `1px solid ${open ? C.border : "transparent"}`, borderRadius: 8, cursor: "pointer" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {count > 0 && (
          <span style={{ position: "absolute", top: 3, right: 3, minWidth: 15, height: 15, padding: "0 3px", background: C.err, color: "#fff", fontFamily: FONT, fontSize: 9, fontWeight: 700, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 340, background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", zIndex: 50, overflow: "hidden" }}>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {count === 0 && (
              <div style={{ padding: "18px 14px", fontFamily: FONT, fontSize: 12, color: C.muted, textAlign: "center" }}>No notifications.</div>
            )}

            {/* Group 1 — Expiring soon (snapshots only) */}
            {expiring.length > 0 && (
              <>
                <div style={{ padding: "10px 14px 6px", fontFamily: FONT, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Expiring soon</div>
                {expiring.map((it) => {
                  const r = riskColor(it.left);
                  return (
                    <button key={it.id} onClick={() => { setOpen(false); onOpenSnapshots(); }} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "transparent", border: "none", borderBottom: `1px solid ${C.borderSoft}`, cursor: "pointer" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={r.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Snapshot · {it.name}</span>
                        <span style={{ fontFamily: FONT, fontSize: 11, color: r.color }}>Deletes in {it.left} day{it.left === 1 ? "" : "s"}</span>
                      </span>
                    </button>
                  );
                })}
                <div style={{ padding: "8px 14px", fontFamily: FONT, fontSize: 10.5, color: C.muted, lineHeight: "15px", borderBottom: paused.length ? `1px solid ${C.borderSoft}` : "none" }}>
                  We attempt to notify you before automated deletion. Delivery is not guaranteed — the Console expiry time is authoritative.
                </div>
              </>
            )}

            {/* Group 2 — Paused instances (cost reminders; never deleted) */}
            {paused.length > 0 && (
              <>
                <div style={{ padding: "10px 14px 6px", fontFamily: FONT, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Paused instances</div>
                {paused.map((it) => (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${C.borderSoft}` }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Instance · {it.name}</span>
                      <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>Paused · storage charges continue (≈${it.cost}/mo)</span>
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
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
  const [runtimeImages, setRuntimeImages] = useState<Record<string, RuntimeImage>>(INITIAL_RUNTIME_IMAGES);
  const [restoreSnapshot, setRestoreSnapshot] = useState<Snapshot | null>(null);
  // F-07 — capture starts from Runtime Detail and opens a real form (name,
  // description, metadata), not a bare confirm.
  const [snapshotForInstanceId, setSnapshotForInstanceId] = useState<string | null>(null);
  // Instance drawer lives at page level so the layout can make room for it
  // instead of covering the list the user just clicked in.
  const [drawer, setDrawer] = useState<{ id: string; tab: DrawerTab } | null>(null);
  const openDetail = (id: string, tab: DrawerTab = "overview") => {
    setProvisionForAgentId(null);
    setDrawer({ id, tab });
  };
  // F-08 — launcher-owned Saved Launch Configurations, keyed by Agent.
  const [savedConfigs, setSavedConfigs] = useState<Record<string, SavedLaunchConfig>>(INITIAL_SAVED_CONFIGS);
  const savedConfigFor = (agentId?: string): SavedLaunchConfig =>
    resolveSavedConfig(agentId ? savedConfigs[agentId] : undefined);
  const saveModel = (agentId: string, model: string) => {
    setSavedConfigs((prev) => ({ ...prev, [agentId]: { model, status: "ok" } }));
    pushToast("success", `Saved default model — applies to Runtimes created from now on`);
  };
  // Operation feedback toasts (PRD §4.2 — Accepted → in-progress → resolved)
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastSeq = useRef(0);
  const pushToast = (kind: ToastKind, msg: string): string => {
    const id = `t${++toastSeq.current}`;
    setToasts((prev) => [...prev, { id, kind, msg }]);
    if (kind !== "progress") setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
    return id;
  };
  const settleToast = (id: string, kind: ToastKind, msg: string) => {
    setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, kind, msg } : x)));
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
  };

  // Provision modal — open per-task override modal first, then provision on submit
  const [provisionForAgentId, setProvisionForAgentId] = useState<string | null>(null);

  // Both panels slide in from the right, so only one can be open at a time.
  const handleProvision = (agentId: string) => { setDrawer(null); setProvisionForAgentId(agentId); };

  const actuallyProvision = (agentId: string, config: InstanceConfig) => {
    const id = newInstanceId();
    // F-01 — the record is persisted in Pending and the ID returned immediately;
    // acknowledgement never waits on provider acceptance.
    const newInst: Instance = {
      id,
      agentId,
      status: "pending",
      created: fmtNow(),
      config,
      maxActive: config.maxLifetime,          // P-01 maximum continuous active time
      maxRuntimeAction: "suspend",            // P-01 default action at the limit
      latestOperation: { kind: "create", status: "in_progress", at: fmtNow() },
    };
    setInstances((prev) => [newInst, ...prev]);
    setProvisionForAgentId(null);
    // pending → initializing → running. Compute metering and the active-time
    // clock start only when Running is confirmed (§4.5); transition time is free.
    setTimeout(() => patchInstance(id, { status: "creating" }), 500);
    setTimeout(() => {
      setInstances((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i, status: "running", endpointUrl: endpointFor(id), lifecycleStartedAt: fmtNow(),
                latestOperation: { kind: "create", status: "succeeded", at: fmtNow() },
              }
            : i,
        ),
      );
    }, 1800);
  };

  // ── Runtime Image readiness mutations (validation → preparation). ──────────
  const patchImage = (agentId: string, patch: Partial<RuntimeImage>) =>
    setRuntimeImages((prev) => ({ ...prev, [agentId]: { ...prev[agentId], ...patch } }));
  // Validate → prepare cycle: validating → valid → preparing → ready.
  const runReadiness = (agentId: string, kind: "revalidate" | "replace") => {
    const t = pushToast("progress", kind === "replace" ? "Validating new image…" : "Revalidating image…");
    patchImage(agentId, { validation: "validating", preparation: "not_started", compatibilityIssue: undefined });
    setTimeout(() => {
      patchImage(agentId, { validation: "valid", preparation: "preparing", lastValidated: fmtNow() });
      settleToast(t, "progress", "Preparing runtime…");
      setTimeout(() => {
        patchImage(agentId, { preparation: "ready" });
        settleToast(t, "success", "Runtime ready — Launch enabled");
      }, 1600);
    }, 1400);
  };
  const retryPreparation = (agentId: string) => {
    const t = pushToast("progress", "Preparing runtime…");
    patchImage(agentId, { preparation: "preparing" });
    setTimeout(() => {
      patchImage(agentId, { preparation: "ready" });
      settleToast(t, "success", "Runtime ready — Launch enabled");
    }, 1600);
  };

  // ── Runtime 2.0 lifecycle mutations (PRD §2). Simulated provider timing. ──
  const patchInstance = (id: string, patch: Partial<Instance>) =>
    setInstances((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  // §4.7 — metadata is updatable after create; it never affects behavior.
  const patchMetadata = (id: string, next: MetaEntry[]) =>
    setInstances((prev) => prev.map((i) => (
      i.id === id ? { ...i, config: { ...(i.config ?? TEMPLATE_DEFAULT_CONFIG), metadata: next } } : i
    )));

  const performSuspend = (id: string) => {
    // F-05: running → suspending → suspended. Runtime ID and disk are retained;
    // memory, processes, and live connections are lost. Compute metering stops on
    // the confirmed Suspend; retained-disk metering starts there (§4.5).
    const t = pushToast("progress", "Pause accepted — stopping compute…");
    patchInstance(id, { status: "suspending", latestOperation: { kind: "suspend", status: "in_progress", at: fmtNow() } });
    setTimeout(() => {
      patchInstance(id, {
        status: "suspended", endpointUrl: undefined, suspendedAt: fmtNow(),
        latestOperation: { kind: "suspend", status: "succeeded", at: fmtNow() },
      });
      settleToast(t, "success", "Paused — files kept");
    }, 1200);
  };
  const performResume = (id: string) => {
    // F-05: a fresh boot of the same disk — Resume re-runs the declared startup
    // command and reports Running only after readiness passes. Endpoint routes
    // recover independently and may still be Pending at that point (F-06).
    const t = pushToast("progress", "Resume accepted — re-running the startup command…");
    patchInstance(id, { status: "resuming", latestOperation: { kind: "resume", status: "in_progress", at: fmtNow() } });
    setTimeout(() => {
      setInstances((prev) => prev.map((i) =>
        i.id === id
          ? {
              ...i, status: "running", endpointUrl: endpointFor(i.id), keep: false, suspendedAt: undefined,
              lifecycleStartedAt: fmtNow(),
              latestOperation: { kind: "resume", status: "succeeded", at: fmtNow() },
            }
          : i,
      ));
      settleToast(t, "success", "Running — anything the startup command doesn't launch must be restarted with Run Command");
    }, 1500);
  };
  const performDelete = (id: string) => {
    // F-04: any non-terminal state → deleting → deleted. Delete intent is durable
    // and preempts the lifecycle lock, so a Runtime under an accepted Delete never
    // returns to Running. Deleted is reported only once release is confirmed, and
    // that is when metering stops and the final usage record is emitted.
    const t = pushToast("progress", "Delete accepted — releasing compute and disk…");
    patchInstance(id, { status: "deleting", unconfirmed: false, latestOperation: { kind: "delete", status: "in_progress", at: fmtNow() } });
    setTimeout(() => {
      patchInstance(id, { status: "deleted", endpointUrl: undefined, latestOperation: { kind: "delete", status: "succeeded", at: fmtNow() } });
      settleToast(t, "success", "Deleted — all billing stopped, final usage recorded");
      setTimeout(() => setInstances((prev) => prev.filter((i) => i.id !== id)), 1500);
    }, 1200);
  };
  const performRetry = (id: string) => {
    // Failed creation or unconfirmed outcome → re-attempt (§4.2 / F-01).
    const inst = instances.find((i) => i.id === id);
    const t = pushToast("progress", inst?.unconfirmed ? "Re-checking provider outcome…" : "Retrying creation…");
    patchInstance(id, { status: "creating", lastError: undefined, unconfirmed: false });
    setTimeout(() => {
      setInstances((prev) => prev.map((i) =>
        i.id === id ? { ...i, status: "running", endpointUrl: endpointFor(i.id), lifecycleStartedAt: fmtNow() } : i,
      ));
      settleToast(t, "success", "Instance running");
    }, 1600);
  };

  const handleAction = (id: string, action: RowAction) => {
    const inst = instances.find((i) => i.id === id);
    const shortId = midId(id);
    switch (action) {
      case "suspend": {
        const cost = inst ? pausedCostMo(inst) : 4;
        setConfirm({
          title: "Pause instance?",
          body: (
            <>
              Compute billing stops and the instance keeps its ID and files until you Resume or Delete —
              storage keeps billing ≈${cost}/mo. Memory, running processes, and live connections are lost,
              and any command running now is cancelled (its result stays retrievable).
              Endpoint URLs survive but return the unavailable response while paused.
              For long-term reuse, create a Snapshot instead.
            </>
          ),
          confirmLabel: "Pause Instance",
          destructive: false,
          onConfirm: () => performSuspend(id),
        });
        break;
      }
      case "resume":
        setConfirm({
          title: "Resume instance?",
          body: (
            <>
              Resume is a fresh boot of the same disk, not a restored session: the declared startup command runs
              again and Running is reported only after readiness passes. Anything the startup command doesn't launch
              has to be restarted with Run Command. The Endpoint URL is unchanged, but its availability recovers
              independently and may lag behind Running.
            </>
          ),
          confirmLabel: "Resume Instance",
          destructive: false,
          onConfirm: () => performResume(id),
        });
        break;
      case "retry":
        performRetry(id);
        break;
      case "delete":
        setConfirm({
          title: "Delete instance?",
          body: (
            <>
              This cannot be undone. Compute, retained disk, and every Endpoint route for
              {" "}<span style={{ color: C.fg, fontFamily: MONO }}>{shortId}</span> are released, and all files on it are
              permanently deleted unless they were saved through a Snapshot or downloaded.
              Snapshots and the Agent's Runtime Template are separate resources and survive.
              Deleted is reported only after release is confirmed — that is when all billing stops.
            </>
          ),
          confirmLabel: "Delete Instance",
          destructive: true,
          onConfirm: () => performDelete(id),
        });
        break;
      case "snapshot":
      case "convert":
        // F-07 — capture opens the Create Snapshot form (name, description,
        // metadata, disclosure); it does not change the source Runtime's state.
        setSnapshotForInstanceId(id);
        break;
    }
  };

  // ── Snapshot mutations (PRD §3) ──────────────────────────────────────────
  const createSnapshotFrom = (
    instanceId: string,
    input: { name: string; description: string; metadata: MetaEntry[] },
  ) => {
    const inst = instances.find((i) => i.id === instanceId);
    if (!inst) return;
    const agent = allAgents.find((a) => a.id === inst.agentId);
    const sid = newSnapshotId();
    const snap: Snapshot = {
      id: sid,
      name: input.name || undefined,          // omitted name → Console labels by ID
      description: input.description || undefined,
      sourceAgentId: inst.agentId,
      sourceAgentName: agent?.name || "—",
      sourceAgentVersion: agentVersionName(inst.agentId, agent?.name),
      sourceRuntimeId: inst.id,
      category: agent?.category || "Code & Dev Tools",
      region: agent?.region || "us-ia-iowa-1",
      runtimeClass: agent?.tier || "container",
      architecture: "linux/amd64",
      createdAt: fmtNow(),
      billableGiB: null,                      // reported asynchronously after Ready
      retentionDays: 30,
      status: "creating",
      metadata: input.metadata,
    };
    setSnapshots((prev) => [snap, ...prev]);
    setSnapshotForInstanceId(null);
    setTopTab("snapshots"); // jump to Organization Snapshots so the user sees it
    const t = pushToast("progress", "Capture accepted — Snapshot created in Creating…");
    // Storage metering starts once the provider confirms capture (§4.5), and the
    // compressed billable size can land after Ready — readiness never waits on it.
    setTimeout(() => {
      setSnapshots((prev) => prev.map((s) => (s.id === sid ? { ...s, status: "ready", readyAt: fmtNow() } : s)));
      settleToast(t, "success", "Snapshot ready — storage metering started");
      setTimeout(() => {
        setSnapshots((prev) => prev.map((s) => (s.id === sid ? { ...s, billableGiB: estimateSnapshotGiB() } : s)));
      }, 2200);
    }, 1600);
  };
  const deleteSnapshot = (sid: string) => {
    const t = pushToast("progress", "Deleting snapshot…");
    setSnapshots((prev) => prev.map((s) => (s.id === sid ? { ...s, status: "deleting" } : s)));
    setTimeout(() => {
      setSnapshots((prev) => prev.filter((s) => s.id !== sid));
      settleToast(t, "success", "Snapshot deleted");
    }, 900);
  };
  const confirmDeleteSnapshot = (sid: string) => {
    const snap = snapshots.find((s) => s.id === sid);
    setConfirm({
      title: "Delete snapshot?",
      body: (
        <>
          Snapshot <span style={{ color: C.fg, fontFamily: MONO }}>{snap ? snapshotLabel(snap) : sid}</span> will be
          permanently deleted once release is confirmed. This cannot be undone. Future launches from it are prevented and its
          storage metering stops; Runtimes already launched from it own their own disk and are unaffected.
          The name becomes reusable only after the deletion is confirmed.
        </>
      ),
      confirmLabel: "Delete snapshot",
      destructive: true,
      onConfirm: () => deleteSnapshot(sid),
    });
  };
  const launchFromSnapshot = (snapshot: Snapshot, targetAgentId: string, version: string) => {
    // F-07 launch — reuses the F-01 create path. The Snapshot supplies filesystem
    // state; the target Agent Version supplies startup, permissions, network,
    // Endpoints, lifecycle, and fresh secrets. The Snapshot stays Ready either way.
    setRestoreSnapshot(null);
    setTopTab("deployments");
    setSelectedId(targetAgentId);
    // F-08 rule 4 applies to every create path, including launch-from-Snapshot:
    // with an action_required saved model, nothing is created and nothing is
    // substituted. The Snapshot stays Ready and unchanged.
    const cfg = savedConfigFor(targetAgentId);
    if (cfg.status === "action_required") {
      pushToast("error", "Blocked — confirm a model in this Agent's saved launch configuration first");
      return;
    }
    actuallyProvision(targetAgentId, {
      ...TEMPLATE_DEFAULT_CONFIG,
      name: `from-${snapshotLabel(snapshot).replace(/^snap_/, "").slice(0, 18)}`,
      model: cfg.model,
      metadata: snapshot.metadata ?? [],
    });
    pushToast("success", `Launching a new instance from this Snapshot on ${version} — see My Agents`);
  };

  const list = useMemo(() => {
    const q = filter.toLowerCase();
    return allAgents.filter((a) => !q || a.name.toLowerCase().includes(q));
  }, [filter, allAgents]);

  const selected = list.find((a) => a.id === selectedId) ?? list[0];
  // Read the drawer's instance from live state so it stays in sync as the
  // lifecycle advances, and closes itself once a deleted row is dropped.
  const drawerInst = drawer ? instances.find((i) => i.id === drawer.id) ?? null : null;
  const drawerAgent = drawerInst ? allAgents.find((a) => a.id === drawerInst.agentId) : undefined;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.6); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes row-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes drawer-in { from { transform: translateX(16px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
      <Topbar />
      <Navbar />

      {/* The drawer reserves layout width instead of covering the list, so the
          instance you clicked stays visible and the next one is one click away. */}
      <div
        style={{
          marginLeft: 210, paddingTop: 40, display: "flex", flexDirection: "column", minHeight: "100vh",
          paddingRight: drawerInst ? DRAWER_WIDTH : 0,
          transition: "padding-right .18s ease",
        }}
      >

        {/* Top tabs + expiry notification entry */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, padding: "0 32px" }}>
          <div style={{ display: "flex" }}>
          {[
            { id: "deployments" as const, label: "My Agents", isNew: false },
            { id: "uses" as const, label: "Agents I Use", isNew: false },
            { id: "snapshots" as const, label: "Snapshots", isNew: true },
          ].map((t) => {
            const isActive = topTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setDrawer(null); setTopTab(t.id); }}
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
          <NotificationBell instances={instances} snapshots={snapshots} onOpenSnapshots={() => setTopTab("snapshots")} />
        </div>

        {topTab === "snapshots" && (
          <div style={{ padding: "20px 32px 32px", flex: 1, minHeight: 0 }}>
            <OrganizationSnapshots
              snapshots={snapshots}
              onRestore={(s) => setRestoreSnapshot(s)}
              onDelete={confirmDeleteSnapshot}
            />
          </div>
        )}

        {/* Body: split — left list pane / right detail pane. With the drawer open
            the agent list collapses so the instance table keeps its width; the
            agent name stays in the detail header, so context isn't lost. */}
        {topTab !== "snapshots" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: drawerInst ? "1fr" : "320px 1fr",
            gap: 24,
            padding: "24px 32px 32px",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Left pane */}
          <aside style={{ display: drawerInst ? "none" : "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, lineHeight: "30px", color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>
              My Agents
            </h1>

            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: 10, color: C.muted, display: "flex" }}>
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search agents"
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
              Publish Agent
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
              snapshots={snapshots}
              image={runtimeImages[selected.id]}
              savedConfig={savedConfigFor(selected.id)}
              onProvision={handleProvision}
              onAction={handleAction}
              onOpenDetail={openDetail}
              activeInstanceId={drawer?.id ?? null}
              onSaveModel={saveModel}
              onRevalidate={(id) => runReadiness(id, "revalidate")}
              onRetryPrep={retryPreparation}
              onReplaceImage={(id) => runReadiness(id, "replace")}
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
        onLaunch={(targetAgentId, version) => restoreSnapshot && launchFromSnapshot(restoreSnapshot, targetAgentId, version)}
      />

      {/* F-07 capture form — opened from the instance row / Instance Detail */}
      {(() => {
        const inst = instances.find((i) => i.id === snapshotForInstanceId) ?? null;
        const agent = inst ? allAgents.find((a) => a.id === inst.agentId) : undefined;
        return (
          <CreateSnapshotModal
            inst={inst}
            agentName={agent?.name ?? "—"}
            agentVersion={agentVersionName(inst?.agentId ?? "", agent?.name)}
            region={regionLabel(agent?.region)}
            runtimeClass={agent?.tier ?? "container"}
            architecture="linux/amd64"
            existingNames={snapshots.map((s) => s.name).filter((n): n is string => !!n)}
            snapshotCount={snapshots.filter((s) => s.status === "ready" || s.status === "creating").length}
            onCancel={() => setSnapshotForInstanceId(null)}
            onCreate={(input) => snapshotForInstanceId && createSnapshotFrom(snapshotForInstanceId, input)}
          />
        );
      })()}

      <ProvisionModal
        open={provisionForAgentId !== null}
        agentName={allAgents.find((a) => a.id === provisionForAgentId)?.name ?? ""}
        agentVersion={agentVersionName(provisionForAgentId ?? "", allAgents.find((a) => a.id === provisionForAgentId)?.name)}
        image={(allAgents.find((a) => a.id === provisionForAgentId) as any)?.dockerImage}
        endpoints={endpointsForAgent(allAgents.find((a) => a.id === provisionForAgentId))}
        savedConfig={savedConfigFor(provisionForAgentId ?? undefined)}
        onCancel={() => setProvisionForAgentId(null)}
        onSubmit={(cfg) => {
          if (provisionForAgentId) actuallyProvision(provisionForAgentId, cfg);
        }}
      />

      <InstanceDrawer
        inst={drawerInst}
        deploymentName={drawerAgent?.name ?? ""}
        agentVersion={agentVersionName(drawerInst?.agentId ?? "", drawerAgent?.name)}
        endpoints={endpointsForAgent(drawerAgent)}
        idc={regionLabel(drawerAgent?.region)}
        product={productForTier(drawerAgent?.tier)}
        tab={drawer?.tab ?? "overview"}
        onTab={(tab) => setDrawer((d) => (d ? { ...d, tab } : d))}
        onAction={handleAction}
        onPatchMetadata={patchMetadata}
        onClose={() => setDrawer(null)}
      />

      <ConfirmDialog pending={confirm} onClose={() => setConfirm(null)} />
      <Toaster toasts={toasts} />
    </div>
  );
}
