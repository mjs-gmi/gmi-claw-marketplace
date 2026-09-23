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

/**
 * Templates are NOT billed. They are capped by count, enforced at Register, and
 * their lifecycle is recorded so a future charge has a timeline to bill from —
 * but nothing about them appears on an invoice, so nothing about them belongs
 * in this union. Putting a zero-cost row in a cost list is how a customer ends
 * up asking why their template storage is free this month.
 */
/**
 * 2.0 bills three things. Egress is out of scope for this release entirely —
 * not "metered later", out — and Templates cost nothing at all. Snapshot
 * storage is specified here so the model is whole, but it arrives WITH the
 * Snapshot feature in 2.1 and never before it: storage for a thing you cannot
 * create is not a line item.
 */
export type BillingItem =
  | "running" | "paused" | "model_usage" | "snapshot_storage";

export const BILLING_ITEMS: BillingItem[] = [
  "running", "paused", "model_usage", "snapshot_storage",
];
/** What 2.0 actually charges for — three cells, summing to the header total. */
export const BILLING_ITEMS_2_0: BillingItem[] = ["running", "paused", "model_usage"];

/**
 * §9 — these display names are used everywhere: page, legend, invoice and the
 * human-readable side of the CSV. The machine values are the `billing_item`
 * codes. Keeping one set for both is what stops the invoice disagreeing with
 * the console, which §9 calls out by name.
 */
export const ITEM_LABEL: Record<BillingItem, string> = {
  running: "Running",
  paused: "Paused",
  model_usage: "Model usage",
  snapshot_storage: "Snapshot storage",
};

export const ITEM_COLOR: Record<BillingItem, string> = {
  running: "#DDEA4D",
  paused: "#2dd4bf",
  model_usage: "#fbbf24",
  snapshot_storage: "#a78bfa",
};

/** §10 — one line each, for the empty state and the tooltips. */
export const ITEM_BLURB: Record<BillingItem, string> = {
  running: "Billed per minute while running, by vCPU, memory and disk. No minimum.",
  paused: "Only disk is billed while a sandbox is paused — about 1% of the running rate.",
  model_usage: "Model calls from your sandboxes, at Inference rates. Coding Plan credits apply.",
  snapshot_storage: "Billed per GB-month beyond the free 50 GB. Arrives with Snapshots in 2.1.",
};

/**
 * §2 — Template storage belongs to a template, not a sandbox. Egress and Model
 * usage SHOULD attribute per sandbox; when the upstream cannot, they fall back
 * to account level, which is a degraded state and is labelled as one.
 */
export const ACCOUNT_LEVEL: BillingItem[] = [];

/**
 * Pause / Resume / Snapshot land in Agentbox 2.1. Their billing items are
 * specified and drawn so the model can be reviewed whole, but nothing in the
 * product can produce them yet: no sandbox can be paused, so there are no
 * paused segments, no transitions and no snapshots. Marked rather than hidden,
 * for the same reason the Terminal and Extend controls are drawn — a billing
 * model reviewed with two of its six items missing has not been reviewed.
 */
export const V21_ITEMS: BillingItem[] = ["snapshot_storage"];

// ── Rates ───────────────────────────────────────────────────────────────────
export const RATE = {
  vcpuHr: 0.0738,       // per vCPU hour
  ramGiBHr: 0.00759,    // per GiB hour
  diskGBHr: 0.000106,   // per GB hour
  storageGBMonth: 0.03, // snapshot storage (2.1)
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

/**
 * §10 — storage and egress ship in three steps: no meter, metered but not yet
 * billed, then billed. The middle state is the one that needs care: the number
 * is real but the customer is not paying it yet, so it must stay out of the
 * header total and off the invoice while still being visible for a month.
 */
export type BillingStatus = "no_meter" | "not_yet_billed" | "billed";
export const STATUS_NOTE: Record<BillingStatus, string | null> = {
  no_meter: "Metering not yet available",
  not_yet_billed: "Not yet billed",
  billed: null,
};

// ── Tiers (§P4) ─────────────────────────────────────────────────────────────
// Console already has tier1–tier5 for Inference rate limits; AgentBox hangs its
// own limit table off the same tiers rather than inventing a parallel ladder.
// Tier is set by SETTLED top-up, not by a card on file, and only ever changes
// quotas — never prices.
export type TierId = "tier1" | "tier2" | "tier3" | "tier4" | "tier5";
export interface Tier {
  id: TierId;
  condition: string;
  concurrencyVcpu: number | string;
  sessionLimit: string;
  buildHours: string;
  buildConcurrency: string;
  templates: string;
  /** tier4-5 are extrapolated and not yet agreed. */
  provisional?: boolean;
}
export const TIERS: Record<TierId, Tier> = {
  tier1: { id: "tier1", condition: "Email verified (default)", concurrencyVcpu: 4,   sessionLimit: "1 h",     buildHours: "2.5 h",  buildConcurrency: "1 / 30 min / 2 cores",  templates: "3" },
  tier2: { id: "tier2", condition: "Settled top-up ≥ $25",      concurrencyVcpu: 40,  sessionLimit: "24 h",    buildHours: "10 h, grows with 30-day usage", buildConcurrency: "5 / 1 h / 2 cores", templates: "20" },
  tier3: { id: "tier3", condition: "≥ $500",                     concurrencyVcpu: 200, sessionLimit: "Unlimited", buildHours: "Floor 40 h",  buildConcurrency: "10 / 2 h / 4 cores", templates: "50" },
  tier4: { id: "tier4", condition: "≥ $2,000",                   concurrencyVcpu: 400, sessionLimit: "Unlimited", buildHours: "Floor 100 h", buildConcurrency: "20 / 2 h / 4 cores", templates: "100", provisional: true },
  tier5: { id: "tier5", condition: "Committed-volume contract",  concurrencyVcpu: "Per contract", sessionLimit: "Unlimited", buildHours: "Per contract", buildConcurrency: "Per contract", templates: "Per contract", provisional: true },
};

// ── Formatting (§10) ────────────────────────────────────────────────────────
// Four decimals in detail, two in summaries, six for unit prices. Per-second
// billing means a 30-second segment on `medium` is $0.0015 — at two decimals
// the whole detail table reads "$0.00" and looks broken.
export const money4 = (n: number): string =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
/**
 * Summaries use two decimals — except where that would turn a real charge into
 * "$0.00". Per-minute billing makes small amounts ordinary: a 30-second run on
 * `medium` is $0.0030 and 20 minutes paused is $0.0007, and rendering either as
 * zero tells the customer they were not billed when they were. Below half a
 * cent the number falls back to four decimals rather than rounding away.
 */
export const money2 = (n: number): string => {
  if (n > 0 && n < 0.005) return money4(n);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
export const rate6 = (n: number): string =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`;

/** Detail amounts round to 4dp, and a total is the sum of those — see header. */
export const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;
/**
 * Summary rounding. The breakdown card sits directly under the total it
 * explains, so the two must agree on screen: three cells showing 1.75 / 0.20 /
 * 11355.54 beside a total of 11357.50 is a penny nobody can account for. Both
 * sides round to cents first, then add — so what is displayed is what adds up.
 */
export const round2 = (n: number): number => Math.round(n * 100) / 100;
export const sumRounded = (xs: number[]): number => xs.reduce((a, x) => a + round4(x), 0);

/**
 * Billing granularity. The SKU spec says per second; Fiona's PRD says per
 * minute rounded up. The page is built on the minute, because it is the one
 * that changes a displayed number: a 30-second run bills as one minute, which
 * is $0.0030 on `medium` rather than $0.0015. Both readings agree that it must
 * not render as $0.00, which is what four decimals is for.
 *
 * Whichever wins, only this function changes.
 */
export function billedMinutes(seconds: number): number {
  return Math.ceil(seconds / 60);
}
export const perMinute = (hourlyRate: number): number => hourlyRate / 60;

export function durationLabel(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}
