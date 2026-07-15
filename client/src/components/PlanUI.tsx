// ─── Coding Agent Plan — shared UI atoms ───────────────────────────────────
// Reused across every plan placement (Register, List, My Agents, Launch,
// Browse, Agent Detail, Access, Billing) so the treatment stays identical.
import { C, FONT } from "@/lib/tokens";
import { CODING_AGENT_PLAN } from "@/lib/modelsPlan";

function BoltIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z" />
    </svg>
  );
}

// "Plan eligible" / plan-name pill. `solid` = filled lime (strong emphasis, e.g.
// discount callouts); default = subtle lime-tinted outline (badges on cards).
export function PlanBadge({
  text = "Plan eligible", solid = false, title,
}: { text?: string; solid?: boolean; title?: string }) {
  return (
    <span
      title={title || `${CODING_AGENT_PLAN.name} · ${CODING_AGENT_PLAN.discountPct}% off`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontFamily: FONT, fontSize: 11, fontWeight: 600, lineHeight: "16px", letterSpacing: "0.01em",
        color: solid ? C.limeText : C.lime,
        background: solid ? C.lime : "rgba(221,234,77,0.10)",
        border: `1px solid ${solid ? C.lime : "rgba(221,234,77,0.40)"}`,
        padding: "1px 8px", borderRadius: 999, whiteSpace: "nowrap",
      }}
    >
      <BoltIcon /> {text}
    </span>
  );
}

// Struck-through original + discounted price, with a "-N%" chip.
export function DiscountedPrice({
  original, discounted, size = 13,
}: { original: string; discounted: string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, fontFamily: FONT, flexWrap: "wrap" }}>
      <span style={{ fontSize: size - 2, color: C.muted, textDecoration: "line-through" }}>{original}</span>
      <span style={{ fontSize: size, fontWeight: 700, color: C.fg }}>{discounted}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.lime, background: "rgba(221,234,77,0.10)", border: "1px solid rgba(221,234,77,0.40)", padding: "0 5px", borderRadius: 4 }}>
        −{CODING_AGENT_PLAN.discountPct}%
      </span>
    </span>
  );
}
