// ─── Usage & Billing data ───────────────────────────────────────────────────
// The page aggregates by AGENT. That is the level a person thinks at — "what
// did this agent cost me" — and it is the level both cost chains roll up to:
//
//   Agent
//   ├─ Template (one per agent, many versions) → Template storage
//   └─ Sandbox (many per agent)                → Running, Egress, Model usage
//
// A sandbox is one level down and a segment is two. Each level answers a
// different question, and flattening them was what made the old page unable to
// answer any of them.

import {
  RATE, HOURS_PER_MONTH, STANDARD_SPECS, runningRate, pausedRate, round4, sumRounded,
  billedMinutes, perMinute, round2,
  type BillingItem, type BillingStatus, type Spec,
} from "./billingModel";

export type UsageScope = "inference" | "studio" | "agentbox";

export const BILLING_MONTH = { label: "September 2026", start: "2026-09-01 00:00 UTC", end: "2026-09-30 23:59 UTC" };
export const USAGE_PERIOD = { from: "Aug 22, 2026", to: "Sep 21, 2026" };
export const DATA_AS_OF = "2026-09-22 09:40 UTC";
export const MONTH_OPTIONS = ["September 2026", "August 2026", "July 2026"];

export const ACCOUNT_TIER = "tier2" as const;
export const ACCOUNT_DISCOUNT = 0.10;

/**
 * Where each meter actually is. Template storage and Egress do not exist yet —
 * the page must show "—" with a reason, never $0, because a zero reads as "you
 * used none of this" and the truth is "nobody is counting".
 *
 * Flip either to "billed" to review the fully-metered design.
 */
export const METER: Record<BillingItem, BillingStatus> = {
  running: "billed",
  paused: "billed",              // ships in 2.0
  model_usage: "billed",
  snapshot_storage: "no_meter",  // arrives with Snapshots in 2.1
};
export const BILLING_STARTS: Partial<Record<BillingItem, string>> = {};
export const metered = (i: BillingItem): boolean => METER[i] !== "no_meter";

/** Whether model usage can be attributed to a sandbox via its API key. */
export const MODEL_USAGE_ATTRIBUTABLE = true;

/**
 * §P2 — whether `/ce/usage` can return Running split into vCPU / memory / disk.
 * It returns a single `amount` today. The split must NOT be reverse-computed
 * from spec × rate: rates change, discounts multiply the total, and a number
 * derived that way will not match the invoice. Until Billing answers, segments
 * do not expand and no placeholder rows are shown.
 */
export const RESOURCE_SPLIT_AVAILABLE = false;

// ── Sandboxes ───────────────────────────────────────────────────────────────
export type SandboxState = "running" | "paused" | "deleted" | "creating" | "error";
export type SegmentState = "running" | "paused";
/**
 * §P2 — 2.0 reports hourly buckets rather than true segments, and each bucket
 * must carry its state: a paused hour prices at the paused rate, which is about
 * 1% of running. Without `state` on the row the two are indistinguishable and
 * a paused sandbox looks like it was billed as running.
 *
 * Billing returning `state` on /ce/usage is the open item this depends on.
 */
export interface HourBucket { hourStart: string; minutes: number; state: SegmentState; amount: number }

export interface SandboxUsage {
  id: string;
  name: string;            // equals id when the API returns no display_name
  agentId: string;
  region: string;
  productName?: string;    // absent for a custom spec
  spec: Spec;
  state: SandboxState;
  created?: string;        // §P2 — Sandbox API may not return this
  deleted?: string;
  buckets: HourBucket[];
  /** Pre-redesign rows: one session, original instance type, no breakdown. */
  legacy?: { instanceType: string; durationLabel: string };
}

/** Minutes are rounded up before pricing — see billedMinutes(). */
const seg = (hourStart: string, minutes: number, state: SegmentState, sp: Spec, productName?: string): HourBucket => {
  const hourly = state === "running" ? runningRate(sp, productName) : pausedRate(sp, productName);
  return { hourStart, minutes, state, amount: round4(perMinute(hourly) * minutes) };
};

const MEDIUM = STANDARD_SPECS.medium;
const LARGE = STANDARD_SPECS.large;
const CUSTOM: Spec = { vcpu: 3, ramGiB: 6, diskGB: 30 };

export const SANDBOXES: SandboxUsage[] = [
  // §P2 acceptance — `medium` runs one hour.
  {
    id: "sbx_7c41a9", name: "nightly-scrape", agentId: "wickwood3",
    region: "us-central-iowa1", productName: "medium", spec: MEDIUM,
    state: "deleted", created: "2026-09-03 08:12:05", deleted: "2026-09-03 09:12:05",
    buckets: [seg("2026-09-03 08:00", 60, "running", MEDIUM, "medium")],
  },
  // §P2 acceptance — run 10 min, pause 20 min, resume. Three segments, the
  // middle one at the paused price.
  {
    id: "sbx_2b90ff", name: "matchday-worker", agentId: "matchday",
    region: "us-central-iowa1", productName: "medium", spec: MEDIUM,
    state: "deleted", created: "2026-09-07 09:20:44", deleted: "2026-09-07 10:00:44",
    buckets: [
      seg("2026-09-07 09:20", 10, "running", MEDIUM, "medium"),
      seg("2026-09-07 09:30", 20, "paused",  MEDIUM, "medium"),
      seg("2026-09-07 09:50", 10, "running", MEDIUM, "medium"),
    ],
  },
  // A custom spec: priced by formula, no product code to look up.
  {
    id: "sbx_e5d130", name: "fde-batch-03", agentId: "fde-003",
    region: "eu-de-frankfurt1", spec: CUSTOM,
    state: "running", created: "2026-09-21 13:05:00",
    buckets: [
      seg("2026-09-21 13:00", 55, "running", CUSTOM),
      seg("2026-09-21 14:00", 60, "running", CUSTOM),
      seg("2026-09-22 09:00", 40, "running", CUSTOM),
    ],
  },
  // Paused and still accruing disk — and the API returns no display_name.
  {
    id: "sbx_a11c84", name: "sbx_a11c84", agentId: "viva",
    region: "ap-sg-singapore1", productName: "large", spec: LARGE,
    state: "paused", created: undefined,
    buckets: [
      seg("2026-09-16 03:00", 19,   "running", LARGE, "large"),
      seg("2026-09-16 04:00", 60,   "running", LARGE, "large"),
      seg("2026-09-16 05:00", 2880, "paused",  LARGE, "large"),
    ],
  },
  // A 30-second run: one billed minute, and it must not render as $0.00.
  {
    id: "sbx_0f77c2", name: "probe-run", agentId: "matchday",
    region: "us-central-iowa1", productName: "medium", spec: MEDIUM,
    state: "deleted", created: "2026-09-18 22:04:10", deleted: "2026-09-18 22:04:40",
    buckets: [seg("2026-09-18 22:00", 1, "running", MEDIUM, "medium")],
  },
  // Pre-redesign: one session, original type, no hourly breakdown.
  {
    id: "49d9a362…b104", name: "49d9a362…b104", agentId: "wickwood3",
    region: "us-central-iowa1", productName: "gmi.container.intel.x4660.small.ext",
    spec: STANDARD_SPECS.small, state: "deleted",
    created: "2026-07-09 11:39:34", deleted: "2026-07-10 22:18:34",
    buckets: [{ hourStart: "2026-07-09 11:00", minutes: 2079, state: "running", amount: 0.34 }],
    legacy: { instanceType: "gmi.container.intel.x4660.small.ext", durationLabel: "34 hours 39 minutes" },
  },
];

export const sandboxById = (id: string): SandboxUsage | undefined => SANDBOXES.find((s) => s.id === id);
export const sandboxRunning = (sb: SandboxUsage): number => sumRounded(sb.buckets.map((b) => b.amount));
export const sandboxItem = (sb: SandboxUsage, state: SegmentState): number =>
  sumRounded(sb.buckets.filter((b) => b.state === state).map((b) => b.amount));
/** §P2 — shown in the header while an account is overdue. */
export const TERMINATE_AT: string | null = null;
export const sandboxMinutes = (sb: SandboxUsage): number => sb.buckets.reduce((a, b) => a + b.minutes, 0);
export const isAccruing = (sb: SandboxUsage): boolean => sb.state === "running" || sb.state === "paused";
export const sandboxVersion = (sb: SandboxUsage): "v1" | "v2" => (sb.legacy ? "v1" : "v2");

// ── Model usage ─────────────────────────────────────────────────────────────
export interface ModelUsageRow { sandboxId: string; model: string; tokens: number; amount: number; creditApplied: number }
export const MODEL_USAGE: ModelUsageRow[] = [
  { sandboxId: "sbx_7c41a9",     model: "claude-opus-5",   tokens: 214_300_000, amount: 9_244.10, creditApplied: 0 },
  { sandboxId: "sbx_7c41a9",     model: "claude-sonnet-5", tokens: 114_550_000, amount: 3_118.44, creditApplied: 3_118.44 },
  { sandboxId: "49d9a362…b104",  model: "claude-opus-4.8", tokens: 61_200_000,  amount: 1_230.28, creditApplied: 0 },
  { sandboxId: "sbx_e5d130",     model: "DeepSeek-V4-Pro", tokens: 285_000_000, amount: 881.16,   creditApplied: 0 },
];
export const modelUsageFor = (sandboxId: string): ModelUsageRow[] => MODEL_USAGE.filter((m) => m.sandboxId === sandboxId);
export const modelNet = (m: ModelUsageRow): number => round4(m.amount - m.creditApplied);

// ── Templates — lifecycle records, not a cost (§P1a / §P4) ─────────────────
// Templates are not billed. They are capped by COUNT, enforced at Register, and
// their lifecycle is recorded now so a future charge has a timeline to bill
// from. `imageSizeBytes` is reserved and stays null until Runloop exposes it or
// manifest reading lands — it is deliberately not rendered as a size of zero.
export type TemplateStatus = "ready" | "building" | "error" | "archived";
export interface TemplateRecord {
  id: string;
  agentId: string;
  name: string;
  version: string;
  status: TemplateStatus;
  createdAt: string;
  readyAt?: string;
  deletedAt?: string;
  lastLaunch?: string;
  imageSizeBytes: number | null;   // reserved
}
export const TEMPLATES: TemplateRecord[] = [
  { id: "d6b808ba", agentId: "wickwood3", name: "wickwood3",           version: "v4",  status: "ready",    createdAt: "2026-06-02", readyAt: "2026-06-02", lastLaunch: "2026-09-03", imageSizeBytes: null },
  { id: "7c1e0a44", agentId: "fde-003",   name: "FDE Agent 003-rev20", version: "v20", status: "ready",    createdAt: "2026-08-14", readyAt: "2026-08-14", lastLaunch: "2026-09-21", imageSizeBytes: null },
  { id: "51a7fb30", agentId: "matchday",  name: "matchday",            version: "v2",  status: "ready",    createdAt: "2026-07-20", readyAt: "2026-07-20", lastLaunch: "2026-09-07", imageSizeBytes: null },
  { id: "e9d31c87", agentId: "sevenTest", name: "sevenTest",           version: "v1",  status: "ready",    createdAt: "2026-05-11", readyAt: "2026-05-11", lastLaunch: "2026-07-09", imageSizeBytes: null },
  { id: "a40c2b91", agentId: "viva",      name: "viva",                version: "v3",  status: "building", createdAt: "2026-09-22", imageSizeBytes: null },
];
export const ARCHIVE_AFTER_DAYS = 90;
/** Days until a template with no launch is archived; null when it has none. */
export function daysToArchive(t: TemplateRecord, today = "2026-09-22"): number | null {
  if (!t.lastLaunch || t.status !== "ready") return null;
  const gap = Math.floor((Date.parse(today) - Date.parse(t.lastLaunch)) / 86_400_000);
  return Math.max(0, ARCHIVE_AFTER_DAYS - gap);
}
export const templatesForAgent = (agentId: string): TemplateRecord[] => TEMPLATES.filter((t) => t.agentId === agentId);
export const TEMPLATE_COUNT = TEMPLATES.filter((t) => !t.deletedAt).length;

// ── Allowances ──────────────────────────────────────────────────────────────
// Nothing in 2.0 carries a free allowance: Templates have a count limit rather
// than a charge, and Egress is out of scope. Snapshot storage brings the first
// one, with Snapshots, in 2.1.
export const SNAPSHOT_FREE_GB = 50;

// ── Agent rollup — what P1 lists ────────────────────────────────────────────
export interface AgentRow {
  agentId: string;
  name: string;
  templateId: string;
  runs: number;
  version: "v1" | "v2" | "v1+v2";
  deletedAt?: string;
  accruing: boolean;
  running: number;
  paused: number;
  modelUsage: number;
  templates: number;       // a count, not a cost
}

const AGENT_META: Record<string, { name: string; templateId: string; deletedAt?: string }> = {
  wickwood3: { name: "wickwood3",           templateId: "d6b808ba-37a2-48f6-9f20-d744bc13f70f", deletedAt: "2026-09-20" },
  "fde-003": { name: "FDE Agent 003-rev20", templateId: "7c1e0a44-9b2d-4f13-8a6e-2d55c0913bb2" },
  matchday:  { name: "matchday",            templateId: "51a7fb30-6c84-4de2-9017-8b43ea7c5d19" },
  viva:      { name: "viva",                templateId: "3a86e5b1-7d24-40cf-9e83-16b0d4c7f2aa" },
};

export function sandboxesForAgent(agentId: string): SandboxUsage[] {
  return SANDBOXES.filter((s) => s.agentId === agentId);
}


export function agentRows(): AgentRow[] {
  return Object.entries(AGENT_META).map(([agentId, meta]) => {
    const boxes = sandboxesForAgent(agentId);
    const versions = new Set(boxes.map(sandboxVersion));
    return {
      agentId,
      name: meta.name,
      templateId: meta.templateId,
      runs: boxes.length,
      version: (versions.size > 1 ? "v1+v2" : (versions.values().next().value ?? "v2")) as AgentRow["version"],
      deletedAt: meta.deletedAt,
      accruing: boxes.some(isAccruing),
      running: sumRounded(boxes.map((b) => sandboxItem(b, "running"))),
      paused: sumRounded(boxes.map((b) => sandboxItem(b, "paused"))),
      modelUsage: sumRounded(boxes.flatMap((b) => modelUsageFor(b.id).map(modelNet))),
      templates: templatesForAgent(agentId).length,
    };
  }).sort((a, b) => agentTotal(b) - agentTotal(a));
}

/** Only metered items count toward a total anyone is being asked to pay. */
export function agentTotal(a: AgentRow): number {
  return sumRounded([a.running, a.paused, a.modelUsage]);
}
export function agentById(agentId: string): AgentRow | undefined {
  return agentRows().find((a) => a.agentId === agentId);
}

export const itemTotal = (item: BillingItem): number | null => {
  if (!metered(item)) return null;
  switch (item) {
    case "running":     return sumRounded(SANDBOXES.map((s) => sandboxItem(s, "running")));
    case "paused":      return sumRounded(SANDBOXES.map((s) => sandboxItem(s, "paused")));
    case "model_usage": return sumRounded(MODEL_USAGE.map(modelNet));
    default:            return 0;
  }
};
/**
 * The header total is the sum of the three breakdown cells, not the sum of the
 * agent rows. Both are defensible, but they differ by a cent — rounding per
 * agent and rounding per item take different paths — and only one of them can
 * be right when the card sits directly under the number it is meant to explain.
 * The card explains the total, so the total is built from the card.
 */
export const periodListTotal = (): number =>
  (["running", "paused", "model_usage"] as BillingItem[])
    .reduce((a, i) => a + round2(itemTotal(i) ?? 0), 0);
export const periodBilledTotal = (): number => round4(periodListTotal() * (1 - ACCOUNT_DISCOUNT));

// ── Quotas (§P4) ────────────────────────────────────────────────────────────
export const QUOTA = {
  concurrencyUsedVcpu: 7,
  buildHoursUsed: 6.2,
  buildHoursAllowed: 10,
  buildResets: "2026-10-01 00:00 UTC",
  concurrentBuilds: 5,
  buildTimeoutLabel: "1 h",
  buildCores: 2,
  sessionLimit: "24 h",
  /** §P4 — templates are limited by COUNT. There is no GB cap. */
  templatesUsed: TEMPLATES.filter((t) => !t.deletedAt).length,
  templatesAllowed: 20,
  /** Checked at build submit; a template over this is refused, not charged. */
  imageSizeCapGB: 30,
  archivingSoon: [
    { kind: "Template", name: "sevenTest", detail: "no launch for 74 days · archived at 90" },
  ],
};

// ── Inference / Studio (other scopes, unchanged) ────────────────────────────
export interface ModelSlice { model: string; color: string; amount: number }
export interface InferenceDay { date: string; slices: ModelSlice[] }
export const INFERENCE_MODELS: { model: string; color: string }[] = [
  { model: "Dedicated", color: "#f472b6" }, { model: "claude-opus-5", color: "#a78bfa" },
  { model: "claude-opus-4.8", color: "#fbbf24" }, { model: "claude-fable-5", color: "#22d3ee" },
  { model: "gpt-6-astra", color: "#f472b6" }, { model: "claude-sonnet-5", color: "#c084fc" },
  { model: "gpt-5.6-sol", color: "#38bdf8" }, { model: "GLM-5.3", color: "#e879f9" },
  { model: "kimi-k3", color: "#06b6d4" }, { model: "DeepSeek-V4-Pro", color: "#c026d3" },
];
export const INFERENCE_MODELS_MORE = 229;
export const INFERENCE_TOTAL = 53_689.42;
export const STUDIO_TOTAL = 1_284.16;

export function inferenceSeries(): InferenceDay[] {
  const days: InferenceDay[] = [];
  for (let i = 0; i < 31; i++) {
    const month = i < 10 ? "08" : "09";
    const day = i < 10 ? 22 + i : i - 9;
    const date = `${month}/${String(day).padStart(2, "0")}`;
    const spike = date === "09/01";
    const bump = date === "09/17" || date === "09/18";
    const base = spike ? 4200 : bump ? 260 : 80 + ((i * 37) % 90);
    days.push({
      date,
      slices: INFERENCE_MODELS.slice(0, spike ? 6 : bump ? 4 : 2).map((m, k) => ({
        model: m.model, color: m.color,
        amount: Math.round(base * (spike ? [0.30, 0.45, 0.12, 0.06, 0.04, 0.03][k] : k === 0 ? 0.62 : 0.38 / (k || 1))),
      })),
    });
  }
  return days;
}
export interface UsageRow { time: string; category: string; modelType: string; amount: number }
export const INFERENCE_ROWS: UsageRow[] = [
  { time: "Sep, 2026", category: "Dedicated",  modelType: "—",          amount: 7_671.5 },
  { time: "Sep, 2026", category: "Serverless", modelType: "LLM",        amount: 32_279.4 },
  { time: "Sep, 2026", category: "Serverless", modelType: "Multimodal", amount: 267.07 },
  { time: "Aug, 2026", category: "Dedicated",  modelType: "—",          amount: 5_402.18 },
];
export const STUDIO_ROWS: UsageRow[] = [
  { time: "Sep, 2026", category: "Image", modelType: "Gallery", amount: 902.4 },
  { time: "Sep, 2026", category: "Video", modelType: "Gallery", amount: 311.82 },
  { time: "Sep, 2026", category: "Audio", modelType: "Gallery", amount: 69.94 },
];

export const usd = (n: number): string =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
