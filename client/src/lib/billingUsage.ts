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
  model_usage: "billed",
  template_storage: "no_meter",
  egress: "no_meter",
  paused: "no_meter",            // 2.1
  snapshot_storage: "no_meter",  // 2.1
};
export const BILLING_STARTS: Partial<Record<BillingItem, string>> = {
  template_storage: "2026-11-01",
  egress: "2026-11-01",
};
export const metered = (i: BillingItem): boolean => METER[i] !== "no_meter";

/** §P3 — whether the upstream can attribute these to a sandbox at all. */
export const EGRESS_ATTRIBUTABLE = true;
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
/** §P2 — 2.0 has hourly buckets, not true segments. Same row shape either way. */
export interface HourBucket { hourStart: string; minutes: number; amount: number }

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

const bucket = (hourStart: string, minutes: number, hourlyRate: number): HourBucket =>
  ({ hourStart, minutes, amount: round4(hourlyRate * (minutes / 60)) });

const MEDIUM = STANDARD_SPECS.medium;
const LARGE = STANDARD_SPECS.large;
const CUSTOM: Spec = { vcpu: 3, ramGiB: 6, diskGB: 30 };

export const SANDBOXES: SandboxUsage[] = [
  {
    id: "sbx_7c41a9", name: "nightly-scrape", agentId: "wickwood3",
    region: "us-central-iowa1", productName: "medium", spec: MEDIUM,
    state: "deleted", created: "2026-09-03 08:12:05", deleted: "2026-09-03 09:12:05",
    buckets: [bucket("2026-09-03 08:00", 60, runningRate(MEDIUM, "medium"))],
  },
  {
    id: "sbx_2b90ff", name: "matchday-worker", agentId: "matchday",
    region: "us-central-iowa1", productName: "medium", spec: MEDIUM,
    state: "deleted", created: "2026-09-07 09:20:44", deleted: "2026-09-07 12:20:44",
    buckets: [
      bucket("2026-09-07 09:00", 39, runningRate(MEDIUM, "medium")),
      bucket("2026-09-07 11:00", 9,  runningRate(MEDIUM, "medium")),
      bucket("2026-09-07 12:00", 12, runningRate(MEDIUM, "medium")),
    ],
  },
  {
    id: "sbx_e5d130", name: "fde-batch-03", agentId: "fde-003",
    region: "eu-de-frankfurt1", spec: CUSTOM,     // custom: no product code
    state: "running", created: "2026-09-21 13:05:00",
    buckets: [
      bucket("2026-09-21 13:00", 55, runningRate(CUSTOM)),
      bucket("2026-09-21 14:00", 60, runningRate(CUSTOM)),
      bucket("2026-09-22 09:00", 40, runningRate(CUSTOM)),
    ],
  },
  {
    // §P2 — the API returns no display_name for this one, so the row is its id.
    id: "sbx_a11c84", name: "sbx_a11c84", agentId: "viva",
    region: "ap-sg-singapore1", productName: "large", spec: LARGE,
    state: "running", created: undefined,
    buckets: [
      bucket("2026-09-16 03:00", 19, runningRate(LARGE, "large")),
      bucket("2026-09-16 04:00", 60, runningRate(LARGE, "large")),
      bucket("2026-09-16 05:00", 47, runningRate(LARGE, "large")),
    ],
  },
  {
    // §P1/§P2 — pre-redesign: one session row, original type, no split.
    id: "49d9a362…b104", name: "49d9a362…b104", agentId: "wickwood3",
    region: "us-central-iowa1", productName: "gmi.container.intel.x4660.small.ext",
    spec: STANDARD_SPECS.small, state: "deleted",
    created: "2026-07-09 11:39:34", deleted: "2026-07-10 22:18:34",
    buckets: [{ hourStart: "2026-07-09 11:00", minutes: 2079, amount: 0.34 }],
    legacy: { instanceType: "gmi.container.intel.x4660.small.ext", durationLabel: "34 hours 39 minutes" },
  },
];

export const sandboxById = (id: string): SandboxUsage | undefined => SANDBOXES.find((s) => s.id === id);
export const sandboxRunning = (sb: SandboxUsage): number => sumRounded(sb.buckets.map((b) => b.amount));
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

// ── Templates (one per agent) ───────────────────────────────────────────────
export interface TemplateStorage {
  id: string; agentId: string; name: string; version: string;
  sizeGB: number; lastLaunch: string; storedHours: number; deleted?: boolean;
}
export const TEMPLATES: TemplateStorage[] = [
  { id: "d6b808ba", agentId: "wickwood3", name: "wickwood3",           version: "v4",  sizeGB: 46, lastLaunch: "2026-09-03", storedHours: 730 },
  { id: "7c1e0a44", agentId: "fde-003",   name: "FDE Agent 003-rev20", version: "v20", sizeGB: 38, lastLaunch: "2026-09-21", storedHours: 730 },
  { id: "51a7fb30", agentId: "matchday",  name: "matchday",            version: "v2",  sizeGB: 16, lastLaunch: "2026-09-07", storedHours: 730 },
  { id: "e9d31c87", agentId: "sevenTest", name: "sevenTest",           version: "v1",  sizeGB: 10, lastLaunch: "2026-07-09", storedHours: 48, deleted: true },
];
export const templateGBh = (t: TemplateStorage): number => t.sizeGB * t.storedHours;
export const templateCost = (t: TemplateStorage): number =>
  round4((templateGBh(t) / HOURS_PER_MONTH) * RATE.storageGBMonth);

// ── Egress ──────────────────────────────────────────────────────────────────
export interface EgressRow { sandboxId: string; bytesGB: number }
export const EGRESS: EgressRow[] = [
  { sandboxId: "sbx_e5d130", bytesGB: 18.2 },
  { sandboxId: "sbx_a11c84", bytesGB: 5.1 },
  { sandboxId: "sbx_2b90ff", bytesGB: 3.1 },
];
export const egressFor = (sandboxId: string): number =>
  EGRESS.find((e) => e.sandboxId === sandboxId)?.bytesGB ?? 0;

// ── Allowances ──────────────────────────────────────────────────────────────
export const TEMPLATE_FREE_GB = 100;
export const EGRESS_FREE_GB = 20;
export const SNAPSHOT_FREE_GB = 50;

export const templateGBmo = TEMPLATES.reduce((a, t) => a + templateGBh(t), 0) / HOURS_PER_MONTH;
export const egressUsedGB = EGRESS.reduce((a, e) => a + e.bytesGB, 0);
export const templateBillableGBmo = Math.max(0, templateGBmo - TEMPLATE_FREE_GB);
export const egressBillableGB = Math.max(0, egressUsedGB - EGRESS_FREE_GB);

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
  modelUsage: number;
  templateStorage: number | null;   // null = no meter, which is not zero
  egress: number | null;
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
export function templateForAgent(agentId: string): TemplateStorage | undefined {
  return TEMPLATES.find((t) => t.agentId === agentId);
}

export function agentRows(): AgentRow[] {
  return Object.entries(AGENT_META).map(([agentId, meta]) => {
    const boxes = sandboxesForAgent(agentId);
    const versions = new Set(boxes.map(sandboxVersion));
    const tpl = templateForAgent(agentId);
    return {
      agentId,
      name: meta.name,
      templateId: meta.templateId,
      runs: boxes.length,
      version: (versions.size > 1 ? "v1+v2" : (versions.values().next().value ?? "v2")) as AgentRow["version"],
      deletedAt: meta.deletedAt,
      accruing: boxes.some(isAccruing),
      running: sumRounded(boxes.map(sandboxRunning)),
      modelUsage: sumRounded(boxes.flatMap((b) => modelUsageFor(b.id).map(modelNet))),
      // §P1 — "—", not $0: nothing is counting these yet.
      templateStorage: metered("template_storage") && tpl ? templateCost(tpl) : null,
      egress: metered("egress")
        ? round4(boxes.reduce((a, b) => a + egressFor(b.id), 0) * RATE.egressGB)
        : null,
    };
  }).sort((a, b) => agentTotal(b) - agentTotal(a));
}

/** Only metered items count toward a total anyone is being asked to pay. */
export function agentTotal(a: AgentRow): number {
  return sumRounded([a.running, a.modelUsage, a.templateStorage ?? 0, a.egress ?? 0]);
}
export function agentById(agentId: string): AgentRow | undefined {
  return agentRows().find((a) => a.agentId === agentId);
}

export const itemTotal = (item: BillingItem): number | null => {
  if (!metered(item)) return null;
  switch (item) {
    case "running":     return sumRounded(SANDBOXES.map(sandboxRunning));
    case "model_usage": return sumRounded(MODEL_USAGE.map(modelNet));
    case "template_storage": return round4(templateBillableGBmo * RATE.storageGBMonth);
    case "egress":      return round4(egressBillableGB * RATE.egressGB);
    default:            return 0;
  }
};
export const periodListTotal = (): number => sumRounded(agentRows().map(agentTotal));
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
  templateStorageUsedGB: 110,
  templateStorageCapGB: 500,
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
