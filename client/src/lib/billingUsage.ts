// ─── Usage & Billing data ───────────────────────────────────────────────────
// Mirrors the live console's Usage screens. Figures are the ones the real
// console shows for this account so the prototype is recognisable next to it,
// and so nobody has to work out whether a number is a mock or a regression.
//
// The split that matters for Agentbox is Container vs Token: sandbox compute is
// metered per session, model calls are metered per token, and they are billed
// on different clocks. Every Agentbox surface keeps them apart — a single
// "total" hides which one ran away, and on this account one agent's token spend
// is four orders of magnitude above its container spend.

export type UsageScope = "inference" | "studio" | "agentbox";

export const USAGE_PERIOD = { from: "Aug 22, 2026", to: "Sep 21, 2026" };

// ── Inference ───────────────────────────────────────────────────────────────
export interface ModelSlice { model: string; color: string; amount: number }
export interface InferenceDay { date: string; slices: ModelSlice[] }

/** Legend order is spend order; the tail is collapsed into "and N more". */
export const INFERENCE_MODELS: { model: string; color: string }[] = [
  { model: "Dedicated",        color: "#f472b6" },
  { model: "claude-opus-5",    color: "#a78bfa" },
  { model: "claude-opus-4.8",  color: "#fbbf24" },
  { model: "claude-fable-5",   color: "#22d3ee" },
  { model: "gpt-6-astra",      color: "#f472b6" },
  { model: "claude-sonnet-5",  color: "#c084fc" },
  { model: "gpt-5.6-sol",      color: "#38bdf8" },
  { model: "GLM-5.3",          color: "#e879f9" },
  { model: "kimi-k3",          color: "#06b6d4" },
  { model: "DeepSeek-V4-Pro",  color: "#c026d3" },
];
export const INFERENCE_MODELS_MORE = 229;
export const INFERENCE_TOTAL = 53_689.42;

/**
 * Deterministic so the chart does not reshuffle on every render. One day in the
 * window carries a spike two orders of magnitude above the rest — that is real
 * on this account, and a chart that smooths it away would hide the only thing
 * worth looking at.
 */
export function inferenceSeries(): InferenceDay[] {
  const days: InferenceDay[] = [];
  for (let i = 0; i < 31; i++) {
    const month = i < 10 ? "08" : "09";
    const day = i < 10 ? 22 + i : i - 9;
    const date = `${month}/${String(day).padStart(2, "0")}`;
    const spike = date === "09/01";
    const bump = date === "09/17" || date === "09/18";
    const base = spike ? 4200 : bump ? 260 : 80 + ((i * 37) % 90);
    const slices = INFERENCE_MODELS.slice(0, spike ? 6 : bump ? 4 : 2).map((m, k) => ({
      model: m.model,
      color: m.color,
      amount: Math.round(base * (spike ? [0.30, 0.45, 0.12, 0.06, 0.04, 0.03][k] : k === 0 ? 0.62 : 0.38 / (k || 1))),
    }));
    days.push({ date, slices });
  }
  return days;
}

export interface UsageRow { time: string; category: string; modelType: string; amount: number }
export const INFERENCE_ROWS: UsageRow[] = [
  { time: "Sep, 2026", category: "Dedicated",  modelType: "—",          amount: 7_671.5 },
  { time: "Sep, 2026", category: "Serverless", modelType: "LLM",        amount: 32_279.4 },
  { time: "Sep, 2026", category: "Serverless", modelType: "Multimodal", amount: 267.07 },
  { time: "Aug, 2026", category: "Dedicated",  modelType: "—",          amount: 5_402.18 },
  { time: "Aug, 2026", category: "Serverless", modelType: "LLM",        amount: 8_069.27 },
];

// ── Studio ──────────────────────────────────────────────────────────────────
export const STUDIO_TOTAL = 1_284.16;
export const STUDIO_ROWS: UsageRow[] = [
  { time: "Sep, 2026", category: "Image",  modelType: "Gallery",   amount: 902.4 },
  { time: "Sep, 2026", category: "Video",  modelType: "Gallery",   amount: 311.82 },
  { time: "Sep, 2026", category: "Audio",  modelType: "Gallery",   amount: 69.94 },
];

// ── Agentbox ────────────────────────────────────────────────────────────────
export interface AgentUsage {
  agentId: string;
  name: string;
  templateId: string;
  runs: number;
  container: number;
  token: number;
}
export const agentTotal = (a: AgentUsage): number => a.container + a.token;

export const AGENTBOX_RUNS = 232;

/** Top agents over the rolling window — what the bar chart draws. */
export const AGENTBOX_TOP: AgentUsage[] = [
  { agentId: "wickwood3",   name: "wickwood3",          templateId: "d6b808ba-37a2-48f6-9f20-d744bc13f70f", runs: 1,  container: 0.34,  token: 13_594.98 },
  { agentId: "fde-003",     name: "FDE Agent 003-rev20", templateId: "7c1e0a44-9b2d-4f13-8a6e-2d55c0913bb2", runs: 28, container: 102.24, token: 0 },
  { agentId: "matchday",    name: "matchday",            templateId: "51a7fb30-6c84-4de2-9017-8b43ea7c5d19", runs: 3,  container: 68.16,  token: 0 },
  { agentId: "model-arena", name: "model-arena",         templateId: "b2f4c9d7-1e60-4a85-93cc-7f018de2a446", runs: 6,  container: 51.94,  token: 0 },
  { agentId: "sevenTest",   name: "sevenTest",           templateId: "e9d31c87-4a02-4b6f-85d1-0c7ab2f6e358", runs: 2,  container: 34.08,  token: 0 },
];
export const AGENTBOX_TOP_TOTAL = 14_472.79;

/** The month table. Its membership differs from the rolling window on purpose. */
export const AGENTBOX_MONTH: AgentUsage[] = [
  { agentId: "wickwood3", name: "wickwood3",           templateId: "d6b808ba-37a2-48f6-9f20-d744bc13f70f", runs: 1,  container: 0.34,  token: 13_592.82 },
  { agentId: "fde-003",   name: "FDE Agent 003-rev20", templateId: "7c1e0a44-9b2d-4f13-8a6e-2d55c0913bb2", runs: 28, container: 70.54, token: 0 },
  { agentId: "matchday",  name: "matchday",            templateId: "51a7fb30-6c84-4de2-9017-8b43ea7c5d19", runs: 3,  container: 47.02, token: 0 },
  { agentId: "viva",      name: "viva",                templateId: "3a86e5b1-7d24-40cf-9e83-16b0d4c7f2aa", runs: 1,  container: 23.51, token: 0 },
];

export const AGENTBOX_MONTHS = ["September 2026", "August 2026", "July 2026"];

// ── Agent drill-down ────────────────────────────────────────────────────────
export interface ContainerSession {
  id: string;
  idc: string;
  instanceType: string;
  started: string;
  duration: string;
  status: "Terminated" | "Running" | "Failed";
  amount: number;
}
export interface TokenCall {
  id: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  amount: number;
}

export const AGENT_SESSIONS: Record<string, ContainerSession[]> = {
  wickwood3: [
    { id: "49d9a362…b104", idc: "us-central-iowa1", instanceType: "gmi.container.intel.x4660.small.ext", started: "07/09/2026 11:39:34", duration: "34 hours 39 minutes", status: "Terminated", amount: 0.34 },
  ],
  "fde-003": [
    { id: "a71c5e08…3fd2", idc: "us-central-iowa1", instanceType: "gmi.container.intel.x4660.small.ext", started: "09/03/2026 08:12:05", duration: "6 hours 02 minutes", status: "Terminated", amount: 24.18 },
    { id: "0b93da5f…77ae", idc: "us-central-iowa1", instanceType: "gmi.container.intel.x4660.small.ext", started: "09/11/2026 14:45:51", duration: "11 hours 18 minutes", status: "Terminated", amount: 31.40 },
    { id: "c62f8014…19bd", idc: "eu-de-frankfurt1", instanceType: "gmi.container.intel.x4660.small.ext", started: "09/19/2026 22:03:12", duration: "4 hours 51 minutes", status: "Running",    amount: 14.96 },
  ],
  matchday: [
    { id: "7e20bb93…a5c1", idc: "us-central-iowa1", instanceType: "gmi.container.intel.x4660.small.ext", started: "09/07/2026 09:20:44", duration: "9 hours 07 minutes", status: "Terminated", amount: 27.31 },
    { id: "f148c7d6…60e9", idc: "us-central-iowa1", instanceType: "gmi.container.intel.x4660.small.ext", started: "09/14/2026 17:55:02", duration: "6 hours 33 minutes", status: "Failed",     amount: 19.71 },
  ],
  viva: [
    { id: "2d5a9f31…cc84", idc: "ap-sg-singapore1", instanceType: "gmi.container.intel.x4660.small.ext", started: "09/16/2026 03:41:19", duration: "7 hours 49 minutes", status: "Terminated", amount: 23.51 },
  ],
};

export const AGENT_TOKEN_CALLS: Record<string, TokenCall[]> = {
  wickwood3: [
    { id: "tc_1", model: "claude-opus-5",   calls: 4_812, inputTokens: 182_400_000, outputTokens: 31_900_000, amount: 9_244.10 },
    { id: "tc_2", model: "claude-sonnet-5", calls: 12_640, inputTokens: 96_100_000, outputTokens: 18_450_000, amount: 3_118.44 },
    { id: "tc_3", model: "DeepSeek-V4-Pro", calls: 31_205, inputTokens: 244_800_000, outputTokens: 40_200_000, amount: 1_230.28 },
  ],
};

/** Some agents never call a model — the tab has to hold an honest empty state. */
export function tokenCallsFor(agentId: string): TokenCall[] {
  return AGENT_TOKEN_CALLS[agentId] ?? [];
}
export function sessionsFor(agentId: string): ContainerSession[] {
  return AGENT_SESSIONS[agentId] ?? [];
}
export function agentUsageById(agentId: string): AgentUsage | undefined {
  return AGENTBOX_MONTH.find((a) => a.agentId === agentId)
      ?? AGENTBOX_TOP.find((a) => a.agentId === agentId);
}

export const usd = (n: number): string =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
