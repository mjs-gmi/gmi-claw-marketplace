// ─── AgentBox billing model ─────────────────────────────────────────────────
// Rates, allowances and tiers from the SKU spec (IE/507674662) at the $0.18
// list price. Every value here is a placeholder for an API response — §1 is
// explicit that the UI fetches prices, including the ones inside explanatory
// copy, so nothing may be hardcoded into a sentence.
//
// Two things in here are load-bearing for §12:
//   · a spec's rate is the SUM of three per-resource rates, not a flat hourly
//     number, because custom specs have no product code to look a price up by
//   · totals are the sum of ROUNDED segment amounts, not the rounded sum. The
//     acceptance case (30m run + 2h paused + 30m run = $0.1842) only comes out
//     right that way, and it matches what a reader gets adding up the column.

export type BillingItem = "running" | "paused" | "snapshot_storage" | "template_storage" | "egress";

export const BILLING_ITEMS: BillingItem[] = [
  "running", "paused", "snapshot_storage", "template_storage", "egress",
];

export const ITEM_LABEL: Record<BillingItem, string> = {
  running: "Sandbox runtime",
  paused: "Paused",
  snapshot_storage: "Snapshot storage",
  template_storage: "Template storage",
  egress: "Egress",
};

export const ITEM_COLOR: Record<BillingItem, string> = {
  running: "#DDEA4D",
  paused: "#2dd4bf",
  snapshot_storage: "#a78bfa",
  template_storage: "#38bdf8",
  egress: "#f472b6",
};

/** §10 — one line each, for the empty state and the tooltips. */
export const ITEM_BLURB: Record<BillingItem, string> = {
  running: "Billed per second while running, based on vCPU, memory and disk. No minimum.",
  paused: "Only disk is billed while a sandbox is paused.",
  snapshot_storage: "Billed per GB-month beyond the free 50 GB.",
  template_storage: "Billed per GB-month beyond the free 100 GB. Building templates is free.",
  egress: "Billed per GB beyond the free 20 GB per month. Inbound traffic is always free.",
};

/** Account-level items have no sandbox to hang off (§4). */
export const ACCOUNT_LEVEL: BillingItem[] = ["template_storage", "egress"];

// ── Rates ───────────────────────────────────────────────────────────────────
export const RATE = {
  vcpuHr: 0.0738,       // per vCPU hour
  ramGiBHr: 0.00759,    // per GiB hour
  diskGBHr: 0.000106,   // per GB hour
  storageGBMonth: 0.03, // snapshot and template storage
  egressGB: 0.15,
} as const;

/** A month for GB·month conversion. Stated so the arithmetic is auditable. */
export const HOURS_PER_MONTH = 730;

export interface Spec { vcpu: number; ramGiB: number; diskGB: number }
export const STANDARD_SPECS: Record<string, Spec> = {
  small:  { vcpu: 1, ramGiB: 2, diskGB: 20 },
  medium: { vcpu: 2, ramGiB: 4, diskGB: 20 },
  large:  { vcpu: 4, ramGiB: 8, diskGB: 40 },
};

/**
 * Standard specs have a PUBLISHED hourly rate; the per-resource formula is how
 * their breakdown is derived, and it lands a hundredth of a cent away
 * (medium: 0.1476 + 0.0304 + 0.0021 = 0.1801 against a published 0.1800). The
 * published number is what the customer was quoted, so it is what gets charged
 * — the breakdown is an explanation of it, not the source of it. Custom specs
 * have nothing published, so for those the formula IS the price.
 *
 * Getting this backwards is what made the acceptance cases disagree with each
 * other: §12 wants `medium` for an hour to read $0.1800, and a custom
 * 3/6/30 to read $0.2701, and only this rule produces both.
 */
const PUBLISHED_RUNNING: Record<string, number> = { small: 0.0911, medium: 0.1800, large: 0.3600 };
const PUBLISHED_PAUSED:  Record<string, number> = { small: 0.0021, medium: 0.0021, large: 0.0042 };

function formulaRunning(s: Spec): number {
  return s.vcpu * RATE.vcpuHr + s.ramGiB * RATE.ramGiBHr + s.diskGB * RATE.diskGBHr;
}

export function runningRate(s: Spec, productName?: string): number {
  const published = productName ? PUBLISHED_RUNNING[productName] : undefined;
  return published ?? formulaRunning(s);
}
export function pausedRate(s: Spec, productName?: string): number {
  // CPU and memory are free while paused; only disk bills.
  const published = productName ? PUBLISHED_PAUSED[productName] : undefined;
  return published ?? s.diskGB * RATE.diskGBHr;
}

/** §2.1 — a short code for a standard spec, quantities for a custom one. */
export function specLabel(s: Spec, productName?: string): string {
  if (productName) return productName;
  return `${s.vcpu} vCPU · ${s.ramGiB} GiB · ${s.diskGB} GB`;
}
export function specDetail(s: Spec): string {
  return `${s.vcpu} vCPU · ${s.ramGiB} GiB · ${s.diskGB} GB`;
}

// ── Allowances ──────────────────────────────────────────────────────────────
export interface Allowance { item: BillingItem; free: number; unit: string; used: number; resets: string }

// ── Tiers ───────────────────────────────────────────────────────────────────
export type TierId = "T0" | "T1" | "T2";
export interface Tier {
  id: TierId;
  condition: string;
  concurrencyVcpu: number | string;
  buildQuota: string;
  templateStorageCapGB: number | string;
}
export const TIERS: Record<TierId, Tier> = {
  T0: { id: "T0", condition: "Email verified",             concurrencyVcpu: 4,   buildQuota: "5 CPU-hours",  templateStorageCapGB: 30 },
  T1: { id: "T1", condition: "Cumulative top-up ≥ $25",    concurrencyVcpu: 40,  buildQuota: "0.10 × last-30-day sandbox vCPU-hours, floor 20", templateStorageCapGB: 500 },
  T2: { id: "T2", condition: "Cumulative ≥ $500 or contract", concurrencyVcpu: "200 or negotiated", buildQuota: "Per contract", templateStorageCapGB: "Balance pre-check" },
};

// ── Formatting (§10) ────────────────────────────────────────────────────────
// Four decimals in detail, two in summaries, six for unit prices. Per-second
// billing means a 30-second segment on `medium` is $0.0015 — at two decimals
// the whole detail table reads "$0.00" and looks broken.
export const money2 = (n: number): string =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const money4 = (n: number): string =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
export const rate6 = (n: number): string =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`;

/** Detail amounts round to 4dp, and a total is the sum of those — see header. */
export const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;
export const sumRounded = (xs: number[]): number => xs.reduce((a, x) => a + round4(x), 0);

export function durationLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}
