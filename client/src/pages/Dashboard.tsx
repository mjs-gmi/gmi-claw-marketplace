import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link, useRoute } from "wouter";
import {
  loadSubscription, isSubscribed, getPlan,
  ALL_MODELS, STANDARD_MODELS, getModel, modelName, isStandardModel, paygUsdPer1M,
  type CatalogModel,
} from "@/lib/pricingModel";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import CopyButton from "@/components/CopyButton";
import { C as baseC, FONT, MONO } from "@/lib/tokens";
import { SEED_AGENTS } from "@/lib/seedAgents";
import { PlanBadge, DiscountedPrice } from "@/components/PlanUI";
import V2Badge from "@/components/V2Badge";
import TerminalV2 from "@/components/TerminalV2";
import NoApiBadge, { NoApiNote, NO_API_REASON } from "@/components/NoApiBadge";
import V21Badge, { V21Note } from "@/components/V21Badge";
import BatchBadge, { Batch2Note } from "@/components/BatchBadge";
import { TEMPLATE_QUOTA, agentsAtLimit } from "@/lib/templates";
import SdkPlaygroundV2 from "@/components/SdkPlaygroundV2";
import OpenQuestionBadge from "@/components/OpenQuestionBadge";
import { REVIEW_MODE } from "@/lib/reviewMode";
import {
  PublishStatusEntry, PublishStatusModal, UnpublishDialog,
  type PublishRow, type ReviewStatus, type ListingActionHandlers,
} from "@/components/PublishStatusV2";
import { discountPriceString, CODING_AGENT_PLAN } from "@/lib/modelsPlan";
import AgentDrawer from "@/components/AgentDrawer";
import {
  CostNotice, InsufficientCredits, TopUpCredits, RedeemCoupon,
  hasAcknowledged, acknowledge,
} from "@/components/BillingDialogs";
import { ALL_CLAWS, TYPE_LABELS, type Claw, type TypeLabel } from "@/lib/clawData";
import { SANDBOX_AVAILABLE } from "@/lib/eligibility";
import NotFound from "@/pages/NotFound";
import { STANDARD_SPECS, runningRate, pausedRate, money4 } from "@/lib/billingModel";

// ─── Tokens — shared base from @/lib/tokens, plus a few page-local keys.
const C = {
  ...baseC,
  card:      "#171717",              // page-specific (opaque, not translucent)
  activeBg:  "rgba(255,255,255,0.12)",
  selectedYellow: "rgba(99,105,35,0.3)",
  err:       "#ef4444",              // page-specific
};

// ─── Mock data ────────────────────────────────────────────────────────────
// ─── Sandbox state ──────────────────────────────────────────────────────────
// The contract (SandboxControlState) reports exactly SIX values:
//
//     provisioning · running · paused · checkpointing · updating · failed
//
// Two things it says that the prototype used to contradict:
//   · internal `creating` is expressed externally as `provisioning`
//   · `deleting` is NOT one of them — once a delete is accepted the sandbox is
//     unqueryable (detail returns 404); the state only appears in the delete
//     call's own acknowledgement.
//   · `paused` is only ever returned by an IDC that offers suspend. Runloop
//     does not, so it never appears there — which is why Pause is a 2.1 item.
//
// `TaskStatus` keeps more members than that because the mock drives its own
// transitions (a delete has to animate somehow). Everything the user READS goes
// through statusLabel, which collapses them onto the six contract words.
type SandboxControlState =
  | "provisioning" | "running" | "paused" | "checkpointing" | "updating" | "failed";

type TaskStatus =
  | "pending" | "creating" | "running"
  | "suspending" | "suspended" | "resuming"
  | "deleting" | "deleted" | "error"
  | "stopping" | "stopped"
  | "checkpointing" | "updating";
type AgentStatus = TaskStatus | "idle";

/** Internal transition → the contract's external state. */
function controlState(status: AgentStatus): SandboxControlState | "deleted" | "idle" {
  switch (status) {
    case "pending":
    case "creating":      return "provisioning";
    case "running":       return "running";
    case "suspended":
    case "stopped":       return "paused";
    case "suspending":
    case "resuming":
    case "stopping":      return "updating";   // in flight; not a state of its own
    case "checkpointing": return "checkpointing";
    case "updating":      return "updating";
    case "error":         return "failed";
    // Not contract states — local to the delete animation and the agent rollup.
    case "deleting":
    case "deleted":       return "deleted";
    case "idle":          return "idle";
  }
}

// Normalized Console label mapping (PRD §4.1 — API states are authoritative,
// Console labels are presentation only). Backend keeps suspend/suspended field
// names; the UI presents them as Pause/Paused (Runtime 2.0 PRD v2.3).
// The label is the contract's own word, so support, the API and the customer all
// name the same thing. `deleting`/`deleted` are the two the contract does not
// have, and they are transient by construction.
function statusLabel(status: AgentStatus): string {
  const s = controlState(status);
  if (s === "deleted") return status === "deleting" ? "deleting" : "deleted";
  if (s === "idle") return "Idle";
  return s;
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
  listingState?: ListingState;
  /**
   * Copied from the catalog via "Set up this Agent" and not configured yet.
   * The drawer promises "Continue in My Agents to configure settings and
   * deploy" — this flag is what makes that promise land somewhere instead of
   * dropping the user in front of an unexplained empty agent.
   */
  needsSetup?: boolean;
  /** Where it was copied from, so the first-run panel can name it. */
  copiedFrom?: string;  // M4 state machine — default "draft"
  endpoints?: AgentEndpoint[];  // Register → Networking endpoint definitions
  region?: string;              // Register → region id (read-only in runtime)
  tier?: string;                // Register → compute tier id (read-only in runtime)
  // v1.2 §E6 — a listing needs a public image with no embedded secrets or
  // credentials. Set when Register enabled registry credentials, or when the
  // image is private; it locks the Listing control rather than failing at
  // review time.
  privateImage?: boolean;
}

// Mirrors the localStorage key written by DeployWizard's Connect-flow Submit
const REGISTERED_AGENTS_KEY = "gmi:registered-agents";
// Seed agents are static module data, so a listing state change has to live
// somewhere that survives leaving the page.
const LISTING_OVERRIDES_KEY = "gmi:listing-overrides";

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
// ─── §G Capabilities ────────────────────────────────────────────────────────
// Which panes a sandbox gets is decided by the task's own `capabilities`, never
// by matching on a runtime name. Container tasks report logs/metrics/ports;
// Sandbox reports exec/shell/files/expiry and false for the rest.
interface SandboxCapabilities {
  exec: boolean;     // Run
  shell: boolean;    // Terminal, and the inline >_ affordance
  files: boolean;    // Files
  expiry: boolean;   // the expiry countdown
  logs?: boolean;
  metrics?: boolean;
  ports?: boolean;
}
/**
 * §H — the default set. `shell` is TRUE here, which is the DESIGNED state, not
 * today's state: the primary substrate has no PTY translation in our middle
 * layer yet, and the task response advertising shell:true has never been
 * connected end to end.
 *
 * The prototype draws the target anyway, because that is what it is for — the
 * same call as drawing the Launch duration picker the backend cannot accept.
 * When the capability arrives it is already wired; when review needs to see the
 * degraded case, one sandbox is seeded without it (below).
 */
const SANDBOX_CAPS: SandboxCapabilities = {
  exec: true, shell: true, files: true, expiry: true,
  logs: false, metrics: false, ports: false,
};
/**
 * One sandbox with no shell, so the case most users will actually hit until the
 * PTY work lands stays reviewable, and the tab bar gets exercised at both
 * widths — §F says the design has to hold 1 to 4 tabs.
 */
const SANDBOX_CAPS_NO_SHELL: SandboxCapabilities = { ...SANDBOX_CAPS, shell: false };
function capsOf(inst: Instance): SandboxCapabilities {
  return inst.capabilities ?? SANDBOX_CAPS;
}

// ─── §J Upload permission ───────────────────────────────────────────────────
// Writing files needs creator or org_owner; reading does not. One flag, because
// the prototype has one viewer.
const CAN_WRITE_FILES = true;

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

// ─── Publish Status rows — v1.2 §D ─────────────────────────────────────────
// Derived from the listing state machine rather than stored twice. Every
// listing appears, drafts included — Publish Status is the only place listings
// are managed, so a draft has to be reachable from it (see PublishStatusV2).
const REVIEW_FOR_LISTING: Record<ListingState, ReviewStatus> = {
  draft:          "draft",
  live:           "approved",
  pending_review: "under_review",
  rejected:       "denied",
};

// Frozen on first use. Computing this per render made the Updated column tick
// forward on every re-render and the `updated` sort unstable — but it cannot be
// a module-load constant either: `_seedDaysAgo` is declared further down, so
// evaluating it here hits the temporal dead zone and blanks the page.
let _publishRowFallbackDates: string[] | null = null;
function publishRowFallbackDate(i: number): string {
  if (!_publishRowFallbackDates) _publishRowFallbackDates = [1, 2, 3, 4, 5].map((n) => _seedDaysAgo(n));
  return _publishRowFallbackDates[i % _publishRowFallbackDates.length];
}

// Stand-in review notes until the review service returns a real reason.
const DENY_REASONS = [
  "Listing to public requires a public image with no embedded secrets or credentials.",
  "Short description duplicates another live listing on the Marketplace.",
];

function publishRowsFor(agents: MyAgent[]): PublishRow[] {
  return agents.map((a, i) => {
    const status = REVIEW_FOR_LISTING[a.listingState ?? "draft"];
    return {
      id: a.id,
      listingName: a.name,
      templateName: agentVersionName(a.id, a.name),
      status,
      updated: a.registeredAt ? fmtDate(new Date(a.registeredAt)) : publishRowFallbackDate(i),
      denyReason: status === "denied" ? DENY_REASONS[i % DENY_REASONS.length] : undefined,
      locked: !!a.privateImage,
    };
  });
}

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

// v1.3 §C3 — the two Specs the design draws in the Launch panel.
// NOTE: POST /sandboxes does not accept a spec; it comes from the Template's
// `resources`. Drawn here because the v1.3 set draws it and this is a
// prototype — the control carries a NO API marker so the gap is visible.
// ─── §B/§D Spec catalogue ───────────────────────────────────────────────────
// Register and Launch both need a Spec, and the catalogue is per IDC — the IDC
// has to be chosen first, because it decides which rows exist. No price is
// rendered anywhere: the field is there but always zero, and a $0.00/hr next to
// a size reads as broken rather than free.
interface SpecOption { id: string; vcpu: number; ramGb: number; diskGb: number }
const SPEC_CATALOG: SpecOption[] = [
  { id: "x-small", vcpu: 1,  ramGb: 2,  diskGb: 10 },
  { id: "small",   vcpu: 2,  ramGb: 4,  diskGb: 20 },
  { id: "medium",  vcpu: 4,  ramGb: 8,  diskGb: 40 },
  { id: "large",   vcpu: 8,  ramGb: 16, diskGb: 80 },
  { id: "x-large", vcpu: 16, ramGb: 32, diskGb: 160 },
];
/** Which specs each IDC actually offers. Missing rows are greyed, never hidden. */
const SPECS_BY_IDC: Record<string, string[]> = {
  "us-ia-iowa-1":    ["x-small", "small", "medium", "large", "x-large"],
  "us-or-portland":  ["x-small", "small", "medium"],
  "eu-de-frankfurt": ["small", "medium", "large"],
  "ap-sg-singapore": ["x-small", "small"],
};
/**
 * §四 — the backend does NOT advertise which IDCs refuse a Launch-time Spec.
 * The only way to find out is to send one and get `sandbox_spec_not_supported`
 * back, so the picker is always live and the refusal is handled as an error
 * that reverts to the registered Spec. This list is the mock's stand-in for
 * that server behaviour, never consulted to disable anything up front.
 */
const IDC_REFUSES_SPEC_CHANGE = ["eu-de-frankfurt"];

function specLabel(id?: string): string {
  const sp = SPEC_CATALOG.find((x) => x.id === id);
  return sp ? `${sp.vcpu} vCPU · ${sp.ramGb} GB · ${sp.diskGb} GB` : "—";
}
function specName(id?: string): string {
  return SPEC_CATALOG.find((x) => x.id === id)?.id ?? "—";
}
function specsForIdc(idc?: string): { spec: SpecOption; available: boolean }[] {
  const offered = SPECS_BY_IDC[idc ?? ""] ?? [];
  return SPEC_CATALOG.map((spec) => ({ spec, available: offered.includes(spec.id) }));
}
/** §B — the default is the smallest spec the IDC actually offers. */
function smallestSpec(idc?: string): string | undefined {
  return specsForIdc(idc).find((x) => x.available)?.spec.id;
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
/**
 * Agents registered before the Spec catalogue existed carry a Container /
 * Standard / Performance tier id. Map those forward rather than showing "—"
 * for every seeded agent.
 */
const LEGACY_TIER_TO_SPEC: Record<string, string> = {
  container: "small", standard: "medium", performance: "large",
};
function agentSpecId(agent?: { tier?: string }): string | undefined {
  const t = agent?.tier;
  if (!t) return undefined;
  return SPEC_CATALOG.some((x) => x.id === t) ? t : LEGACY_TIER_TO_SPEC[t];
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
// Model catalog comes from the shared pricing model (Standard / Premium lanes).
// Standard = included/FUP; Premium = burns Premium Credits (or PAYG without a plan).
const FEATURED_MODEL = STANDARD_MODELS[0]; // deepseek-v4-flash — Standard default
function launchModel(id?: string): CatalogModel | undefined {
  return id ? getModel(id) : undefined;
}
// Human name for any stored id — including one the API no longer returns.
function modelDisplayName(id?: string): string {
  if (!id) return FEATURED_MODEL.name;
  return modelName(id);
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
  agent_hermes: { model: "kimi-k27-code", status: "ok" }, // a Premium saved default
  // Saved a model the available-models API no longer returns → action_required.
  // This agent's Template is Ready, so the model gate is the only thing blocking
  // create — the two launch gates stay legible separately.
  agent_hermes_mingjun: { model: "qwen-25-72b", status: "action_required" },
  agent_openclaw: { model: "deepseek-v4-flash", status: "ok" }, // Standard
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
  name?: string;         // rides along as metadata.name — create has no name field
  idc?: string;          // create parameter: idc_name
  specId?: string;       // §D — chosen at Launch; MAY differ from the agent's
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
  /** §G — what this task can do. Absent falls back to the Sandbox set. */
  capabilities?: SandboxCapabilities;
  /**
   * §D — the Spec this sandbox actually launched with. It MAY differ from the
   * Agent's registered Spec (`instance_type MAY differ`), which is why it is
   * stored per sandbox rather than read off the agent.
   */
  specId?: string;
  endpointUrl?: string;       // populated when status=running (per swagger F-03)
  config?: InstanceConfig;    // per-task override (PRD F-04 / F-09 — empty = template defaults)
  // ── Runtime 2.0 lifecycle (PRD §2) ──────────────────────────────────────
  /**
   * THE authoritative expiry, as the control plane reports it.
   *
   * Swagger is explicit that the caller must not derive this: POST
   * /sandboxes/{id}/timeout says "调用方不能从自己的请求参数推出生效值，以响应里的
   * new_end_at 为准" — a `timeout` ≤ 0 is silently replaced with 300s, so the
   * number you sent is not the number in force. Every countdown reads this.
   */
  endAt?: string;
  /**
   * What was asked for at create, kept for display only ("1h", "6h", …).
   * It is NOT the clock: /timeout re-bases from *now*, so after one extend the
   * original duration no longer describes when this sandbox dies.
   */
  maxActive?: string;
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
// The control plane hands back an absolute expiry; seeds mimic that rather than
// storing a duration the UI would have to add up itself.
const _seedMinsIn = (n: number): string => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + n);
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
    // The full set: Overview / Run Command / Terminal / Files / Access.
    capabilities: SANDBOX_CAPS,
    specId: "small",
    maxActive: "1h",
    endAt: _seedMinsIn(7),      // near-expiry state §五.1 calls for
    maxRuntimeAction: "suspend",
    lifecycleStartedAt: _seedMinsAgo(53), // ~7 min left — reaches the near-expiry state §五.1 calls for
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
    // No shell — what a sandbox looks like until the PTY translation is built.
    // Kept so the narrower tab bar stays reviewable.
    capabilities: SANDBOX_CAPS_NO_SHELL,
    specId: "medium",
    maxActive: "2h",
    endAt: _seedMinsIn(96),     // the long-lived one
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
    endAt: _seedMinsIn(-8),     // reaper picks this up on load
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
    endAt: _seedMinsIn(52),
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
    endAt: _seedMinsIn(357),
    maxRuntimeAction: "suspend",
    lifecycleStartedAt: _seedMinsAgo(3),
    unconfirmed: true,
    latestOperation: { kind: "create", status: "unknown", at: _seedMinsAgo(3) },
  },
];


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
  // There is no "no limit". Omitting `timeout` yields 300 seconds — the
  // SHORTEST life, not an unbounded one. Never render this as "unlimited".
  if (!v || v === "off") return "300 seconds (API default when timeout is omitted)";
  const m = /^(\d+)\s*(min|h)$/.exec(v.trim());
  if (!m) return v;
  const n = Number(m[1]);
  return m[2] === "h" ? `${n} hour${n > 1 ? "s" : ""}` : `${n} min`;
}
// Round a minute count up to a coarse "N min / N h remaining" label.
// Compact form for the Lifecycle cell, which already sits under a "Lifecycle"
// header — "5h 57m" reads better there than "5h 57m remaining left".
function remainingShort(mins: number): string {
  if (mins <= 0) return "limit reached";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function remainingLabel(mins: number): string {
  if (mins <= 0) return "limit reached";
  if (mins < 60) return `${mins} min remaining`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${h}h ${rem}m remaining` : `${h}h remaining`;
}

// F-02 Lifecycle column — active-time remaining for a Running runtime.
// The lifecycle as numbers, so the row can draw a bar and colour the last few
// minutes rather than printing a sentence. `timeout` is wall-clock from
// creation and nothing inside the sandbox extends it, so this is the whole
// truth about how long it has left.
interface LifecycleClock {
  unlimited: boolean;
  totalMins: number;
  usedMins: number;
  leftMins: number;
  pct: number;
}
function lifecycleClock(inst: Instance): LifecycleClock {
  // `unlimited` can no longer be produced by any control: the API has no
  // "no limit" — omitting `timeout` yields 300 seconds, the SHORTEST life, not
  // an unbounded one. The flag stays only to render legacy records.
  if (!inst.endAt) return { unlimited: true, totalMins: 0, usedMins: 0, leftMins: 0, pct: 0 };
  const end = Date.parse(inst.endAt.replace(" ", "T"));
  if (Number.isNaN(end)) return { unlimited: true, totalMins: 0, usedMins: 0, leftMins: 0, pct: 0 };
  const start = inst.lifecycleStartedAt
    ? Date.parse(inst.lifecycleStartedAt.replace(" ", "T"))
    : Date.parse(inst.created.replace(" ", "T"));
  const total = Math.max(1, Math.round((end - start) / 60000));
  const left = Math.max(0, Math.ceil((end - Date.now()) / 60000));
  const used = Math.max(0, total - left);
  return { unlimited: false, totalMins: total, usedMins: used, leftMins: left, pct: Math.min(100, (used / total) * 100) };
}

/** The control plane's own answer: now + seconds, as /timeout and /connect return it. */
function endAtFromNow(seconds: number): string {
  // Mirrors the server rule — `timeout` ≤ 0 becomes 300s. The UI must never
  // assume the number it sent is the number in force.
  const secs = seconds > 0 ? seconds : 300;
  return fmtDate(new Date(Date.now() + secs * 1000));
}

function activeRemaining(inst: Instance): string {
  const clock = lifecycleClock(inst);
  if (clock.unlimited) return "Expiry unknown";
  return `${remainingLabel(clock.leftMins)} active`;
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
// ─── §C Template build ──────────────────────────────────────────────────────
// `template_build_status` is ONE field with four known values, and it lives only
// on the agent detail response — the list endpoint does not carry it, which is
// why the left-hand agent list shows no build dot.
//
// The prototype used to derive a build state from two orthogonal fields
// (`validation` + `preparation`). That was a guess made before the API was
// readable; the real thing is a single status, there is no build-log endpoint,
// and there is no rebuild endpoint. Recovery is editing the image and saving.
type TemplateBuildStatus = "waiting" | "building" | "ready" | "error";
/** Anything the backend sends that we do not recognise, plus "not sent at all". */
type BuildView = TemplateBuildStatus | "unknown" | "missing";

interface RuntimeImage {
  url: string;
  tag: string;
  digest: string;      // immutable digest
  registry: string;
  architecture: string;
  /** Raw value off the wire. Undefined = the field was absent. */
  buildStatus?: string;
  /** The backend's own words. There is no log to open, so this is all there is. */
  buildError?: string;
  /** Anchor for the "waited mm:ss" counter. Builds run 21s to 3min+. */
  buildStartedAt?: string;
  lastValidated: string;
}
const KNOWN_BUILD: TemplateBuildStatus[] = ["waiting", "building", "ready", "error"];

/**
 * §C — "构建中 + 已等待 mm:ss，不画进度条". The build reports no progress field
 * and takes anywhere from 21s to several minutes, so a bar would be fiction.
 * Elapsed time is the one true thing we can show.
 */
function BuildElapsed({ since }: { since?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!since) return null;
  const started = Date.parse(since.replace(" ", "T"));
  if (Number.isNaN(started)) return null;
  const secs = Math.max(0, Math.floor((now - started) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }} title="Time waited so far">
      waited {mm}:{ss}
    </span>
  );
}

function buildView(img?: RuntimeImage): BuildView {
  if (!img || img.buildStatus === undefined) return "missing";
  const raw = img.buildStatus;
  return (KNOWN_BUILD as string[]).includes(raw) ? (raw as TemplateBuildStatus) : "unknown";
}

/** Label + colour for the header chip. `missing` renders nothing at all. */
function buildChip(v: BuildView, raw?: string): { label: string; color: string } | null {
  switch (v) {
    case "ready":    return { label: "Ready", color: C.ok };
    case "building": return { label: "Building image", color: C.warn };
    case "waiting":  return { label: "Waiting to build", color: C.warn };
    case "error":    return { label: "Build failed", color: C.err };
    // An unrecognised value is shown verbatim rather than mapped to a guess.
    case "unknown":  return { label: raw ?? "Unknown", color: C.muted };
    case "missing":  return null;
  }
}
// ─── §C Launch gate ─────────────────────────────────────────────────────────
// Ready launches. waiting/building/error do not. A MISSING or unrecognised
// status does NOT block: the field is absent from some responses, and refusing
// to launch because we did not understand a string would strand the user on our
// own parsing bug. Let the call go and let 409 template_not_ready be the truth.
function isLaunchable(img?: RuntimeImage): boolean {
  const v = buildView(img);
  return v === "ready" || v === "missing" || v === "unknown";
}

/** §C — why Launch is off, in the user's words. Null when it is not off. */
function launchBlockedBy(img?: RuntimeImage): string | null {
  switch (buildView(img)) {
    case "waiting":
    case "building": return "The image is still building — Launch opens when it reaches Ready.";
    case "error":    return img?.buildError
      ? `The image build failed — ${img.buildError}`
      : "The image build failed. Edit the image address and save to build again.";
    default:         return null;
  }
}

const INITIAL_RUNTIME_IMAGES: Record<string, RuntimeImage> = {
  agent_hermes: {
    url: "ghcr.io/mjs-gmi/hermes-gmi", tag: "v5", digest: "sha256:0bf9bdf13d544665a7188cce1423ab11c0de",
    registry: "ghcr.io", architecture: "linux/amd64", buildStatus: "ready",
    lastValidated: _seedDaysAgo(2),
  },
  agent_hermes_mingjun: {
    url: "ghcr.io/mjs-gmi/hermes-gmi", tag: "v6-rc1", digest: "sha256:b73c1e082f4a4d198c6b5a9e0f21d7c4a1b2",
    registry: "ghcr.io", architecture: "linux/amd64", buildStatus: "ready",
    lastValidated: _seedMinsAgo(4),
  },
  agent_openclaw: {
    url: "ghcr.io/mjs-gmi/openclaw-gmi", tag: "v5-mode-none", digest: "sha256:d87723941a694cfd8b97f3c895db9e85aa10",
    registry: "ghcr.io", architecture: "linux/arm64", buildStatus: "error",
    lastValidated: _seedMinsAgo(9),
    // The backend's own words. There is no log endpoint, so this is all the
    // user gets — which is why it has to be shown verbatim, not summarised.
    buildError: "image architecture linux/arm64 is not supported in this IDC (requires linux/amd64)",
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
const IconPlay = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
);
const IconTerminal = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 17 6-6-6-6" /><path d="M12 19h8" /></svg>
);
const IconFile = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2v6h6" /><path d="M4 2h10l6 6v14H4z" /></svg>
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
  label: string; value: string; accent: string;
  /** Optional: a card whose label already says it needs no second line. */
  helper?: string;
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
      {helper && <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "16px" }}>{helper}</div>}
    </div>
  );
}

function PillSegmented<T extends string>({
  options, active, onChange,
}: {
  options: { value: T; label: string; noApi?: boolean; question?: string }[];
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
            {opt.noApi && <NoApiBadge style={{ marginLeft: 6 }} />}
            {opt.question && <OpenQuestionBadge title={opt.question} style={{ marginLeft: 6 }} />}
          </button>
        );
      })}
    </div>
  );
}

// Colour keys off the contract state, not the internal transition, so the same
// external state can never be two colours in two places.
const STATE_COLOR: Record<SandboxControlState | "deleted" | "idle", string> = {
  provisioning:  "#60a5fa",   // blue — preparing, not usable yet
  running:       C.ok,
  paused:        C.warn,
  checkpointing: "#60a5fa",
  updating:      "#60a5fa",
  failed:        C.err,
  deleted:       "#525252",
  idle:          "#737373",
};

function statusDot(status: AgentStatus): string {
  return STATE_COLOR[controlState(status)];
}

// ─── NEW feature badge — small lime pill marking Runtime 2.0 additions ──────
function NewBadge({ style }: { style?: React.CSSProperties }) {
  if (!REVIEW_MODE) return null;
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
  // Which release a surface ships in is a planning fact, not something the
  // person using it needs on the label.
  if (!REVIEW_MODE) return null;
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
// The R1 API has one wall-clock `timeout` and no pause, so the timeline runs
// Created → Running → Deleted. It used to end in "Paused", which the swagger
// cannot deliver and which contradicts what happens at the limit.
function LifecycleTimeline({ maxActive }: { maxActive?: string }) {
  const activeSub = !maxActive || maxActive === "off" ? "No limit" : `≤ ${durationLabel(maxActive)}`;
  const stages = [
    { label: "Created", sub: "timeout starts counting here",   color: C.muted },
    { label: "Running", sub: activeSub,                        color: C.ok },
    { label: "Deleted", sub: "released with its disk",         color: C.err },
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

/**
 * The template's state, derived from the build status this page already
 * tracks. A second store of template records would be a second truth about the
 * same object — and the one that goes stale, because only this one is wired to
 * the build simulation.
 */
interface TemplateView {
  label: string;
  color: string;
  note?: string;
  launch: boolean;
  edit: boolean;
  rebuild: boolean;
  logs: boolean;
}
function templateViewFor(agent: MyAgent, image?: RuntimeImage): TemplateView {
  const v = buildView(image);
  const version = agentVersionName(agent.id, agent.name).split("-").pop();
  switch (v) {
    case "building":
    case "waiting":
      return { label: "Building", color: C.warn, launch: false, edit: false, rebuild: false, logs: true };
    case "error":
      return { label: "Error", color: C.err, note: image?.buildError, launch: false, edit: true, rebuild: true, logs: true };
    case "missing":
      return { label: "No template", color: C.muted, launch: false, edit: true, rebuild: false, logs: false };
    case "unknown":
      return { label: image?.buildStatus ?? "Unknown", color: C.muted, launch: true, edit: true, rebuild: true, logs: false };
    case "ready": {
      // Inactivity is a template's only clock, and the nudge that replaces a
      // storage charge: an unused one is archived at 90 days.
      const idle = daysIdle(agent);
      const left = idle === null ? null : Math.max(0, 90 - idle);
      return {
        label: `Ready · ${version ?? "v1"}`,
        color: C.ok,
        note: left !== null && left <= 21 ? `Archives in ${left} d` : undefined,
        launch: true, edit: true, rebuild: true, logs: false,
      };
    }
  }
}
/** Days since this agent last launched a sandbox; null when it never has. */
function daysIdle(agent: MyAgent, instances: Instance[] = []): number | null {
  const mine = instances.filter((i) => i.agentId === agent.id);
  if (mine.length === 0) return AGENT_IDLE_DAYS[agent.id] ?? null;
  const latest = mine.map((i) => Date.parse(i.created.replace(" ", "T"))).sort((a, b) => b - a)[0];
  return Math.floor((Date.now() - latest) / 86_400_000);
}
/** Seeded idle ages, so the archive warning is reachable in review. */
const AGENT_IDLE_DAYS: Record<string, number> = { agent_openclaw: 78 };

function AgentListItem({
  agent, agg, image, instances, selected, onClick, onEditTemplate, onDeleteTemplate, onLaunch,
}: {
  agent: MyAgent;
  agg: AgentAggregate;
  image?: RuntimeImage;
  instances: Instance[];
  selected: boolean;
  onClick: () => void;
  onEditTemplate: (agent: MyAgent) => void;
  onDeleteTemplate: (agent: MyAgent) => void;
  onLaunch: (agent: MyAgent) => void;
}) {
  const status: AgentStatus =
    agg.error > 0 ? "error" :
    agg.creating > 0 ? "creating" :
    agg.active > 0 ? "running" :
    (agent.displayStatus ?? "idle");

  const tpl = templateViewFor(agent, image);
  const idle = daysIdle(agent, instances);
  const lastLaunched = idle === null ? "—" : idle === 0 ? "today" : idle === 1 ? "yesterday" : `${idle} days ago`;

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
      </div>
      {/* Two states, kept apart. The dot is the AGENT — are its sandboxes
          running. The chip below is its TEMPLATE — can a sandbox start at all.
          Collapsing them hides the case that matters most: an agent with
          nothing running because its image failed to build. */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 6, height: 6, borderRadius: 999, background: statusDot(status), display: "inline-block",
            animation: status === "creating" ? "pulse 1.2s ease-in-out infinite" : "none",
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: "16px" }}>
          {agg.active === 0 ? "No running sandboxes" : `${agg.active} running sandbox${agg.active === 1 ? "" : "es"}`}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.muted }}>Template</span>
        <span style={{ display: "inline-flex", fontFamily: FONT, fontSize: 11, color: tpl.color, background: `${tpl.color}1f`, border: `1px solid ${tpl.color}55`, padding: "1px 7px", borderRadius: 5 }}>
          {tpl.label}
        </span>
        {tpl.note && (
          <span style={{ fontSize: 11, color: tpl.color === C.err ? C.muted : C.warn, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {tpl.note}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
        <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>
          Last launched {lastLaunched}
        </span>
        {/* §1 — the actions are on the row, not behind a kebab. Which ones
            exist follows the template's state: there is no Launch for an image
            that has not been built, because that call can only 409. */}
        <div onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", gap: 4, flexShrink: 0 }}>
          {tpl.launch && <RowLink label="Launch" onClick={() => onLaunch(agent)} />}
          {tpl.logs && <RowLink label="View logs" onClick={() => {}} />}
          {tpl.rebuild && <RowLink label="Rebuild" onClick={() => {}} />}
          {tpl.edit && <RowLink label="Edit" onClick={() => onEditTemplate(agent)} />}
          <RowLink label="Delete" danger onClick={() => onDeleteTemplate(agent)} />
        </div>
      </div>
    </div>
  );
}

function RowLink({ label, danger, onClick }: { label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FONT, fontSize: 11, fontWeight: 500,
        background: "transparent", color: danger ? C.err : C.muted,
        border: "none", padding: "2px 4px", cursor: "pointer",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = danger ? C.err : C.fg; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = danger ? C.err : C.muted; }}
    >
      {label}
    </button>
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
    { at: inst.created, label: "pending — Sandbox record persisted, ID returned" },
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

// v1.3 §F — "View public listing" renders the agent through the same Browse
// Agents drawer the catalog uses, so the preview is the real thing rather than
// a second rendering that can drift. Falls back to the agent's own fields when
// the listing is not in the public catalog yet.
function asCatalogClaw(agent: MyAgent): Claw {
  const published = ALL_CLAWS.find((c) => c.name === agent.name);
  if (published) return published;
  const category = (TYPE_LABELS as string[]).includes(agent.category)
    ? (agent.category as TypeLabel)
    : "Code & Dev Tools";
  return {
    id: agent.id,
    name: agent.name,
    publisher: "You",
    description: `${agent.name} runs as a GMI AgentBox container from template ${agent.templateId}.`,
    tags: [category.toLowerCase().replace(/[^a-z]+/g, "-"), "agent", "ai", "llm"],
    typeLabel: category,
    infrastructurePath: agent.verified ? "gmi_ce_maas" : "gmi_ce_only",
    availability: "available",
    pricing: "Free",
  };
}

// ─── Listing actions — primary CTA inline + ⋮ menu for secondary ─────────
// "View public listing" is the high-frequency action (external link) so it
// stays inline as a lime CTA. "Edit listing" + "Unpublish" fold into a ⋮ menu
// to reduce button density on the agent detail header.
// Single "Listing ▼" dropdown sits next to "+ Sandbox" in the agent detail
// header. All listing actions live behind one trigger — no inline primary
// button — so the header stays tight even as state changes. State badge
// inside the trigger (DRAFT / PENDING / LIVE / REJECTED) tells the user where
// the listing is at a glance.
// ─── Listing control in the agent header ───────────────────────────────────
// One action, never a menu. Publishing and unpublishing are the two things a
// publisher does from the Agent they are looking at; everything else about a
// listing — edit, repost, withdraw, view public, and the review state of every
// listing at once — lives in the Publish Status modal, which is reached from
// the My Agents column header.
function ListingActions({
  state, locked = false, onPublish, onUnpublish,
}: {
  state?: ListingState;
  /** v1.2 §E6 — image can't be listed publicly, so publishing is inert. */
  locked?: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const isLive    = state === "live";
  const isPending = state === "pending_review";

  // Live is the only state with something to take down.
  if (isLive) {
    return (
      <button
        onClick={onUnpublish}
        title="Remove this Agent from the Marketplace"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: FONT, fontSize: 13, fontWeight: 500, lineHeight: "20px",
          background: "transparent", color: C.err,
          border: `1px solid ${C.err}55`,
          padding: "5px 14px", borderRadius: 8, cursor: "pointer",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </svg>
        Unpublish
      </button>
    );
  }

  // Not live: one Publish button, disabled with the reason when it can't run.
  // v1.2 §E5 — a listing already in review says so here rather than needing a
  // separate pill; §E6 — a locked image says why without a submit attempt.
  const blocked =
    locked   ? "Unable to Publish — Listing to public requires a public image with no embedded secrets or credentials."
  : isPending ? "Under review — this listing is already submitted. Withdraw it from Publish Status to change it."
  : null;

  return (
    <button
      onClick={() => { if (!blocked) onPublish(); }}
      disabled={!!blocked}
      title={blocked ?? "Publish this Agent to the Marketplace"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: FONT, fontSize: 13, fontWeight: 500, lineHeight: "20px",
        background: "transparent",
        color: blocked ? C.muted : C.fg,
        border: `1px solid ${C.border}`,
        padding: "5px 14px", borderRadius: 8,
        cursor: blocked ? "not-allowed" : "pointer",
      }}
    >
      {locked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      )}
      {isPending && !locked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
        </svg>
      )}
      Publish
    </button>
  );
}

// ─── Expires cell — §A, and §五's four corrections ────────────────────────
// The spec is blunt about what was wrong here, and two of them were mine:
//
//   · say "Expires in", not "43 min remaining active" and not "5h 57m left"
//   · a colour change is not enough — ours *deletes* the sandbox and its files
//     at the limit, which is harsher than every competitor, so the consequence
//     has to be written down
//   · extending is "set a new expiry", not "+30 min": competitors have people
//     re-enter a duration, and an additive control teaches the wrong model
//   · put Extend next to the expiry, not somewhere else
function ExpiresCell({ inst }: { inst: Instance }) {
  // §G — an org whose tasks report expiry:false has no expiry to show at all.
  if (!capsOf(inst).expiry) return <span style={{ fontFamily: FONT, fontSize: 12, color: C.muted }}>—</span>;

  const clock = lifecycleClock(inst);
  if (clock.unlimited) {
    // §E — no `expires_at` means nothing will reap it on a timer. That is
    // "no automatic limit", not "unknown": the previous wording made a normal
    // configuration look like a fault.
    return (
      <span style={{ fontFamily: FONT, fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>
        No automatic limit
      </span>
    );
  }

  // §E — amber under five minutes. One threshold, because the only decision it
  // drives is "act now or not", and a three-tier ramp implies a precision the
  // auto-renew-on-read behaviour does not support.
  const soon = clock.leftMins < 5;
  const expired = clock.leftMins <= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span
        title={`Expires at ${inst.endAt}`}
        style={{
          fontFamily: FONT, fontSize: 12, fontWeight: soon ? 600 : 500,
          color: soon ? C.warn : C.fg,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        {expired ? "Expiring" : `Expires in ${remainingShort(clock.leftMins)}`}
      </span>
      {/* The consequence, not just a colour — expiry here deletes the disk. */}
      <span style={{ fontFamily: FONT, fontSize: 10.5, color: soon ? C.warn : C.muted, lineHeight: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {soon ? "Sandbox and files will be deleted." : "Deleted with its files at the limit."}
      </span>
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

  // §H/§I — Run and Terminal are reachable from the row, not just from inside
  // the drawer. Both are capability-gated (§G) and Running-only: a stopped
  // sandbox has nothing to exec against.
  const caps = capsOf(inst);
  const live = inst.status === "running";
  const jumps: { tab: DrawerTab; label: string; icon: React.ReactNode; on: boolean }[] = [];
  if (caps.exec)  jumps.push({ tab: "run",      label: "Run Command", icon: <IconPlay />,     on: live });
  if (caps.shell) jumps.push({ tab: "terminal", label: "Terminal",      icon: <IconTerminal />, on: live });

  // Lifecycle actions by state — the §4.1 transition matrix is authoritative.
  type MenuAction = { action: RowAction; label: string; icon: React.ReactNode; release?: Release; danger?: boolean; title?: string; noApi?: boolean; v21?: boolean };
  const lifecycle: MenuAction[] = [];
  if (inst.status === "running") {
    lifecycle.push({ action: "snapshot", label: "Save as Snapshot", icon: <IconSnapshot />, release: "R1", noApi: true, v21: true });
  }
  // Snapshot from Suspended is conditional on Q8. While it's unresolved AgentBox
  // never silently resumes: Resume → Snapshot → Suspend stays three steps.
  if (inst.status === "suspended" && CAP.snapshotFromSuspended && canConvert) {
    lifecycle.push({ action: "convert", label: "Save as Snapshot", icon: <IconSnapshot />, release: "R1?", v21: true });
  }
  // F-04 / §4.2 — Delete is available from every non-terminal state, confirmed or
  // not, and is never rejected as a lifecycle conflict. Deleting is an idempotent
  // no-op, so the entry drops once release is already under way.
  if (inst.status !== "deleted" && inst.status !== "deleting") {
    lifecycle.push({
      action: "delete", label: "Delete Sandbox", icon: <IconTrash />, danger: true,
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
        aria-label={`Sandbox ${inst.id.slice(0, 8)} actions`}
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
          {jumps.map((j) => (
            <button
              key={j.tab}
              disabled={!j.on}
              title={j.on ? undefined : `The Sandbox is ${statusLabel(inst.status)} — this needs it Running.`}
              onClick={() => { setOpen(false); onOpenDetail(inst.id, j.tab); }}
              style={{ ...itemStyle(false), color: j.on ? C.fg : "#5a5a5a", cursor: j.on ? "pointer" : "not-allowed" }}
            >
              {j.icon}
              <span style={{ flex: 1 }}>{j.label}</span>
            </button>
          ))}
          {jumps.length > 0 && lifecycle.length > 0 && (
            <div style={{ height: 1, background: C.borderSoft, margin: "4px 6px" }} />
          )}
          {lifecycle.map((it) => (
            <button
              key={it.action}
              title={it.title}
              onClick={() => { setOpen(false); onAction(inst.id, it.action); }}
              style={itemStyle(false, it.danger)}
            >
              {it.icon}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.v21 && <V21Badge />}
              {it.noApi && <NoApiBadge />}
              {it.release && <ReleaseBadge r={it.release} />}
            </button>
          ))}
          {lifecycle.length > 0 && (
            <div style={{ height: 1, background: C.borderSoft, margin: "4px 6px" }} />
          )}
          {/* "Open detail" was a third way to do what clicking the row already
              does, and what the disclosure spells out by name. Gone. The ⋮ is
              down to the rarely-used and the destructive, which is all a kebab
              should ever hold. */}
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
  open, agentName, agentVersion, image, endpoints, idcDefault, specDefault, onCancel, onSubmit,
}: {
  open: boolean;
  agentName: string;
  /** §D — the agent's IDC. Fixed: the image is built per IDC, so Launch shows it. */
  idcDefault?: string;
  /** §D — the Spec the agent registered with. The Launch picker opens on it. */
  specDefault?: string;
  agentVersion: string;
  image?: string;
  endpoints: AgentEndpoint[];
  onCancel: () => void;
  onSubmit: (cfg: InstanceConfig) => void;
}) {
  const [name, setName] = useState("");
  // idc_name is a create parameter, so it belongs here and nowhere else.
  const [idc, setIdc] = useState(idcDefault ?? "us-ia-iowa-1");
  // v1.3 §C3 / §C4 — Spec picker and the Add Model gate.
  const [launchSpec, setLaunchSpec] = useState<string>(() => specDefault ?? smallestSpec(idcDefault) ?? "small");
  /** Set when the server answered `sandbox_spec_not_supported`; holds the Spec it fell back to. */
  const [specRejected, setSpecRejected] = useState<string | null>(null);
  const [addModel, setAddModel] = useState(false);
  // Always start with one empty editable row at the bottom (matches the
  // reference UI — user can start typing without clicking "+ key" first).
  const [env, setEnv] = useState<{ id: string; key: string; value: string }[]>([
    { id: "e0", key: "", value: "" },
  ]);
  const [maxLifetime, setMaxLifetime] = useState(TEMPLATE_DEFAULT_CONFIG.maxLifetime);
  // No control sets this any more, and create does not accept an idle
  // policy; it stays as the payload default so InstanceConfig is unchanged.
  const idleTimeout = TEMPLATE_DEFAULT_CONFIG.idleTimeout;
  // P-02 — declared-Endpoint traffic counts as activity by default (D-05 opt-out).
  // F-08 — starts from the Saved Launch Configuration; this field is the optional
  // per-Runtime override. Empty means the saved model is action_required and the
  // launcher has to confirm one before create is allowed (rule 4).
  const [model, setModel] = useState("");
  // Selecting a Premium (excluded-from-plan) model pops a confirm modal.
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  // §4.7 — customer metadata, set at create.
  const [meta, setMeta] = useState<MetaEntry[]>([]);
  // Lifecycle defaults to a collapsed timeline + summary; controls reveal on Customize.
  const [showLifecycle, setShowLifecycle] = useState(false);
  // .env import — parse KEY=VALUE lines into override rows
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  // Re-seed the model field from the launcher's saved default each time the modal
  // opens, so switching Agents can't carry a stale selection across.
  useEffect(() => {
    if (!open) return;
    // Model is a per-sandbox choice now; open on the featured one.
    setModel(FEATURED_MODEL.id);
    // And re-seed the IDC: this modal mounts once and stays mounted, so the
    // initializer ran while no agent was selected and idcDefault was undefined.
    // Without this, launching a Frankfurt agent silently records IOWA.
    setIdc(idcDefault ?? "us-ia-iowa-1");
    setLaunchSpec(specDefault ?? smallestSpec(idcDefault) ?? "small");
  }, [open, idcDefault, specDefault]);

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
    setModel(FEATURED_MODEL.id);
    setMeta([]);
    setShowLifecycle(false);
    setImportOpen(false);
    setImportText("");
  };

  const close = () => { resetState(); onCancel(); };

  const canCreate = model !== "";
  const submit = () => {
    if (!canCreate) return;
    // §四 — stand-in for `sandbox_spec_not_supported`. The panel stays open, the
    // Spec falls back to the registered one, and the reason appears beside the
    // control. Closing on a rejected create would leave the user guessing why
    // nothing appeared in the list.
    if (specDefault && launchSpec !== specDefault && IDC_REFUSES_SPEC_CHANGE.includes(idc)) {
      setLaunchSpec(specDefault);
      setSpecRejected(specDefault);
      return;
    }
    onSubmit({
      name: name.trim() || undefined,
      idc,
      specId: launchSpec,
      envOverrides: env.filter((e) => e.key.trim().length > 0),
      maxLifetime,
      idleTimeout,
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
    model !== FEATURED_MODEL.id;

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
              Launch sandbox {agentName && <span style={{ color: C.muted, fontWeight: 500 }}> — {agentName}</span>}
            </h3>
            <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "4px 0 0", lineHeight: "16px" }}>
              Provision a new Sandbox from this deployment.
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
          {/* Sandbox Template (F-01) — read-only. In R1 a Sandbox launches from a
              Ready Template produced by the Agent Version build: the image pull and
              dependency install happen at register time, never at create time.
              Image and Spec are both Template-owned; Launch owns IDC, model,
              lifecycle and env. */}
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Sandbox Template <span style={{ letterSpacing: "normal", textTransform: "none", fontWeight: 500 }}>· {agentVersion}</span>
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
            {/* The image is a Template property, like Spec. Launch shows it and
                never offers to change it, so say where it *is* changed rather
                than leaving a read-only field with no explanation. */}
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px", marginRight: 5 }} aria-hidden="true">
                <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Set by this Agent's Template — change it with Edit Template, not per sandbox.
              <V2Badge style={{ marginLeft: 5 }} />
            </span>
          </section>

          {/* v1.3 §C4 — Add Model. Off means the sandbox only starts the runtime.
              The model itself is not a create parameter; it rides in env_vars as
              GMI_MODEL_ID, so this gate is contract-safe. */}
          <section style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>Add Model</label>
                <V2Badge />
              </div>
              <div style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                If no model is selected, this sandbox will only start the runtime environment.
              </div>
            </div>
            <span
              role="switch"
              aria-checked={addModel}
              onClick={() => setAddModel((v) => !v)}
              style={{ width: 36, height: 20, flexShrink: 0, cursor: "pointer", background: addModel ? C.lime : C.border, borderRadius: 999, position: "relative", transition: "background .15s ease" }}
            >
              <span style={{ position: "absolute", top: 2, left: addModel ? 18 : 2, width: 16, height: 16, borderRadius: 999, background: addModel ? C.limeText : "#fafafa", transition: "left .15s ease" }} />
            </span>
          </section>

          {addModel && <>
          {/* Model selection (F-08) — precedence: this per-Runtime override >
              Saved Launch Configuration > the Agent Version's default. The resolved
              value is injected as locked GMI_MODEL_ID. */}
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Model</span>
              <ReleaseBadge r="IND" />
              <PlanBadge />
            </div>
            <select
              value={model}
              onChange={(e) => { const v = e.target.value; if (!v || isStandardModel(v)) setModel(v); else setPendingModel(v); }}
              style={{
                ...inputStyle, fontFamily: FONT, fontSize: 13, cursor: "pointer",
              }}
            >
              <optgroup label="Standard · included (FUP)">
                {STANDARD_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
              <optgroup label="Premium · burns credits">
                {ALL_MODELS.filter((m) => m.lane === "premium").map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.burnBlended} cr/1M</option>
                ))}
              </optgroup>
            </select>
            {/* Confirm modal — a Premium model is excluded from the Coding Plan */}
            {pendingModel && (() => {
              const m = getModel(pendingModel);
              const payg = m ? paygUsdPer1M(m) : null;
              return (
                <div onClick={() => setPendingModel(null)} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                  <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "100%", background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 999, background: "rgba(251,191,36,0.16)", border: "1px solid rgba(251,191,36,0.5)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fbbf24" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
                      </span>
                      <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>Use a Premium model?</h3>
                    </div>
                    <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, lineHeight: "19px", margin: 0 }}>
                      <span style={{ color: C.fg, fontWeight: 600 }}>{m?.name}</span> is excluded from the Coding Agent Plan. Each run draws down your Premium Credits at <span style={{ color: C.fg }}>{m?.burnBlended} credits / 1M tokens</span>{payg != null && <> (pay-as-you-go <span style={{ color: C.fg }}>${payg.toFixed(2)}/1M</span> without a plan)</>}. Standard models run nearly unlimited and free on any plan.
                    </p>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                      <button onClick={() => setPendingModel(null)} style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, background: "transparent", color: C.muted, border: `1px solid ${C.border}`, padding: "7px 14px", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
                      <button onClick={() => { setModel(pendingModel); setPendingModel(null); }} style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, background: "#fbbf24", color: "#0a0a0a", border: "none", padding: "7px 14px", borderRadius: 8, cursor: "pointer" }}>Use {m?.name}</button>
                    </div>
                  </div>
                </div>
              );
            })()}
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
              Chosen per sandbox and injected as locked <span style={{ fontFamily: MONO }}>GMI_MODEL_ID</span> · applies only to Sandboxes created after this change; running Sandboxes are unaffected.
            </span>
            {/* Threshold nudge — how this run bills, based on the launcher's subscription */}
            {(() => {
              const sub = loadSubscription();
              return isSubscribed(sub) ? (
                <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
                  Premium model usage draws from your <span style={{ color: C.lime }}>{getPlan(sub.plan).name}</span> credits — {sub.creditsRemaining.toLocaleString()} left. Standard models are included.
                </span>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "rgba(221,234,77,0.06)", border: "1px solid rgba(221,234,77,0.30)", borderRadius: 8, padding: "8px 10px" }}>
                  <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.fg, flex: "1 1 auto", minWidth: 180 }}>
                    You're on <span style={{ fontWeight: 600 }}>pay-as-you-go</span> — Premium models bill per token at list price. Subscribe to run from a monthly credit pool and keep Standard nearly unlimited.
                  </span>
                  <Link href="/plans" style={{ flexShrink: 0, fontFamily: FONT, fontSize: 12, fontWeight: 700, color: C.limeText, background: C.lime, borderRadius: 7, padding: "5px 12px", textDecoration: "none" }}>Subscribe & save →</Link>
                </div>
              );
            })()}
          </section>

          </>}

          {/* §D/§七.1 — this is the reverse of the previous build. The IDC is
              FIXED: `sandbox_placement_fixed`, and the image is built per IDC,
              so a sandbox cannot be placed anywhere else. The Spec is NOT fixed:
              `instance_type MAY differ` from the registered one, so it is a real
              choice here. We had these two exactly the wrong way round. */}
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>IDC</label>
              <V2Badge />
            </div>
            <div style={{ ...inputStyle, fontFamily: FONT, fontSize: 13, color: C.muted, cursor: "default", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span>{regionLabel(idc)}</span>
              <span style={{ fontFamily: FONT, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 4, padding: "0 6px" }}>FIXED</span>
            </div>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
              Set by the agent — its image is built for this IDC, so every Sandbox lands here.
            </span>
          </section>

          {/* Spec — a real create-time choice, defaulting to the registered one. */}
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>Spec</label>
              <V2Badge />
            </div>
            <select
              value={launchSpec}
              onChange={(e) => { setSpecRejected(null); setLaunchSpec(e.target.value); }}
              style={{ ...inputStyle, fontFamily: FONT, fontSize: 13, cursor: "pointer" }}
            >
              {/* Unavailable sizes stay in the list, disabled. Hiding them makes
                  the catalogue look arbitrarily short and gives the reader no way
                  to learn the size exists elsewhere. */}
              {specsForIdc(idc).map(({ spec, available }) => (
                <option key={spec.id} value={spec.id} disabled={!available}>
                  {spec.id} · {specLabel(spec.id)}{available ? "" : " — not available in this IDC"}
                </option>
              ))}
            </select>
            {/* §7 — the minimum disclosure: both prices, beside the choice that
                sets them. Paused is about 1% of running, and that ratio is the
                whole reason Pause exists, so it belongs here rather than being
                discovered on the bill. */}
            {(() => {
              const sp = STANDARD_SPECS[launchSpec];
              if (!sp) return null;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontFamily: FONT, fontSize: 11.5, color: C.muted, lineHeight: "16px" }}>
                  <span>Running <span style={{ fontFamily: MONO, color: C.fg }}>{money4(runningRate(sp, launchSpec))}</span>/h</span>
                  <span>Paused <span style={{ fontFamily: MONO, color: C.fg }}>{money4(pausedRate(sp, launchSpec))}</span>/h</span>
                  <V2Badge title="New in V2 — both prices are disclosed beside the Spec that sets them." />
                  <Link href="/settings/usage" style={{ color: C.link, textDecoration: "none" }}>Usage &amp; billing →</Link>
                </div>
              );
            })()}
            {/* §四 — the refusal arrives as an error, not as a disabled control:
                nothing tells us beforehand which IDCs reject a Spec change, so
                the picker stays live and this says what happened afterwards. */}
            {specRejected ? (
              <span style={{ display: "flex", alignItems: "flex-start", gap: 7, fontFamily: FONT, fontSize: 11, color: C.warn, lineHeight: "16px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 7, padding: "7px 10px" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                <span>
                  This IDC does not support changing the Spec at Launch — it has been put back to
                  {" "}<span style={{ fontFamily: MONO, color: C.fg }}>{specRejected}</span>. Launch again to continue.
                </span>
              </span>
            ) : (
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
                Defaults to the agent's registered Spec. It may differ per Sandbox.
              </span>
            )}
          </section>

          {/* Name — optional */}
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>
              Name <span style={{ color: C.muted, fontWeight: 400 }}>· optional</span>
            </label>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
              Stored as <span style={{ fontFamily: MONO }}>metadata.name</span> — the create call has no name field of its own.
            </span>
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
              <V2Badge />
            </div>

            {/* Stage timeline — always visible; updates live with the selected settings */}
            <LifecycleTimeline maxActive={maxLifetime} />

            {!showLifecycle ? (
              /* Collapsed — one-line summary + Customize (defaults-first) */
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "16px" }}>
                  Decided by the system · deleted with its files at the limit
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
                {/* Maximum active time (F-02) */}
                {/* §E — bs-api takes a `timeout` at create, but the container
                    server does not forward one, so whatever is picked here
                    cannot reach the sandbox. The control stays visible and
                    inert: the design is decided and waiting on passthrough, and
                    deleting it would lose that. What it must not do is accept a
                    number and silently drop it. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: 0.72 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>
                    Maximum active time
                    <NoApiBadge title="bs-api accepts `timeout` at create; the container server does not pass it through yet." />
                  </span>
                  <select value={maxLifetime} disabled style={{ ...inputStyle, fontFamily: FONT, fontSize: 13, cursor: "not-allowed", color: C.muted }}>
                    <option value="15min">15 minutes</option>
                    <option value="30min">30 minutes</option>
                    <option value="1h">1 hour</option>
                    <option value="4h">4 hours</option>
                    <option value="custom">Custom…</option>
                  </select>
                  <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                    Decided by the system for now — the expiry is reported back once the Sandbox is running.
                    These steps are ours: the API takes any number of seconds and states no minimum or maximum.
                  </span>
                </div>

                {/* Pause when inactive (P1-7) — the swagger has no idle policy and
                    no pause, so this cannot be sent. Kept visible and inert
                    rather than deleted: it is decided design waiting on an API. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.72 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "not-allowed" }}>
                    <input
                      type="checkbox"
                      checked={false}
                      disabled
                      style={{ accentColor: C.lime, width: 15, height: 15, cursor: "not-allowed" }}
                    />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>
                      Pause when inactive
                      <NoApiBadge title="Create accepts template_id / idc_name / timeout / env_vars / metadata only. There is no idle policy and no pause endpoint." />
                    </span>
                  </label>
                  <NoApiNote>
                    No idle policy in the R1 API. A sandbox runs on one wall-clock
                    <span style={{ fontFamily: MONO }}> timeout</span>; work inside it does not extend it.
                    Opening a Terminal does, because attaching calls
                    <span style={{ fontFamily: MONO }}> connect</span>.
                  </NoApiNote>
                  {/* The idle sub-controls used to live here. With the checkbox
                      hard-disabled — there is no idle policy in the API — they
                      were unreachable, and leaving them in would have quietly
                      restored a live idle editor beside a NO API notice if the
                      organisation default ever changed. */}
                </div>

                {/* Read-only policy row — action at the active limit (never deletes) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12 }}>
                    <span style={{ color: C.muted }}>When the limit is reached</span>
                    <span style={{ color: C.err, display: "inline-flex", alignItems: "center", gap: 5 }}><IconTrash size={11} /> Deleted — disk goes with it</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12 }}>
                    <span style={{ color: C.muted }}>Clock</span>
                    <span style={{ color: C.fg }}>Set by the system for now</span>
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                    <V2Badge />
                    <span>
                      One <span style={{ fontFamily: MONO }}>timeout</span>, counted from the moment the sandbox is
                      created. Running, idle and waiting all count. Nothing you do <em>inside</em> extends it — commands
                      and traffic do not reset the clock, so save anything you need out through Filesystem first.
                      The one exception is opening a Terminal: attaching a session is a control-plane
                      <span style={{ fontFamily: MONO }}> connect</span>, which pushes the expiry out to at least 30
                      minutes. There is no pause at the limit: the sandbox is released and its files go with it.
                    </span>
                  </span>
                </div>

                <button
                  onClick={() => { setShowLifecycle(false); setMaxLifetime(TEMPLATE_DEFAULT_CONFIG.maxLifetime); }}
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
              Endpoints come from the Agent. Their live URLs and tokens appear under Access once the sandbox is running —
              and a Running sandbox does not guarantee its Endpoint is Available.
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
              Opaque to AgentBox — never used for routing, quota, billing attribution, or access control. Returned by Get and List, and filterable in the sandbox list.
            </span>
          </section>
        </div>

        {/* Footer — pinned so Create is reachable without scrolling to the end */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderTop: `1px solid ${C.borderSoft}`, background: C.cardSolid }}>
          {/* F-01 acceptance — the call returns a durable Runtime ID immediately and
              never waits on provider acceptance; Running is only reported once
              readiness passes, and transition time is not billed (§4.5). */}
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px", maxWidth: 290 }}>
            Returns a Sandbox ID right away in Pending. Running is reported only after readiness passes; starting time is not billed.
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
              title={canCreate ? undefined : "Confirm a model before creating a Sandbox"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: FONT, fontSize: 13, fontWeight: 600,
                background: canCreate ? C.lime : "#3a3a1f", color: canCreate ? C.limeText : "#6b6b52",
                border: "none",
                padding: "6px 16px", borderRadius: 8, cursor: canCreate ? "pointer" : "not-allowed",
              }}
            >
              Create Sandbox
            </button>
          </div>
        </div>
      </aside>
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

// ─── §I Files ───────────────────────────────────────────────────────────────
// A directory browser, not a path box. The backend exposes only single-file
// upload and download by absolute path — no list, delete, rename or stat — but
// the gap is in OUR middle layer, not the substrate: the substrate can list.
// Every competitor we could verify (E2B, Daytona, Vercel) ships a file browser,
// and "type the full path of a file you cannot see" is not a product.
//
// So the browser is the design, and the listing is assembled in the meantime by
// running one `ls` through the exec API. That is slower — about a second or two
// per level — which is why every navigation has a real loading state instead of
// pretending to be instant. When the list endpoint lands, only `listDir` below
// changes; nothing in the UI moves.
type FileKind = "dir" | "file";
interface DirEntry { name: string; kind: FileKind; sizeBytes?: number }

type TransferState =
  | { kind: "idle" }
  | { kind: "busy"; pct: number; name: string }
  | { kind: "done"; msg: string }
  | { kind: "error"; reason: string; hint: string };

const FILES_ROOT = "/home/user";
/** Mock-only. Not a documented limit — see uploadFailure(). */
const MOCK_OVERSIZE_MB = 100;

/** §I — absolute, and no `.` or `..` segment. Catchable before the round trip. */
function badPath(path: string): string | null {
  if (!path.startsWith("/")) return "Give an absolute path, e.g. /home/user/in.json";
  if (path.split("/").some((seg) => seg === "." || seg === "..")) {
    return "Paths cannot contain . or .. segments — give the full path.";
  }
  return null;
}

function uploadFailure(path: string, sizeMb: number): { reason: string; hint: string } | null {
  const bad = badPath(path);
  if (bad) return { reason: "Invalid path", hint: bad };
  if (/^\/(proc|sys|dev)\//.test(path) || path.startsWith("/root/")) {
    return { reason: "Permission denied", hint: "The sandbox user cannot write here. Try somewhere under /home/user/." };
  }
  // The threshold is a MOCK trigger so the rejected state is reachable in the
  // prototype — the contract does not state a per-file limit and neither does
  // this copy. Put the real number back once the swagger names one.
  if (sizeMb > MOCK_OVERSIZE_MB) {
    return { reason: "File too large", hint: "The upload was rejected before anything was written — there is no partial file." };
  }
  return null;
}

function fmtSize(bytes?: number): string {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Mock filesystem. Keyed by absolute directory path.
const MOCK_TREE: Record<string, DirEntry[]> = {
  "/home/user": [
    { name: "data", kind: "dir" },
    { name: "out", kind: "dir" },
    { name: "main.py", kind: "file", sizeBytes: 4213 },
    { name: "requirements.txt", kind: "file", sizeBytes: 287 },
    { name: ".env.example", kind: "file", sizeBytes: 142 },
  ],
  "/home/user/data": [
    { name: "raw", kind: "dir" },
    { name: "input.json", kind: "file", sizeBytes: 1_842_112 },
    { name: "labels.csv", kind: "file", sizeBytes: 90_233 },
  ],
  "/home/user/data/raw": [
    { name: "batch-001.ndjson", kind: "file", sizeBytes: 12_884_901 },
  ],
  "/home/user/out": [
    { name: "result.json", kind: "file", sizeBytes: 5_120 },
    { name: "run.log", kind: "file", sizeBytes: 71_338 },
  ],
};

/**
 * The one function that changes when the list endpoint lands. Today it stands in
 * for "run `ls` over exec and parse it", which is why it is slow and why it can
 * fail on an image with no shell.
 */
function listDir(path: string): Promise<DirEntry[]> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      const rows = MOCK_TREE[path];
      if (!rows) reject(new Error("no such directory"));
      else resolve(rows);
    }, 1100 + Math.random() * 700);   // §四 — a level costs 1–2 seconds
  });
}

function FilesSection({ inst }: { inst: Instance }) {
  const running = inst.status === "running";
  const creating = inst.status === "pending" || inst.status === "creating";
  const [cwd, setCwd] = useState(FILES_ROOT);
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [listing, setListing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [up, setUp] = useState<TransferState>({ kind: "idle" });
  const [down, setDown] = useState<TransferState>({ kind: "idle" });
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);
  const after = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };

  // §I — writing needs creator or org_owner; reading needs neither. So a
  // read-only viewer loses upload and KEEPS download.
  const canWrite = CAN_WRITE_FILES;

  useEffect(() => {
    if (!running) { setEntries(null); return; }
    let cancelled = false;
    setListing(true);
    setListError(null);
    listDir(cwd)
      .then((rows) => { if (!cancelled) setEntries(rows); })
      .catch(() => { if (!cancelled) { setEntries(null); setListError(`Could not list ${cwd}.`); } })
      .finally(() => { if (!cancelled) setListing(false); });
    return () => { cancelled = true; };
  }, [cwd, running]);

  const blocked =
    creating ? "The Sandbox is still being created — files open once it reports Running."
  : !running  ? `Files are available only while the Sandbox is Running (this one is ${statusLabel(inst.status)}).`
  : null;

  const startUpload = (file: File) => {
    const target = `${cwd}/${file.name}`;
    const sizeMb = file.size / (1024 * 1024);
    const fail = uploadFailure(target, sizeMb);
    const clash = entries?.some((e) => e.kind === "file" && e.name === file.name);
    setUp({ kind: "busy", pct: 0, name: file.name });
    [18, 44, 71, 93].forEach((pct, i) => after(140 * (i + 1), () => setUp((s0) => (s0.kind === "busy" ? { ...s0, pct } : s0))));
    after(760, () => {
      if (fail) { setUp({ kind: "error", ...fail }); return; }
      setUp({ kind: "done", msg: `${clash ? "Replaced" : "Uploaded"} ${file.name} in ${cwd}` });
      setEntries((prev) => {
        const rows = prev ?? [];
        if (rows.some((e) => e.name === file.name)) {
          return rows.map((e) => (e.name === file.name ? { ...e, sizeBytes: file.size } : e));
        }
        return [...rows, { name: file.name, kind: "file" as const, sizeBytes: file.size }];
      });
    });
  };

  const startDownload = (name: string) => {
    setDown({ kind: "busy", pct: 0, name });
    // No total size comes back, so there is no honest percentage — the bar is
    // indeterminate on purpose.
    [30, 66, 90].forEach((pct, i) => after(150 * (i + 1), () => setDown((s0) => (s0.kind === "busy" ? { ...s0, pct } : s0))));
    after(700, () => setDown({ kind: "done", msg: `Downloaded ${name}` }));
  };

  const segments = cwd.split("/").filter(Boolean);
  const crumb = (i: number) => `/${segments.slice(0, i + 1).join("/")}`;

  const feedback = (st: TransferState) => {
    if (st.kind === "idle") return null;
    if (st.kind === "busy") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>{st.name} · {st.pct}%</span>
          <div style={{ height: 3, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${st.pct}%`, height: "100%", background: C.lime, transition: "width .14s linear" }} />
          </div>
        </div>
      );
    }
    if (st.kind === "done") {
      return (
        <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 6, fontFamily: FONT, fontSize: 11, color: C.ok, lineHeight: "16px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 6 9 17l-5-5" /></svg>
          {st.msg}
        </span>
      );
    }
    return (
      <span style={{ display: "flex", alignItems: "flex-start", gap: 6, fontFamily: FONT, fontSize: 11, lineHeight: "16px", color: C.err }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
        <span><span style={{ fontWeight: 600 }}>{st.reason}</span> — <span style={{ color: C.muted }}>{st.hint}</span></span>
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h4 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>Files</h4>
        <V2Badge />
      </div>

      {blocked && (
        <span style={{ display: "flex", alignItems: "flex-start", gap: 7, fontFamily: FONT, fontSize: 11.5, color: C.warn, lineHeight: "16px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "8px 11px" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
          {blocked}
        </span>
      )}

      {running && (
        <>
          {/* Breadcrumb — every segment is a way back up. */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", fontFamily: MONO, fontSize: 12 }}>
            {segments.map((seg, i) => {
              const target = crumb(i);
              const last = i === segments.length - 1;
              return (
                <span key={target} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: C.borderSoft }}>/</span>
                  <button
                    disabled={last || listing}
                    onClick={() => setCwd(target)}
                    style={{
                      background: "transparent", border: "none", padding: 0,
                      fontFamily: MONO, fontSize: 12,
                      color: last ? C.fg : C.link,
                      cursor: last || listing ? "default" : "pointer",
                    }}
                  >
                    {seg}
                  </button>
                </span>
              );
            })}
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 90px", gap: 10, padding: "7px 12px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${C.borderSoft}`, fontFamily: FONT, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: C.muted }}>
              <div>Name</div><div>Type</div><div style={{ textAlign: "right" }}>Size</div>
            </div>

            {/* §四 — a level costs a second or two while the listing is pieced
                together from a command, so the wait is shown rather than hidden. */}
            {listing ? (
              <div style={{ padding: "18px 12px", display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 12, color: C.muted }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: C.warn, animation: "pulse 1.2s ease-in-out infinite" }} />
                Listing {cwd}…
              </div>
            ) : listError ? (
              <div style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.err }}>{listError}</span>
                <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                  Listings are assembled by running a command inside the Sandbox, so an image without a shell cannot be browsed.
                  You can still download by full path below.
                </span>
              </div>
            ) : entries && entries.length === 0 ? (
              <div style={{ padding: "18px 12px", fontFamily: FONT, fontSize: 12, color: C.muted }}>This folder is empty.</div>
            ) : (
              (entries ?? []).map((e) => (
                <button
                  key={e.name}
                  onClick={() => (e.kind === "dir" ? setCwd(`${cwd}/${e.name}`) : startDownload(e.name))}
                  title={e.kind === "dir" ? `Open ${e.name}` : `Download ${e.name}`}
                  style={{
                    width: "100%", textAlign: "left", cursor: "pointer",
                    display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 90px", gap: 10,
                    alignItems: "center", padding: "8px 12px",
                    background: "transparent", border: "none",
                    borderBottom: `1px solid ${C.borderSoft}`,
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span style={{ color: e.kind === "dir" ? C.lime : C.muted, flexShrink: 0, display: "inline-flex" }}>
                      {e.kind === "dir"
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                        : <IconFile size={13} />}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                  </span>
                  <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted }}>{e.kind === "dir" ? "Folder" : "File"}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.muted, textAlign: "right" }}>{e.kind === "dir" ? "—" : fmtSize(e.sizeBytes)}</span>
                </button>
              ))
            )}
          </div>
          {feedback(down)}

          {/* Upload lands in the folder being looked at — no second path field
              to keep in sync with the breadcrumb. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, opacity: canWrite ? 1 : 0.6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ ...(canWrite
                ? { background: C.lime, color: C.limeText, border: "none", cursor: "pointer" }
                : { background: "transparent", color: "#5a5a5a", border: `1px solid ${C.border}`, cursor: "not-allowed" }),
                fontFamily: FONT, fontSize: 12, fontWeight: 600, padding: "7px 12px", borderRadius: 8 }}>
                <input
                  type="file"
                  disabled={!canWrite}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) startUpload(f); e.target.value = ""; }}
                  style={{ display: "none" }}
                />
                Upload to this folder
              </label>
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
                Goes to <span style={{ fontFamily: MONO, color: C.fg }}>{cwd}/</span> ·{" "}
                <span style={{ color: C.warn }}>an existing file with the same name is replaced</span>
              </span>
            </div>
            {!canWrite && (
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.warn, lineHeight: "15px" }}>
                You can browse and download here but not upload — writing needs the creator or an organization owner.
              </span>
            )}
            {feedback(up)}
          </div>

          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
            Click a file to download it. No delete, rename or preview yet.
            Files live on this Sandbox — <span style={{ color: C.fg }}>deleting it deletes them permanently</span>.
          </span>
        </>
      )}
    </div>
  );
}

// ─── §K Access ──────────────────────────────────────────────────────────────
// The backend hands back one `endpoint_url` — no port, no scheme choice, no
// visibility toggle. So the only branch that matters is whether that field came
// back at all; there is nothing to ask the user and nothing to assemble.
//
// No Credential block. The console never holds the sandbox token: it is minted
// by /connect for the data plane and is not ours to reveal, copy or rotate. The
// previous version offered all three, which promised a capability the frontend
// does not have.
function AccessSection({ inst }: { inst: Instance; endpoints?: AgentEndpoint[] }) {
  const running = inst.status === "running";
  if (!inst.endpointUrl) return null;   // §K — no address, no section

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: C.muted, display: "inline-flex" }}><IconNetwork size={14} /></span>
        <h4 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>Access</h4>
        <V2Badge />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Endpoint</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, background: C.pillBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 11px", fontFamily: MONO, fontSize: 12, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {inst.endpointUrl}
          </span>
          <CopyButton value={inst.endpointUrl} />
          <a
            href={running ? inst.endpointUrl : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!running}
            title={running ? "Open in a new tab" : `The Sandbox is ${statusLabel(inst.status)} — the endpoint answers only while it is Running.`}
            style={{
              flexShrink: 0, textDecoration: "none",
              fontFamily: FONT, fontSize: 12, fontWeight: 600,
              background: running ? C.lime : "transparent",
              color: running ? C.limeText : "#5a5a5a",
              border: running ? "none" : `1px solid ${C.border}`,
              borderRadius: 7, padding: "7px 14px",
              cursor: running ? "pointer" : "not-allowed",
              pointerEvents: running ? "auto" : "none",
            }}
          >
            Open
          </a>
        </div>
      </div>

      {/* The one thing about this URL the operator has to know. */}
      <span style={{ display: "flex", alignItems: "flex-start", gap: 7, fontFamily: FONT, fontSize: 11, color: C.warn, lineHeight: "16px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "8px 11px" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
        Anyone with this link can reach the Sandbox. There is no sign-in in front of it.
      </span>

      <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
        If the page does not load, the Sandbox is running but your program may not be listening yet — check it started
        from the <span style={{ color: C.fg }}>Terminal</span>.
      </span>
    </div>
  );
}

// ─── Instance drawer (PRD §5.4) ──────────────────────────────────────────────
// Opens from a row click — no ⋮ → View Details hop — and slides in beside the
// list so the list stays visible and the next instance is one click away.
// Everything that used to be stacked in one scrolling popup is grouped into
// tabs, and the endpoint confirmations are inline instead of a second modal.
// Tabs are the intersection of what E2B and Daytona actually ship.
//
//   E2B      /sandboxes/[id]/{monitoring,logs,terminal,filesystem} + index
//   Daytona  Overview · Logs · Traces · Metrics · Spending · Terminal ·
//            Filesystem · VNC
//   Vercel   one Connect surface: shell, files, commands, ports
//
// So: Overview, Metrics, Logs, Terminal, Filesystem. Two names the spec asked
// for are not in any of them and are gone — "Work" exists nowhere, and neither
// does an "Access" tab; Daytona reaches credentials through a row action, which
// is where ours went. Running one command lives inside Terminal, which is
// Vercel's Connect shape.
// Metrics and Logs are gone: neither has an endpoint in the Sandbox contract
// (no /usage, no /logs), so two of five tabs were dead. They stay in the union
// only so an existing /dashboard/sandbox/:id/logs URL still resolves — TAB_ALIAS
// redirects them to Overview rather than 404ing someone's bookmark.
// ─── §H Run ─────────────────────────────────────────────────────────────────
// POST /tasks/{id}/exec. The status code IS the protocol:
//   200 — the command finished inside the wait window; the body is the result
//   202 — still running; poll until it settles
// There is no `cwd` parameter and no per-command timeout, so this form has no
// advanced section to hide. `wait_timeout` is a long-poll ceiling, not a command
// timeout: passing it does not kill anything, which is why there is no timed-out
// state here. A command that outlives the window simply keeps running.
type ExecState = "pending" | "running" | "cancelling" | "cancelled" | "succeeded" | "failed";

interface Execution {
  id: string;
  command: string;
  state: ExecState;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated?: boolean;
  startedAt: number;
  endedAt?: number;
}

/**
 * The backend spells cancellation with one L in some places and two in others,
 * and an unrecognised status must never be treated as terminal — polling has to
 * continue or the UI strands a command that is still running.
 */
function normalizeExecState(raw: string): ExecState | null {
  const v = raw.toLowerCase();
  if (v === "cancelling" || v === "canceling") return "cancelling";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  if (v === "pending") return "pending";
  if (v === "running" || v === "in_progress") return "running";
  if (v === "succeeded" || v === "success" || v === "completed") return "succeeded";
  if (v === "failed" || v === "error") return "failed";
  return null;   // unknown → keep polling
}

function execSeconds(ex: Execution): string {
  const ms = (ex.endedAt ?? Date.now()) - ex.startedAt;
  return `${(ms / 1000).toFixed(1)}s`;
}

// Mock outcomes. Long-running commands stay running so Cancel is reachable.
function mockExec(cmd: string): { state: ExecState; exitCode: number; stdout: string; stderr: string; truncated?: boolean; ms: number } {
  const c = cmd.trim();
  if (/^ls\b/.test(c))     return { state: "succeeded", exitCode: 0, stdout: "main.py\nrequirements.txt\ndata/\nout/", stderr: "", ms: 400 };
  if (/^pwd\b/.test(c))    return { state: "succeeded", exitCode: 0, stdout: "/home/user", stderr: "", ms: 300 };
  if (/^cat\b/.test(c))    return { state: "succeeded", exitCode: 0, stdout: Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n"), stderr: "", truncated: true, ms: 600 };
  if (/^python|^node|^\.\//.test(c)) return { state: "succeeded", exitCode: 0, stdout: "loaded 1,284 rows\nwrote out/result.json", stderr: "", ms: 2600 };
  if (/^pip |^npm /.test(c)) return { state: "succeeded", exitCode: 0, stdout: "Successfully installed 4 packages", stderr: "", ms: 3400 };
  return { state: "failed", exitCode: 127, stdout: "", stderr: `sh: 1: ${c.split(" ")[0]}: not found`, ms: 500 };
}
function mockIsLongRunning(cmd: string): boolean {
  return /\bsleep\b|\btrain\b|\bwatch\b|\btail -f\b/.test(cmd.trim());
}

function RunPane({
  inst, history, setHistory,
}: {
  inst: Instance;
  history: Execution[];
  setHistory: (fn: (prev: Execution[]) => Execution[]) => void;
}) {
  const [cmd, setCmd] = useState("");
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);
  const after = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };

  const running = inst.status === "running";
  const live = history.find((h) => h.state === "pending" || h.state === "running" || h.state === "cancelling");

  const patch = (id: string, p: Partial<Execution>) =>
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, ...p } : h)));

  const submit = () => {
    const c = cmd.trim();
    if (!c || !running || live) return;
    const id = `exec_${Math.random().toString(16).slice(2, 10)}`;
    setHistory((prev) => [{ id, command: c, state: "running", exitCode: null, stdout: "", stderr: "", startedAt: Date.now() }, ...prev]);
    setCmd("");
    if (mockIsLongRunning(c)) return;      // stays running so Cancel is reachable
    const out = mockExec(c);
    after(out.ms, () => patch(id, {
      state: out.state, exitCode: out.exitCode,
      stdout: out.stdout, stderr: out.stderr,
      stdoutTruncated: out.truncated, endedAt: Date.now(),
    }));
  };

  const cancel = (ex: Execution) => {
    patch(ex.id, { state: "cancelling" });
    after(700, () => patch(ex.id, { state: "cancelled", endedAt: Date.now() }));
  };

  const blocked = !running
    ? `Run needs a Running Sandbox — this one is ${statusLabel(inst.status)}.`
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h4 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>Run Command</h4>
        <V2Badge />
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>POST /exec</span>
      </div>

      {blocked && (
        <span style={{ display: "flex", alignItems: "flex-start", gap: 7, fontFamily: FONT, fontSize: 11.5, color: C.warn, lineHeight: "16px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "8px 11px" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
          {blocked}
        </span>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: 13, color: C.lime, flexShrink: 0 }}>$</span>
        <input
          value={cmd}
          disabled={!running || !!live}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") submit(); }}
          placeholder="python main.py --input data/in.json"
          style={{
            flex: 1, minWidth: 0,
            background: running ? C.pillBg : "rgba(255,255,255,0.02)",
            border: `1px solid ${C.border}`, color: running ? C.fg : C.muted,
            fontFamily: MONO, fontSize: 12.5, padding: "8px 11px", borderRadius: 8, outline: "none",
          }}
        />
        <button
          onClick={submit}
          disabled={!running || !!live || cmd.trim() === ""}
          title={live ? "One command at a time — the current one is still running." : undefined}
          style={{
            flexShrink: 0, fontFamily: FONT, fontSize: 12.5, fontWeight: 600,
            background: running && !live && cmd.trim() ? C.lime : "transparent",
            color: running && !live && cmd.trim() ? C.limeText : "#5a5a5a",
            border: running && !live && cmd.trim() ? "none" : `1px solid ${C.border}`,
            borderRadius: 8, padding: "8px 16px",
            cursor: running && !live && cmd.trim() ? "pointer" : "not-allowed",
          }}
        >
          Run
        </button>
      </div>

      <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
        One command at a time. <span style={{ color: C.fg }}>For an interactive session, use the Terminal.</span>{" "}
        There is no working directory or per-command timeout — a command that outlives the response keeps running in the background.
      </span>

      {history.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {history.map((ex) => {
            const bad = ex.state === "failed" || (ex.exitCode !== null && ex.exitCode !== 0);
            const inFlight = ex.state === "pending" || ex.state === "running" || ex.state === "cancelling";
            const head =
              ex.state === "pending"    ? { text: "Queued…", color: C.warn }
            : ex.state === "running"    ? { text: "Running…", color: C.warn }
            : ex.state === "cancelling" ? { text: "Cancelling…", color: C.warn }
            : ex.state === "cancelled"  ? { text: `Cancelled · ${execSeconds(ex)}`, color: C.muted }
            : bad                       ? { text: `exit ${ex.exitCode ?? "—"} · ${execSeconds(ex)}`, color: C.err }
            :                             { text: `exit ${ex.exitCode} · ${execSeconds(ex)}`, color: C.ok };
            return (
              <div key={ex.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 11px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${C.borderSoft}` }}>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.lime, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>$ {ex.command}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: head.color, flexShrink: 0 }}>{head.text}</span>
                  {(ex.stdout || ex.stderr) && (
                    <CopyButton value={[ex.stdout, ex.stderr].filter(Boolean).join("\n")} />
                  )}
                  {/* §H — Cancel is a plain button on a running command, not a
                      menu item. It is the only thing anyone wants at that moment. */}
                  {inFlight && (ex.state === "pending" || ex.state === "running") && (
                    <button
                      onClick={() => cancel(ex)}
                      style={{ flexShrink: 0, fontFamily: FONT, fontSize: 11, fontWeight: 600, background: "transparent", color: C.fg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 9px", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {(ex.stdout || ex.stderr) && (
                  <pre style={{ margin: 0, background: "#000", color: "#d4d4d4", fontFamily: MONO, fontSize: 11.5, lineHeight: "18px", padding: "9px 11px", maxHeight: 220, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {ex.stdout}
                    {ex.stderr && <span style={{ color: "#fca5a5" }}>{ex.stdout ? "\n" : ""}{ex.stderr}</span>}
                  </pre>
                )}
                {ex.stdoutTruncated && (
                  <div style={{ padding: "6px 11px", borderTop: `1px solid ${C.borderSoft}`, fontFamily: FONT, fontSize: 11, color: C.muted }}>
                    Output was truncated by the server — redirect to a file and download it for the whole thing.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type DrawerTab = "overview" | "metrics" | "logs" | "terminal" | "files" | "work" | "access" | "run" | "config";
// Old links keep resolving.
const TAB_ALIAS: Partial<Record<DrawerTab, DrawerTab>> = {
  // `run` and `access` are real tabs again (§H/§K), so they no longer redirect.
  work: "terminal", config: "overview",
  // Retired 2026-09-09 — no /logs and no /usage endpoint exists, so both tabs
  // were permanently empty. Old links land on Overview instead of 404ing.
  metrics: "overview", logs: "overview",
};
interface DrawerTabDef { key: DrawerTab; label: string; runningOnly?: boolean; v2?: boolean }
/**
 * §G — which panes exist is a property of the task, read off `capabilities`.
 * Matching on a runtime name would put a Files tab on anything we happened to
 * call a sandbox, and hide one on anything we did not. Access is extra: it
 * appears only when the backend actually handed back an endpoint (§K).
 */
function drawerTabsFor(inst: Instance): DrawerTabDef[] {
  const caps = capsOf(inst);
  const tabs: DrawerTabDef[] = [{ key: "overview", label: "Overview" }];
  if (caps.exec)  tabs.push({ key: "run",      label: "Run Command", runningOnly: true, v2: true });
  if (caps.shell) tabs.push({ key: "terminal", label: "Terminal",   runningOnly: true, v2: true });
  if (caps.files) tabs.push({ key: "files",    label: "Filesystem", v2: true });
  if (inst.endpointUrl) tabs.push({ key: "access", label: "Access" });
  return tabs;
}
const DRAWER_WIDTH = 560;

function InstanceDrawer({
  inst, deploymentName, agentVersion, endpoints, idc, product, tab, onTab,
  variant = "drawer", tabHref, onConnectSandbox, tokenStale = false,
  execHistory, setExecHistory,
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
  /** POST /connect — floors the expiry; returns what moved, or null. */
  onConnectSandbox: (id: string) => { extendedToMins: number } | null;
  /**
   * The access token is bound to the sandbox lifetime, so extending it re-signs
   * the token and invalidates the one the user already copied. Say so before
   * they hit a 401 they cannot explain.
   */
  tokenStale?: boolean;
  /** "page" renders full width at its own URL; "drawer" is the slide-over. */
  variant?: "drawer" | "page";
  /** Tabs are links in page mode, so the URL is the state. */
  tabHref?: (t: DrawerTab) => string;
  /** §H — kept at page level and keyed by sandbox, so switching tabs does not
      throw away a result the user is still reading. */
  execHistory: Execution[];
  setExecHistory: (fn: (prev: Execution[]) => Execution[]) => void;
  onAction: (id: string, action: RowAction) => void;
  onPatchMetadata: (id: string, next: MetaEntry[]) => void;
  onClose: () => void;
}) {
  if (!inst) return null;
  const running = inst.status === "running";
  // §E — the control plane's `expires_at` is the only lifecycle number we can
  // stand behind, so everything here derives from it.
  const clock = lifecycleClock(inst);
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

  const actionBtn = (label: string, icon: React.ReactNode, action: RowAction, kind: "primary" | "ghost" | "danger", noApi = false, v21 = false, batch2 = false) => (
    <button
      onClick={() => onAction(inst.id, action)}
      title={
        noApi ? NO_API_REASON
        : action === "delete" ? "Available in every state, confirmed or not — never rejected as a lifecycle conflict."
        : undefined
      }
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: FONT, fontSize: 12.5, fontWeight: kind === "primary" ? 600 : 500,
        background: kind === "primary" ? C.lime : "transparent",
        color: kind === "primary" ? C.limeText : kind === "danger" ? C.err : C.fg,
        border: kind === "primary" ? "none" : `1px solid ${C.border}`,
        padding: "5px 11px", borderRadius: 7, cursor: "pointer",
      }}
    >
      {icon} {label} {batch2 && <BatchBadge batch={2} />} {v21 && <V21Badge />} {noApi && <NoApiBadge />}
    </button>
  );

  const visibleTabs = drawerTabsFor(inst).filter((t) => !t.runningOnly || running);
  const resolvedTab = TAB_ALIAS[tab] ?? tab;
  const activeTab = visibleTabs.some((t) => t.key === resolvedTab) ? resolvedTab : "overview";

  const isPage = variant === "page";
  return (
    <aside
      style={isPage ? {
        // Page mode: its own URL, full width, no shadow, no animation — this is
        // the primary surface, matching how E2B's dashboard routes
        // /sandboxes/[id]/terminal and /filesystem rather than burying them.
        width: "100%",
        background: "transparent",
        display: "flex", flexDirection: "column",
        minHeight: 0,
      } : {
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
          {/* Only the drawer gets a close affordance. On a page the breadcrumb
              and the browser's own back button are the way out; an ✕ beside
              them reads as "dismiss this panel" on something that is not one. */}
          {!isPage && (
            <button
              onClick={onClose}
              aria-label={isPage ? "Back to My Agents" : "Close sandbox detail"}
              style={{ flexShrink: 0, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, cursor: "pointer" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
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
          {/* Three different release stories, three different markers:
              Pause and Resume are 2.0 but batch 2 — designed, drawn, waiting on
              the sandbox API, about two weeks behind the UI release.
              Snapshot is not in 2.0 at all; it lands in 2.1.
              Everything else here ships in batch 1. */}
          {running && actionBtn("Pause", <IconSuspend />, "suspend", "ghost", false, false, true)}
          {inst.status === "suspended" && actionBtn("Resume", <IconResume />, "resume", "primary", false, false, true)}
          {running && actionBtn("Create Snapshot", <IconSnapshot />, "snapshot", "ghost", true, true)}
          {(inst.status === "error" || inst.unconfirmed) && actionBtn("Retry", <IconRestart />, "retry", "ghost")}
          {inst.status !== "deleted" && inst.status !== "deleting" && actionBtn("Delete", <IconTrash />, "delete", "danger")}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "0 12px", borderBottom: `1px solid ${C.borderSoft}`, overflowX: "auto" }}>
        {visibleTabs.map((t) => {
          const on = t.key === activeTab;
          const Tag: any = isPage && tabHref ? Link : "button";
          const nav = isPage && tabHref ? { href: tabHref(t.key) } : { onClick: () => onTab(t.key) };
          return (
            <Tag
              key={t.key}
              {...nav}
              style={{
                textDecoration: "none",
                fontFamily: FONT, fontSize: 12.5, fontWeight: on ? 600 : 500,
                color: on ? C.fg : C.muted,
                background: "transparent", border: "none",
                borderBottom: `2px solid ${on ? C.lime : "transparent"}`,
                padding: "10px 10px", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              {t.label}
              {t.v2 && <V2Badge />}
            </Tag>
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
            {row("IDC", idc)}
            {row("Spec", specLabel(inst.specId) === "—" ? product : `${specName(inst.specId)} · ${specLabel(inst.specId)}`)}
            {row("Public IP", "—")}
            {row("Created at", inst.created, true)}
            {row("Updated at", inst.latestOperation?.at ?? inst.created, true)}

            {/* §E Lifecycle — the whole block is capability-gated, and what it
                shows is what the control plane reports: an instant and the time
                left. "Maximum active time" and "Active time used" are gone: the
                requested duration stops describing anything once the lease
                auto-renews on read, so a total and a used-so-far were two
                numbers we could not stand behind. */}
            {capsOf(inst).expiry && (
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <h4 style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: C.fg, margin: 0 }}>Lifecycle</h4>
                  <V2Badge />
                </div>
                {inst.endAt ? (
                  <>
                    <DetailRow label="Expires at" value={inst.endAt} />
                    <DetailRow
                      label="Time left"
                      value={remainingLabel(Math.max(0, clock.leftMins))}
                      accent={clock.leftMins < 5 ? C.warn : undefined}
                    />
                    <DetailRow label="At the limit" value="This Sandbox and its files are permanently deleted" accent={C.err} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                      <button
                        disabled
                        title="Extending needs POST /tasks/{id}/timeout, which the container server does not expose yet."
                        style={{
                          fontFamily: FONT, fontSize: 12, fontWeight: 600,
                          background: "transparent", color: "#5a5a5a",
                          border: `1px solid ${C.border}`, borderRadius: 7,
                          padding: "5px 14px", cursor: "not-allowed",
                        }}
                      >
                        Extend
                      </button>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                        <NoApiBadge title="bs-api has POST /sandboxes/{id}/timeout; the container server does not pass it through." />
                        Sets a new expiry counted from now — not added to the current one.
                      </span>
                    </div>
                  </>
                ) : (
                  <DetailRow label="Expiry" value="No automatic limit" />
                )}
              </div>
            )}

            {/* Storage & billing (§4.5) */}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              <h4 style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: C.fg, margin: 0 }}>Storage &amp; billing</h4>
              <DetailRow
                label="Storage"
                value={inst.status === "suspended" ? `Paused · charges continue (≈$${pausedCostMo(inst)}/mo)` : "Active (running)"}
                accent={inst.status === "suspended" ? "#60a5fa" : undefined}
              />
              <DetailRow
                label="Clock"
                value="Set by the system; the Sandbox reports the instant it expires"
              />
              <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px", marginTop: 2 }}>
                Starting, pausing, and resuming time is not billed. Compute metering starts when Running is confirmed and stops on a
                confirmed Pause or release. Resume is a fresh boot of the same disk: the ID and files are kept, memory, processes, and
                live connections are not. Exact charges live in Spending.
              </div>
            </div>


          </>
        )}


        {activeTab === "files"  && <FilesSection inst={inst} />}
        {activeTab === "run"    && <RunPane inst={inst} history={execHistory} setHistory={setExecHistory} />}
        {activeTab === "access" && <AccessSection inst={inst} endpoints={endpoints} />}
        {activeTab === "terminal" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Retired 2026-09-09 — the one-shot "Run Command" pane is gone. No
                sandbox console ships one: Runloop, Vercel Connect, Cloudflare and
                Daytona all put command execution in an interactive shell, and E2B
                and Modal keep it in the SDK entirely. `POST /executions` still
                exists in the contract; it is an SDK call, not a console screen. */}
            <div>
              <TerminalV2
                sandboxId={inst.id}
                sandboxKey={midId(inst.id)}
                domain="sandbox.gmi.cloud"
                canConnect={running}
                blockedReason={`A session needs a Running Sandbox — this one is ${statusLabel(inst.status)}.`}
                onConnect={() => onConnectSandbox(inst.id)}
              />
              {tokenStale && (
                <div
                  role="status"
                  style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 10, fontFamily: FONT, fontSize: 11.5, lineHeight: "16px", color: C.fg, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: 8, padding: "9px 11px" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.warn} strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
                  The expiry changed, so the control plane re-signed this sandbox&apos;s access token.
                  Any token you copied earlier no longer works — reconnect above to get the current one.
                </div>
              )}
            </div>
          </div>
        )}


        {/* §六.B does not name a Config tab; "what this sandbox was created with" is
            Overview material, so it renders there. */}
        {activeTab === "overview" && (
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
                What this sandbox was created with. Platform keys are locked; overrides were fixed at create.
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
  /** §五 — set a new total lifetime for a sandbox, in minutes from creation. */
  onProvision: (agentId: string) => void;
  onAction: (id: string, action: RowAction) => void;
  // A row click opens the drawer. Terminal and Filesystem live there
  // too, so nothing expands inline and no view is reachable through ⋮ only.
  onOpenDetail: (id: string, tab?: DrawerTab) => void;
  activeInstanceId: string | null;
  canConvert?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "running" | "paused" | "inprogress" | "error">("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc"); // Launched column sort
  // Expand a row to see everything it can do, named, without opening a menu or
  // navigating first. Nobody discovers an action they cannot see.
  const [expanded, setExpanded] = useState<string | null>(null);

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
      {/* Sandbox Overview — rollup across this agent's instances */}
      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 12px" }}>
          Sandbox Overview
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {/* §I — these four carried engineering notes ("status = running",
              "red tab badge if > 0", "max(createdAt)") and were live in front of
              customers. Replaced with what the number means to the person
              reading it, or nothing where the label already says it. */}
          <MetricCard label="Running" value={String(agg.active)} helper="ready to use" accent={C.ok} />
          <MetricCard label="Failed" value={String(agg.error)} helper={agg.error > 0 ? "needs attention" : undefined} accent={C.err} />
          <MetricCard label="Creating" value={String(agg.creating)} helper="not usable yet" accent={C.warn} />
          <MetricCard label="Last launched" value={agg.lastProvisioned ? agoLabel(agg.lastProvisioned) : "—"} accent={C.muted} />
        </div>
      </section>

      {/* Instances — header is just a label now; "+ Sandbox" lives in
          the agent detail header next to Manage Listing ▼. */}
      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 4px" }}>
          Sandboxes
        </h3>
        <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "16px", color: C.muted, margin: "0 0 12px" }}>
          Create returns a Sandbox ID immediately in Pending — Running is reported only once readiness passes.
          Filter by customer metadata with <span style={{ fontFamily: MONO }}>key=value</span>.
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
              // Header must track the row grid below.
              gridTemplateColumns: "26px 1.1fr 1.3fr 0.85fr 1.7fr 0.65fr 1.4fr",
              padding: "10px 16px",
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.02)",
              fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: "16px",
              alignItems: "center",
            }}
          >
            <div />
            <div>Sandbox</div>
            <div>Endpoint</div>
            <div>Status</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>Expires <NewBadge /> <V2Badge /></div>
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
              No sandboxes yet
            </div>
          ) : (
            filtered.map((inst, i) => {
              const active = inst.id === activeInstanceId;
              return (
                <div key={inst.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    title="Open sandbox detail"
                    onClick={() => onOpenDetail(inst.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenDetail(inst.id); } }}
                    style={{
                      display: "grid",
                      // Lifecycle carries a countdown, a bar and Extend now, so it
                      // takes the width Launched no longer needs.
                      gridTemplateColumns: "26px 1.1fr 1.3fr 0.85fr 1.7fr 0.65fr 1.4fr",
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
                    {/* Disclosure — the row was clickable with nothing saying so,
                        which is why people went hunting in the ⋮ instead. */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpanded((x) => (x === inst.id ? null : inst.id)); }}
                      aria-expanded={expanded === inst.id}
                      aria-label={expanded === inst.id ? "Hide what this sandbox can do" : "Show what this sandbox can do"}
                      title={expanded === inst.id ? "Hide actions" : "Show everything this sandbox can do"}
                      style={{
                        width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: "transparent", color: expanded === inst.id ? C.fg : C.muted,
                        border: "none", borderRadius: 5, cursor: "pointer", padding: 0,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                           style={{ transform: expanded === inst.id ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                    <div style={{ minWidth: 0 }}>
                      <div
                        title={inst.config?.name
                          ? `${inst.config.name} · ${inst.id}`
                          : `${inst.id} — this Sandbox has no name yet; the API does not return one`}
                        style={{ color: inst.config?.name ? C.fg : C.muted, fontFamily: inst.config?.name ? FONT : MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
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
                    {(() => {
                      const pending = inst.status === "pending" || inst.status === "creating";
                      const label =
                        inst.status === "suspended" ? "Unavailable while paused"
                        : pending ? "Not ready yet"
                        : inst.endpointUrl ? inst.endpointUrl.replace(/^https?:\/\//, "")
                        : "—";
                      const plain = inst.status === "suspended" || pending;
                      return (
                        <div
                          title={
                            inst.status === "suspended" ? "Unavailable while paused"
                            : pending ? "The address appears once the Sandbox reports Running."
                            : `${inst.endpointUrl ?? ""} — anyone with this link can reach it`
                          }
                          style={{
                            fontFamily: plain ? FONT : "'GeistMono', monospace",
                            fontSize: 12,
                            color: plain ? C.muted : inst.endpointUrl ? C.muted : C.borderSoft,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}
                        >
                          {label}
                        </div>
                      );
                    })()}
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
                      {/* In the row this was a two-line chip that spilled over the
                          Lifecycle column. The full sentence lives on the glyph,
                          and the drawer header still spells it out. */}
                      {inst.unconfirmed && (
                        <span
                          title="Confirmation pending — unknown provider outcome; the last confirmed state is shown while we reconcile (§4.1)"
                          aria-label="Confirmation pending"
                          style={{ marginLeft: 6, flexShrink: 0, display: "inline-flex", alignItems: "center", color: C.warn, cursor: "help" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                          </svg>
                        </span>
                      )}
                    </div>
                    {/* Lifecycle — active-runtime limit (Running) vs paused cost reminder.
                        PRD v2.3: paused instances are never auto-deleted — no countdown. */}
                    {(() => {
                      if (inst.status === "running") {
                        return <ExpiresCell inst={inst} />;
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
                    <div
                      style={{ color: C.muted }}
                      title={inst.created ? inst.created : "The API does not return a creation time for this Sandbox"}
                    >
                      {inst.created ? agoLabel(inst.created) : "—"}
                    </div>
                    {/* Row actions stop propagation so they never double as "open detail" */}
                    <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                      {/* §K — Open is a plain link to `endpoint_url`. It appears
                          only when the backend gave one, and is greyed only while
                          the Sandbox is not Running: that is the single disabled
                          state in this row. No port to pick, no visibility to
                          set — the backend returns one address or none. */}
                      {inst.endpointUrl && (
                        <a
                          href={inst.status === "running" ? inst.endpointUrl : undefined}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={inst.status === "running"
                            ? `Open ${inst.endpointUrl} in a new tab`
                            : `The Sandbox is ${statusLabel(inst.status)} — the endpoint answers only while it is Running.`}
                          style={{
                            ...rowBtnGhost,
                            textDecoration: "none",
                            color: inst.status === "running" ? C.fg : "#5a5a5a",
                            cursor: inst.status === "running" ? "pointer" : "not-allowed",
                            pointerEvents: inst.status === "running" ? "auto" : "none",
                          }}
                        >
                          <IconExternalLink size={11} /> Open
                        </a>
                      )}
                      {/* Terminal and Files are what people open a sandbox to do,
                          so they are buttons rather than ⋮ entries. */}
                      {inst.status === "running" && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenDetail(inst.id, "terminal"); }}
                            title="Open an interactive shell"
                            style={rowBtnGhost}
                          >
                            <IconTerminal /> Terminal
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenDetail(inst.id, "files"); }}
                            title="Upload or download one file by path"
                            style={rowBtnGhost}
                          >
                            <IconFile /> Filesystem
                          </button>
                        </>
                      )}
                      {/* One primary lifecycle verb per state; the rest live in the drawer */}
                      {inst.status === "running" && (
                        <button onClick={() => onAction(inst.id, "suspend")} title="Pause compute and keep the sandbox files. Ships in batch 2." style={rowBtnGhost}>
                          <IconSuspend /> Pause <BatchBadge batch={2} />
                        </button>
                      )}
                      {inst.status === "suspended" && (
                        <button onClick={() => onAction(inst.id, "resume")} title="Resume the sandbox from its kept files. Ships in batch 2." style={rowBtnPrimary}>
                          <IconResume /> Resume <BatchBadge batch={2} />
                        </button>
                      )}
                      {inst.status === "error" && (
                        <button onClick={() => onOpenDetail(inst.id, "overview")} title="Open the failure reason and state history" style={rowBtnGhost}>
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

                  {/* Everything this sandbox can do, named and on screen. The
                      operations were reachable only through the ⋮ or by knowing
                      the row was clickable — an action nobody can see is an
                      action nobody uses. */}
                  {expanded === inst.id && (
                    <div
                      style={{
                        display: "flex", flexDirection: "column", gap: 10,
                        padding: "12px 16px 14px 42px",
                        borderTop: `1px solid ${C.borderSoft}`,
                        background: "rgba(255,255,255,0.015)",
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {([
                          { tab: "terminal" as DrawerTab, label: "Terminal",   icon: <IconTerminal />, hint: "Open an interactive shell", on: inst.status === "running" },
                          { tab: "files"    as DrawerTab, label: "Filesystem", icon: <IconFile />,     hint: "Upload or download one file by absolute path", on: inst.status === "running" },
                        ]).map((a) => (
                          <button
                            key={a.tab}
                            disabled={!a.on}
                            onClick={(e) => { e.stopPropagation(); if (a.on) onOpenDetail(inst.id, a.tab); }}
                            title={a.on ? a.hint : `Available once the Sandbox is Running (this one is ${statusLabel(inst.status)})`}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              fontFamily: FONT, fontSize: 12.5, fontWeight: 500,
                              color: a.on ? C.fg : "#5a5a5a",
                              background: "transparent",
                              border: `1px solid ${C.border}`,
                              borderRadius: 7, padding: "5px 11px",
                              cursor: a.on ? "pointer" : "not-allowed",
                            }}
                          >
                            {a.icon} {a.label}
                          </button>
                        ))}
                      </div>
                      {/* The facts, not only the links. Half the reason people
                          were opening the detail at all was to read four
                          fields, so the four fields are here. */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 22px" }}>
                        {([
                          ["Host",     `${midId(inst.id)}.sandbox.gmi.cloud`],
                          ["Spec",     specLabel(agentSpecId(agent))],
                          ["IDC",      regionLabel(inst.config?.idc ?? agent.region)],
                          ["Template", agentVersionName(agent.id, agent.name)],
                        ] as [string, string][]).map(([k, v]) => (
                          <span key={k} style={{ display: "inline-flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>{k}</span>
                            <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                          Each destination has its own URL —
                          <span style={{ fontFamily: MONO }}> /dashboard/sandbox/{midId(inst.id)}/…</span> — so it can be
                          shared. Expires, Pause and Delete stay on the row itself.
                        </span>
                      </div>
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
// ─── Integration pane ─────────────────────────────────────────────────────
// The console has an Integration tab (docs/design/v1.2/My Agent_intance.png);
// this is it. What belongs here is what an operator cannot get anywhere else:
// the Template ID, and the calls that use it.
//
// The SDK playground below was mine, not the console's, and not in any spec —
// it renders only in review mode so the design survives without shipping a
// code editor inside a management console.
function IntegrationPane({ agent }: { agent: MyAgent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section>
        <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: "0 0 4px" }}>
          Template ID
        </h3>
        <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 400, color: C.muted, margin: "0 0 12px" }}>
          Every call below starts from this ID — it is what <span style={{ fontFamily: MONO }}>template_id</span> means.
        </p>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "10px 14px",
            fontFamily: MONO, fontSize: 13, color: C.fg,
          }}
        >
          <span style={{ flex: 1, overflowX: "auto" }}>{agent.templateId}</span>
          <CopyButton value={agent.templateId} />
        </div>
      </section>

      {REVIEW_MODE && <SdkPlaygroundV2 templateId={agent.templateId} />}
    </div>
  );
}

// ─── Analytics pane — cost + usage by model + usage by API key ─────────────
function AnalyticsPane({ agent, instances, snapshots }: { agent: MyAgent; instances: Instance[]; snapshots: Snapshot[] }) {
  const cost = agentCostBreakdown(agent.id, instances, snapshots);
  const costLines = [
    { label: "Compute", note: "per active sandbox", val: cost.computeMo },
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
          <li>Paused Sandboxes bill retained disk only, from confirmed Pause until Resume or confirmed release.</li>
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
  agent, instances, snapshots, image, onProvision, onAction, onOpenDetail, activeInstanceId,
  onPublishListing, onUnpublishListing,
  onEditTemplate, onDeleteAgent, onDismissSetup, canConvert = false,
}: {
  agent: MyAgent;
  instances: Instance[];
  snapshots: Snapshot[];
  image?: RuntimeImage;
  onPublishListing: (agentId: string) => void;
  onUnpublishListing: (agentId: string) => void;
  onProvision: (agentId: string) => void;
  onAction: (id: string, action: RowAction) => void;
  onOpenDetail: (id: string, tab?: DrawerTab) => void;
  activeInstanceId: string | null;
  onEditTemplate: (agent: MyAgent) => void;
  onDeleteAgent: (agent: MyAgent) => void;
  /** Clears the first-run panel without configuring anything. */
  onDismissSetup: (agentId: string) => void;
  canConvert?: boolean;
}) {
  const [tab, setTab] = useState<"monitor" | "integration" | "analytics">("monitor");
  // Launch gate: the Template must be Ready. That is the only gate now — the
  // saved-launch-configuration surface is gone, so a "confirm a model" block
  // would have had nowhere to send anyone.
  const templateReady = isLaunchable(image);
  const launchable = templateReady;
  // + Sandbox + Listing ▼ now share the top-right of the agent header.
  // Provisioning is the highest-frequency action so it gets the lime fill;
  // listing actions sit behind a single dropdown next to it.
  // A disabled launch button has to say WHICH step it is waiting on, and
  // whether waiting is even the right response — "no template at all" and
  // "template is still building" call for different things from the user.
  const launchBlockedReason = launchBlockedBy(image) ?? "";

  const headerActions = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={() => launchable && onProvision(agent.id)}
        disabled={!launchable}
        title={launchable ? "Launch a new sandbox" : launchBlockedReason}
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
        Sandbox
      </button>
      <ListingActions
        state={agent.listingState}
        locked={!!agent.privateImage}
        onPublish={() => onPublishListing(agent.id)}
        onUnpublish={() => onUnpublishListing(agent.id)}
      />
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

      {/* Nobody ships a Template panel. E2B carries `template-id` and
          `spec-items` as fields in the sandbox header; Daytona has `Image` as a
          column in the list. So this is a strip of identity fields, not a card,
          and the build state sits with it because §E wants a status label on
          the Agent header telling you whether a Sandbox can start. */}
      {image && (() => {
        const view = buildView(image);
        const state = buildChip(view, image.buildStatus);
        const tplv = templateViewFor(agent, image);
        const acts = { logs: tplv.logs, rebuild: tplv.rebuild, edit: tplv.edit };
        const tplNote = tplv.note;
        const field = (k: string, v: React.ReactNode) => (
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>{k}</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
          </span>
        );
        return (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${C.borderSoft}`, borderBottom: `1px solid ${C.borderSoft}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", minWidth: 0 }}>
            {/* A plain status label. There is no build log to open — the API has
                no log endpoint — so this is not a disclosure, and pretending it
                was one gave the reader a chevron that revealed invented output.
                An unrecognised value renders verbatim; a missing one renders
                nothing, because "we did not get the field" is not a state the
                user should have to interpret. */}
            {state && (
              <span
                title={view === "ready" ? "Sandboxes can start from this image" : undefined}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                  fontFamily: FONT, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
                  color: state.color, background: `${state.color}1f`, border: `1px solid ${state.color}55`,
                  padding: "1px 8px", borderRadius: 5,
                }}
              >
                {view === "building" && (
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: state.color, animation: "pulse 1.2s ease-in-out infinite" }} />
                )}
                {state.label}
                <V2Badge style={{ marginLeft: 1 }} />
              </span>
            )}
            {/* Builds run 21s to well past 3min and report no progress, so the
                honest readout is time waited — never a bar that fakes a fraction. */}
            {(view === "building" || view === "waiting") && <BuildElapsed since={image.buildStartedAt} />}
            {field("Template", agentVersionName(agent.id, agent.name))}
            {field("Image", `${image.url}:${image.tag}`)}
            {field("Spec", `${specName(agentSpecId(agent))} · ${specLabel(agentSpecId(agent))}`)}
            {field("IDC", regionLabel(agent.region))}
            {/* Inactivity is the only clock a template has; it is the nudge
                that replaces a storage charge. */}
            {tplNote && <span style={{ fontFamily: FONT, fontSize: 11, color: C.warn }}>{tplNote}</span>}
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {/* The template block's own actions. Delete is NOT here: deleting
                  the template deletes the agent, so it lives once, in the danger
                  zone at the bottom of the page. */}
              {acts.logs && (
                <button
                  title="The build output for this template"
                  style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 500, color: C.fg, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}
                >
                  Build logs
                </button>
              )}
              {acts.rebuild && (
                <button
                  title="Build this template again from the same image"
                  style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 500, color: C.fg, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}
                >
                  Rebuild
                </button>
              )}
              {acts.edit && (
                <button
                  onClick={() => onEditTemplate(agent)}
                  title="Change the image, Spec or default IDC — every future Sandbox picks them up"
                  style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 500, color: C.fg, background: "transparent", border: `1px solid ${C.border}`, padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}
                >
                  Edit Template
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* v1.3 §A10 — the drawer says "Continue in My Agents to configure settings
          and deploy". This is where that lands: a copy arrives pointing at a
          placeholder image, and the three things standing between it and a
          running sandbox are named, in order, with the control that does each. */}
      {agent.needsSetup && (
        <section
          style={{
            border: "1px solid rgba(221,234,77,0.35)", background: "rgba(221,234,77,0.05)",
            borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <h3 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>
              Finish setting up this agent
            </h3>
            <V2Badge />
          </div>
          <p style={{ fontFamily: FONT, fontSize: 12.5, lineHeight: "18px", color: C.muted, margin: 0 }}>
            Copied from <span style={{ color: C.fg }}>{agent.copiedFrom ?? "the catalog"}</span>. A copy carries the
            shape of the original, not its image or credentials — those are the publisher&apos;s. Three things to do:
          </p>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            <li style={{ fontFamily: FONT, fontSize: 12.5, lineHeight: "18px", color: C.fg }}>
              Point the template at <span style={{ fontWeight: 600 }}>your own image</span> — it starts on a placeholder.
            </li>
            <li style={{ fontFamily: FONT, fontSize: 12.5, lineHeight: "18px", color: C.fg }}>
              Set the <span style={{ fontWeight: 600 }}>IDC and Spec</span> you want it to run on.
            </li>
            <li style={{ fontFamily: FONT, fontSize: 12.5, lineHeight: "18px", color: C.fg }}>
              Wait for the build to reach <span style={{ fontWeight: 600 }}>Ready</span>, then launch a sandbox.
            </li>
          </ol>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => onEditTemplate(agent)}
              style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, background: C.lime, color: C.limeText, border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer" }}
            >
              Edit Template
            </button>
            <button
              onClick={() => onDismissSetup(agent.id)}
              style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 500, background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}
            >
              I&apos;ll do this later
            </button>
          </div>
        </section>
      )}

      {/* Say it in the page, not only in a tooltip — the reason a sandbox cannot
          start is the single thing blocking this agent from being useful. */}
      {!launchable && (
        <div
          style={{
            display: "flex", alignItems: "flex-start", gap: 7,
            background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.32)",
            borderRadius: 8, padding: "9px 11px",
            fontFamily: FONT, fontSize: 12, lineHeight: "17px", color: C.fg,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.warn} strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
          </svg>
          <span>
            <span style={{ fontWeight: 600 }}>No sandbox can start yet.</span> {launchBlockedReason}
            {buildView(image) === "error" && (
              <span style={{ display: "block", marginTop: 4, color: C.muted }}>
                There is no rebuild action — edit the image address and save, or register the agent again.
              </span>
            )}
          </span>
        </div>
      )}




      {/* The console's own tabs — see docs/design/v1.2/My Agent_intance.png.
          Names are the console's, not ours. */}
      <PillSegmented
        active={tab}
        onChange={setTab}
        options={[
          { value: "monitor",     label: "Monitor" },
          { value: "integration", label: "Integration" },
          { value: "analytics",   label: "Analytics" },
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

      {/* §2 — the one place this agent can be deleted. Deleting the template
          deletes the agent: they are the same object, so offering it twice
          would imply they are separable. It sits at the bottom, away from the
          edit controls, because it ends everything above it. */}
      {tab === "monitor" && (
        <section style={{ marginTop: 28, border: `1px solid rgba(248,113,113,0.28)`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: C.fg }}>Delete this agent</div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 3, lineHeight: "17px" }}>
              Removes the agent and its template together, and frees a slot against your quota.
              {instances.filter((i) => i.agentId === agent.id && i.status !== "deleted").length > 0
                ? " Its running sandboxes are deleted with it, along with their files."
                : " It has no sandboxes to lose."}
            </div>
          </div>
          <button
            onClick={() => onDeleteAgent(agent)}
            style={{ flexShrink: 0, fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: C.err, background: "transparent", border: `1px solid rgba(248,113,113,0.5)`, borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}
          >
            Delete agent
          </button>
        </section>
      )}
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
    ["Source Sandbox", midId(inst.id)],
    ["Source Agent Version", agentVersion],
    ["Region", region],
    ["Spec", runtimeClass],
    ["Architecture", architecture],
  ];

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 540, maxWidth: "100%", background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 10, display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>
            Create Snapshot <V21Badge /> <ReleaseBadge r="R1" />
          </h3>
          <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "4px 0 0", lineHeight: "17px" }}>
            Capture this Sandbox's filesystem so you can launch new Sandboxes without repeating setup. {agentName} · {midId(inst.id)} keeps running.
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
              Snapshots preserve the Sandbox filesystem only. Memory, running processes, active connections, and temporary secrets are not preserved.
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
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>Launch New Sandbox</h3>
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
              Only Versions of this Agent are eligible. Region, Spec, and architecture
              ({snapshot.region} · {snapshot.runtimeClass} · {snapshot.architecture}) are validated before any resource is created.
            </span>
          )}

          {/* What restores / re-applied · secrets · cost · permission (PRD F-08 / §4.4) */}
          {anyCompatible && (() => {
            const d = discountPriceString(CODING_AGENT_PLAN.featuredModelInPrice);
            return (
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 9, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "11px 12px" }}>
                <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "17px" }}>
                  <span style={{ color: C.fg, fontWeight: 600 }}>Snapshot provides</span> filesystem state · <span style={{ color: C.fg, fontWeight: 600 }}>Target Version provides</span> startup command, permissions, network, Endpoints, lifecycle and fresh secrets. The new Sandbox gets its own ID, Endpoints and access.
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "17px" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1, color: C.warn }}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  <span><span style={{ color: C.fg, fontWeight: 600 }}>Secrets are injected fresh</span> — never taken from the Snapshot. Credentials that were written to the captured disk may still be there.</span>
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "17px" }}>
                  Each launch is independent and there is no batch API. Sending the same request twice produces one Sandbox, not two.
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
            Launch New Sandbox
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
        <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONT, fontSize: 24, fontWeight: 700, lineHeight: "30px", color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>
          Snapshots <V21Badge />
        </h1>
        <V21Note>
          Snapshots are not built yet — capture, restore and retention all land in Agentbox 2.1.
          Everything below is here so the flow can be reviewed; none of it runs.
        </V21Note>
        <ReleaseBadge r="R1" />
      </div>
      <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: 0, lineHeight: "19px" }}>
        Immutable, Organization-owned, point-in-time copies of a Sandbox's disk. Launch a new Sandbox from one into the same Agent —
        this is where Launch and Delete happen. Snapshots outlive their source Sandbox, and the Snapshot ID is the canonical reference
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
              ? "No snapshots yet. Capture one from a running sandbox in My Agents → Sandbox Detail."
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
                  <button onClick={() => onRestore(s)} style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.limeText, background: C.lime, border: "none", padding: "3px 10px", borderRadius: 6, cursor: "pointer" }}>Launch New Sandbox</button>
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
        A Snapshot is captured from a live Sandbox's disk. It is not a Template — Templates are built from developer config at
        Register → Agent Version build and are reproducible by construction. Renaming or clearing a name never breaks the link to the
        source Agent Version. Deleting a Snapshot prevents future launches and stops its storage metering; Sandboxes already launched
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
  instances, snapshots, agents, onOpenSnapshots, onOpenPublishStatus,
}: {
  instances: Instance[];
  snapshots: Snapshot[];
  /** Listing review outcomes belong here — see group 0 below. */
  agents: MyAgent[];
  onOpenSnapshots: () => void;
  onOpenPublishStatus: () => void;
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
  //  3) Listing review outcomes. Submitting a listing used to be a one-way door:
  //     nothing ever told the publisher the review had finished, so the only way
  //     to find out was to keep reopening Publish Status. A decision — approved
  //     or denied — is exactly what a notification is for.
  const reviewed = agents
    .filter((a) => a.listingState === "live" || a.listingState === "rejected")
    .map((a) => ({ id: a.id, name: a.name, approved: a.listingState === "live" }));
  const count = expiring.length + paused.length + reviewed.length;

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

            {/* Group 0 — Listing review outcomes */}
            {reviewed.length > 0 && (
              <>
                <div style={{ padding: "10px 14px 6px", fontFamily: FONT, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Listing review</div>
                {reviewed.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => { setOpen(false); onOpenPublishStatus(); }}
                    style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "transparent", border: "none", borderBottom: `1px solid ${C.borderSoft}`, cursor: "pointer" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={it.approved ? C.ok : C.err} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      {it.approved ? <path d="M20 6 9 17l-5-5" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>}
                    </svg>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                      <span style={{ fontFamily: FONT, fontSize: 11, color: it.approved ? C.ok : C.err }}>
                        {it.approved ? "Approved — now live in Browse Agents" : "Denied — open Publish Status for the reason"}
                      </span>
                    </span>
                  </button>
                ))}
              </>
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
                <div style={{ padding: "10px 14px 6px", fontFamily: FONT, fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Paused sandboxes</div>
                {paused.map((it) => (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${C.borderSoft}` }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Sandbox · {it.name}</span>
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
  // §A — the route has to refuse too, not just the nav link: an org without the
  // runtime may still land here from a bookmark or a shared URL.
  if (!SANDBOX_AVAILABLE) return <NotFound />;
  const [, setLocation] = useLocation();
  const [topTab, setTopTab] = useState<"deployments" | "uses" | "snapshots">("deployments");
  const [filter, setFilter] = useState("");
  const [registered, setRegistered] = useState<MyAgent[]>(() => loadRegisteredAgents());
  // v1.3 §F — listing preview through the Browse Agents drawer.
  const [publicListing, setPublicListing] = useState<MyAgent | null>(null);
  // v1.3 §B1 — AgentBox bills by usage; say so once before anything can spend.
  const [showCostNotice, setShowCostNotice] = useState(() => !hasAcknowledged("myagents"));
  // v1.3 §D — no balance endpoint exists; this stands in for one.
  const [hasCredits, setHasCredits] = useState(true);
  const [showInsufficient, setShowInsufficient] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);

  // v1.3 §B2/§B3 — "Set up this Agent" in Browse Agents hands the catalog entry
  // over through sessionStorage. Pick it up once, add it as a private copy at
  // the top of the list, and select it.
  useEffect(() => {
    let handoff: { id: string; name: string } | null = null;
    try {
      const raw = sessionStorage.getItem("gmi.setupAgent");
      if (raw) { handoff = JSON.parse(raw); sessionStorage.removeItem("gmi.setupAgent"); }
    } catch { return; }
    if (!handoff) return;
    const copy: MyAgent = {
      id: `ag_${Date.now().toString(36)}`,
      name: `${handoff.name} (copy)`,
      templateId: `tpl_${Math.random().toString(36).slice(2, 10)}`,
      category: "Code & Dev Tools",
      verified: true,
      displayStatus: "idle",
      hostMode: "gmi",
      maasKey: "",
      accessUrl: "",
      registeredAt: new Date().toISOString(),
      listingState: "draft",
      needsSetup: true,
      copiedFrom: handoff.name,
    };
    setRegistered((prev) => [copy, ...prev]);
    setSelectedId(copy.id);
    pushToast("success", "Finish setting up this agent.");
  }, []);
  const [hiddenSeedIds, setHiddenSeedIds] = useState<Set<string>>(new Set());

  // "I'll do this later" — the panel is a nudge, not a gate.
  const dismissSetup = (agentId: string) => {
    setRegistered((prev) => {
      const next = prev.map((a) => (a.id === agentId ? { ...a, needsSetup: false } : a));
      try { localStorage.setItem(REGISTERED_AGENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

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
          This cannot be undone. Existing running sandboxes will not be affected.
        </>
      ),
      confirmLabel: "Delete template",
      destructive: true,
      onConfirm: () => performDeleteTemplate(agent),
    });
  };
  // Newly-registered agents from Connect flow appear at the top, then the seed list
  // (seed entries the user has deleted at runtime are hidden via hiddenSeedIds).
  // v1.2 §D — runtime listing-state overrides. Seed agents are static module
  // data, so Unpublish / Repost record the new state here and it is layered on
  // top when the list is built. Registered agents keep their own copy too, so
  // the override is the single read path either way.
  const [listingOverrides, setListingOverrides] = useState<Record<string, ListingState>>(
    () => {
      try { return JSON.parse(localStorage.getItem(LISTING_OVERRIDES_KEY) || "{}"); }
      catch { return {}; }
    },
  );
  const setListingState = (agentId: string, state: ListingState) => {
    // Persisted, not just in component state: every listing action navigates
    // away (the listing form, the marketplace), and an Unpublish that comes
    // back as Live is worse than no Unpublish at all.
    setListingOverrides((m) => {
      const next = { ...m, [agentId]: state };
      try { localStorage.setItem(LISTING_OVERRIDES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setRegistered((prev) => {
      if (!prev.some((a) => a.id === agentId)) return prev;
      const next = prev.map((a) => (a.id === agentId ? { ...a, listingState: state } : a));
      try { localStorage.setItem(REGISTERED_AGENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const allAgents = useMemo(
    () => [...registered, ...MY_DEPLOYMENTS.filter((a) => !hiddenSeedIds.has(a.id))]
      .map((a) => (listingOverrides[a.id] ? { ...a, listingState: listingOverrides[a.id] } : a)),
    [registered, hiddenSeedIds, listingOverrides],
  );
  // allAgents may be empty for a brand-new user — no fallback to MY_DEPLOYMENTS now that it's empty.
  const [selectedId, setSelectedId] = useState<string>(allAgents[0]?.id ?? "");
  const [instances, setInstances] = useState<Instance[]>(INITIAL_INSTANCES);
  // Snapshot lifecycle (PRD §3 / §5.5)
  const [snapshots, setSnapshots] = useState<Snapshot[]>(INITIAL_SNAPSHOTS);
  const [runtimeImages, setRuntimeImages] = useState<Record<string, RuntimeImage>>(INITIAL_RUNTIME_IMAGES);

  // Every agent needs a Template record — it is what carries the build state,
  // the Ready badge and the launch gate. Seeds got one hard-coded; anything the
  // user registered got nothing, which left a brand-new agent as an empty shell
  // with "+ Sandbox" disabled forever. Mint one on arrival and run the build.
  useEffect(() => {
    const missing = registered.filter((a) => !runtimeImages[a.id]);
    if (missing.length === 0) return;
    const image = (a: MyAgent): RuntimeImage => {
      const raw = (a as { dockerImage?: string }).dockerImage || "ghcr.io/you/agent:latest";
      const at = raw.lastIndexOf(":");
      const hasTag = at > raw.lastIndexOf("/");
      return {
        url: hasTag ? raw.slice(0, at) : raw,
        tag: hasTag ? raw.slice(at + 1) : "latest",
        digest: `sha256:${a.id.replace(/[^a-f0-9]/g, "").padEnd(36, "0").slice(0, 36)}`,
        registry: (raw.split("/")[0].includes(".") ? raw.split("/")[0] : "docker.io"),
        architecture: "linux/amd64",
        buildStatus: "waiting",
        buildStartedAt: fmtNow(),
        lastValidated: fmtNow(),
      };
    };
    setRuntimeImages((prev) => {
      const next = { ...prev };
      missing.forEach((a) => { next[a.id] = image(a); });
      return next;
    });
    // Then let it build, so the Ready gate is reachable for an agent the user
    // actually created — not just the three seeds. Real builds run 21s to 3min+;
    // compressed here, but the waiting -> building -> ready shape is the real one.
    missing.forEach((a) => {
      setTimeout(() => patchImage(a.id, { buildStatus: "building" }), 900);
      setTimeout(() => patchImage(a.id, { buildStatus: "ready", lastValidated: fmtNow() }), 4200);
    });
  }, [registered, runtimeImages]);
  const [restoreSnapshot, setRestoreSnapshot] = useState<Snapshot | null>(null);
  // F-07 — capture starts from Runtime Detail and opens a real form (name,
  // description, metadata), not a bare confirm.
  const [snapshotForInstanceId, setSnapshotForInstanceId] = useState<string | null>(null);
  // Instance drawer lives at page level so the layout can make room for it
  // instead of covering the list the user just clicked in.
  const [drawer, setDrawer] = useState<{ id: string; tab: DrawerTab } | null>(null);
  const openDetail = (id: string, tab: DrawerTab = "overview") => {
    setProvisionForAgentId(null);
    setDrawer(null);
    setLocation(sandboxHref(id, tab));
  };
  // F-08 — launcher-owned Saved Launch Configurations, keyed by Agent.
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
  // v1.2 §D — Publish Status modal + its unpublish confirmation
  // A sandbox detail is a place, not a panel: /dashboard/sandbox/:id/:tab is
  // linkable, bookmarkable and survives the back button. The drawer stays for
  // the quick peek off a row hover, but the URL is the source of truth.
  const [onSandboxRoute, routeParams] = useRoute("/dashboard/sandbox/:sandboxId/:tab?");
  const routeSandboxId = onSandboxRoute ? routeParams?.sandboxId : undefined;
  const routeTab = (onSandboxRoute ? (routeParams?.tab as DrawerTab | undefined) : undefined) ?? "overview";

  const sandboxHref = (id: string, tab: DrawerTab = "overview") =>
    `/dashboard/sandbox/${encodeURIComponent(id)}/${tab}`;

  // Run history per sandbox. Lives here so it survives closing the tab or the
  // drawer — the pane promises results stay retrievable by execution_id.
  const [publishStatusOpen, setPublishStatusOpen] = useState(false);
  const [unpublishRow, setUnpublishRow] = useState<PublishRow | null>(null);

  // Both panels slide in from the right, so only one can be open at a time.
  const handleProvision = (agentId: string) => { setDrawer(null); setProvisionForAgentId(agentId); };
  // v1.2 §E1 — Repost sends a listing back through review. It moves to
  // Under review, which is the same state a first submission sits in: Unpublish
  // is not offered again until the review lands. Say so, rather than implying
  // the listing is both live and re-submitted — the prototype has no state for
  // that, and pretending otherwise leaves no way to take the listing down.
  const handleRepost = (agentId: string) => {
    setListingState(agentId, "pending_review");
    pushToast("success", "Resubmitted for review — Unpublish returns once the review lands.");
  };

  // Every listing action, in one bag, handed to the Publish Status row menu —
  // that modal is the single place listings are managed.
  const openListingForm = (agentId: string) => {
    setPublishStatusOpen(false);
    setLocation(`/list-claw?agentId=${encodeURIComponent(agentId)}`);
  };
  // The Unpublish confirmation is shared with Publish Status, so the agent
  // header hands it the same row shape rather than a second dialog.
  const requestUnpublish = (agentId: string) => {
    const row = publishRowsFor(allAgents).find((r) => r.id === agentId);
    if (row) setUnpublishRow(row);
  };
  const listingHandlers: ListingActionHandlers = {
    onComplete:  (row) => openListingForm(row.id),
    onEdit:      (row) => openListingForm(row.id),
    onFix:       (row) => openListingForm(row.id),
    // v1.3 §F — preview the listing in place, in the same drawer Browse Agents
    // uses. This replaces the old punt to /marketplace: agent ids and claw ids
    // are still different namespaces, but the drawer renders from the agent, so
    // there is no URL to 404 on.
    onView:      (row) => {
      const agent = allAgents.find((a) => a.id === row.id);
      if (!agent) return;
      setPublishStatusOpen(false);
      setPublicListing(agent);
    },
    onRepost:    (row) => handleRepost(row.id),
    onWithdraw:  (row) => {
      setListingState(row.id, "draft");
      pushToast("success", `${row.listingName} withdrawn — back to Draft, nothing was published`);
    },
    onUnpublish: (row) => setUnpublishRow(row),
  };

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
      specId: config.specId,
      capabilities: SANDBOX_CAPS,
      // §E — the container server picks the lifetime; the console reads
      // `expires_at` back and never derives it from what was asked for. Until
      // `timeout` is passed through there is nothing to ask for.
      endAt: endAtFromNow(durationMins(config.maxLifetime) * 60),
      maxRuntimeAction: "suspend",            // P-01 default action at the limit
      latestOperation: { kind: "create", status: "in_progress", at: fmtNow() },
    };
    setInstances((prev) => [newInst, ...prev]);
    setProvisionForAgentId(null);
    // pending → initializing → running. Compute metering and the active-time
    // clock start only when Running is confirmed (§4.5); transition time is free.
    setTimeout(() => patchInstance(id, { status: "creating" }), 1200);
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
      // §F wants this wait to hold up for about a minute. A 1.8s mock made the
      // state impossible to see, let alone review, so it runs long enough to
      // watch — the point being that nothing looks broken while it waits.
    }, 9000);
  };

  // ── Runtime Image readiness mutations (validation → preparation). ──────────
  const patchImage = (agentId: string, patch: Partial<RuntimeImage>) =>
    setRuntimeImages((prev) => ({ ...prev, [agentId]: { ...prev[agentId], ...patch } }));
  // Validate → prepare cycle: validating → valid → preparing → ready.
  // §五 — the user sets a new total, not an increment. The API updates the
  // sandbox's timeout, and the expiry only ever moves later: E2B's setTimeout
  // takes whichever of the current and the new expiry is further out, so a
  // small number cannot cut a running sandbox short by accident.
  // POST /sandboxes/{id}/connect — exchanges data-plane credentials, and the
  // call carries a `timeout`. Two rules, both decided earlier in review:
  //   · it FLOORS the expiry at now + CONNECT_FLOOR_MINS; it never shortens one
  //     that is already further out. Overwriting would turn "I opened a
  //     terminal" into "I cut my sandbox from 5h to 30m".
  //   · whatever it does is stated in the Terminal at the moment it happens.
  // Returns what moved so the Terminal can say it, or null when nothing did.
  // Extending invalidates the data-plane token — "延长 sandbox 存活时需重新调用
  // connect 接口获取新的令牌". Tracked per sandbox so the UI can say the token
  // in the user's hand is stale, rather than letting them find out on a 401.
  const [tokenStale, setTokenStale] = useState<Record<string, boolean>>({});
  // §H — results stay retrievable by execution id, so switching tabs or panes
  // must not discard them.
  const [execHistory, setExecHistory] = useState<Record<string, Execution[]>>({});

  const CONNECT_FLOOR_MINS = 30;
  const connectSandbox = (id: string): { extendedToMins: number } | null => {
    const inst = instances.find((i) => i.id === id);
    if (!inst) return null;
    // Connecting always re-issues the token — that is the point of the call.
    setTokenStale((prev) => { const n = { ...prev }; delete n[id]; return n; });
    const { leftMins } = lifecycleClock(inst);
    // "传 timeout 且大于 0 时顺带延长存活时间（只延长不缩短）" — a floor, never
    // an overwrite. The response's `end_at` is authoritative either way.
    if (leftMins >= CONNECT_FLOOR_MINS) return null;
    setInstances((prev) => prev.map((i) => (
      i.id === id ? { ...i, endAt: endAtFromNow(CONNECT_FLOOR_MINS * 60) } : i
    )));
    return { extendedToMins: CONNECT_FLOOR_MINS };
  };

  // §E — Extend is NOT wired up. bs-api has POST /sandboxes/{id}/timeout, but
  // the container server does not pass it through: Launch takes no `timeout`,
  // there is no /tasks/{id}/timeout, and the only thing it reports is
  // `expires_at`. A control that cannot reach an endpoint is worse than no
  // control, so the expiry is read-only everywhere until that lands.
  //
  // When it does: re-base from NOW (not a total from creation), honour the
  // response's new_end_at rather than the requested number (<= 0 becomes 300s),
  // running-only, and mark the access token stale — extending invalidates it.
  // Reading a task also auto-renews its lease today; whether that survives
  // passthrough decides whether a user-set expiry can even hold.

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
      settleToast(t, "success", "Running — anything the startup command doesn't launch has to be restarted from the Terminal");
    }, 1500);
  };
  const performDelete = (id: string) => {
    // §L — DELETE returns 204 immediately. There is no "deleting" state to poll
    // for and none to render: the row goes, now. Animating a deletion the
    // backend already finished only teaches people to distrust the list.
    setInstances((prev) => prev.filter((i) => i.id !== id));
    pushToast("success", "Sandbox deleted — its files are gone with it");
  };
  // ── Expiry reaper ────────────────────────────────────────────────────────
  // §E — "过期即从列表消失，没有 expired 态可以展示". There is no expired status
  // in the enum and nothing to poll: a sandbox that reaches its limit is simply
  // gone on the next read, files and all. So one stage, not two — the row goes
  // and a toast says why, which is the only trace the operator ever gets.
  //
  // Runs off the same 1 Hz tick the countdown uses, and only touches sandboxes
  // that actually carry an expiry.
  useEffect(() => {
    const t = window.setInterval(() => {
      setInstances((prev) => {
        const expired = prev.filter((i) => i.endAt && lifecycleClock(i).leftMins <= 0);
        if (expired.length === 0) return prev;
        // A toast raised inside the updater fires twice under StrictMode.
        queueMicrotask(() => {
          expired.forEach((i) =>
            pushToast("unconfirmed", `${midId(i.id)} reached its limit — deleted with its files`),
          );
        });
        return prev.filter((i) => !expired.some((e) => e.id === i.id));
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const performRetry = (id: string) => {
    // Failed creation or unconfirmed outcome → re-attempt (§4.2 / F-01).
    const inst = instances.find((i) => i.id === id);
    const t = pushToast("progress", inst?.unconfirmed ? "Re-checking provider outcome…" : "Retrying creation…");
    patchInstance(id, { status: "creating", lastError: undefined, unconfirmed: false });
    setTimeout(() => {
      setInstances((prev) => prev.map((i) =>
        i.id === id ? { ...i, status: "running", endpointUrl: endpointFor(i.id), lifecycleStartedAt: fmtNow() } : i,
      ));
      settleToast(t, "success", "Sandbox running");
    }, 1600);
  };

  const handleAction = (id: string, action: RowAction) => {
    const inst = instances.find((i) => i.id === id);
    const shortId = midId(id);
    switch (action) {
      case "suspend": {
        setConfirm({
          title: "Pause sandbox?",
          body: (
            <>
              <span style={{ display: "inline-flex", marginBottom: 8 }}><BatchBadge batch={2} /></span>{" "}
              <span style={{ color: C.muted }}>Pause and Resume arrive about two weeks after the 2.0 UI release.</span>{" "}
              Only disk is billed while paused — vCPU and memory stop. The reduced rate starts once the
              sandbox <span style={{ color: C.fg }}>reaches</span> paused, not when you ask for it.
              The sandbox keeps its ID and files until you Resume or Delete. Memory, running processes and
              live connections are lost, and any command running now is cancelled.
              Endpoint URLs survive but return the unavailable response while paused.
              For long-term reuse, create a Snapshot instead.
            </>
          ),
          confirmLabel: "Pause Sandbox",
          destructive: false,
          onConfirm: () => performSuspend(id),
        });
        break;
      }
      case "resume":
        setConfirm({
          title: "Resume sandbox?",
          body: (
            <>
              Resume is a fresh boot of the same disk, not a restored session: the declared startup command runs
              again and Running is reported only after readiness passes. Anything the startup command doesn't launch
              has to be restarted from the Terminal. The Endpoint URL is unchanged, but its availability recovers
              independently and may lag behind Running.
            </>
          ),
          confirmLabel: "Resume Sandbox",
          destructive: false,
          onConfirm: () => performResume(id),
        });
        break;
      case "retry":
        performRetry(id);
        break;
      case "delete":
        setConfirm({
          title: "Delete sandbox?",
          body: (
            <>
              This cannot be undone. Compute, retained disk, and every Endpoint route for
              {" "}<span style={{ color: C.fg, fontFamily: MONO }}>{shortId}</span> are released, and all files on it are
              permanently deleted unless they were saved through a Snapshot or downloaded.
              Snapshots and the Agent's Sandbox Template are separate resources and survive.
              Deleted is reported only after release is confirmed — that is when all billing stops.
            </>
          ),
          confirmLabel: "Delete Sandbox",
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
          storage metering stops; Sandboxes already launched from it own their own disk and are unaffected.
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
    // Model is a per-sandbox choice, so a snapshot launch takes the featured
    // one rather than consulting a stored default that no longer exists.
    actuallyProvision(targetAgentId, {
      ...TEMPLATE_DEFAULT_CONFIG,
      name: `from-${snapshotLabel(snapshot).replace(/^snap_/, "").slice(0, 18)}`,
      model: FEATURED_MODEL.id,
      metadata: snapshot.metadata ?? [],
    });
    pushToast("success", `Launching a new sandbox from this Snapshot on ${version} — see My Agents`);
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

  // The routed sandbox — the page form of the same panes.
  const pageInst = routeSandboxId ? instances.find((i) => i.id === routeSandboxId) ?? null : null;
  const pageAgent = pageInst ? allAgents.find((a) => a.id === pageInst.agentId) : undefined;

  const detailPaneFor = (
    inst: Instance,
    agent: MyAgent | undefined,
    variant: "drawer" | "page",
  ) => (
    <InstanceDrawer
      variant={variant}
      inst={inst}
      deploymentName={agent?.name ?? ""}
      agentVersion={agentVersionName(inst.agentId, agent?.name)}
      execHistory={execHistory[inst.id] ?? []}
      setExecHistory={(fn) => setExecHistory((m) => ({ ...m, [inst.id]: fn(m[inst.id] ?? []) }))}
      endpoints={endpointsForAgent(agent)}
      idc={regionLabel(inst.config?.idc ?? agent?.region)}
      product={productForTier(agent?.tier)}
      tab={variant === "page" ? routeTab : (drawer?.tab ?? "overview")}
      onTab={(tab) => {
        if (variant === "page") setLocation(sandboxHref(inst.id, tab));
        else setDrawer((d) => (d ? { ...d, tab } : d));
      }}
      tabHref={variant === "page" ? (t) => sandboxHref(inst.id, t) : undefined}
      onConnectSandbox={connectSandbox}
      tokenStale={!!tokenStale[inst.id]}
      onAction={handleAction}
      onPatchMetadata={patchMetadata}
      onClose={() => { if (variant === "page") setLocation("/dashboard"); else setDrawer(null); }}
    />
  );

  // A routed sandbox replaces the list, the way /sandboxes/[id] does elsewhere.
  if (onSandboxRoute) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.6); } }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <Topbar />
        <Navbar />
        <div style={{ marginLeft: 210, paddingTop: 40, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <div style={{ padding: "20px 32px 8px" }}>
            <Link
              href="/dashboard"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 12, color: C.muted, textDecoration: "none" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              My Agents
              {pageAgent && <span style={{ color: C.fg }}> · {pageAgent.name}</span>}
            </Link>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: "0 32px 32px", display: "flex", flexDirection: "column" }}>
            {pageInst
              ? detailPaneFor(pageInst, pageAgent, "page")
              : (
                <div style={{ fontFamily: FONT, fontSize: 13, color: C.muted, padding: "48px 0", textAlign: "center" }}>
                  No sandbox with id <span style={{ fontFamily: MONO, color: C.fg }}>{routeSandboxId}</span>.
                  It may have reached its lifecycle limit and been released.
                </div>
              )}
          </div>
        </div>
        <ConfirmDialog pending={confirm} onClose={() => setConfirm(null)} />
        <Toaster toasts={toasts} />
      </div>
    );
  }

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
            { id: "deployments" as const, label: "My Agents", isNew: false, noApi: false },
            { id: "uses" as const, label: "Agents I Use", isNew: false, noApi: false },
            // No /snapshots endpoint in the R1 swagger.
            { id: "snapshots" as const, label: "Snapshots", isNew: true, noApi: true, v21: true },
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
                {(t as { v2?: boolean }).v2 && <V2Badge />}
                {(t as { v21?: boolean }).v21 && <V21Badge />}
                {t.noApi && <NoApiBadge />}
              </button>
            );
          })}
          </div>
          <NotificationBell
            instances={instances}
            snapshots={snapshots}
            agents={allAgents}
            onOpenSnapshots={() => setTopTab("snapshots")}
            onOpenPublishStatus={() => setPublishStatusOpen(true)}
          />
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
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, lineHeight: "30px", color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>
                My Agents
              </h1>
              {/* v1.2 §D1 */}
              <PublishStatusEntry onOpen={() => setPublishStatusOpen(true)} />
              <BatchBadge batch={1} title="Batch 1 — My Agents, Templates, Run Command, Terminal and Filesystem all ship with the 2.0 UI release. Only Pause and Resume wait for batch 2." />
            </div>

            {/* An agent IS its template, so the template quota belongs here and
                is counted in agents — one number to act on rather than two that
                have to agree. Build time sits beside it because it is the other
                thing that can refuse a registration. No storage figure: there
                is no charge for it and no byte count to show. */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 22, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "9px 14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontFamily: FONT, fontSize: 10.5, color: C.muted }}>Agents</span>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: agentsAtLimit() ? C.warn : C.fg }}>
                  {TEMPLATE_QUOTA.used} / {TEMPLATE_QUOTA.allowed}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontFamily: FONT, fontSize: 10.5, color: C.muted }}>Build time this month</span>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: TEMPLATE_QUOTA.buildHoursUsed / TEMPLATE_QUOTA.buildHoursAllowed >= 0.8 ? C.warn : C.fg }}>
                  {TEMPLATE_QUOTA.buildHoursUsed} / {TEMPLATE_QUOTA.buildHoursAllowed} h
                </span>
              </div>
              <Link href="/settings/quotas" style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 11.5, color: C.link, textDecoration: "none", whiteSpace: "nowrap", alignSelf: "center" }}>
                Quotas →
              </Link>
            </div>

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
                  image={runtimeImages[agent.id]}
                  instances={instances}
                  selected={agent.id === selected?.id}
                  onClick={() => setSelectedId(agent.id)}
                  onEditTemplate={handleEditTemplate}
                  onLaunch={(a) => setProvisionForAgentId(a.id)}
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
              onPublishListing={openListingForm}
              onUnpublishListing={requestUnpublish}
              onProvision={handleProvision}
              onAction={handleAction}
              onOpenDetail={openDetail}
              activeInstanceId={drawer?.id ?? null}
              onEditTemplate={handleEditTemplate}
              onDeleteAgent={handleDeleteTemplate}
              onDismissSetup={dismissSetup}
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
        idcDefault={allAgents.find((a) => a.id === provisionForAgentId)?.region}
        specDefault={agentSpecId(allAgents.find((a) => a.id === provisionForAgentId))}
        onCancel={() => setProvisionForAgentId(null)}
        onSubmit={(cfg) => {
          // v1.3 §C7 — check the balance before creating; short of credits the
          // §D prompt takes over instead of a create that would fail.
          if (!hasCredits) { setProvisionForAgentId(null); setShowInsufficient(true); return; }
          if (provisionForAgentId) actuallyProvision(provisionForAgentId, cfg);
        }}
      />

      {drawerInst && detailPaneFor(drawerInst, drawerAgent, "drawer")}

      <ConfirmDialog pending={confirm} onClose={() => setConfirm(null)} />

      {/* v1.2 §D — Publish Status */}
      {publishStatusOpen && (
        <PublishStatusModal
          rows={publishRowsFor(allAgents)}
          onClose={() => setPublishStatusOpen(false)}
          handlers={listingHandlers}
          escapeDisabled={!!unpublishRow}
        />
      )}
      <UnpublishDialog
        row={unpublishRow}
        onCancel={() => setUnpublishRow(null)}
        onConfirm={(row) => {
          setUnpublishRow(null);
          setListingState(row.id, "draft");
          pushToast("success", `${row.listingName} unpublished — removed from the Marketplace`);
        }}
      />

      {/* v1.3 §B1 — usage-billing notice, acknowledged once per browser */}
      {showCostNotice && (
        <CostNotice
          body={
            <>
              AgentBox charges based on actual usage. Building an Agent is billed based on build time.
              After deployment, sandboxes are billed while running, with model usage and storage charged separately.
              <br />
              No charges begin until you start a build or deploy a sandbox.
            </>
          }
          onAcknowledge={() => { acknowledge("myagents"); setShowCostNotice(false); }}
        />
      )}

      {/* v1.3 §D — credit gate. No balance/deposit/coupon endpoint exists yet. */}
      {showInsufficient && (
        <InsufficientCredits
          onDeposit={() => { setShowInsufficient(false); setShowTopUp(true); }}
          onCoupon={() => { setShowInsufficient(false); setShowCoupon(true); }}
          onClose={() => setShowInsufficient(false)}
        />
      )}
      {showTopUp && (
        <TopUpCredits onClose={() => setShowTopUp(false)} onContinue={() => { setShowTopUp(false); setHasCredits(true); }} />
      )}
      {showCoupon && (
        <RedeemCoupon onClose={() => setShowCoupon(false)} onApply={() => { setShowCoupon(false); setHasCredits(true); }} />
      )}

      {/* v1.3 §F — listing preview reuses the Browse Agents drawer */}
      <AgentDrawer
        claw={publicListing ? asCatalogClaw(publicListing) : null}
        mode="listing"
        onClose={() => setPublicListing(null)}
      />

      <Toaster toasts={toasts} />
    </div>
  );
}
