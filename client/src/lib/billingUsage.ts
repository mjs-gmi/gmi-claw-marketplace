// ─── Usage & Billing data ───────────────────────────────────────────────────
// The cost subject is the SANDBOX INSTANCE, not the template. A template can
// have many instances, each started, paused and deleted on its own clock, so
// every figure here hangs off a sandbox — except Template storage and Egress,
// which are account-level and deliberately have no sandbox to attach to.
//
// Amounts are computed from the rate card rather than typed in, so the §12
// acceptance cases are checkable against the page instead of against a fixture.

import {
  RATE, HOURS_PER_MONTH, STANDARD_SPECS, runningRate, pausedRate, round4, sumRounded,
  type BillingItem, type Spec, type TierId,
} from "./billingModel";

export type UsageScope = "inference" | "studio" | "agentbox";

export const USAGE_PERIOD = { from: "Aug 22, 2026", to: "Sep 21, 2026" };
/** §10 — billing periods are UTC calendar months, and the page has to say so. */
export const BILLING_MONTH = { label: "September 2026", start: "2026-09-01 00:00 UTC", end: "2026-09-30 23:59 UTC" };
export const DATA_AS_OF = "2026-09-21 14:05 UTC";

export const ACCOUNT_TIER: TierId = "T1";
/** §10 — a discount multiplies the computed amount; base rates never change. */
export const ACCOUNT_DISCOUNT = 0.10;

// ── Sandboxes and their segments ────────────────────────────────────────────
export type SegmentState = "running" | "paused";
export interface Segment {
  id: string;
  state: SegmentState;
  start: string;
  end?: string;          // absent = still accruing (§10 "In progress")
  seconds: number;
}
export type SandboxState = "running" | "paused" | "deleted" | "creating" | "error";

export interface SandboxUsage {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  region: string;
  /** Undefined for a custom spec — §2.1 says those have no product code. */
  productName?: string;
  spec: Spec;
  state: SandboxState;
  created: string;
  deleted?: string;
  segments: Segment[];
  /** §9 — pre-redesign rows have no resource breakdown and must say so. */
  legacy?: { instanceType: string };
}

export interface SnapshotUsage {
  id: string;
  sandboxId: string;
  name: string;
  sizeGB: number;
  ageDays: number;
  storedHours: number;
}

const hrs = (h: number) => Math.round(h * 3600);

export const SANDBOXES: SandboxUsage[] = [
  // §12 — `medium` runs one hour then is deleted. The canonical case.
  {
    id: "sbx_7c41a9",
    name: "nightly-scrape",
    templateId: "d6b808ba-37a2-48f6-9f20-d744bc13f70f",
    templateName: "wickwood3",
    region: "us-central-iowa1",
    productName: "medium",
    spec: STANDARD_SPECS.medium,
    state: "deleted",
    created: "2026-09-03 08:12:05",
    deleted: "2026-09-03 09:12:05",
    segments: [{ id: "sg1", state: "running", start: "2026-09-03 08:12:05", end: "2026-09-03 09:12:05", seconds: hrs(1) }],
  },
  // §12 — run 30m, pause 2h, resume 30m, delete.
  {
    id: "sbx_2b90ff",
    name: "matchday-worker",
    templateId: "51a7fb30-6c84-4de2-9017-8b43ea7c5d19",
    templateName: "matchday",
    region: "us-central-iowa1",
    productName: "medium",
    spec: STANDARD_SPECS.medium,
    state: "deleted",
    created: "2026-09-07 09:20:44",
    deleted: "2026-09-07 12:20:44",
    segments: [
      { id: "sg1", state: "running", start: "2026-09-07 09:20:44", end: "2026-09-07 09:50:44", seconds: hrs(0.5) },
      { id: "sg2", state: "paused",  start: "2026-09-07 09:50:44", end: "2026-09-07 11:50:44", seconds: hrs(2) },
      { id: "sg3", state: "running", start: "2026-09-07 11:50:44", end: "2026-09-07 12:20:44", seconds: hrs(0.5) },
    ],
  },
  // §12 — a custom spec: quantities, no product code.
  {
    id: "sbx_e5d130",
    name: "fde-batch-03",
    templateId: "7c1e0a44-9b2d-4f13-8a6e-2d55c0913bb2",
    templateName: "FDE Agent 003-rev20",
    region: "eu-de-frankfurt1",
    spec: { vcpu: 3, ramGiB: 6, diskGB: 30 },
    state: "running",
    created: "2026-09-21 13:05:00",
    segments: [{ id: "sg1", state: "running", start: "2026-09-21 13:05:00", seconds: hrs(1) }],
  },
  // Still accruing while paused — the list has to flag these (§4).
  {
    id: "sbx_a11c84",
    name: "viva-eval",
    templateId: "3a86e5b1-7d24-40cf-9e83-16b0d4c7f2aa",
    templateName: "viva",
    region: "ap-sg-singapore1",
    productName: "large",
    spec: STANDARD_SPECS.large,
    state: "paused",
    created: "2026-09-16 03:41:19",
    segments: [
      { id: "sg1", state: "running", start: "2026-09-16 03:41:19", end: "2026-09-16 11:30:19", seconds: hrs(7.82) },
      { id: "sg2", state: "paused",  start: "2026-09-16 11:30:19", seconds: hrs(126) },
    ],
  },
  // §9 — a pre-redesign record: container duration only, no breakdown.
  {
    id: "49d9a362…b104",
    name: "49d9a362…b104",
    templateId: "d6b808ba-37a2-48f6-9f20-d744bc13f70f",
    templateName: "wickwood3",
    region: "us-central-iowa1",
    productName: "gmi.container.intel.x4660.small.ext",
    spec: STANDARD_SPECS.small,
    state: "deleted",
    created: "2026-07-09 11:39:34",
    deleted: "2026-07-10 22:18:34",
    segments: [{ id: "sg1", state: "running", start: "2026-07-09 11:39:34", end: "2026-07-10 22:18:34", seconds: hrs(34.65) }],
    legacy: { instanceType: "gmi.container.intel.x4660.small.ext" },
  },
];

export const SNAPSHOTS: SnapshotUsage[] = [
  { id: "snap_4f21a0", sandboxId: "sbx_2b90ff", name: "matchday-pre-upgrade", sizeGB: 38, ageDays: 14, storedHours: 336 },
  { id: "snap_9c07be", sandboxId: "sbx_a11c84", name: "viva-eval-baseline",   sizeGB: 22, ageDays: 5,  storedHours: 120 },
];

// ── Derived amounts ─────────────────────────────────────────────────────────
export function segmentAmount(sb: SandboxUsage, sg: Segment): number {
  const hours = sg.seconds / 3600;
  // A legacy row has no product name to price by, but it also has no
  // breakdown — its amount is whatever the old container meter recorded.
  const rate = sg.state === "running"
    ? runningRate(sb.spec, sb.legacy ? undefined : sb.productName)
    : pausedRate(sb.spec, sb.legacy ? undefined : sb.productName);
  return round4(rate * hours);
}
/** Running segments expand to three rows (§5) — the only way a custom spec reconciles. */
export function segmentBreakdown(sb: SandboxUsage, sg: Segment): { label: string; qty: string; amount: number }[] {
  if (sg.state !== "running") {
    return [{ label: "Disk", qty: `${sb.spec.diskGB} GB · ${(sg.seconds / 3600).toFixed(2)} h`, amount: round4(sb.spec.diskGB * RATE.diskGBHr * (sg.seconds / 3600)) }];
  }
  const h = sg.seconds / 3600;
  return [
    { label: "vCPU",   qty: `${sb.spec.vcpu} vCPU · ${h.toFixed(2)} h`,      amount: round4(sb.spec.vcpu * RATE.vcpuHr * h) },
    { label: "Memory", qty: `${sb.spec.ramGiB} GiB · ${h.toFixed(2)} h`,     amount: round4(sb.spec.ramGiB * RATE.ramGiBHr * h) },
    { label: "Disk",   qty: `${sb.spec.diskGB} GB · ${h.toFixed(2)} h`,      amount: round4(sb.spec.diskGB * RATE.diskGBHr * h) },
  ];
}
export function sandboxTotal(sb: SandboxUsage): number {
  return sumRounded(sb.segments.map((sg) => segmentAmount(sb, sg)));
}
export function sandboxItemTotal(sb: SandboxUsage, item: BillingItem): number {
  if (item !== "running" && item !== "paused") return 0;
  return sumRounded(sb.segments.filter((s) => s.state === item).map((sg) => segmentAmount(sb, sg)));
}
export const isAccruing = (sb: SandboxUsage): boolean => sb.state === "running" || sb.state === "paused";

// ── Account-level items ─────────────────────────────────────────────────────
export const SNAPSHOT_FREE_GB = 50;
export const TEMPLATE_FREE_GB = 100;
export const EGRESS_FREE_GB = 20;

/** Storage accrues in GB·hours and is presented as GB·month (§4). */
export const snapshotGBh = SNAPSHOTS.reduce((a, s) => a + s.sizeGB * s.storedHours, 0);
export const templateGBh = 10 * 48 + 100 * HOURS_PER_MONTH;   // §12: 10 GB for 48 h beyond the allowance
export const egressUsedGB = 26.4;

export const snapshotGBmo = snapshotGBh / HOURS_PER_MONTH;
export const templateGBmo = templateGBh / HOURS_PER_MONTH;

export const snapshotBillableGBmo = Math.max(0, snapshotGBmo - SNAPSHOT_FREE_GB);
export const templateBillableGBmo = Math.max(0, templateGBmo - TEMPLATE_FREE_GB);
export const egressBillableGB = Math.max(0, egressUsedGB - EGRESS_FREE_GB);

export const ACCOUNT_ITEM_AMOUNT: Record<"snapshot_storage" | "template_storage" | "egress", number> = {
  snapshot_storage: round4(snapshotBillableGBmo * RATE.storageGBMonth),
  template_storage: round4(templateBillableGBmo * RATE.storageGBMonth),
  egress: round4(egressBillableGB * RATE.egressGB),
};

export function itemTotal(item: BillingItem): number {
  if (item === "running" || item === "paused") {
    return sumRounded(SANDBOXES.map((sb) => sandboxItemTotal(sb, item)));
  }
  return ACCOUNT_ITEM_AMOUNT[item];
}
export const periodTotal = (): number => sumRounded(
  (["running", "paused", "snapshot_storage", "template_storage", "egress"] as BillingItem[]).map(itemTotal),
);

// ── Quotas (§6) ─────────────────────────────────────────────────────────────
export const QUOTA = {
  concurrencyUsedVcpu: 7,      // includes paused sandboxes — the point of the row
  buildCpuHoursUsed: 12.4,
  buildCpuHoursAllowed: 20,
  buildResets: "2026-10-01 00:00 UTC",
  concurrentBuilds: 2,
  buildTimeoutMin: 30,
  buildCores: 4,
  templateStorageUsedGB: 110,
  archivingSoon: [
    { kind: "Paused sandbox", name: "viva-eval", detail: "archived in 5 days if not resumed" },
    { kind: "Template", name: "sevenTest", detail: "no launch for 74 days · archived at 90" },
  ],
};

export const usd = (n: number): string =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Inference / Studio (unchanged scopes) ───────────────────────────────────
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

export interface UsageRow { time: string; category: string; modelType: string; amount: number; legacyFromAgentbox?: boolean }
export const INFERENCE_ROWS: UsageRow[] = [
  { time: "Sep, 2026", category: "Dedicated",  modelType: "—",          amount: 7_671.5 },
  { time: "Sep, 2026", category: "Serverless", modelType: "LLM",        amount: 32_279.4 },
  { time: "Sep, 2026", category: "Serverless", modelType: "Multimodal", amount: 267.07 },
  // §9 — Token usage left Agentbox. It lands here, still attributed.
  { time: "Sep, 2026", category: "Serverless", modelType: "LLM · wickwood3", amount: 13_592.82, legacyFromAgentbox: true },
  { time: "Aug, 2026", category: "Dedicated",  modelType: "—",          amount: 5_402.18 },
];
export const STUDIO_ROWS: UsageRow[] = [
  { time: "Sep, 2026", category: "Image", modelType: "Gallery", amount: 902.4 },
  { time: "Sep, 2026", category: "Video", modelType: "Gallery", amount: 311.82 },
  { time: "Sep, 2026", category: "Audio", modelType: "Gallery", amount: 69.94 },
];

export const sandboxById = (id: string): SandboxUsage | undefined => SANDBOXES.find((s) => s.id === id);
export const snapshotsFor = (id: string): SnapshotUsage[] => SNAPSHOTS.filter((s) => s.sandboxId === id);
export const snapshotCost = (s: SnapshotUsage): number =>
  round4((s.sizeGB * s.storedHours / HOURS_PER_MONTH) * RATE.storageGBMonth);
