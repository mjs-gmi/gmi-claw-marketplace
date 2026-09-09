// ─── Publish Status — v1.2 §D ───────────────────────────────────────────────
// One place to see every listing this account has submitted and where it sits
// in review. Reached from the "Publish Status" entry in the My Agents column
// header; nothing that already existed on that page is replaced.
//
// Review states map onto the existing ListingState machine:
//   live           → Approved
//   pending_review → Under Review
//   rejected       → Denied   (carries a reason, shown on the ⓘ)
//   draft          → Draft    (registered, never submitted)
//
// Every listing action lives in the row menu here — this is the one place to
// manage a listing, so a draft has to be reachable too. That is a deliberate
// widening of the v1.2 design, which showed submitted listings only.
import { useEffect, useMemo, useRef, useState } from "react";
import { C, FONT } from "@/lib/tokens";
import V2Badge from "@/components/V2Badge";

export type ReviewStatus = "draft" | "approved" | "under_review" | "denied";

export interface PublishRow {
  id: string;
  listingName: string;
  templateName: string;
  status: ReviewStatus;
  updated: string;
  /** Only set on `denied` — surfaced through the ⓘ next to the chip. */
  denyReason?: string;
  /** Private image or embedded credentials: this listing can't go public. */
  locked?: boolean;
}

/** Every action the row menu can offer, in the order it renders them. */
export interface ListingActionHandlers {
  onComplete:  (row: PublishRow) => void;  // draft → finish the listing form
  onEdit:      (row: PublishRow) => void;  // edit a submitted or live listing
  onFix:       (row: PublishRow) => void;  // denied → fix and resubmit
  onView:      (row: PublishRow) => void;  // open the public listing
  onRepost:    (row: PublishRow) => void;  // live → send back through review
  onWithdraw:  (row: PublishRow) => void;  // pull a submission before review
  onUnpublish: (row: PublishRow) => void;  // take a live listing down
}

const STATUS_META: Record<ReviewStatus, { label: string; color: string }> = {
  draft:        { label: "Draft",        color: C.muted },
  approved:     { label: "Approved",     color: C.ok },
  under_review: { label: "Under Review", color: C.link },
  denied:       { label: "Denied",       color: "#f87171" },
};

type SortKey = "listingName" | "templateName" | "status" | "updated";

// ─── Entry point in the My Agents column header ─────────────────────────────
export function PublishStatusEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      title="Manage every listing — draft, in review, live — in one place"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: FONT, fontSize: 12.5, fontWeight: 500,
        color: C.muted, background: "transparent", border: "none",
        padding: "2px 0", cursor: "pointer",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3v5h5" />
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
        <path d="M12 7v5l4 2" />
      </svg>
      Publish Status
      <V2Badge />
    </button>
  );
}

// ─── Status chip (+ deny reason on hover) ───────────────────────────────────
function StatusChip({ row }: { row: PublishRow }) {
  const m = STATUS_META[row.status];
  const [hover, setHover] = useState(false);
  const showReason = row.status === "denied" && !!row.denyReason;
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <span
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontFamily: FONT, fontSize: 11, fontWeight: 600, lineHeight: "16px",
          color: m.color, background: `${m.color}1f`, border: `1px solid ${m.color}55`,
          padding: "1px 7px", borderRadius: 5, whiteSpace: "nowrap",
          cursor: showReason ? "help" : "default",
        }}
      >
        {m.label}
        {showReason && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
          </svg>
        )}
      </span>
      {showReason && hover && (
        <span
          role="tooltip"
          style={{
            position: "absolute", bottom: "calc(100% + 7px)", left: -12,
            width: 244, zIndex: 40,
            background: "#2a2a2a", border: `1px solid ${C.border}`, borderRadius: 7,
            padding: "8px 10px",
            boxShadow: "0 8px 22px rgba(0,0,0,0.55)",
            fontFamily: FONT, fontSize: 11.5, lineHeight: "16px", color: C.fg,
            textAlign: "left",
          }}
        >
          <span style={{ display: "block", fontWeight: 600, marginBottom: 3 }}>Reason for failure</span>
          <span style={{ color: C.muted }}>{row.denyReason}</span>
        </span>
      )}
    </span>
  );
}

// ─── Per-row ⋯ menu — the single home for listing management ───────────────
// Every action a listing can take lives here, gated by its state. Nothing is
// reachable only from somewhere else, which is the point of collapsing listing
// management into this one surface.
type MenuItem = {
  key: string;
  label: string;
  run: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  icon: React.ReactNode;
};

const Ico = {
  edit:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
  send:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>,
  view:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M21 14v7H3V3h7" /></svg>,
  repost:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>,
  withdraw:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>,
  unpublish: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>,
  info:      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>,
};

const LOCK_REASON =
  "Cannot be published — listing to public requires a public image with no embedded secrets or credentials.";

function itemsFor(row: PublishRow, h: ListingActionHandlers): MenuItem[] {
  switch (row.status) {
    case "draft":
      return [
        { key: "complete", label: "Complete listing", run: () => h.onComplete(row), icon: Ico.send,
          disabled: row.locked, title: row.locked ? LOCK_REASON : undefined },
      ];
    case "under_review":
      return [
        { key: "edit",     label: "Edit pending listing", run: () => h.onEdit(row),     icon: Ico.edit },
        { key: "withdraw", label: "Withdraw",             run: () => h.onWithdraw(row), icon: Ico.withdraw, danger: true },
      ];
    case "denied":
      return [
        { key: "fix",      label: "Fix & resubmit", run: () => h.onFix(row),      icon: Ico.edit,
          disabled: row.locked, title: row.locked ? LOCK_REASON : undefined },
        { key: "withdraw", label: "Withdraw",       run: () => h.onWithdraw(row), icon: Ico.withdraw, danger: true },
      ];
    case "approved":
      return [
        { key: "repost",    label: "Repost",              run: () => h.onRepost(row),    icon: Ico.repost,
          disabled: row.locked, title: row.locked ? LOCK_REASON : "Submit this listing for review again" },
        { key: "edit",      label: "Edit listing",        run: () => h.onEdit(row),      icon: Ico.edit },
        { key: "view",      label: "View public listing", run: () => h.onView(row),      icon: Ico.view },
        { key: "unpublish", label: "Unpublish",           run: () => h.onUnpublish(row), icon: Ico.unpublish, danger: true },
      ];
  }
}

function RowMenu({ row, handlers }: { row: PublishRow; handlers: ListingActionHandlers }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  // The row list scrolls, so an absolutely-positioned menu gets clipped by it.
  // Anchor the menu to the viewport off the trigger's rect instead, and flip it
  // upward when there isn't room below.
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const estHeight = 44 + itemsFor(row, handlers).length * 34;
    const up = r.bottom + estHeight > window.innerHeight - 12;
    setPos({
      top: up ? r.top - 4 : r.bottom + 4,
      right: Math.max(8, window.innerWidth - r.right),
      up,
    });
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const reflow = () => setOpen(false);
    document.addEventListener("mousedown", away);
    window.addEventListener("resize", reflow);
    window.addEventListener("scroll", reflow, true);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow, true);
    };
  }, [open]);

  const items = itemsFor(row, handlers);
  // Destructive items sit below a rule, matching the agent-header menu.
  const firstDanger = items.findIndex((i) => i.danger);

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
      <button
        ref={btnRef}
        onClick={() => { if (!open) place(); setOpen((o) => !o); }}
        aria-label={`Listing actions for ${row.listingName}`}
        style={{
          width: 26, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: open ? "rgba(255,255,255,0.06)" : "transparent",
          color: C.muted, border: "none", borderRadius: 6, cursor: "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      {open && pos && (
        <div
          style={{
            position: "fixed",
            top: pos.up ? undefined : pos.top,
            bottom: pos.up ? window.innerHeight - pos.top : undefined,
            right: pos.right,
            minWidth: 186, zIndex: 1150,
            background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column",
          }}
        >
          {items.map((it, i) => (
            <div key={it.key} style={{ display: "contents" }}>
              {i === firstDanger && firstDanger > 0 && (
                <div style={{ height: 1, background: C.borderSoft, margin: "4px 6px" }} />
              )}
              <button
                onClick={() => { if (it.disabled) return; setOpen(false); it.run(); }}
                disabled={it.disabled}
                title={it.title}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  fontFamily: FONT, fontSize: 12.5, fontWeight: 500,
                  color: it.disabled ? C.muted : it.danger ? "#f87171" : C.fg,
                  opacity: it.disabled ? 0.55 : 1,
                  background: "transparent", border: "none",
                  padding: "7px 9px", borderRadius: 6,
                  cursor: it.disabled ? "not-allowed" : "pointer", textAlign: "left",
                }}
              >
                {it.icon}
                {it.label}
                {it.disabled && <span style={{ marginLeft: "auto", display: "inline-flex" }}>{Ico.info}</span>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Unpublish confirmation — v1.2 §D7 ──────────────────────────────────────
export function UnpublishDialog({
  row, onCancel, onConfirm,
}: {
  row: PublishRow | null;
  onCancel: () => void;
  onConfirm: (row: PublishRow) => void;
}) {
  useEffect(() => {
    if (!row) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [row, onCancel]);

  if (!row) return null;
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Unpublish Agent"
        style={{
          width: 424, maxWidth: "100%",
          background: "#111111", border: `1px solid ${C.border}`, borderRadius: 10,
          padding: "18px 20px 16px",
          boxShadow: "0 20px 48px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>
            Unpublish Agent
          </h3>
          <button
            onClick={onCancel}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", display: "flex", padding: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <p style={{ fontFamily: FONT, fontSize: 13, lineHeight: "20px", color: C.muted, margin: "10px 0 0" }}>
          Unpublish this Agent will remove it from the Marketplace.<br />
          Re-submitting will require a new review cycle.<br />
          Are you sure you want to unpublish?
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
          <button
            onClick={onCancel}
            style={{
              fontFamily: FONT, fontSize: 13, fontWeight: 500,
              background: "transparent", color: C.fg,
              border: `1px solid ${C.border}`, padding: "7px 16px", borderRadius: 7, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(row)}
            style={{
              fontFamily: FONT, fontSize: 13, fontWeight: 600,
              background: "#ef4444", color: "#fafafa",
              border: "none", padding: "7px 16px", borderRadius: 7, cursor: "pointer",
            }}
          >
            Unpublish
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable header cell ───────────────────────────────────────────────────
function Th({
  label, sortKey, active, dir, onSort, align = "left",
}: {
  label: string;
  sortKey?: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  if (!sortKey) {
    return (
      <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, textAlign: align }}>
        {label}
      </div>
    );
  }
  return (
    <button
      onClick={() => onSort(sortKey)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        font: "inherit", fontFamily: FONT, fontSize: 12, fontWeight: 500,
        color: active ? C.fg : C.muted,
        background: "transparent", border: "none", padding: 0, cursor: "pointer",
        justifySelf: align === "right" ? "end" : "start",
      }}
    >
      {label}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: active ? 1 : 0.55 }} aria-hidden="true">
        {!active || dir === "desc" ? <path d="m7 15 5 5 5-5" /> : <path d="m7 9 5-5 5 5" />}
      </svg>
    </button>
  );
}

// ─── The modal — v1.2 §D2–D6 ────────────────────────────────────────────────
const GRID = "minmax(0,1.15fr) minmax(0,1fr) 128px 168px 34px";

export function PublishStatusModal({
  rows, onClose, handlers, escapeDisabled = false,
}: {
  rows: PublishRow[];
  onClose: () => void;
  handlers: ListingActionHandlers;
  /** True while a dialog sits on top — Escape belongs to the topmost layer. */
  escapeDisabled?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sort = (k: SortKey) => {
    // A fresh column opens on the direction that is useful first: newest for
    // dates, but *most actionable* for status — Denied before Approved.
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setDir(k === "status" ? "asc" : "desc"); }
  };

  // Denied first, then Under Review, then Approved — the order in which a
  // publisher has to act on them.
  const statusRank: Record<ReviewStatus, number> = { denied: 0, under_review: 1, draft: 2, approved: 3 };

  const sorted = useMemo(() => {
    const mul = dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      let cmp: number;
      if (sortKey === "status") cmp = statusRank[a.status] - statusRank[b.status];
      else if (sortKey === "updated") cmp = a.updated.localeCompare(b.updated);
      else cmp = a[sortKey].localeCompare(b[sortKey]);
      return cmp * mul;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, dir]);

  useEffect(() => {
    if (escapeDisabled) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, escapeDisabled]);

  const cellText: React.CSSProperties = {
    fontFamily: FONT, fontSize: 12.5, color: C.fg,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "88px 24px 24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Publish Status"
        style={{
          width: 860, maxWidth: "100%", maxHeight: "calc(100vh - 132px)",
          display: "flex", flexDirection: "column",
          background: "#141414", border: `1px solid ${C.border}`, borderRadius: 11,
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px 12px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
            <h3 style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: C.fg, margin: 0 }}>
              Publish Status
            </h3>
            <V2Badge />
          </div>
          <button
            onClick={onClose}
            aria-label="Close publish status"
            style={{
              width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: "transparent", color: C.muted, border: `1px solid ${C.border}`,
              borderRadius: 7, cursor: "pointer",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Header row */}
        <div
          style={{
            display: "grid", gridTemplateColumns: GRID, gap: 12,
            padding: "0 20px 10px", alignItems: "center",
            borderBottom: `1px solid ${C.borderSoft}`,
          }}
        >
          <Th label="Listing name"  sortKey="listingName"  active={sortKey === "listingName"}  dir={dir} onSort={sort} />
          <Th label="Template name" sortKey="templateName" active={sortKey === "templateName"} dir={dir} onSort={sort} />
          <Th label="Review Status" sortKey="status"       active={sortKey === "status"}       dir={dir} onSort={sort} />
          <Th label="Updated"       sortKey="updated"      active={sortKey === "updated"}      dir={dir} onSort={sort} />
          <div />
        </div>

        {/* Rows */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 20px 16px" }}>
          {sorted.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid", gridTemplateColumns: GRID, gap: 12,
                padding: "11px 0", alignItems: "center",
                borderBottom: `1px solid ${C.borderSoft}`,
              }}
            >
              {/* Long names truncate — the title attribute carries the full one */}
              <span style={cellText} title={r.listingName}>{r.listingName}</span>
              <span style={{ ...cellText, color: C.muted }} title={r.templateName}>{r.templateName}</span>
              <StatusChip row={r} />
              <span style={{ ...cellText, color: C.muted }}>{r.updated}</span>
              <RowMenu row={r} handlers={handlers} />
            </div>
          ))}
          {sorted.length === 0 && (
            <div style={{ fontFamily: FONT, fontSize: 13, color: C.muted, padding: "28px 0", textAlign: "center" }}>
              No listings yet. Register an Agent and it shows up here as a Draft.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
