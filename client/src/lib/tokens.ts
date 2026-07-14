// ─── Shared design tokens ───────────────────────────────────────────────────
// Single source of truth for the app's palette, fonts, and category colors.
// Import from here instead of redefining per-page so colors never drift.
// (Marketplace / Dashboard / DeployWizard still carry local `C` supersets with
//  a few page-specific keys; migrate them here when convenient.)

import type { TypeLabel } from "./clawData";

export const FONT = "'Geist', system-ui, sans-serif";
export const MONO = "'GeistMono', ui-monospace, monospace";

export const C = {
  bg:         "#0a0a0a",
  fg:         "#fafafa",
  muted:      "#a3a3a3",
  border:     "#404040",
  borderSoft: "#262626",
  card:       "rgba(23,23,23,0.95)",
  cardSolid:  "#171717",
  pillBg:     "rgba(82,82,82,0.3)",
  lime:       "#DDEA4D",
  limeText:   "#0a0a0a",
  link:       "#5b94f0",
  warn:       "#fbbf24",
  ok:         "#34d399",
  err:        "#f87171",
} as const;

// Category accent colors — the same violet/sky/green/pink set used on the
// marketplace cards and the List-an-Agent form's Live Card Preview.
export const TYPE_COLOR: Record<TypeLabel, string> = {
  "Code & Dev Tools":     "#c7a7ff",
  "Data & Analytics":     C.lime,
  "Customer Support":     "#7dd3fc",
  "Content & Marketing":  "#86efac",
  "Research & Knowledge": "#f9a8d4",
};
