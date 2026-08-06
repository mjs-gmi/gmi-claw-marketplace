// ─── Four-object model (Instance → Task refactor) ──────────────────────────
// The product's core objects and how they relate:
//
//   Agent Version  →  Saved Launch Config  →  Task  →  Runtime
//   (developer)       (user, reusable)        (user)   (system, default ephemeral)
//
// - Agent Version: the published, buildable version an Agent (SEED_AGENTS / registered).
// - Saved Launch Config: a user's reusable "how I run this" — model, credentials,
//   env overrides, environment policy. Pinned to an Agent Version.
// - Task: one execution. Owns input, result, files, logs, actual cost; references a Runtime.
// - Runtime: the environment behind a Task. Default released after completion; optionally kept.
//
// Runtime lives in the existing Dashboard/Instance surfaces; this module owns the
// user-facing Task loop and the Saved Launch Config that feeds it.

import { SEED_AGENTS } from "@/lib/seedAgents";

export type TaskStatus = "queued" | "running" | "succeeded" | "failed";
export type EnvPolicy = "release" | "keep";

// F-08 — selectable models are GMI's available LLMs (no external/BYO). Featured = default.
export interface TaskModel { id: string; name: string; plan?: boolean; featured?: boolean }
export const TASK_MODELS: TaskModel[] = [
  { id: "deepseek-v4-flash", name: "DeepSeek-V4-Flash", plan: true, featured: true },
  { id: "claude-opus-48", name: "Claude Opus 4.8", plan: true },
  { id: "gpt-55", name: "GPT-5.5" },
];
export const FEATURED_TASK_MODEL = TASK_MODELS.find((m) => m.featured) ?? TASK_MODELS[0];
export function modelName(id: string): string {
  return TASK_MODELS.find((m) => m.id === id)?.name ?? id;
}

export interface EnvOverride { key: string; value: string }

export interface Task {
  id: string;
  agentId: string;
  agentName: string;
  agentVersion: string;       // pinned Agent Version, e.g. "v1.0.0"
  model: string;              // resolved model id (injected as GMI_MODEL_ID)
  input: string;
  status: TaskStatus;
  createdAt: number;          // epoch ms
  durationSec?: number;
  costUsd?: number;
  result?: string;
  files?: string[];
  envPolicy: EnvPolicy;
  runtimeId: string;
  runtimeKept: boolean;       // Keep environment → Runtime persists after the Task
}

// ─── Agent lookup (Agent Version source) ────────────────────────────────────
export interface AgentLite {
  id: string;
  name: string;
  version: string;
  model: string;              // Featured/default model id
}

const REGISTERED_AGENTS_KEY = "gmi:registered-agents";

export function listAgents(): AgentLite[] {
  const seed: AgentLite[] = SEED_AGENTS.map((a) => ({
    id: a.id,
    name: a.name,
    version: "v1.0.0",
    model: FEATURED_TASK_MODEL.id,
  }));
  let registered: AgentLite[] = [];
  if (typeof window !== "undefined") {
    try {
      const arr = JSON.parse(localStorage.getItem(REGISTERED_AGENTS_KEY) || "[]");
      if (Array.isArray(arr)) {
        registered = arr.map((a: { id: string; name: string }) => ({
          id: a.id, name: a.name, version: "v1.0.0", model: FEATURED_TASK_MODEL.id,
        }));
      }
    } catch { /* ignore */ }
  }
  return [...registered, ...seed];
}
export function getAgent(id: string): AgentLite | undefined {
  return listAgents().find((a) => a.id === id);
}

// ─── Task store (localStorage-backed) ───────────────────────────────────────
const TASKS_KEY = "gmi:tasks";

function seedTasks(): Task[] {
  const now = Date.now();
  return [
    {
      id: "task_9f3a2c74e1b8", agentId: "agent_hermes", agentName: "Hermes", agentVersion: "v1.0.0",
      model: "deepseek-v4-flash", input: "Summarize the attached changelog and tag breaking changes.",
      status: "succeeded", createdAt: now - 1000 * 60 * 12, durationSec: 34, costUsd: 0.021,
      result: "3 breaking changes found. See details.", files: ["output/report.md"],
      envPolicy: "release", runtimeId: "rt_9f3a2c74", runtimeKept: false,
    },
    {
      id: "task_1e1bd4529a3c", agentId: "agent_openclaw", agentName: "Openclaw test", agentVersion: "v2.1.0",
      model: "claude-opus-48", input: "Run the e2e suite against staging and report failures.",
      status: "running", createdAt: now - 1000 * 60 * 2, envPolicy: "keep",
      runtimeId: "rt_1e1bd452", runtimeKept: true,
    },
    {
      id: "task_a1c8e5f27d34", agentId: "agent_hermes_mingjun", agentName: "hermes for mingjun", agentVersion: "v1.0.0",
      model: "gpt-55", input: "Generate release notes from the last 20 commits.",
      status: "failed", createdAt: now - 1000 * 60 * 40, durationSec: 8, costUsd: 0.004,
      result: "exit_code 1 — missing GITHUB_TOKEN credential.",
      envPolicy: "release", runtimeId: "rt_a1c8e5f2", runtimeKept: false,
    },
  ];
}

export function loadTasks(): Task[] {
  if (typeof window === "undefined") return seedTasks();
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) { const s = seedTasks(); saveTasks(s); return s; }
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : seedTasks();
  } catch { return seedTasks(); }
}
export function saveTasks(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch { /* ignore */ }
}
export function getTask(id: string): Task | undefined {
  return loadTasks().find((t) => t.id === id);
}
export function upsertTask(task: Task): void {
  const tasks = loadTasks();
  const i = tasks.findIndex((t) => t.id === task.id);
  if (i >= 0) tasks[i] = task; else tasks.unshift(task);
  saveTasks(tasks);
}
export function newTaskId(): string {
  const r = () => Math.random().toString(16).slice(2, 8);
  return `task_${r()}${r()}`;
}

// Mock per-run cost estimate (used on the Run Task page and stored as actual on completion).
export function estimateCostUsd(model: string): number {
  const base = model === "claude-opus-48" ? 0.06 : model === "gpt-55" ? 0.05 : 0.02;
  return Math.round(base * 100) / 100;
}
