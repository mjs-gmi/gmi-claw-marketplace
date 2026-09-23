import { Link } from "wouter";
import { C, FONT, MONO } from "@/lib/tokens";
import V2Badge from "@/components/V2Badge";
import V21Badge from "@/components/V21Badge";
import { TIERS, RATE, rate6, type TierId } from "@/lib/billingModel";
import {
  ACCOUNT_TIER, QUOTA, BILLING_MONTH, SANDBOXES, isAccruing, agentById,
  SNAPSHOT_FREE_GB,
} from "@/lib/billingUsage";

// ─── Settings › Quotas & account tier (§P4) ─────────────────────────────────
// One click from every rejection. The distinction the page exists to make:
// hitting a quota REFUSES the request — it never bills you. A build that runs
// out of quota is turned away, not charged, and the old page had no surface
// that could say so.
//
// Placement is still open with Console (§P4 header). The logic here holds
// wherever it lands, which is why it is built as a standalone page rather than
// wired into a tab that may not exist.

function Row({ label, used, limit, note, warn, v21 }: {
  label: string; used: string; limit: string; note?: React.ReactNode; warn?: boolean; v21?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, padding: "13px 0", borderTop: `1px solid ${C.borderSoft}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 13.5, color: C.fg }}>
          {label}{v21 && <V21Badge />}
        </div>
        {note && <div style={{ fontFamily: FONT, fontSize: 11.5, color: warn ? C.warn : C.muted, marginTop: 3, lineHeight: "16px" }}>{note}</div>}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 13, color: warn ? C.warn : C.fg, whiteSpace: "nowrap", textAlign: "right" }}>
        {used} <span style={{ color: C.muted }}>/ {limit}</span>
      </div>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px 6px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
        <h2 style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: C.fg, margin: 0 }}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default function Quotas() {
  const tier = TIERS[ACCOUNT_TIER as TierId];
  const buildPct = QUOTA.buildHoursUsed / QUOTA.buildHoursAllowed;
  const tplPct = QUOTA.templatesUsed / QUOTA.templatesAllowed;
  const order: TierId[] = ["tier1", "tier2", "tier3", "tier4", "tier5"];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, padding: "26px 26px 60px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link href="/settings/usage" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 13, color: C.muted, textDecoration: "none" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Usage &amp; Billing
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 4px" }}>
          <h1 style={{ fontFamily: FONT, fontSize: 23, fontWeight: 700, color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>
            Quotas &amp; account tier
          </h1>
          <V2Badge title="New in V2 — quotas, tiers and allowances had no surface before." />
        </div>
        <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: "0 0 20px" }}>
          Limits on what you can run at once. Hitting one refuses the request — <span style={{ color: C.fg }}>nothing here bills you</span>.
        </p>

        <Section
          title="Your tier"
          aside={<span style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: C.lime, background: "rgba(221,234,77,0.12)", border: "1px solid rgba(221,234,77,0.4)", padding: "2px 9px", borderRadius: 5 }}>{tier.id}</span>}
        >
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "0 0 10px", lineHeight: "18px" }}>
            {tier.condition}. Tier follows <span style={{ color: C.fg }}>settled top-up</span>, not a card on file, and changes
            quotas only — never prices. A chargeback returns the account to tier1 and freezes new sandboxes.
          </p>
          {/* The ladder, so "what do I get if I top up" is answerable here. */}
          <div style={{ overflowX: "auto", margin: "0 -20px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 660 }}>
              <thead>
                <tr>
                  <th style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 500, color: C.muted, textAlign: "left", padding: "8px 20px" }} />
                  {order.map((t) => (
                    <th key={t} style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 600, color: t === tier.id ? C.lime : C.muted, textAlign: "left", padding: "8px 12px", whiteSpace: "nowrap" }}>
                      {t}{TIERS[t].provisional && <span style={{ color: C.warn }} title="Extrapolated, not yet agreed"> *</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([
                  ["Condition", (t: TierId) => TIERS[t].condition],
                  ["Concurrency", (t: TierId) => `${TIERS[t].concurrencyVcpu} vCPU`],
                  ["Session limit", (t: TierId) => TIERS[t].sessionLimit],
                  ["Build time / month", (t: TierId) => TIERS[t].buildHours],
                  ["Templates", (t: TierId) => TIERS[t].templates],
                ] as const).map(([label, get]) => (
                  <tr key={label}>
                    <td style={{ fontFamily: FONT, fontSize: 12, color: C.muted, padding: "9px 20px", borderTop: `1px solid ${C.borderSoft}`, whiteSpace: "nowrap" }}>{label}</td>
                    {order.map((t) => (
                      <td key={t} style={{ fontFamily: FONT, fontSize: 12, color: t === tier.id ? C.fg : C.muted, padding: "9px 12px", borderTop: `1px solid ${C.borderSoft}` }}>
                        {get(t)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontFamily: FONT, fontSize: 11, color: C.muted, margin: "10px 0 6px" }}>
            <span style={{ color: C.warn }}>*</span> tier4 and tier5 figures are extrapolated and not yet agreed.
          </p>
        </Section>

        <Section title="Concurrency">
          {/* §P4 — paused sandboxes hold quota from 2.0. Pausing frees the
              compute bill, not the seat, and a user at the limit who paused
              everything and still cannot launch needs to read that here. */}
          <Row label="Sandboxes holding quota" used={`${QUOTA.concurrencyUsedVcpu} vCPU`} limit={`${tier.concurrencyVcpu} vCPU`}
               note="Paused sandboxes count toward this — pausing frees compute, not quota." />
          {/* §P4 — the number alone is not actionable. At the limit the question
              is WHICH sandboxes hold it, and the answer belongs here. */}
          <div style={{ paddingBottom: 6 }}>
            {SANDBOXES.filter(isAccruing).map((sb) => (
              <div key={sb.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 0 7px 14px", borderLeft: `2px solid ${C.borderSoft}`, marginLeft: 2 }}>
                <Link href={`/settings/usage/agentbox/${sb.agentId}/${encodeURIComponent(sb.id)}`} style={{ fontFamily: FONT, fontSize: 12.5, color: C.link, textDecoration: "none" }}>
                  {sb.name}
                </Link>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>
                  {agentById(sb.agentId)?.name} · {sb.state} · {sb.spec.vcpu} vCPU
                </span>
              </div>
            ))}
          </div>
          <Row label="Session limit" used="—" limit={tier.sessionLimit}
               note="Maximum life of one sandbox on this tier. What happens at the limit is pending Product." />
        </Section>

        <Section title="Template builds">
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "0 0 4px", lineHeight: "18px" }}>
            Builds are free — their cost is already in the running price. The quota exists to stop templates being built
            and never run, so exhausting it <span style={{ color: C.fg }}>refuses the build; it does not charge you</span>.
          </p>
          {/* §P4 — published in hours at 2 cores. "CPU-hours" is not a unit
              anyone can plan a build around. */}
          <Row label="Build time this month" used={`${QUOTA.buildHoursUsed} h`} limit={`${QUOTA.buildHoursAllowed} h`}
               warn={buildPct >= 0.8}
               note={`At 2 cores. Resets ${QUOTA.buildResets}. On ${tier.id}: ${tier.buildHours}.`} />
          <Row label="Concurrent builds / timeout / cores" used="0" limit={tier.buildConcurrency} />
          <Row label="Image size pre-check" used="—" limit={`${QUOTA.imageSizeCapGB} GB`}
               note="Validated before the build starts, so an oversize image fails fast rather than after a long build." />
        </Section>

        <Section title="Templates and allowances" aside={<span style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted }}>Resets {BILLING_MONTH.end}</span>}>
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "0 0 4px", lineHeight: "18px" }}>
            A cap refuses the request. An allowance does not — usage beyond it is billed at the rate shown.
            Nothing in 2.0 carries an allowance: the first one arrives with Snapshots.
          </p>
          {/* §P4 — templates are capped by COUNT and cost nothing, so this is a
              refusal limit, not an allowance. At the cap Register is rejected
              with "Templates 20 / 20" and the remedy is to delete one or
              upgrade — never an overage charge. */}
          <Row label="Templates" used={`${QUOTA.templatesUsed}`} limit={`${QUOTA.templatesAllowed}`}
               warn={tplPct >= 0.8}
               note={<>
                 Templates are free. At the limit, Register is rejected — delete an unused template or upgrade.{" "}
                 <Link href="/settings/usage" style={{ color: C.link, textDecoration: "none" }}>See templates →</Link>
               </>} />
          <Row label="Image size per build" used="—" limit={`${QUOTA.imageSizeCapGB} GB`}
               note="Checked when a build is submitted. A larger image is refused, not charged." />
          <Row label="Snapshot storage allowance" v21 used="—" limit={`${SNAPSHOT_FREE_GB} GB·mo`}
               note="Snapshots ship in 2.1." />
        </Section>

        <Section title="Approaching archival">
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "0 0 4px", lineHeight: "18px" }}>
            A template with no launch for 90 days is archived, then deleted.{" "}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              Paused sandboxes not resumed for 30 days are archived. <V21Badge />
            </span>
          </p>
          {QUOTA.archivingSoon.map((r) => (
            <div key={r.name} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, padding: "13px 0", borderTop: `1px solid ${C.borderSoft}` }}>
              <div>
                <div style={{ fontFamily: FONT, fontSize: 13.5, color: C.fg }}>{r.name}</div>
                <div style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted, marginTop: 3 }}>{r.kind}</div>
              </div>
              <span style={{ fontFamily: FONT, fontSize: 12.5, color: C.warn, whiteSpace: "nowrap" }}>{r.detail}</span>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}
