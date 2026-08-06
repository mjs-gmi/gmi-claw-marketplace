// ─── Personal subscription pricing (replaces the Coding Agent Plan) ─────────
// Four tiers + a monthly Premium Credits pool (100 credits = $1.00 of list-price
// usage) + a curated Standard model set that's nearly unlimited under FUP.
//
//   Standard models  → Included, FUP soft cap, do NOT burn credits.
//   Premium  models  → Debit the credit pool at each model's published burn rate.

export type PlanId = "lite" | "standard" | "pro" | "max";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  priceAnnual: number;      // 2 months free ⇒ monthly × 10
  premiumCredits: number;   // monthly pool
  faceValueUsd: number;     // list-price usage the pool covers
  stdSoftCapTokens: string; // Standard-lane monthly soft cap
  concurrency: string;      // relative priority tier (never numeric TPM)
}

export const PLANS: Plan[] = [
  { id: "lite",     name: "Lite",     priceMonthly: 9.99,  priceAnnual: 99.9,   premiumCredits: 1000,  faceValueUsd: 10,  stdSoftCapTokens: "40M",   concurrency: "Tier 2" },
  { id: "standard", name: "Standard", priceMonthly: 19.99, priceAnnual: 199.9,  premiumCredits: 2200,  faceValueUsd: 22,  stdSoftCapTokens: "80M",   concurrency: "Tier 2" },
  { id: "pro",      name: "Pro",      priceMonthly: 59.99, priceAnnual: 599.9,  premiumCredits: 7200,  faceValueUsd: 72,  stdSoftCapTokens: "500M",  concurrency: "Tier 3" },
  { id: "max",      name: "Max",      priceMonthly: 199.9, priceAnnual: 1999.9, premiumCredits: 26000, faceValueUsd: 260, stdSoftCapTokens: "2000M", concurrency: "Tier 4" },
];
export function getPlan(id: PlanId | "payg"): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[1];
}

// Launch promotions (marketing levers — tunable without touching plan structure).
export const LAUNCH_PROMO: Partial<Record<PlanId, { firstMonth: number }>> = {
  standard: { firstMonth: 16 },
  pro: { firstMonth: 48 },
};

// ─── Model catalog ──────────────────────────────────────────────────────────
export type ModelLane = "standard" | "premium";
export interface CatalogModel {
  id: string;
  name: string;
  lane: ModelLane;
  burnBlended?: number;  // premium only — credits / 1M tokens (80/20 blend)
  burnIn?: number;       // premium only — credits / 1M input
  burnOut?: number;      // premium only — credits / 1M output
  listPrice?: string;    // standard only — list token price
}

// Standard lane — curated, ≤ ~$0.05/1M vendor cost. Nearly unlimited under FUP.
export const STANDARD_MODELS: CatalogModel[] = [
  { id: "deepseek-v4-flash", name: "DeepSeek-V4-Flash", lane: "standard", listPrice: "$0.098 / $0.196" },
  { id: "glm-47-flash",      name: "GLM-4.7-Flash",     lane: "standard", listPrice: "$0.07 / $0.40" },
  { id: "gpt-oss-120b",      name: "GPT OSS 120B",      lane: "standard", listPrice: "$0.05 / $0.25" },
];

// Premium lane — debit the credit pool at published rates (as of 2026-07-20).
export const PREMIUM_MODELS: CatalogModel[] = [
  { id: "kimi-k3",              name: "Kimi K3",                 lane: "premium", burnIn: 300, burnOut: 1500, burnBlended: 540 },
  { id: "qwen37-max",          name: "Qwen3.7 Max",              lane: "premium", burnIn: 250, burnOut: 750,  burnBlended: 350 },
  { id: "kimi-k27-code-hs",    name: "Kimi K2.7-Code-Highspeed", lane: "premium", burnIn: 190, burnOut: 800,  burnBlended: 312 },
  { id: "qwen36-max-preview",  name: "Qwen3.6 Max Preview",      lane: "premium", burnIn: 130, burnOut: 780,  burnBlended: 260 },
  { id: "glm-52-fp8",          name: "GLM-5.2-FP8",              lane: "premium", burnIn: 140, burnOut: 440,  burnBlended: 200 },
  { id: "qwen3-coder-480b",    name: "Qwen3 Coder 480B A35B",    lane: "premium", burnIn: 90,  burnOut: 450,  burnBlended: 162 },
  { id: "kimi-k27-code",       name: "Kimi K2.7-Code",           lane: "premium", burnIn: 95,  burnOut: 400,  burnBlended: 156 },
  { id: "glm-51",              name: "GLM-5.1",                  lane: "premium", burnIn: 98,  burnOut: 308,  burnBlended: 140 },
  { id: "deepseek-v4-pro",     name: "DeepSeek-V4-Pro",          lane: "premium", burnIn: 113, burnOut: 226,  burnBlended: 136 },
  { id: "qwen36-plus",         name: "Qwen3.6 Plus",             lane: "premium", burnIn: 50,  burnOut: 300,  burnBlended: 100 },
  { id: "glm-5-h200",          name: "GLM-5 (H200)",             lane: "premium", burnIn: 60,  burnOut: 192,  burnBlended: 86 },
  { id: "minimax-m25-h200",    name: "MiniMax-M2.5 (H200)",      lane: "premium", burnIn: 30,  burnOut: 120,  burnBlended: 48 },
  { id: "deepseek-v32-exp",    name: "DeepSeek-V3.2-Exp",        lane: "premium", burnIn: 27,  burnOut: 41,   burnBlended: 30 },
];

export const ALL_MODELS: CatalogModel[] = [...STANDARD_MODELS, ...PREMIUM_MODELS];
export function getModel(id: string): CatalogModel | undefined {
  return ALL_MODELS.find((m) => m.id === id);
}
export function modelName(id: string): string {
  return getModel(id)?.name ?? id;
}
export function isStandardModel(id: string): boolean {
  return STANDARD_MODELS.some((m) => m.id === id);
}
// How many M tokens a credit balance buys on a given premium model (80/20 blend).
export function tokensForCredits(credits: number, model: CatalogModel): number {
  if (model.lane !== "premium" || !model.burnBlended) return Infinity;
  return credits / model.burnBlended; // in millions of tokens
}

// ─── Current user's plan + credit balance (mock) ────────────────────────────
// No subscription ⇒ pay-as-you-go (PAYG): every model billed per token at list
// price. A plan is an optional money-saver, never a gate.
export type SubPlan = PlanId | "payg";
export interface Subscription { plan: SubPlan; creditsRemaining: number; }
const SUB_KEY = "gmi:subscription";
export function loadSubscription(): Subscription {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(SUB_KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.plan) return s; }
    } catch { /* ignore */ }
  }
  return { plan: "payg", creditsRemaining: 0 }; // default: pay-as-you-go
}
export function saveSubscription(s: Subscription): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SUB_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export function isSubscribed(s: Subscription): boolean {
  return s.plan !== "payg";
}
// PAYG list price for a premium model, in $/1M (100 credits = $1.00 of usage).
export function paygUsdPer1M(model: CatalogModel): number | null {
  return model.lane === "premium" && model.burnBlended != null ? model.burnBlended / 100 : null;
}
