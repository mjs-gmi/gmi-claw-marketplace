// ─── Publish Status — v1.2 §D ───────────────────────────────────────────────
// One place to see every listing this account has submitted and where it sits
// in review. Reached from the "Publish Status" entry in the My Agents column
// header; nothing that already existed on that page is replaced.
//
// Review states map onto the existing ListingState machine:
//   live           → Approved
//   pending_review → Under Review
//   rejected       → Denied   (carries a reason, shown on the ⓘ)
//   draft          → not listed here (never submitted)
import { useEffect, useMemo, useRef, useState } from "react";
import { C, FONT } from "@/lib/tokens";
import V2Badge from "@/components/V2Badge";

export type ReviewStatus = "approved" | "under_review" | "denied";

export interface PublishRow {
  id: string;
  listingName: string;
  templateName: string;
  status: ReviewStatus;
  updated: string;
  /** Only set on `denied` — surfaced through the ⓘ next to the chip. */
  denyReason?: string;
}

const STATUS_META: Record<ReviewStatus, { label: string; color: string }> = {
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
      title="Every listing you've submitted and where it sits in review"
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

// ─── Per-row ⋯ menu ─────────────────────────────────────────────────────────
function RowMenu({
  row, onUnpublish, onList,
}: {
  row: PublishRow;
  onUnpublish: (row: PublishRow) => void;
  onList: (row: PublishRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  // Approved is the only state with a live listing to pull down; everything
  // else routes back into the listing form.
  const isApproved = row.status === "approved";

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Listing actions"
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
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0,
            minWidth: 156, zIndex: 45,
            background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column",
          }}
        >
          {isApproved ? (
            <button
              onClick={() => { setOpen(false); onUnpublish(row); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                fontFamily: FONT, fontSize: 12.5, fontWeight: 500,
                color: "#f87171", background: "transparent", border: "none",
                padding: "7px 9px", borderRadius: 6, cursor: "pointer", textAlign: "left",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
              </svg>
              Unpublish
            </button>
          ) : (
            <button
              onClick={() => { setOpen(false); onList(row); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                fontFamily: FONT, fontSize: 12.5, fontWeight: 500,
                color: C.fg, background: "transparent", border: "none",
                padding: "7px 9px", borderRadius: 6, cursor: "pointer", textAlign: "left",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
              </svg>
              List an agent
            </button>
          )}
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
  rows, onClose, onUnpublish, onList,
}: {
  rows: PublishRow[];
  onClose: () => void;
  onUnpublish: (row: PublishRow) => void;
  onList: (row: PublishRow) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sort = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setDir("desc"); }
  };

  // Denied first, then Under Review, then Approved — the order in which a
  // publisher has to act on them.
  const statusRank: Record<ReviewStatus, number> = { denied: 0, under_review: 1, approved: 2 };

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
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

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
              <RowMenu row={r} onUnpublish={onUnpublish} onList={onList} />
            </div>
          ))}
          {sorted.length === 0 && (
            <div style={{ fontFamily: FONT, fontSize: 13, color: C.muted, padding: "28px 0", textAlign: "center" }}>
              No listings submitted yet. Publish an Agent and it shows up here with its review state.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
