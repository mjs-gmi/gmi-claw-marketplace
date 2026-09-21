import { Link } from "wouter";
import V2Badge from "@/components/V2Badge";
import { C, FONT, MONO } from "@/lib/tokens";
import { TIERS, RATE, rate6, money2 } from "@/lib/billingModel";
import {
  ACCOUNT_TIER, QUOTA, BILLING_MONTH,
  snapshotGBmo, templateGBmo, egressUsedGB,
  SNAPSHOT_FREE_GB, TEMPLATE_FREE_GB, EGRESS_FREE_GB,
} from "@/lib/billingUsage";

// ─── Settings › Quotas & account tier (§6) ──────────────────────────────────
// One click from every quota rejection, which is the requirement that decides
// its existence: a rejection that only says "quota exceeded" sends the user to
// support. Every row here names the quota, the current usage, the limit and the
// remedy, so the message can link here and stop explaining.
//
// The distinction this page exists to make: a build quota running out is a
// REFUSAL, not a charge. Nothing on this page bills.

function Row({ label, used, limit, note, warn }: {
  label: string; used: string; limit: string; note?: string; warn?: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, padding: "13px 0", borderTop: `1px solid ${C.borderSoft}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FONT, fontSize: 13.5, color: C.fg }}>{label}</div>
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
  const tier = TIERS[ACCOUNT_TIER];
  const buildPct = QUOTA.buildCpuHoursUsed / QUOTA.buildCpuHoursAllowed;
  const tplPct = QUOTA.templateStorageUsedGB / (tier.templateStorageCapGB as number);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, padding: "26px 26px 60px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
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
          title="Account tier"
          aside={<span style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: C.lime, background: "rgba(221,234,77,0.12)", border: "1px solid rgba(221,234,77,0.4)", padding: "2px 9px", borderRadius: 5 }}>{tier.id}</span>}
        >
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "0 0 4px", lineHeight: "18px" }}>
            {tier.condition}. Top up to <span style={{ color: C.fg, fontFamily: MONO }}>$500</span> cumulative for T2, or contact Sales for a negotiated limit.
          </p>
          <Row label="Concurrency" used={`${QUOTA.concurrencyUsedVcpu} vCPU`} limit={`${tier.concurrencyVcpu} vCPU`}
               note="Paused sandboxes count toward this — pausing frees compute, not quota." />
        </Section>

        <Section title="Template builds">
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "0 0 4px", lineHeight: "18px" }}>
            Builds are free. When the quota is exhausted a build is <span style={{ color: C.fg }}>refused, not charged</span>.
          </p>
          <Row label="Build CPU-hours this month"
               used={`${QUOTA.buildCpuHoursUsed}`} limit={`${QUOTA.buildCpuHoursAllowed} CPU-h`}
               warn={buildPct >= 0.8}
               note={`Resets ${QUOTA.buildResets}. On ${tier.id} the allowance floats: ${tier.buildQuota}.`} />
          <Row label="Concurrent builds" used="0" limit={`${QUOTA.concurrentBuilds}`} />
          <Row label="Timeout per build" used="—" limit={`${QUOTA.buildTimeoutMin} min`} />
          <Row label="Cores per build" used="—" limit={`${QUOTA.buildCores}`} />
        </Section>

        <Section title="Storage caps">
          <Row label="Template storage" used={`${QUOTA.templateStorageUsedGB} GB`} limit={`${tier.templateStorageCapGB} GB`}
               warn={tplPct >= 0.8}
               note={tplPct >= 0.8 ? "Over 80% of the cap — new templates are refused at 100%." : undefined} />
        </Section>

        <Section title="Free allowances" aside={<span style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted }}>Resets {BILLING_MONTH.end}</span>}>
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "0 0 4px", lineHeight: "18px" }}>
            These do not refuse anything. Usage beyond them is billed at the rate shown.
          </p>
          <Row label="Snapshot storage" used={`${snapshotGBmo.toFixed(1)} GB·mo`} limit={`${SNAPSHOT_FREE_GB} GB·mo`}
               warn={snapshotGBmo > SNAPSHOT_FREE_GB}
               note={`Beyond the allowance: ${rate6(RATE.storageGBMonth)}/GB·mo`} />
          <Row label="Template storage" used={`${templateGBmo.toFixed(2)} GB·mo`} limit={`${TEMPLATE_FREE_GB} GB·mo`}
               warn={templateGBmo > TEMPLATE_FREE_GB}
               note={`Beyond the allowance: ${rate6(RATE.storageGBMonth)}/GB·mo`} />
          <Row label="Egress" used={`${egressUsedGB.toFixed(1)} GB`} limit={`${EGRESS_FREE_GB} GB`}
               warn={egressUsedGB > EGRESS_FREE_GB}
               note={`Beyond the allowance: ${rate6(RATE.egressGB)}/GB · inbound is always free`} />
        </Section>

        <Section title="Approaching archival">
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "0 0 4px", lineHeight: "18px" }}>
            Templates with no launch for 90 days are archived then deleted. Paused sandboxes not resumed for 30 days are archived.
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
