// ─── Open question marker ───────────────────────────────────────────────────
// For a surface that is built and works, but whose *placement* nobody has
// signed off. Distinct from NO API (no endpoint behind it) and from V2 (new in
// this change set): this one says "we are not sure this belongs here."
//
// It exists because the alternative is worse — a placement decision made by
// whoever wrote the code, then never revisited because nothing on screen says
// it was open.
import { C, FONT } from "@/lib/tokens";

export default function OpenQuestionBadge({
  title,
  style,
}: {
  /** The actual question. Write it as a question. */
  title: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      title={title}
      aria-label={`Open question: ${title}`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 15, height: 15, flexShrink: 0,
        fontFamily: FONT, fontSize: 10, fontWeight: 800, lineHeight: 1,
        color: C.warn,
        background: "rgba(251,191,36,0.14)",
        border: "1px dashed rgba(251,191,36,0.6)",
        borderRadius: 999,
        verticalAlign: "middle", cursor: "help",
        ...style,
      }}
    >
      ?
    </span>
  );
}
