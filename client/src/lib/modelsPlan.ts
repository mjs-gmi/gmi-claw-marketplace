// ─── Coding Agent Plan ───────────────────────────────────────────────────
// Commercial-side feature (separate from Runtime 2.0): a GMI Models subscription
// that discounts token pricing on coding models and marks coding agents as
// "Plan eligible" across the product. Single source of truth for plan identity,
// eligibility rules, and discounted pricing so all 9 placements stay consistent.
import type { TypeLabel } from "./clawData";

export const CODING_AGENT_PLAN = {
  name: "Coding Agent Plan",
  discountPct: 20, // 8 折
  featuredModelId: "deepseek-v4-flash",
  featuredModelName: "DeepSeek-V4-Flash",
  featuredModelInPrice: "$0.098 / 1M tok",
} as const;

// MaaS models the plan covers (Builder side → discounted token price).
export const PLAN_MODEL_IDS: string[] = ["deepseek-v4-flash", "claude-opus-48", "gpt-55"];

// Agent categories the plan applies to (User side → eligible agents).
export const PLAN_CATEGORIES: TypeLabel[] = ["Code & Dev Tools"];

export function isPlanEligibleModel(modelId?: string): boolean {
  return !!modelId && PLAN_MODEL_IDS.includes(modelId);
}

export function isPlanEligibleAgent(category?: string): boolean {
  return !!category && (PLAN_CATEGORIES as string[]).includes(category);
}

// Apply the plan discount to a numeric price.
export function applyPlanDiscount(price: number): number {
  return +(price * (1 - CODING_AGENT_PLAN.discountPct / 100)).toFixed(4);
}

// Parse a "$0.098 / 1M tok" style price → { original, discounted } keeping the unit.
// Returns null if the string has no parseable dollar amount (e.g. "Free").
export function discountPriceString(price: string): { original: string; discounted: string } | null {
  const m = /\$\s*([0-9]*\.?[0-9]+)\s*(.*)$/.exec(price.trim());
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (Number.isNaN(num) || num === 0) return null;
  const unit = (m[2] || "").trim();
  const disc = applyPlanDiscount(num);
  return {
    original: `$${num}${unit ? " " + unit : ""}`,
    discounted: `$${disc}${unit ? " " + unit : ""}`,
  };
}
