// ─── V2 badge — marks surfaces added or reworked by Agentbox V2.0 ───────────
// Additive marker only: nothing in the v1 prototype is removed or renamed
// because of it. Attach it next to the label of any control, tab, column, or
// section that lands as part of the V2.0 interface change set.
//
// Source: "Agentbox V2.0 Interface Changes: New Flow and Features Overview"
// (Confluence, space IE) — sections A–I.
//
// Deliberately distinct from Dashboard's lime `NEW` pill: `NEW` flags
// Runtime 2.0 additions, this flags the V2.0 change set. Both can sit side by
// side on the same label.
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
