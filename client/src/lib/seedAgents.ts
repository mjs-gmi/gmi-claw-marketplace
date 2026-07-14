// ─── Canonical demo "My Agents" seed ────────────────────────────────────────
// Single source of truth for the prototype's pre-existing registered agents.
// Shared by Dashboard (the My Agents grid) and ListClaw (the register-first
// guard + Linked Template picker) so the two views can never disagree about
// whether the user already has agents. Previously Dashboard seeded these while
// ListClaw only read localStorage, so "List an agent" wrongly showed
// "Register an Agent first" even though My Agents listed two templates.

export type SeedListingState = "draft" | "pending_review" | "live" | "rejected";

export interface SeedAgent {
  id: string;
  name: string;
  templateId: string;
  category: string;
  verified: boolean;
  displayStatus: "running" | "idle" | "error";
  hostMode: "gmi" | "connect";
  maasKey: string;
  accessUrl: string;
  registeredAt: string;
  listingState: SeedListingState;
  dockerImage?: string;
  region?: string;
}

export const SEED_AGENTS: SeedAgent[] = [
  {
    id: "agent_openclaw",
    name: "Openclaw test",
    templateId: "d8772394-1a69-4cfd-8b97-f3c895db9e85",
    category: "Code & Dev Tools",
    verified: true,
    displayStatus: "running",
    hostMode: "gmi",
    maasKey: "",
    accessUrl: "",
    registeredAt: "2025-01-01T00:00:00.000Z",
    listingState: "draft",
    dockerImage: "ghcr.io/mjs-gmi/openclaw-gmi:v5-mode-none",
    region: "us-ia-iowa-1",
  },
  {
    id: "agent_hermes",
    name: "Hermes",
    templateId: "a14f0c52-6b9d-4e71-9a83-2c1e7f4db0aa",
    category: "Code & Dev Tools",
    verified: true,
    displayStatus: "running",
    hostMode: "gmi",
    maasKey: "",
    accessUrl: "",
    registeredAt: "2025-01-01T00:00:00.000Z",
    listingState: "draft",
    region: "us-ia-iowa-1",
  },
];
