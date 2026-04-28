# GMI Claw Marketplace — Claw Detail Page Lo-fi Requirements

**Author:** Manus AI
**Date:** April 27, 2026

## 1. Executive Summary

This document details the functional and UI requirements for the **Claw Detail Page** in the GMI Claw Marketplace. This page serves as the storefront for individual Claws, providing consumers with comprehensive information, infrastructure verification details, and the primary call-to-action to access or request the Claw.

## 2. Problem Statement

**Consumer Perspective:** Users browsing the Marketplace need a clear, trustworthy view of what a Claw does, who built it, and what infrastructure it runs on before deciding to integrate or use it. They need to understand if it's fully managed by GMI or self-hosted by the publisher.

## 3. Target Users & Personas

- **Claw Consumers:** Enterprise users, developers, and product managers looking to discover and integrate AI agents into their workflows without building them from scratch.

## 4. User Flow

`Click Claw Card on Marketplace` → `View Claw Details` → `Click "Access Claw" / "Request Early Access"` → `Redirect to Claw Interface / Waitlist`

## 5. Strategic Context

The Claw Detail page is the primary conversion point in the Marketplace. It must balance marketing copy (description, tags) with technical transparency (infrastructure badges, trust indicators) to build consumer confidence.

## 6. Requirements

The page uses a two-column layout: main content on the left, and a sticky action panel on the right.

### 6.1 Global Chrome & Navigation

**Form:** Page Layout
**Preceding Action:** Click a Claw card from the Marketplace or Dashboard.
**Subsequent Action:** N/A (Container).

- **Topbar & Sidebar:** Standard GMI Console layout.
- **Breadcrumb:** `< ArrowLeft` "Back to Marketplace" (Returns to `/marketplace`).

---

### 6.2 Left Column: Main Content

This section provides all descriptive and technical information about the Claw.

#### 6.2.1 Header Section

- **Badges Row:**
  - **Infrastructure Badge:** Indicates deployment type (e.g., `Verified` in Lime or `Powered by GMI CE` in Blue). Includes a tooltip with detailed explanation.
  - **Category Tag:** Indicates the Claw's category (e.g., `Developer`, `Productivity`, `Business`, `Creative`) with specific color coding.
- **Title:** The name of the Claw (e.g., "Code Review Agent").
- **Publisher Info:** "by `[Publisher Name]`".

#### 6.2.2 Metadata & Description

- **Tags:** A horizontal list of descriptive tags (e.g., `GitHub`, `Security`, `TypeScript`).
- **About this Claw:** A full-length text description detailing the Claw's features, integrations, and use cases.

#### 6.2.3 Visual Preview

- **Preview Container:** A 16:9 aspect ratio placeholder box.
- **Content:** Currently displays an image icon with the text "Image / Demo coming soon". This will later hold screenshots or interactive demos.

#### 6.2.4 Infrastructure Verification

- **Section Header:** "Infrastructure"
- **Verification Box:**
  - **Indicator:** A colored dot matching the infrastructure badge.
  - **Title:** The badge label (e.g., "Verified").
  - **Description:** Full text explaining the infrastructure guarantee (e.g., "This Claw is fully hosted on GMI Cluster Engine and uses GMI Models-as-a-Service. High availability and security are guaranteed by GMI.").

---

### 6.3 Right Column: Action Panel (Sticky)

This panel remains visible as the user scrolls, housing the primary conversion actions and trust indicators.

#### 6.3.1 Availability Status

- **Status Indicator:** Shows the current availability of the Claw.
  - **Available:** Pulsing Lime dot + "Available".
  - **Early Access:** Pulsing Orange dot + "Early Access".
  - **Unavailable:** Gray dot + "Unavailable".

#### 6.3.2 Call to Action (Dynamic based on Status)

- **If Available:**
  - **CTA:** `Access Claw` (Primary Lime button with external link icon).
  - **Action:** Triggers a success toast ("Connecting to [Claw Name]...") and redirects the user to the Claw's interface.
- **If Early Access:**
  - **CTA:** `Request Early Access` (Orange outline button with clock icon).
  - **Helper Text:** "Limited beta. Join the waitlist to be notified when access opens."
  - **Action:** Triggers a success toast ("Early access requested...").
- **If Unavailable:**
  - **CTA:** `Unavailable` (Disabled gray button with alert icon).
  - **Helper Text:** "This Claw is not currently accepting new users."

#### 6.3.3 Trust Indicators

- **Divider:** Separates CTAs from trust info.
- **Items:**
  - Checkmark icon + Infrastructure guarantee text (matches the badge tooltip).
  - Checkmark icon + "Browser-based. No SDK, API key, or installation required."

## 7. Interaction Notes

- **Sticky Panel:** The right column must remain fixed (`sticky top-24`) while the left column scrolls.
- **Not Found State:** If an invalid Claw ID is provided in the URL, display a full-page error ("// Claw not found") with a "Back to Marketplace" button.
