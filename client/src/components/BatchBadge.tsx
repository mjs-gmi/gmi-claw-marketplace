// ─── Release batch marker ───────────────────────────────────────────────────
// Agentbox 2.0 ships in two batches, and the split is about the BACKEND, not
// the design: everything here is drawn and reviewable, but Pause and Resume
// cannot be wired until the sandbox API lands.
//
//   Batch 1 — ships now. The whole UI change set, Running included.
//   Batch 2 — Pause and Resume, roughly two weeks behind, waiting on backend.
//
// This is a different axis from V2 and 2.1, and the three must not be conflated:
//   V2Badge   — "this is new in Agentbox 2.0" (what changed)
//   BatchBadge — "which half of 2.0 does it ship in" (when)
//   V21Badge  — "not in 2.0 at all; Snapshots land in 2.1" (later release)
// A surface can honestly carry a V2 and a Batch badge. Nothing carries both a
// Batch and a 2.1 badge — if it is 2.1 it is in neither batch.
//
// Only Batch 2 is marked on individual controls. Batch 1 is the default and
// tagging every element that ships now is what turns a badge into wallpaper;
// it appears once per major surface instead, as a positive confirmation that
// the block in front of you is ready.
import { C, FONT } from "@/lib/tokens";

export const BATCH_REASON: Record<1 | 2, string> = {
  1: "Batch 1 — ships with the 2.0 UI release.",
  2: "Batch 2 — Pause and Resume follow about two weeks later; the backend is not ready. The control is drawn so the flow can be reviewed.",
};

export default function BatchBadge({
  batch, title, style,
}: {
  batch: 1 | 2;
  title?: string;
  style?: React.CSSProperties;
}) {
  const one = batch === 1;
  return (
    <span
      title={title ?? BATCH_REASON[batch]}
      style={{
        display: "inline-flex", alignItems: "center",
        fontFamily: FONT, fontSize: 9, fontWeight: 700, lineHeight: "12px",
        letterSpacing: "0.07em", whiteSpace: "nowrap", verticalAlign: "middle",
        color: one ? C.ok : "#c084fc",
        background: one ? "rgba(52,211,153,0.12)" : "rgba(192,132,252,0.14)",
        border: `1px solid ${one ? "rgba(52,211,153,0.45)" : "rgba(192,132,252,0.5)"}`,
        padding: "1px 5px", borderRadius: 4,
        ...style,
      }}
    >
      {one ? "BATCH 1" : "BATCH 2"}
    </span>
  );
}

/** A one-line note for a whole block that waits on batch 2. */
export function Batch2Note({ children }: { children?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        background: "rgba(192,132,252,0.05)",
        border: "1px solid rgba(192,132,252,0.30)",
        borderRadius: 8, padding: "9px 12px",
        fontFamily: FONT, fontSize: 12, lineHeight: "17px", color: C.muted,
      }}
    >
      <BatchBadge batch={2} style={{ marginTop: 1, flexShrink: 0 }} />
      <span>{children ?? BATCH_REASON[2]}</span>
    </div>
  );
}
