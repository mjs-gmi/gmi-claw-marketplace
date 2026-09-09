// ─── "Not in the R1 API" marker ─────────────────────────────────────────────
// The bs-api Sandbox swagger (GET /api/v2/ec/openapi.yaml) covers
// sandboxes / templates / files / executions. It does NOT cover:
//
//   pause · snapshots · actions · aliases · shell* (data plane)
//   and there is no /logs or /usage endpoint
//
// Create accepts exactly template_id / idc_name / timeout / env_vars /
// metadata — nothing else.
//
// The prototype carries surfaces for several of those. Rather than delete
// design work that may well ship later, they stay put and wear this marker so
// nobody reviews them as though they were buildable today, and nobody demos
// them to a customer as a promise.
import { C, FONT } from "@/lib/tokens";
import { REVIEW_MODE } from "@/lib/reviewMode";

export const NO_API_REASON =
  "Not in the R1 Sandbox API — the swagger covers sandboxes, templates, files and executions only. This surface has no endpoint behind it yet.";

export default function NoApiBadge({
  title = NO_API_REASON,
  style,
}: {
  title?: string;
  style?: React.CSSProperties;
}) {
  // Annotation, not product UI — see lib/reviewMode.
  if (!REVIEW_MODE) return null;
  return (
    <span
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontFamily: FONT, fontSize: 9, fontWeight: 700, lineHeight: "12px",
        letterSpacing: "0.06em",
        color: "#c7a7ff",
        background: "rgba(199,167,255,0.12)",
        border: "1px dashed rgba(199,167,255,0.55)",
        padding: "1px 5px", borderRadius: 4,
        verticalAlign: "middle", whiteSpace: "nowrap",
        ...style,
      }}
    >
      NO API
    </span>
  );
}

/** Inline one-liner for a whole block that has no endpoint behind it. */
export function NoApiNote({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  // Annotation, not product UI — see lib/reviewMode.
  if (!REVIEW_MODE) return null;
  return (
    <span
      style={{
        display: "flex", alignItems: "flex-start", gap: 7,
        fontFamily: FONT, fontSize: 11, lineHeight: "16px", color: "#c7a7ff",
        background: "rgba(199,167,255,0.06)",
        border: "1px dashed rgba(199,167,255,0.4)",
        borderRadius: 8, padding: "8px 11px",
        ...style,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
        <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
      </svg>
      <span>{children ?? NO_API_REASON}</span>
    </span>
  );
}
