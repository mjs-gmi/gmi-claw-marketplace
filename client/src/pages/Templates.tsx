import { useState } from "react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import { C, FONT, MONO } from "@/lib/tokens";
import V2Badge from "@/components/V2Badge";
import {
  TEMPLATES, TEMPLATE_QUOTA, daysToArchive, relativeDay, buildElapsed,
  templatesAtLimit, ARCHIVE_WARN_DAYS, type TemplateRecord,
} from "@/lib/templates";

// ─── Agentbox › Templates ───────────────────────────────────────────────────
// Templates cost nothing, so nothing here is money. The header carries the
// three numbers that actually give someone a reason to clean up — count against
// the tier limit, build time left this month, and (per row) how long until an
// unused template is archived. That archive countdown is doing the job a
// storage charge would otherwise do, without charging anyone.
//
// Deliberately absent: a Size column. It is the first step back toward billing
// for storage, and the byte count is not available anyway.

function QuotaStat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, letterSpacing: "0.03em" }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: warn ? C.warn : C.fg, whiteSpace: "nowrap" }}>{value}</span>
      {sub && <span style={{ fontFamily: FONT, fontSize: 10.5, color: C.muted }}>{sub}</span>}
    </div>
  );
}

function StatusCell({ t }: { t: TemplateRecord }) {
  const left = daysToArchive(t);
  const color = t.status === "ready" ? C.ok : t.status === "building" ? C.warn : t.status === "error" ? C.err : C.muted;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", fontFamily: FONT, fontSize: 11.5, color, background: `${color}1f`, border: `1px solid ${color}55`, padding: "2px 9px", borderRadius: 5 }}>
        {t.status === "building" && t.buildingForSec !== undefined
          ? `Building ${buildElapsed(t.buildingForSec)}`
          : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
      </span>
      {/* The nudge that replaces a storage bill: an unused template is going
          away, and here is how long you have to keep it. */}
      {left !== null && left <= ARCHIVE_WARN_DAYS && (
        <span
          title="Templates with no launch for 90 days are archived, then deleted. Launch it or delete it."
          style={{ display: "inline-flex", fontFamily: FONT, fontSize: 11, color: C.warn, background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.4)", padding: "2px 8px", borderRadius: 5, cursor: "help" }}
        >
          Archives in {left} d
        </span>
      )}
      {t.status === "error" && t.buildError && (
        <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>{t.buildError}</span>
      )}
    </span>
  );
}

function RowAction({ label, danger, onClick }: { label: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FONT, fontSize: 11.5, fontWeight: 500,
        background: "transparent", color: danger ? C.err : C.fg,
        border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

/**
 * The quota rejection. Four things, always: which quota, used against limit,
 * what to do, and where to look. Register stays enabled and fails loudly —
 * a greyed button teaches nothing and invites a support ticket.
 */
function QuotaRejected({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "100%", background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 999, background: "rgba(251,191,36,0.16)", border: "1px solid rgba(251,191,36,0.5)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.warn }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v5M12 16h.01" /></svg>
          </span>
          <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>
            Templates {TEMPLATE_QUOTA.used} / {TEMPLATE_QUOTA.allowed}
          </h3>
        </div>
        <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, lineHeight: "19px", margin: 0 }}>
          Delete a template you are not using, or top up to upgrade to{" "}
          <span style={{ color: C.fg }}>{TEMPLATE_QUOTA.nextTier.name}</span> for{" "}
          {TEMPLATE_QUOTA.nextTier.templates} templates.
          <br />
          <span style={{ fontSize: 12 }}>Templates are free — this is a count limit, not a charge.</span>
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, background: "transparent", color: C.fg, border: `1px solid ${C.border}`, padding: "7px 14px", borderRadius: 8, cursor: "pointer" }}>
            View templates
          </button>
          <Link href="/settings/quotas" style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, background: C.lime, color: C.limeText, border: "none", padding: "7px 14px", borderRadius: 8, cursor: "pointer", textDecoration: "none" }}>
            View quota
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Templates() {
  const [rejected, setRejected] = useState(false);
  const buildPct = TEMPLATE_QUOTA.buildHoursUsed / TEMPLATE_QUOTA.buildHoursAllowed;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar />
      <Navbar />
      <div style={{ marginLeft: 210, paddingTop: 40 }}>
        <div style={{ padding: "22px 24px 60px" }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>Templates</h1>
              <V2Badge title="New in V2 — templates get their own page, with the quota that governs them." />
            </div>
            <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: "4px 0 0" }}>
              The image each Agent launches sandboxes from. Building and storing them is free.
            </p>
          </div>

          {/* Usage, not money. These three are what make someone tidy up. */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 26, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 9, padding: "11px 18px" }}>
            <QuotaStat label="Templates" value={`${TEMPLATE_QUOTA.used} / ${TEMPLATE_QUOTA.allowed}`} warn={templatesAtLimit()} />
            <QuotaStat label="Build time this month" value={`${TEMPLATE_QUOTA.buildHoursUsed} / ${TEMPLATE_QUOTA.buildHoursAllowed} h`} sub={`resets ${TEMPLATE_QUOTA.buildResets}`} warn={buildPct >= 0.8} />
            <QuotaStat label="Storage" value="Free" sub="no size limit" />
            <span
              title="Template storage is free. When you hit the count limit, delete a template you are not using."
              style={{ display: "inline-flex", alignItems: "center", color: C.muted, cursor: "help", marginTop: 14 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            </span>
          </div>
        </header>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          {/* Never disabled — it fails with a reason instead. */}
          <button
            onClick={() => (templatesAtLimit() ? setRejected(true) : undefined)}
            style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, background: C.lime, color: C.limeText, border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}
          >
            Register template
          </button>
        </div>

        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Version", "Status", "Last launched", "Created"].map((h) => (
                  <th key={h} style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 500, color: C.muted, padding: "13px 18px", textAlign: "left" }}>{h}</th>
                ))}
                <th style={{ padding: "13px 18px", width: 220 }} />
              </tr>
            </thead>
            <tbody>
              {TEMPLATES.filter((t) => !t.deletedAt).map((t) => (
                <tr key={t.id}>
                  <td style={{ fontFamily: FONT, fontSize: 13.5, color: C.fg, padding: "15px 18px", borderTop: `1px solid ${C.borderSoft}`, whiteSpace: "nowrap" }}>
                    {t.name}
                    <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{t.id}</div>
                  </td>
                  <td style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted, padding: "15px 18px", borderTop: `1px solid ${C.borderSoft}` }}>{t.version}</td>
                  <td style={{ padding: "15px 18px", borderTop: `1px solid ${C.borderSoft}` }}><StatusCell t={t} /></td>
                  <td style={{ fontFamily: FONT, fontSize: 13, color: C.muted, padding: "15px 18px", borderTop: `1px solid ${C.borderSoft}`, whiteSpace: "nowrap" }}>
                    {t.status === "building" ? "—" : relativeDay(t.lastLaunch)}
                  </td>
                  <td style={{ fontFamily: FONT, fontSize: 13, color: C.muted, padding: "15px 18px", borderTop: `1px solid ${C.borderSoft}` }}>
                    {t.createdAt.slice(5).replace("-", "/")}
                  </td>
                  <td style={{ padding: "15px 18px", borderTop: `1px solid ${C.borderSoft}`, textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end", whiteSpace: "nowrap" }}>
                      {t.status === "building" ? (
                        <RowAction label="View logs" />
                      ) : t.status === "error" ? (
                        <><RowAction label="Rebuild" /><RowAction label="Delete" danger /></>
                      ) : (
                        <><RowAction label="Launch" /><RowAction label="Rebuild" /><RowAction label="Delete" danger /></>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted, margin: "12px 0 0", lineHeight: "17px" }}>
          A template with no launch for 90 days is archived, then deleted.{" "}
          <Link href="/settings/quotas" style={{ color: C.link, textDecoration: "none" }}>Quotas →</Link>
        </p>
        </div>
      </div>

      {rejected && <QuotaRejected onClose={() => setRejected(false)} />}
    </div>
  );
}
