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
