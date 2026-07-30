// ─── Canonical demo "My Agents" seed ────────────────────────────────────────
// Single source of truth for the prototype's pre-existing registered agents.
// Shared by Dashboard (the My Agents grid) and ListClaw (the register-first
// guard + Linked Template picker) so the two views can never disagree about
// whether the user already has agents. Ordered to match the production console:
// Hermes first (selected by default, has running instances), then the others.

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
  // Omitted for seed agents so no DRAFT/LIVE pill shows in the list (matches the
  // console, which surfaces only the verified check for these).
  listingState?: SeedListingState;
  dockerImage?: string;
  region?: string;
  // Endpoints declared at Register → Networking. Surfaced live under Access in
  // Instance Details. name/internalPort/protocol/visibility (private|public).
  endpoints?: { id: string; name: string; internalPort: string; protocol: string; visibility: "private" | "public" }[];
  // Compute tier id from Register (container | standard | performance). region is
  // already declared above. Both are template properties, read-only downstream.
  tier?: string;
}

export const SEED_AGENTS: SeedAgent[] = [
  {
    id: "agent_hermes",
    name: "Hermes",
    templateId: "0bf9bdf1-3d54-4665-a718-8cce1423ab11",
    category: "Code & Dev Tools",
    verified: true,
    displayStatus: "running",
    hostMode: "gmi",
    maasKey: "",
    accessUrl: "",
    registeredAt: "2025-01-01T00:00:00.000Z",
    region: "us-ia-iowa-1",
    tier: "container",
    endpoints: [{ id: "ep_web", name: "web", internalPort: "8080", protocol: "HTTPS", visibility: "private" }],
  },
  {
    id: "agent_hermes_mingjun",
    name: "hermes for mingjun",
    templateId: "b73c1e08-2f4a-4d19-8c6b-5a9e0f21d7c4",
    category: "Code & Dev Tools",
    verified: false,
    displayStatus: "running",
    hostMode: "gmi",
    maasKey: "",
    accessUrl: "",
    registeredAt: "2025-01-01T00:00:00.000Z",
    region: "us-or-portland",
    tier: "standard",
    endpoints: [{ id: "ep_api", name: "api", internalPort: "3000", protocol: "HTTP", visibility: "public" }],
  },
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
    dockerImage: "ghcr.io/mjs-gmi/openclaw-gmi:v5-mode-none",
    region: "eu-de-frankfurt",
    tier: "performance",
    endpoints: [
      { id: "ep_web", name: "web", internalPort: "8080", protocol: "HTTPS", visibility: "private" },
      { id: "ep_vnc", name: "vnc", internalPort: "5900", protocol: "TCP", visibility: "public" },
    ],
  },
];
