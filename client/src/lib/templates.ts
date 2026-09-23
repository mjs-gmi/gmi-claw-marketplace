// ─── Templates ──────────────────────────────────────────────────────────────
// Templates are free. They have no price, no size on screen, and they do not
// appear anywhere in Usage & Billing — the same line E2B draws. What they do
// have is three numbers that give a user a reason to clean up: how many exist
// against the tier limit, how much build time is left this month, and how long
// until an unused one is archived.
//
// This lives outside the billing module on purpose. It was in there while
// template storage was still a line item; keeping it there now would be an
// invitation to put a cost column back.

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
  /** Seconds elapsed, for a build in flight. */
  buildingForSec?: number;
  buildError?: string;
  /**
   * Reserved. Runloop does not expose per-blueprint size and manifest reading
   * is not built, so this stays null — and it is never rendered, because a
   * size column is the first step back toward charging for one.
   */
  imageSizeBytes: number | null;
}

export const TEMPLATES: TemplateRecord[] = [
  { id: "d6b808ba", agentId: "wickwood3", name: "openclaw-custom", version: "v5", status: "ready",
    createdAt: "2026-09-12", readyAt: "2026-09-12", lastLaunch: "2026-09-20", imageSizeBytes: null },
  { id: "a40c2b91", agentId: "viva", name: "eval-env", version: "v2", status: "building",
    createdAt: "2026-09-22", buildingForSec: 192, imageSizeBytes: null },
  { id: "e9d31c87", agentId: "sevenTest", name: "old-demo", version: "v1", status: "ready",
    createdAt: "2026-07-06", readyAt: "2026-07-06", lastLaunch: "2026-07-06", imageSizeBytes: null },
  { id: "7c1e0a44", agentId: "fde-003", name: "FDE Agent 003-rev20", version: "v20", status: "ready",
    createdAt: "2026-08-14", readyAt: "2026-08-14", lastLaunch: "2026-09-21", imageSizeBytes: null },
  { id: "51a7fb30", agentId: "matchday", name: "matchday", version: "v2", status: "ready",
    createdAt: "2026-07-20", readyAt: "2026-07-20", lastLaunch: "2026-09-07", imageSizeBytes: null },
  { id: "3b91f0ac", agentId: "hermes", name: "hermes-runtime", version: "v3", status: "ready",
    createdAt: "2026-06-30", readyAt: "2026-06-30", lastLaunch: "2026-09-19", imageSizeBytes: null },
  { id: "c5e7d218", agentId: "openclaw", name: "openclaw-arm", version: "v1", status: "error",
    createdAt: "2026-09-19", buildError: "image architecture linux/arm64 is not supported in this IDC", imageSizeBytes: null },
];

export const TODAY = "2026-09-22";
export const ARCHIVE_AFTER_DAYS = 90;
/** Show the countdown once it is close enough to act on. */
export const ARCHIVE_WARN_DAYS = 21;

export function daysSince(date: string | undefined, today = TODAY): number | null {
  if (!date) return null;
  return Math.floor((Date.parse(today) - Date.parse(date)) / 86_400_000);
}
/** Days until an unused template is archived; null when the clock does not run. */
export function daysToArchive(t: TemplateRecord, today = TODAY): number | null {
  if (t.status !== "ready") return null;
  const idle = daysSince(t.lastLaunch ?? t.createdAt, today);
  if (idle === null) return null;
  return Math.max(0, ARCHIVE_AFTER_DAYS - idle);
}
export function relativeDay(date: string | undefined, today = TODAY): string {
  const d = daysSince(date, today);
  if (d === null) return "—";
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}
export function buildElapsed(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export const templatesForAgent = (agentId: string): TemplateRecord[] =>
  TEMPLATES.filter((t) => t.agentId === agentId && !t.deletedAt);
export const liveTemplates = (): TemplateRecord[] => TEMPLATES.filter((t) => !t.deletedAt);

// ── Quota (the only numbers a template surface shows) ───────────────────────
export const TEMPLATE_QUOTA = {
  used: liveTemplates().length,
  allowed: 20,
  buildHoursUsed: 3.2,
  buildHoursAllowed: 10,
  buildResets: "Oct 1",
  buildConcurrent: 5,
  buildTimeout: "1 h",
  buildCores: 2,
  /** What the next tier would give, for the upgrade half of a rejection. */
  nextTier: { name: "tier3", templates: 50 },
};
export const buildHoursLeft = (): number =>
  Math.max(0, TEMPLATE_QUOTA.buildHoursAllowed - TEMPLATE_QUOTA.buildHoursUsed);
export const templatesAtLimit = (): boolean => TEMPLATE_QUOTA.used >= TEMPLATE_QUOTA.allowed;
