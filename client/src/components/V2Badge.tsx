// ─── V2 badge — marks surfaces added or reworked by Agentbox V2.0 ───────────
// Additive marker only: nothing in the v1 prototype is removed or renamed
// because of it. Attach it next to the label of any control, tab, column, or
// section that lands as part of the V2.0 interface change set.
//
// Source: "Agentbox V2.0 Interface Changes: New Flow and Features Overview"
// (Confluence, space IE) — sections A–I.
//
// This one ships. It answers a question the reader does have — "what changed
// in V2?" — which is why it is on by default while NO API, the open-question
// "?" and the R0/R1/IND release tags stay behind review mode. Those three
// stacked on top of this is what turned every tab label into noise.
//
// Rule for using it: only on something V2 actually introduced (Confluence
// §A–§I). Not on a surface that merely got touched.
import { C, FONT } from "@/lib/tokens";

export default function V2Badge({
  title = "New in Agentbox V2.0",
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
        color: C.link,
        background: "rgba(91,148,240,0.12)",
        border: `1px solid rgba(91,148,240,0.45)`,
        padding: "1px 5px", borderRadius: 4,
        verticalAlign: "middle", whiteSpace: "nowrap",
        ...style,
      }}
    >
      V2
    </span>
  );
}
