# GMI Claw Marketplace — Design Brainstorm

## Context
- Product: An interactive showcase for the GMI Claw Marketplace — where developers discover, explore, and deploy autonomous AI agents (Claws).
- Brand: Must match the official GMI Cloud design system (gmicloud.ai).
- Fonts used on GMI Cloud: Alpha Lyrae (custom display), Inter (body), GeistMono (monospace/code), SPACERR (decorative)
- Colors: Pure Black #000000, Pure White #FFFFFF, Neon Lime #C8FF00
- Style: High-Contrast Brutalism — sharp 0px corners, 1px borders, alternating black/white sections, monospace body on dark

---

<response>
<text>
## Idea 1: "Terminal Marketplace" — Dark-First Developer Console

**Design Movement:** Brutalist Developer Terminal meets high-end SaaS catalog

**Core Principles:**
1. Black-first: The entire experience starts in the dark. White sections are used sparingly for pricing and detailed spec sheets.
2. Monospace as identity: Body copy on dark sections uses GeistMono, reinforcing that this is a platform built by engineers, for engineers.
3. Grid as structure: The Claw catalog is a strict 3-column grid defined entirely by 1px #333 borders — no card backgrounds, no shadows.
4. Neon Lime as the single accent: #C8FF00 is used ONLY for primary CTAs, active states, and key data highlights. Nothing else gets color.

**Color Philosophy:** Binary contrast with one surgical accent. The black/white alternation creates a rhythm that feels like reading a well-formatted technical manual. The neon lime is a "system alert" — it demands attention exactly where needed.

**Layout Paradigm:** Asymmetric editorial grid. The hero uses a left-aligned, massive display headline (Alpha Lyrae) with a right-side terminal animation showing a live Claw deployment. Below the fold, sections alternate: black (value prop) → white (catalog) → black (infrastructure) → white (pricing).

**Signature Elements:**
1. Animated typewriter headline in Alpha Lyrae font (matching gmicloud.ai hero)
2. Dot-matrix background on white sections (subtle radial dot pattern)
3. 1px dashed borders on secondary CTAs (matching the "CONTACT SALES" button on gmicloud.ai)

**Interaction Philosophy:** Interactions are immediate and functional. Hover states use solid color fills (no fades). The deployment modal feels like a terminal — showing a live log stream with monospace text.

**Animation:** Typewriter reveal on hero headline. Staggered fade-in for catalog cards on scroll. Terminal log animation in the deployment modal.

**Typography System:**
- Display: Alpha Lyrae (loaded from /fonts/alpha-lyrae-medium.woff2) — hero titles only
- UI Headers: Inter Bold (700) — section titles, card headers
- Body: Inter Regular (400) — descriptions, body copy on light sections
- Code/Mono: GeistMono — body copy on dark sections, terminal output, pricing figures
</text>
<probability>0.08</probability>
</response>

<response>
<text>
## Idea 2: "Spec Sheet" — White-First Enterprise Catalog

**Design Movement:** Swiss International Typographic Style meets enterprise SaaS

**Core Principles:**
1. White-dominant: The catalog and discovery experience lives on white. Black sections are used for the hero and CTA blocks.
2. Typography as hierarchy: Size, weight, and spacing do all the work. No decorative elements.
3. Table-driven data: Claw specs are presented in structured tables, not marketing cards.
4. Minimal accent use: Neon lime appears only on the primary CTA and active filter states.

**Color Philosophy:** Clinical precision. White communicates trust and clarity for enterprise buyers. The black hero creates a strong entry point, and the lime CTA is the only moment of energy.

**Layout Paradigm:** Centered, column-based editorial layout with a persistent left sidebar for filtering the Claw catalog.

**Signature Elements:**
1. Left sidebar filter panel with checkboxes and category tags
2. Horizontal rule dividers between sections (1px black on white)
3. Monospace pricing figures in large type

**Interaction Philosophy:** Functional and precise. Filters update the catalog instantly. Hover states are minimal — just a border color change.

**Animation:** Minimal. Page transitions use a simple fade. No scroll animations.

**Typography System:**
- Display: Inter Black (900) — very large, tight tracking
- Body: Inter Regular (400)
- Mono: GeistMono — code snippets and pricing
</text>
<probability>0.06</probability>
</response>

<response>
<text>
## Idea 3: "Neon Grid" — Dark Brutalist with Geometric Accents

**Design Movement:** Brutalist dark-mode with wireframe geometric illustrations

**Core Principles:**
1. Full black canvas: The entire site lives on black. White is used only for text.
2. Wireframe geometry: Isometric cube illustrations (matching gmicloud.ai's GPU section) are used as decorative elements throughout.
3. Grid-defined cards: All cards are defined by 1px #333 borders on a black background. On hover, the border turns neon lime.
4. Neon lime as the energy source: Used more liberally here — borders on hover, active states, stat highlights, and section labels.

**Color Philosophy:** The black canvas creates a sense of infinite depth. The neon lime feels like circuit traces or system indicators — alive and technical.

**Layout Paradigm:** Full-bleed black sections with internal max-width grids. The hero uses a full-viewport split: left side has the headline and CTA, right side has an animated wireframe cube cluster.

**Signature Elements:**
1. Animated wireframe cube cluster in the hero (CSS/SVG animation)
2. Neon lime border on card hover (0→1px lime border transition)
3. "DEPLOY →" CTA with an arrow that animates on hover

**Interaction Philosophy:** Hover states are dramatic — border color changes, subtle scale transforms. The deployment flow uses a step-by-step wizard with a terminal preview.

**Animation:** Rotating wireframe cube in hero. Card border glow on hover. Terminal typing animation in deployment modal.

**Typography System:**
- Display: Alpha Lyrae — hero only
- Headers: Inter Bold (700)
- Body: GeistMono on dark, Inter on light
- Labels: All-caps Inter Medium (500), letter-spacing: 0.1em
</text>
<probability>0.09</probability>
</response>

---

## Selected Approach: Idea 3 — "Neon Grid"

This approach best serves the product's dual audience (enterprise users + developers) while staying true to the GMI Cloud brand. The full-black canvas with neon lime accents creates a premium, technical feel that differentiates the Marketplace from generic SaaS tools. The wireframe geometry ties directly to the visual language already established on gmicloud.ai.
