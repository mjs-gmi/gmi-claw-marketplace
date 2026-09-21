import { Fragment, useMemo, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { C, FONT, MONO } from "@/lib/tokens";
import V2Badge from "@/components/V2Badge";
import {
  BILLING_ITEMS, ITEM_LABEL, ITEM_COLOR, ITEM_BLURB, ACCOUNT_LEVEL, RATE,
  money2, money4, rate6, round4, sumRounded, specDetail, durationLabel,
  type BillingItem,
} from "@/lib/billingModel";
import {
  USAGE_PERIOD, BILLING_MONTH, DATA_AS_OF, ACCOUNT_DISCOUNT,
  INFERENCE_MODELS, INFERENCE_MODELS_MORE, INFERENCE_TOTAL, INFERENCE_ROWS,
  STUDIO_TOTAL, STUDIO_ROWS, inferenceSeries,
  SANDBOXES, sandboxById, sandboxTotal, sandboxItemTotal, segmentAmount,
  segmentBreakdown, isAccruing, itemTotal, periodTotal,
  snapshotsFor, snapshotCost, snapshotGBmo, templateGBmo, egressUsedGB,
  snapshotBillableGBmo, templateBillableGBmo, egressBillableGB,
  SNAPSHOT_FREE_GB, TEMPLATE_FREE_GB, EGRESS_FREE_GB,
  usd, type UsageScope, type SandboxState,
} from "@/lib/billingUsage";

// ─── Settings › Usage & Billing ─────────────────────────────────────────────
// Modelled on the live console. Three scopes share one screen: Inference and
// Studio meter tokens, Agentbox meters two different things on two different
// clocks — container time and model tokens — and keeping those apart is the
// whole point of the Agentbox view. On this account one agent's token spend is
// forty thousand times its container spend, so a single "total" column would
// hide the only fact worth acting on.

const SETTINGS_NAV = [
  { key: "general",  label: "General" },
  { key: "keys",     label: "API Keys" },
  { key: "usage",    label: "Usage & Billing" },
  { key: "referral", label: "Referral Program" },
  { key: "routing",  label: "Routing Settings" },
];

const BILLING_TABS = ["Usage", "Credits & Payment", "Coupons", "Orders", "Invoices"] as const;
type BillingTab = (typeof BILLING_TABS)[number];

const RANGES = ["24hr", "7d", "30d"] as const;

// ── shared bits ─────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "18px 20px", ...style }}>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value, options, onChange, size = "md",
}: { value: T; options: readonly T[]; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.04)", borderRadius: 7, padding: 2, gap: 2 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            style={{
              fontFamily: FONT, fontSize: size === "sm" ? 12 : 13, fontWeight: on ? 600 : 500,
              padding: size === "sm" ? "4px 11px" : "6px 14px", borderRadius: 5, border: "none",
              background: on ? "#0d0d0d" : "transparent",
              color: on ? C.fg : C.muted, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Dropdown({ value, options, onChange, width = 190 }: {
  value: string; options: string[]; onChange: (v: string) => void; width?: number;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width, background: C.pillBg, border: `1px solid ${C.border}`, color: C.fg,
        fontFamily: FONT, fontSize: 13, padding: "8px 11px", borderRadius: 8,
        outline: "none", cursor: "pointer",
      }}
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ExportButton() {
  return (
    <button
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        fontFamily: FONT, fontSize: 13, fontWeight: 500,
        background: C.pillBg, color: C.fg, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "8px 14px", cursor: "pointer",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      Export
    </button>
  );
}

const thStyle: React.CSSProperties = {
  fontFamily: FONT, fontSize: 12.5, fontWeight: 500, color: C.muted,
  padding: "13px 18px", textAlign: "left",
};
const tdStyle: React.CSSProperties = {
  fontFamily: FONT, fontSize: 13.5, color: C.fg,
  padding: "16px 18px", borderTop: `1px solid ${C.borderSoft}`,
};

function Chevron() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ── Inference / Studio ──────────────────────────────────────────────────────
function InferenceChart() {
  const series = useMemo(() => inferenceSeries(), []);
  const max = Math.max(...series.map((d) => d.slices.reduce((a, s) => a + s.amount, 0)));
  const H = 130;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        {/* Axis. Three labels is enough: the chart exists to show one spike. */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: H, fontFamily: FONT, fontSize: 11, color: C.muted, flexShrink: 0 }}>
          <span>$20,000</span><span>$10,000</span><span>$0</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end", gap: 3, height: H, borderBottom: `1px solid ${C.border}` }}>
          {series.map((d) => {
            const total = d.slices.reduce((a, s) => a + s.amount, 0);
            return (
              <div
                key={d.date}
                title={`${d.date} · ${usd(total)}`}
                style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column-reverse", height: `${(total / max) * 100}%`, minHeight: 2 }}
              >
                {d.slices.map((s) => (
                  <div key={s.model} style={{ background: s.color, height: `${(s.amount / total) * 100}%` }} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 3, marginLeft: 64, marginTop: 7 }}>
        {series.map((d, i) => (
          <span key={d.date} style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 9.5, color: C.muted, textAlign: "center", transform: "rotate(-45deg)", transformOrigin: "center", whiteSpace: "nowrap" }}>
            {i % 1 === 0 ? d.date : ""}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "7px 16px", marginTop: 22 }}>
        {INFERENCE_MODELS.map((m) => (
          <span key={m.model} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 11.5, color: C.fg }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }} />
            {m.model}
          </span>
        ))}
        <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted }}>and {INFERENCE_MODELS_MORE} more</span>
      </div>
    </div>
  );
}

function TokenScopeView({ total, rows }: { total: number; rows: typeof INFERENCE_ROWS }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("30d");
  return (
    <>
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: C.fg, letterSpacing: "-0.01em" }}>
              Total Amount: {usd(total)}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 3 }}>
              {USAGE_PERIOD.from} – {USAGE_PERIOD.to}
            </div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Dropdown value="All Model Types" options={["All Model Types", "LLM", "Multimodal", "Embedding"]} onChange={() => {}} />
            <Segmented value={range} options={RANGES} onChange={setRange} size="sm" />
          </div>
        </div>
        <InferenceChart />
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "18px 0 12px" }}>
        <Dropdown value="All Category" options={["All Category", "Dedicated", "Serverless"]} onChange={() => {}} width={175} />
        <Dropdown value="All Model Types" options={["All Model Types", "LLM", "Multimodal"]} onChange={() => {}} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.pillBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 13px", fontFamily: MONO, fontSize: 12.5, color: C.fg }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 3v3M16 3v3" /></svg>
          09/01/2025 - 09/21/2026
        </span>
        <span style={{ marginLeft: "auto" }}><ExportButton /></span>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Model Type</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
              <th style={{ ...thStyle, width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.time}-${r.category}-${r.modelType}-${i}`}>
                <td style={tdStyle}>{r.time}</td>
                <td style={tdStyle}>{r.category}</td>
                <td style={tdStyle}>{r.modelType}</td>
                <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{usd(r.amount)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}><Chevron /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Agentbox ────────────────────────────────────────────────────────────────
// §4 — two aggregations must both be reachable, because they answer different
// questions: "which sandbox cost me money" and "what did I spend it on". The
// second is the only place Template storage and Egress can appear at all, since
// neither belongs to a sandbox.
type AgentboxView = "sandbox" | "item";

function AllowanceBar({ label, used, free, unit, note }: {
  label: string; used: number; free: number; unit: string; note?: string;
}) {
  const pct = Math.min(100, (used / free) * 100);
  const over = used > free;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: FONT, fontSize: 12.5, color: C.fg }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: over ? C.warn : C.muted }}>
          {used.toFixed(used < 10 ? 1 : 0)} / {free} {unit}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: over ? C.warn : C.lime }} />
      </div>
      {note && <span style={{ fontFamily: FONT, fontSize: 11, color: over ? C.warn : C.muted, lineHeight: "15px" }}>{note}</span>}
    </div>
  );
}

function BillingEmptyState() {
  return (
    <Card>
      <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, marginBottom: 4 }}>
        No Agentbox usage yet
      </div>
      <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "0 0 16px", lineHeight: "18px" }}>
        These are the five things Agentbox bills for. Nothing else is charged — registering a template and building it are free.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {BILLING_ITEMS.map((it) => (
          <div key={it} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: ITEM_COLOR[it], flexShrink: 0, marginTop: 5 }} />
            <div>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, color: C.fg }}>{ITEM_LABEL[it]}</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "17px" }}>{ITEM_BLURB[it]}</div>
            </div>
          </div>
        ))}
      </div>
      <a href="/plans" style={{ display: "inline-block", marginTop: 16, fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: C.lime, textDecoration: "none" }}>
        See full pricing →
      </a>
    </Card>
  );
}

function Agentbox({ onOpen }: { onOpen: (id: string) => void }) {
  const [view, setView] = useState<AgentboxView>("sandbox");
  const [range, setRange] = useState<string>(BILLING_MONTH.label);
  const [stateFilter, setStateFilter] = useState("All states");

  const total = periodTotal();
  const itemTotals = BILLING_ITEMS.map((it) => ({ item: it, amount: itemTotal(it) }));
  const maxItem = Math.max(...itemTotals.map((x) => x.amount), 0.0001);

  const rows = useMemo(() => {
    const list = [...SANDBOXES].sort((a, b) => sandboxTotal(b) - sandboxTotal(a));
    if (stateFilter === "All states") return list;
    return list.filter((s) => s.state === stateFilter.toLowerCase());
  }, [stateFilter]);

  const maxSandbox = Math.max(...SANDBOXES.map(sandboxTotal), 0.0001);
  const accruing = SANDBOXES.filter(isAccruing).length;

  if (SANDBOXES.length === 0) return <BillingEmptyState />;

  return (
    <>
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.fg }}>
              Total · <span style={{ fontFamily: MONO }}>{money2(total)}</span>
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 3 }}>
              {BILLING_MONTH.label} · {BILLING_MONTH.start} – {BILLING_MONTH.end}
              {accruing > 0 && (
                <> · <span style={{ color: C.warn }}>{accruing} sandbox{accruing === 1 ? "" : "es"} still accruing</span></>
              )}
            </div>
          </div>
          <Segmented value={range} options={[BILLING_MONTH.label, "30d", "7d", "24hr"]} onChange={setRange} size="sm" />
        </div>

        {/* §2.1 — the legend is the five billing items now, not models. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {itemTotals.map(({ item, amount }) => (
            <div key={item} style={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr) 110px", gap: 14, alignItems: "center" }}>
              <span style={{ fontFamily: FONT, fontSize: 13, color: C.fg, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ITEM_BLURB[item]}>
                {ITEM_LABEL[item]}
              </span>
              <div style={{ height: 11, borderRadius: 2, background: "rgba(255,255,255,0.03)" }}>
                <div style={{ width: `${(amount / maxItem) * 100}%`, height: "100%", background: ITEM_COLOR[item], borderRadius: 2, minWidth: amount > 0 ? 3 : 0 }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 13, color: amount > 0 ? C.fg : C.muted, textAlign: "right" }}>{money2(amount)}</span>
            </div>
          ))}
        </div>

        {/* §4 — allowance and estimated charge only make sense for a whole
            calendar month at account scope. Anything narrower is usage only,
            and the page says which it is showing. */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.borderSoft}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>Free allowances</span>
            <Link href="/settings/quotas" style={{ fontFamily: FONT, fontSize: 12, color: C.link, textDecoration: "none" }}>Quotas →</Link>
          </div>
          {range === BILLING_MONTH.label ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20 }}>
              <AllowanceBar label="Snapshot storage" used={snapshotGBmo} free={SNAPSHOT_FREE_GB} unit="GB·mo"
                note={snapshotBillableGBmo > 0 ? `${snapshotBillableGBmo.toFixed(1)} GB·mo billable` : "Within the free allowance"} />
              <AllowanceBar label="Template storage" used={templateGBmo} free={TEMPLATE_FREE_GB} unit="GB·mo"
                note={templateBillableGBmo > 0 ? `${templateBillableGBmo.toFixed(2)} GB·mo billable` : "Within the free allowance"} />
              <AllowanceBar label="Egress" used={egressUsedGB} free={EGRESS_FREE_GB} unit="GB"
                note={`Resets ${BILLING_MONTH.end.slice(0, 10)} · inbound is always free`} />
            </div>
          ) : (
            <span style={{ display: "flex", alignItems: "flex-start", gap: 7, fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "17px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              Allowance and estimated charge are shown for the full month at account level. This range shows usage only.
            </span>
          )}
        </div>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px", flexWrap: "wrap" }}>
        <Segmented value={view === "sandbox" ? "By sandbox" : "By billing item"}
                   options={["By sandbox", "By billing item"] as const}
                   onChange={(v) => setView(v === "By sandbox" ? "sandbox" : "item")} size="sm" />
        {view === "sandbox" && (
          <Dropdown value={stateFilter} options={["All states", "Running", "Paused", "Deleted"]} onChange={setStateFilter} width={160} />
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted }}>Data updated as of {DATA_AS_OF}</span>
          <ExportButton />
        </span>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {view === "sandbox" ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Sandbox</th>
                <th style={thStyle}>Template</th>
                <th style={thStyle}>Spec</th>
                <th style={thStyle}>State</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Running</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Paused</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                <th style={{ ...thStyle, width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((sb) => (
                <tr
                  key={sb.id}
                  onClick={() => onOpen(sb.id)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(221,234,77,0.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "inline-block", width: 3, height: 26, borderRadius: 2, background: `${(sandboxTotal(sb) / maxSandbox) > 0.5 ? C.lime : C.border}` }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sb.name}</div>
                        <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{sb.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: C.muted }}>{sb.templateName}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>
                    {/* §2.1 — a short code for a standard spec, quantities for a
                        custom one, because a custom spec has no code to show. */}
                    {sb.legacy ? sb.legacy.instanceType : sb.productName ?? specDetail(sb.spec)}
                  </td>
                  <td style={tdStyle}><StateChip state={sb.state} /></td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money2(sandboxItemTotal(sb, "running"))}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: sandboxItemTotal(sb, "paused") > 0 ? C.fg : C.muted }}>
                    {money2(sandboxItemTotal(sb, "paused"))}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>
                    {money2(sandboxTotal(sb))}
                    {isAccruing(sb) && <div style={{ fontFamily: FONT, fontSize: 10.5, color: C.warn }}>In progress</div>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}><Chevron /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Billing item</th>
                <th style={thStyle}>Scope</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Quantity</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Unit price</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {itemTotals.map(({ item, amount }) => (
                <tr key={item}>
                  <td style={tdStyle}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: ITEM_COLOR[item] }} />
                      {ITEM_LABEL[item]}
                    </span>
                    <div style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted, marginTop: 2 }}>{ITEM_BLURB[item]}</div>
                  </td>
                  {/* §4 — Template storage and Egress are account-level: they
                      have no sandbox, and saying so is the point of this view. */}
                  <td style={{ ...tdStyle, color: C.muted }}>
                    {ACCOUNT_LEVEL.includes(item) ? "Account" : `${SANDBOXES.filter((s) => sandboxItemTotal(s, item) > 0).length} sandboxes`}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: C.muted }}>{itemQuantity(item)}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: C.muted }}>{itemUnitPrice(item)}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money2(amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function itemQuantity(item: BillingItem): string {
  switch (item) {
    case "running":
    case "paused": {
      const secs = SANDBOXES.flatMap((s) => s.segments).filter((sg) => sg.state === item).reduce((a, sg) => a + sg.seconds, 0);
      return `${(secs / 3600).toFixed(2)} h`;
    }
    case "snapshot_storage":  return `${snapshotBillableGBmo.toFixed(2)} GB·mo billable`;
    case "template_storage":  return `${templateBillableGBmo.toFixed(2)} GB·mo billable`;
    case "egress":            return `${egressBillableGB.toFixed(2)} GB billable`;
  }
}
function itemUnitPrice(item: BillingItem): string {
  switch (item) {
    case "running":          return "per resource";
    case "paused":           return `${rate6(RATE.diskGBHr)}/GB·h`;
    case "snapshot_storage":
    case "template_storage": return `${rate6(RATE.storageGBMonth)}/GB·mo`;
    case "egress":           return `${rate6(RATE.egressGB)}/GB`;
  }
}

function StateChip({ state }: { state: SandboxState }) {
  const color = state === "running" ? C.ok : state === "paused" ? "#60a5fa" : state === "error" ? C.err : C.muted;
  return (
    <span style={{ display: "inline-flex", fontFamily: FONT, fontSize: 11.5, color, background: `${color}1f`, border: `1px solid ${color}55`, padding: "2px 9px", borderRadius: 5 }}>
      {state}
    </span>
  );
}

// ── Sandbox detail (§5) ─────────────────────────────────────────────────────
// A chronological timeline, not a session list. One sandbox has many segments,
// so what used to be per-row constants — region, spec, instance type — move to
// the header, and each row becomes a stretch of time in one state. Running
// segments expand into vCPU / memory / disk, which is the only way a custom
// spec's price can be reconciled: there is no product code to look it up by.
function SandboxDetail({ sandboxId }: { sandboxId: string }) {
  const [tab, setTab] = useState<"Segments" | "Snapshots">("Segments");
  const [open, setOpen] = useState<string | null>(null);
  const sb = sandboxById(sandboxId);
  if (!sb) return <div style={{ fontFamily: FONT, color: C.muted }}>No usage recorded for this sandbox.</div>;

  const snaps = snapshotsFor(sb.id);
  const total = sandboxTotal(sb);
  const snapTotal = sumRounded(snaps.map(snapshotCost));

  const field = (k: string, v: React.ReactNode) => (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted }}>{k}</span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.fg }}>{v}</span>
    </span>
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>{sb.name}</h1>
            <StateChip state={sb.state} />
          </div>
          {/* Everything constant across segments lives here, not in a column. */}
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 8 }}>
            {field("Sandbox", sb.id)}
            {field("Template", `${sb.templateName} · ${sb.templateId.slice(0, 8)}…`)}
            {field("Spec", sb.legacy ? sb.legacy.instanceType : sb.productName ? `${sb.productName} · ${specDetail(sb.spec)}` : specDetail(sb.spec))}
            {field("Region", sb.region)}
            {field("Created", sb.created)}
            {sb.deleted && field("Deleted", sb.deleted)}
          </div>
          {sb.legacy && (
            // §9 — a pre-redesign row cannot be broken down, and saying so is
            // better than showing three zeroes that look like a bug.
            <div style={{ marginTop: 10, display: "inline-flex", alignItems: "flex-start", gap: 7, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.borderSoft}`, borderRadius: 7, padding: "7px 11px", fontFamily: FONT, fontSize: 11.5, color: C.muted, lineHeight: "16px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              Pre-redesign billing, charged by container duration. Paused, storage and egress were not metered for this period.
            </div>
          )}
        </div>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 13, fontWeight: 500, background: C.pillBg, color: C.fg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, margin: "22px 0 14px", flexWrap: "wrap" }}>
        <Segmented value={tab} options={["Segments", "Snapshots"] as const} onChange={setTab} size="sm" />
        <span style={{ fontFamily: FONT, fontSize: 13, color: C.muted }}>
          {BILLING_MONTH.label} total: <span style={{ fontFamily: MONO, color: C.fg }}>{money4(tab === "Segments" ? total : snapTotal)}</span>
        </span>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {tab === "Segments" ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 34 }} />
                <th style={thStyle}>Segment</th>
                <th style={thStyle}>Start</th>
                <th style={thStyle}>End</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Duration</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sb.segments.map((sg) => {
                const amount = segmentAmount(sb, sg);
                const expandable = !sb.legacy;
                const isOpen = open === sg.id;
                return (
                  <Fragment key={sg.id}>
                    <tr
                      onClick={() => expandable && setOpen(isOpen ? null : sg.id)}
                      style={{ cursor: expandable ? "pointer" : "default" }}
                    >
                      <td style={{ ...tdStyle, paddingRight: 0 }}>
                        {expandable && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                               style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: sg.state === "running" ? ITEM_COLOR.running : ITEM_COLOR.paused }} />
                          {sg.state === "running" ? "Running" : "Paused"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{sg.start}</td>
                      <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5, color: sg.end ? C.fg : C.warn }}>
                        {sg.end ?? "In progress"}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{durationLabel(sg.seconds)}</td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money4(amount)}</td>
                    </tr>
                    {isOpen && segmentBreakdown(sb, sg).map((b) => (
                      <tr key={b.label} style={{ background: "rgba(255,255,255,0.02)" }}>
                        <td style={{ ...tdStyle, borderTop: "none" }} />
                        <td style={{ ...tdStyle, borderTop: "none", color: C.muted, paddingLeft: 26 }}>{b.label}</td>
                        <td style={{ ...tdStyle, borderTop: "none", color: C.muted, fontFamily: MONO, fontSize: 12 }} colSpan={2}>{b.qty}</td>
                        <td style={{ ...tdStyle, borderTop: "none" }} />
                        <td style={{ ...tdStyle, borderTop: "none", fontFamily: MONO, textAlign: "right", color: C.muted }}>{money4(b.amount)}</td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : snaps.length === 0 ? (
          <div style={{ padding: "26px 18px", fontFamily: FONT, fontSize: 13, color: C.muted }}>
            No snapshots were taken from this sandbox.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Snapshot</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Size</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Age</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Stored</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Period cost</th>
              </tr>
            </thead>
            <tbody>
              {snaps.map((s) => (
                <tr key={s.id}>
                  <td style={tdStyle}>
                    {s.name}
                    <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{s.id}</div>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{s.sizeGB} GB</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{s.ageDays} d</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{(s.sizeGB * s.storedHours).toLocaleString()} GB·h</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money4(snapshotCost(s))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* §10 — billed amount by default, list and discount in detail. */}
      {ACCOUNT_DISCOUNT > 0 && tab === "Segments" && (
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 24, fontFamily: FONT, fontSize: 12, color: C.muted }}>
          <span>List <span style={{ fontFamily: MONO, color: C.fg }}>{money4(total)}</span></span>
          <span>Discount <span style={{ fontFamily: MONO, color: C.fg }}>{(ACCOUNT_DISCOUNT * 100).toFixed(0)}%</span></span>
          <span>Billed <span style={{ fontFamily: MONO, color: C.fg }}>{money4(round4(total * (1 - ACCOUNT_DISCOUNT)))}</span></span>
        </div>
      )}
    </>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function UsageBilling() {
  const [, setLocation] = useLocation();
  // §5 — a sandbox detail is its own URL, so a charge someone is questioning
  // can be linked to directly rather than described.
  const [matchSandbox, params] = useRoute("/settings/usage/agentbox/:sandboxId");
  const sandboxId = matchSandbox ? params?.sandboxId : undefined;

  const [side, setSide] = useState<"Inference" | "Compute">("Inference");
  const [tab, setTab] = useState<BillingTab>("Usage");
  const [scope, setScope] = useState<UsageScope>(sandboxId ? "agentbox" : "inference");

  const crumbs: { label: string; href?: string }[] = sandboxId
    ? [
        { label: "Usage & Billing", href: "/settings/usage" },
        { label: "Usage", href: "/settings/usage" },
        { label: "Agentbox", href: "/settings/usage" },
        { label: sandboxById(sandboxId)?.name ?? sandboxId },
      ]
    : [{ label: "Usage & Billing", href: "/settings/usage" }, { label: "Usage" }];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, display: "flex" }}>
      {/* Settings sidebar — this screen replaces the app nav rather than nesting
          inside it, which is how the live console behaves. */}
      <aside style={{ width: 256, flexShrink: 0, borderRight: `1px solid ${C.border}`, padding: "18px 14px", display: "flex", flexDirection: "column", gap: 18 }}>
        <Link
          href="/dashboard"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.muted, textDecoration: "none", fontFamily: FONT, fontSize: 13 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </Link>
        <h2 style={{ fontFamily: FONT, fontSize: 19, fontWeight: 600, color: C.fg, margin: "0 0 0 6px" }}>Settings</h2>
        <Segmented value={side} options={["Inference", "Compute"] as const} onChange={setSide} />
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SETTINGS_NAV.map((n) => {
            const on = n.key === "usage";
            return (
              <span
                key={n.key}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  fontFamily: FONT, fontSize: 13.5, fontWeight: on ? 600 : 500,
                  color: on ? C.lime : C.fg,
                  padding: "8px 10px", borderRadius: 7,
                  cursor: on ? "default" : "not-allowed",
                  opacity: on ? 1 : 0.75,
                }}
                title={on ? undefined : "Not part of this prototype"}
              >
                <span style={{ width: 16, display: "inline-flex", color: on ? C.lime : C.muted }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {n.key === "usage"
                      ? <><path d="M3 3v18h18" /><path d="M7 15v-4M12 15V7M17 15v-6" /></>
                      : <circle cx="12" cy="12" r="8" />}
                  </svg>
                </span>
                {n.label}
              </span>
            );
          })}
        </nav>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 22px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}>
            {crumbs.map((c, i) => (
              <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                {i > 0 && <span style={{ color: C.borderSoft }}>›</span>}
                {c.href && i < crumbs.length - 1 ? (
                  <Link href={c.href} style={{ fontFamily: FONT, fontSize: 13.5, color: C.muted, textDecoration: "none" }}>{c.label}</Link>
                ) : (
                  <span style={{ fontFamily: FONT, fontSize: 13.5, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                )}
              </span>
            ))}
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 13, color: C.fg, background: C.pillBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 11px" }}>🎁 $0</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 13, color: C.fg, background: C.pillBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 11px" }}>
            <span style={{ color: C.lime }}>⚡</span> $52.27M
          </span>
          <span style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(167,139,250,0.2)", border: "1px solid rgba(167,139,250,0.45)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 12, fontWeight: 600, color: "#c7a7ff" }}>M</span>
        </header>

        {/* Billing tabs */}
        <div style={{ display: "flex", gap: 4, padding: "0 22px", borderBottom: `1px solid ${C.border}` }}>
          {BILLING_TABS.map((t) => {
            const on = t === tab;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  fontFamily: FONT, fontSize: 13.5, fontWeight: on ? 600 : 500,
                  background: "transparent", border: "none",
                  borderBottom: `2px solid ${on ? C.fg : "transparent"}`,
                  color: on ? C.fg : C.muted,
                  padding: "13px 12px", marginBottom: -1, cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "22px 22px 48px", maxWidth: 1320 }}>
          {tab !== "Usage" ? (
            <div style={{ fontFamily: FONT, fontSize: 13.5, color: C.muted, padding: "40px 0" }}>
              {tab} is part of the existing Console and is not rebuilt in this prototype.
            </div>
          ) : sandboxId ? (
            <SandboxDetail sandboxId={sandboxId} />
          ) : (
            <>
              <h1 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>Usage</h1>
              <p style={{ fontFamily: FONT, fontSize: 13.5, color: C.muted, margin: "6px 0 16px" }}>
                Usage across Inference, Studio and Agentbox.
              </p>
              <div style={{ marginBottom: 18, display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Segmented
                  value={scope === "inference" ? "Inference" : scope === "studio" ? "Studio" : "Agentbox"}
                  options={["Inference", "Studio", "Agentbox"] as const}
                  onChange={(v) => setScope(v === "Inference" ? "inference" : v === "Studio" ? "studio" : "agentbox")}
                />
                {scope === "agentbox" && <V2Badge />}
              </div>

              {scope === "inference" && <TokenScopeView total={INFERENCE_TOTAL} rows={INFERENCE_ROWS} />}
              {scope === "studio"    && <TokenScopeView total={STUDIO_TOTAL} rows={STUDIO_ROWS} />}
              {scope === "agentbox"  && (
                <Agentbox onOpen={(id) => setLocation(`/settings/usage/agentbox/${encodeURIComponent(id)}`)} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
