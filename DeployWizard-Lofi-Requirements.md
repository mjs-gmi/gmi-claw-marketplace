# GMI Claw Marketplace — Register & List (Deployment Wizard) Lo-fi Requirements

**Author:** Manus AI
**Date:** April 27, 2026

## 1. Executive Summary

This document details the functional and UI requirements for the **Register & List** (Deployment Wizard) flow in the GMI Claw Marketplace. It provides a complete inventory of fields, states, copy, and interactions required for designers to build lo-fi wireframes and for engineers to implement the frontend. The wizard allows builders to register their Claws via two distinct paths: a fully managed GMI Cluster Engine (CE) deployment or a self-hosted integration using GMI Models-as-a-Service (MaaS).

## 2. Problem Statement

**Developer Perspective:** Builders need a streamlined, predictable way to configure infrastructure, inject secrets, and deploy their AI agents (Claws) without wrestling with complex DevOps tooling. They also need flexibility: some want a fully managed serverless experience, while others prefer to host their own compute and only consume GMI's model APIs.

**User Perspective:** Enterprise consumers need assurance that the Claws they provision are reliable, secure, and properly integrated with GMI's infrastructure, which is guaranteed by the standardized registration and verification process.

## 3. Target Users & Personas

- **Claw Builders (Developers):** AI engineers and product builders who create agents and want to monetize or distribute them via the GMI Marketplace. They are technical but prefer to focus on agent logic rather than infrastructure orchestration.

## 4. User Flow

`Click "Register & List"` → `Select Tab (GMI CE or Self-hosted)` → `Complete Wizard Steps` → `Review Configuration` → `Submit / Publish` → `Success Screen` → `Proceed to List on Marketplace`

## 5. Strategic Context

The Deployment Wizard is the critical bridge between Claw creation and Marketplace distribution. By offering both a managed (CE) and unmanaged (Self-hosted) path, GMI captures both net-new builders looking for an all-in-one platform and established teams looking to augment existing stacks with frontier models.

## 6. Requirements

The wizard is structured around a two-tab interface, each representing a distinct deployment path.

### 6.1 Global Wizard Chrome

**Form:** Page Layout
**Preceding Action:** Click "Register & List" from Navbar or Dashboard.
**Subsequent Action:** N/A (Container for wizard steps).

- **Topbar:** Breadcrumb (`Home › Deploy & List`), User Credits (`$0.00`), Avatar.
- **Left Sidebar:** Standard GMI Console navigation (Inference, Compute, Home, Storage, etc.).
- **Content Area:**
  - **Back Link:** `< ArrowLeft` "Back to Console" (Returns to `/dashboard`).
  - **Header:** "Developer Console · New Claw Project" (overline), "Register a Claw" (H1), "Configure infrastructure and register your Claw. List it on the Marketplace after testing." (subtitle).
  - **Tab Switcher:**
    - **Tab 1:** `GMI CE Deployment` (Default, Lime highlight when active).
    - **Tab 2:** `Self-hosted + MaaS` (Blue highlight when active).

---

### 6.2 Tab 1: GMI CE Deployment (Default)

This path allows builders to deploy a container image to GMI's Cluster Engine, optionally injecting a MaaS API key for model access.

#### 6.2.1 Step 0: Basic Info

**Form:** Wizard Step (Index 0)
**Preceding Action:** Select Tab 1.
**Subsequent Action:** Click "Continue" → Step 1.

- **Step Indicator:** `✓ Basic Info` `—` `2 Infrastructure` `—` `3 Env Variables` `—` `4 Review & Deploy`
- **Header:** Server Icon + "Basic Info"
- **Field: Internal Project Name:**
  - **Type:** Text Input (mono font).
  - **Label:** `Internal Project Name *`
  - **Placeholder:** `e.g. contract-review-v2`
  - **Hint:** "This is your internal identifier — not shown publicly on the Marketplace."
- **Info Box (Lime):** Explains that Marketplace listing name/description are configured separately later.
- **CTAs:**
  - `Back to Console` (Secondary, bottom left).
  - `Continue >` (Primary Lime, bottom right).

#### 6.2.2 Step 1: Infrastructure

**Form:** Wizard Step (Index 1)
**Preceding Action:** Complete Step 0.
**Subsequent Action:** Click "Continue" → Step 2.

- **Header:** CPU Icon + "Infrastructure"
- **Subtitle:** "Configure compute resources for your Claw. GMI CE will provision containers on demand."
- **Section A: Compute (Fixed, Always On)**
  - **Field: Docker Image Source:**
    - **Type:** Radio Cards (2 options).
    - **Options:** `Registry URL` (Github icon), `Upload Image` (Upload icon).
    - **Conditional UI:** If `Registry URL` is selected, show Text Input (`Registry URL`, placeholder `registry.hub.docker.com/...`). If `Upload Image` is selected, show dashed dropzone (currently mocked with "Coming soon" toast).
  - **Field: Compute Tier:**
    - **Type:** Vertical Radio Cards (3 options).
    - **Options:**
      - `Performance`: 32 vCPU, 128 GB RAM, 25 Gbps ($1.20/hr).
      - `Standard`: 16 vCPU, 64 GB RAM, 10 Gbps ($0.60/hr) — **Recommended Badge**.
      - `Economy`: 4 vCPU, 16 GB RAM, 1 Gbps ($0.15/hr).
  - **Field: Data Center Region:**
    - **Type:** 2x2 Grid Radio Cards.
    - **Options:** `US West`, `US East`, `Asia (Singapore)`, `Europe (Germany)`.
  - **Field: Scaling:**
    - **Type:** Two side-by-side Number Inputs.
    - **Labels:** `Min Instances` (hint: 0 = serverless), `Max Instances`.
    - **Helper Text:** "Billed per instance·hr. Min instances are always running and always billed."
- **Section B: Add GMI MaaS (Optional Toggle)**
  - **Type:** Full-width Toggle Row.
  - **Label:** `Add GMI MaaS — Access 200+ frontier models`
  - **State:** Default ON.
  - **Conditional UI (When ON):**
    - **Field: Select Models:**
      - **Type:** Searchable multi-select with horizontal scrolling cards.
      - **Search Box:** `Search models...` with clear (X) button.
      - **Selected Chips:** Shows selected models with remove (X) buttons.
      - **Cards:** Model Name, Context Window, Tokens/$ (e.g., "Llama 3.1 70B", "128K", "1M").
- **CTAs:** `< Back` (to Step 0), `Continue >` (to Step 2).

#### 6.2.3 Step 2: Environment Variables

**Form:** Wizard Step (Index 2)
**Preceding Action:** Complete Step 1.
**Subsequent Action:** Click "Continue" → Step 3.

- **Header:** Terminal Icon + "Environment Variables"
- **Section: Auto-Injected by GMI**
  - **If MaaS is ON:** Displays two locked, read-only rows: `GMI_MAAS_API_KEY` ("Auto-generated on deploy") and `GMI_MAAS_BASE_URL` ("https://api.gmi.ai/v1").
  - **If MaaS is OFF:** Displays text "No auto-injected variables — MaaS is disabled."
- **Section: Custom Variables**
  - **Header Row:** Label + `+ Add Variable` button.
  - **Empty State:** "No custom variables. Click 'Add Variable' to add database URIs, API keys, or other config."
  - **Variable Row (Dynamic):**
    - Key Input (`KEY_NAME`).
    - Value Input (`value`) with toggleable visibility (Eye/EyeOff icon).
    - `Secret` toggle button (masks value in DB).
    - Delete (Trash) button.
- **CTAs:** `< Back` (to Step 1), `Continue >` (to Step 3).

#### 6.2.4 Step 3: Review & Publish

**Form:** Wizard Step (Index 3)
**Preceding Action:** Complete Step 2.
**Subsequent Action:** Click "Publish Template" → Loading Screen → Success Screen.

- **Header:** Zap Icon + "Review & Publish Template"
- **Section: Configuration Summary**
  - **Type:** Key-Value Table.
  - **Rows:** Project Name, Docker Image, Compute Tier, Storage, Auto-Scaling, MaaS (model count), Custom Env Vars (count).
- **Section: Cost Estimate**
  - **Type:** 3-column grid + progress bar.
  - **Columns:** Base (Min containers $/hr & $/day), Max (Max containers $/hr & $/day), MaaS Tokens ("Billed per token used").
  - **Helper Text:** "Billing begins immediately upon clicking 'Publish Template'."
- **Notice Box (Lime):** "Registration ≠ Listing" — Explains that publishing the template does not make it public on the Marketplace until explicitly listed from the Dashboard.
- **CTAs:** `< Back` (to Step 2), `Publish Template` (Primary Lime, triggers deployment simulation).

#### 6.2.5 Tab 1: Success Screen

**Form:** Full Page View
**Preceding Action:** Complete deployment simulation.
**Subsequent Action:** Click "List this Claw" → `/list-claw`.

- **Header:** Pulsing Lime Dot + "Template Published ✓"
- **Title:** `[Project Name] is ready to provision`
- **Subtitle:** Explains that the template is published, but containers are provisioned on demand.
- **Template ID Box:** Shows generated `tpl_...` ID with a `Copy` button.
- **Status Cards (2x2 Grid):** Template State (Active), Marketplace State (Not Listed), Containers Running (0), Billing (Pay per provisioning).
- **Code Snippet Block:** "How to provision user instances via API" — Shows `curl` commands for POST/GET/DELETE to the containers API, using the generated `templateId`. Includes `Copy` button.
- **Next Step Banner:** "Integrate the provisioning API into your own system... When you're ready, list this Claw."
- **CTAs:** `List this Claw >` (Primary Lime, routes to `/list-claw` with context), `Go to Dashboard` (Secondary).

---

### 6.3 Tab 2: Self-hosted + MaaS

This path is for builders hosting their own compute infrastructure who only want to consume GMI models and list their external endpoint on the Marketplace.

#### 6.3.1 Nudge Modal (Tab Switch Warning)

**Form:** Modal Overlay
**Preceding Action:** Click Tab 2 for the first time in a session.
**Subsequent Action:** Confirm switch or cancel.

- **Header:** `⚠ Before you switch` (Amber)
- **Title:** "You’ll miss out on bundle pricing"
- **Body:** Explains loss of CE+MaaS bundle pricing and the "Verified" badge. States that self-hosted Claws only receive the "Powered by GMI MaaS" badge.
- **CTAs:** `Stay on GMI Full Stack` (Primary Lime, closes modal), `Continue to self-hosted` (Secondary outline, proceeds to Tab 2).

#### 6.3.2 Step 0: MaaS Key

**Form:** Wizard Step (Index 0)
**Preceding Action:** Confirm Tab 2 switch.
**Subsequent Action:** Click "Continue" → Step 1.

- **Step Indicator:** `✓ MaaS Key` `—` `2 Endpoint` `—` `3 Review & Submit` (Blue theme).
- **Badge Notice (Blue):** Re-iterates that this path receives the "Powered by GMI MaaS" badge.
- **Header:** Zap Icon + "GMI MaaS API Key"
- **Field: MaaS API Key:**
  - **Type:** Text Input (mono font).
  - **Label:** `MaaS API Key *`
  - **Placeholder:** `gmi_sk_...`
  - **Hint:** Instructions to create key in Console.
- **Info Box (Lime):** Explains that the code must reference `GMI_MAAS_API_KEY` and that GMI will validate it.
- **CTAs:** `< Switch to CE` (Returns to Tab 1), `Continue >` (Primary Blue).

#### 6.3.3 Step 1: External Endpoint

**Form:** Wizard Step (Index 1)
**Preceding Action:** Complete Tab 2 Step 0.
**Subsequent Action:** Click "Continue" → Step 2.

- **Header:** Server Icon + "External Endpoint URL"
- **Field: Endpoint URL:**
  - **Type:** Text Input (mono font).
  - **Label:** `Endpoint URL *`
  - **Placeholder:** `https://your-claw.yourdomain.com`
  - **Hint:** Must be publicly reachable over HTTPS.
- **Warning Box (Red):** "You are solely responsible for uptime... If your endpoint goes down, your listing will be marked Unavailable."
- **CTAs:** `< Back` (to Step 0), `Continue >` (Primary Blue).

#### 6.3.4 Step 2: Review & Submit

**Form:** Wizard Step (Index 2)
**Preceding Action:** Complete Tab 2 Step 1.
**Subsequent Action:** Click "Submit" → Tab 2 Success Screen.

- **Header:** CheckCircle Icon + "Review & Submit"
- **Section: Configuration Summary:**
  - **Type:** Key-Value Table.
  - **Rows:** Deployment Type ("Self-hosted + GMI MaaS"), MaaS API Key (masked), Endpoint URL, Badge ("Powered by GMI MaaS").
- **Notice Box (Lime):** "Submission ≠ Listing" — Explains that submission requires GMI verification before the listing goes live.
- **CTAs:** `< Back` (to Step 1), `Submit` (Primary Blue, triggers submission simulation).

#### 6.3.5 Tab 2: Success Screen

**Form:** Full Page View
**Preceding Action:** Complete Tab 2 submission.
**Subsequent Action:** Return to Dashboard or Marketplace.

- **Header:** Lime Dot + "Listing Submitted ✓"
- **Title:** "Your Claw is under review"
- **Subtitle:** "We’ve received your self-hosted Claw submission. GMI will verify your MaaS key and endpoint before listing goes live."
- **Status Cards (2x2 Grid):** Deployment Type, Badge (Blue), Marketplace State (Pending Review - Amber), Endpoint.
- **CTAs:** `Go to My Claws >` (Primary Lime, routes to `/dashboard`), `Browse Marketplace` (Secondary).

## 7. Interaction Notes

- **Validation:** "Continue" buttons should validate required fields (e.g., Project Name, MaaS Key, Endpoint) and show toast errors if empty.
- **State Persistence:** Switching between tabs should preserve the state of the inactive tab (e.g., returning to Tab 1 remembers the Project Name).
- **Context Passing:** The "List this Claw" CTA on the Tab 1 Success screen must pass `templateId`, `projectName`, and `useMaaS` via URL query parameters to the `/list-claw` route to pre-fill the listing form.

---

## 8. Addendum — June 18, 2026

### 8.1 New requirement: Public webhook receiver (Host on GMI · Networking)

**Status:** 🔨 New (added to prototype, awaiting backend confirmation)
**Surface:** Register Wizard → Tab 1 (Host on GMI) → Step "Networking"
**Why:** Builders increasingly need their Agent to receive third-party webhooks (Stripe, GitHub, Slack, Linear, etc.). Today the wizard exposes Port Mapping for outbound-served traffic but does not provide a stable inbound URL for webhook callbacks. Without this, every Builder ends up rolling their own ngrok-style tunnel or registering raw IPs that change on redeploy.

**UI spec (prototype shipped):**

- **Section title:** "Public webhook receiver" (FieldLabel) with a right-aligned **Toggle Switch** (default `Off`).
- **Helper text:** "Expose a stable public HTTPS URL so third-party services (Stripe, GitHub, Slack, etc.) can POST events to your Agent."
- **When toggle is ON, reveal:**
  - **Field: Webhook URL** — read-only, mono. Rendered as `https://hooks.gmi.cloud/<slug>` where `<slug>` is derived from the Internal Project Name (a-z0-9-, lowercased, hyphen-collapsed). Copy button to the right.
    - Helper: "Stable across redeploys. GMI proxies POSTs to your container on the port below."
  - **Field: Forward to internal port** — number text input, default `8080`.
  - **Field: HMAC signing secret · optional** — mono text input with a `Generate` pill button on the right that fills `whsec_<random30>`. Helper: "If set, GMI signs each forwarded request with `X-GMI-Signature` so your code can verify authenticity."

**Defaults / behavior:**
- Off by default; turning ON does **not** require restart of the Agent at deploy time — GMI provisions the ingress at first deploy and rebinds on subsequent deploys to the same URL.
- The webhook URL is **stable** for the lifetime of the deployment (template). Re-registering the same template yields the same URL.
- Signature header is opt-in. When secret is set, every forwarded POST gets `X-GMI-Signature: t=<timestamp>,v1=<hmac_sha256>`.

**Step 5 (Review & Register) summary row** (new):
- Label: `Webhook receiver`
- Value (when off): `Off`
- Value (when on): `Public · forwards to :<port>[ · signed]`

### 8.2 Tracker — open items

| ID | Item | Owner | Status |
| --- | --- | --- | --- |
| WH-01 | Ingress contract — confirm GMI CE can route `hooks.gmi.cloud/<slug>` to a per-template container port without per-deploy reconfiguration | CaaS / eng | ⚠️ pending |
| WH-02 | URL stability guarantee — slug must survive redeploys; collision policy on slug clash | CaaS / eng | ⚠️ pending |
| WH-03 | HMAC signing scheme — pick exact format (`X-GMI-Signature: t=…,v1=…` proposed); document on the public docs site | DevRel / eng | 🔨 new |
| WH-04 | Replay protection — timestamp tolerance window (proposed: ±5 minutes), document | eng | 🔨 new |
| WH-05 | Rate-limit + abuse defaults — sensible per-template baseline (e.g. 100 rps), 413 on > 1 MB payloads | platform | 🔨 new |
| WH-06 | Backend persistence — how `webhook_enabled` / `webhook_forward_port` / `webhook_secret` fields land in the deployment template payload (likely under `RunTaskRequest.networking.webhook` or similar) | eng | ⚠️ pending swagger update |
| WH-07 | Update v1.1 PRD §7 (out of scope) — webhook receiver is **inbound** ingress (different from the existing F-07 outbound lifecycle webhooks); call out the distinction | PM | 🔨 new |

### 8.3 Notes / decisions

- **This is INBOUND, not OUTBOUND.** The PRD's existing F-07 ("Webhooks — lifecycle events") is GMI pushing `task.creating | running | error | deleted` events outbound to a Builder-registered callback URL. The 8.1 feature is the reverse direction: a public HTTPS URL **on the Agent side** that third parties POST to. These must be documented as two separate features in v1.1 PRD §7.
- **Connect-your-agent flow does not get this.** Self-hosted Agents already own their public URL (`accessUrl`); they can wire any webhook receiver they want server-side. The wizard's webhook receiver only makes sense for Host on GMI mode (we own the ingress).
- **Prototype scope:** UI is wired, state persists in the wizard. Backend wire-up is open per WH-01..WH-06.

### 8.4 Per-task config UI — prototype extension to F-04 / F-09

**Goal**: surface in **My Agents** the v1.1 PRD's per-task override surface (F-04 task-scoped env, F-09 lifetime/idle override) without conflating it with template-level defaults. The wizard sets the **template** defaults at register time; this surface lets a user override **just for this task** at provision time, and inspect what was actually applied per running instance.

**Where it lives:**
- **Provision modal** — opens when the user clicks `+ Provision instance` in the instance set panel, before the task is created. Two sections, both optional:
  - **Environment overrides** — addable rows of `KEY` + `value`. Helper text: "Merged over template env at task start. Locked GMI keys (`GMI_MAAS_*`) cannot be overridden."
  - **Lifecycle overrides** — `max_lifetime` and `idle_timeout` selects, prefilled with template defaults. Helper: "Hard caps for just this task. Leave at template defaults if not needed."
- **Config panel** (per-instance) — appears as a 4th action on every instance row alongside `Metrics / Shell / Logs`. Read-only. Two states:
  - *No overrides applied* → "Used template defaults — no per-task overrides."
  - *Overrides applied* → grid of `max_lifetime` / `idle_timeout` (cyan if different from template) + list of env override pairs.

**Out of scope (explicitly removed per design review June 21, 2026):**
- Input payload editor (the runtime request body for the agent itself). Belongs in the Playground / agent's own UI, not in the provisioning surface.
- API equivalent / SDK preview blocks. Cluttered the config view without adding value — devs needing the SDK call can read the docs.

**Backend mapping (target):**
- `POST /tasks` body: `{ deployment_id, env: { KEY: value, ... } | null, max_lifetime: "1h" | null, idle_timeout: "5min" | null, ... }`
- Read paths (`GET /tasks/{id}`) include the resolved per-task config so the Config panel can display what the platform actually ran with (template default ∪ override).

**Prototype scope**: UI + state wired. `Instance.config` captured client-side; backend wire-up follows F-04 / F-09 swagger when finalized.
