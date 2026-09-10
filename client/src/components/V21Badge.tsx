// ─── "Lands in 2.1" marker ──────────────────────────────────────────────────
// Pause, Resume and Snapshot are drawn throughout the console but are NOT built
// yet — they are scheduled for Agentbox 2.1. This badge says so on the control
// itself.
//
// Why this one ships by default, unlike NO API and the R0/R1 release tags:
// those answer "does an endpoint exist" and "which release is this planned for"
// — questions the team asks, not the operator. "This button lands in 2.1" is
// different. Someone looking at the prototype WILL click Pause, and the honest
// answer to what happens next belongs on the button, not in a doc.
//
// It is not the same statement as NoApiBadge. NO API is a fact about the
// swagger; 2.1 is a decision about the roadmap. A surface can carry both: the
// contract has no pause endpoint AND we have decided pause ships in 2.1. That
// decision was the open item in docs/design/v1.2/README.md §G.
import { C, FONT } from "@/lib/tokens";

export const V21_REASON =
  "Not built yet — Pause, Resume and Snapshot are scheduled for Agentbox 2.1. The control is here so the flow can be reviewed; it does not do anything real.";

export default function V21Badge({
  title = V21_REASON,
  style,
}: {
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex", alignItems: "center",
        fontFamily: FONT, fontSize: 9, fontWeight: 700, lineHeight: "12px",
        letterSpacing: "0.08em",
        color: C.warn,
        background: "rgba(251,191,36,0.12)",
        border: "1px solid rgba(251,191,36,0.45)",
        padding: "1px 5px", borderRadius: 4,
        verticalAlign: "middle", whiteSpace: "nowrap",
        ...style,
      }}
    >
      2.1
    </span>
  );
}

/** Inline one-liner for a whole block that is deferred to 2.1. */
export function V21Note({ children }: { children?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        background: "rgba(251,191,36,0.05)",
        border: "1px solid rgba(251,191,36,0.30)",
        borderRadius: 8, padding: "9px 12px",
        fontFamily: FONT, fontSize: 12, lineHeight: "17px", color: C.muted,
      }}
    >
      <V21Badge style={{ marginTop: 1, flexShrink: 0 }} />
      <span>{children ?? V21_REASON}</span>
    </div>
  );
}
