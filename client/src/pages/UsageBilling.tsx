import { useMemo, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { C, FONT, MONO } from "@/lib/tokens";
import V2Badge from "@/components/V2Badge";
import V21Badge from "@/components/V21Badge";
import {
  BILLING_ITEMS, ITEM_LABEL, ITEM_COLOR, ITEM_BLURB, V21_ITEMS, RATE,
  money2, money4, rate6, sumRounded, specDetail,
  type BillingItem,
} from "@/lib/billingModel";
import {
  BILLING_MONTH, DATA_AS_OF, MONTH_OPTIONS, BILLING_STARTS, metered,
  INFERENCE_MODELS, INFERENCE_MODELS_MORE, INFERENCE_TOTAL, INFERENCE_ROWS,
  STUDIO_TOTAL, STUDIO_ROWS, inferenceSeries, USAGE_PERIOD,
  SANDBOXES, sandboxById, sandboxRunning, sandboxMinutes, sandboxVersion,
  sandboxesForAgent, templateForAgent, agentRows, agentTotal, agentById,
  MODEL_USAGE, modelUsageFor, modelNet, TEMPLATES, templateCost, templateGBh,
  EGRESS, egressFor, EGRESS_ATTRIBUTABLE, MODEL_USAGE_ATTRIBUTABLE,
  templateGBmo, templateBillableGBmo, egressUsedGB, egressBillableGB,
  TEMPLATE_FREE_GB, EGRESS_FREE_GB, SNAPSHOT_FREE_GB,
  itemTotal, periodListTotal, periodBilledTotal,
  type UsageScope, type SandboxState, type SandboxUsage,
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
                title={`${d.date} · ${money2(total)}`}
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
              Total Amount: {money2(total)}
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
                <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money2(r.amount)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}><Chevron /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── §P3 item drill-downs ────────────────────────────────────────────────────
// Every amount in the by-item view leads somewhere, and each list ends in an
// action. Storage and egress were previously numbers a user could see and not
// act on: they could tell they were over the allowance and had no way to find
// out what was responsible.
function ItemDrilldown({ item, onClose }: { item: BillingItem; onClose: () => void }) {
  const head = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${C.borderSoft}`, background: "rgba(255,255,255,0.02)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: C.fg }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: ITEM_COLOR[item] }} />
        {ITEM_LABEL[item]}
        {V21_ITEMS.includes(item) && <V21Badge />}
      </span>
      <button onClick={onClose} style={{ fontFamily: FONT, fontSize: 12, background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
        Close
      </button>
    </div>
  );
  const del = () => (
    <button style={{ fontFamily: FONT, fontSize: 11.5, fontWeight: 500, background: "transparent", color: C.err, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
      Delete
    </button>
  );
  const notMetered = (what: string) => (
    <div style={{ padding: "20px 18px", fontFamily: FONT, fontSize: 13, color: C.muted, lineHeight: "19px" }}>
      Metering not yet available.{BILLING_STARTS[item] ? ` Billing starts ${BILLING_STARTS[item]}.` : ""}
      <div style={{ marginTop: 6 }}>When it is live, this lists {what}.</div>
    </div>
  );

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginTop: 12 }}>
      {head}

      {item === "template_storage" && (
        !metered("template_storage") ? notMetered("every template with its size, age and cost, and a delete action") : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={thStyle}>Template</th><th style={thStyle}>Agent</th><th style={thStyle}>Version</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Size</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Stored</th>
              <th style={thStyle}>Last launch</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Period cost</th>
              <th style={{ ...thStyle, width: 90 }} />
            </tr></thead>
            <tbody>
              {TEMPLATES.map((t) => (
                <tr key={t.id}>
                  <td style={tdStyle}>{t.name}<div style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{t.id}</div></td>
                  <td style={{ ...tdStyle, color: C.muted }}>
                    {agentById(t.agentId)?.name ?? t.agentId}
                    {t.deleted && <div style={{ fontSize: 11, color: C.warn }}>agent deleted</div>}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO, color: C.muted }}>{t.version}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{t.sizeGB} GB</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: C.muted }}>{templateGBh(t).toLocaleString()} GB·h</td>
                  <td style={{ ...tdStyle, color: C.muted }}>{t.lastLaunch}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money4(templateCost(t))}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{del()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {item === "egress" && (
        !metered("egress") ? notMetered("outbound traffic per sandbox") :
        EGRESS_ATTRIBUTABLE ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={thStyle}>Sandbox</th><th style={thStyle}>Agent</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Outbound</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
            </tr></thead>
            <tbody>
              {EGRESS.map((e) => {
                const sb = sandboxById(e.sandboxId);
                return (
                  <tr key={e.sandboxId}>
                    <td style={tdStyle}>{sb?.name ?? e.sandboxId}<div style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{e.sandboxId}</div></td>
                    <td style={{ ...tdStyle, color: C.muted }}>{sb ? agentById(sb.agentId)?.name : "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{e.bytesGB.toFixed(1)} GB</td>
                    <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: C.muted }}>after allowance</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "20px 18px", fontFamily: FONT, fontSize: 13, color: C.muted, lineHeight: "19px" }}>
            Not attributable by sandbox. Outbound traffic is metered for the account as a whole.
            <div style={{ marginTop: 8 }}>
              <a href="/deploy" style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, color: C.lime, textDecoration: "none" }}>
                Review template network settings →
              </a>
            </div>
          </div>
        )
      )}

      {item === "model_usage" && (
        MODEL_USAGE_ATTRIBUTABLE ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={thStyle}>Sandbox</th><th style={thStyle}>Agent</th><th style={thStyle}>Model</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Tokens</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Credit</th>
            </tr></thead>
            <tbody>
              {MODEL_USAGE.map((m, i) => {
                const sb = sandboxById(m.sandboxId);
                return (
                  <tr key={i}>
                    <td style={tdStyle}>{sb?.name ?? m.sandboxId}</td>
                    <td style={{ ...tdStyle, color: C.muted }}>{sb ? agentById(sb.agentId)?.name : "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{m.model}</td>
                    <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{(m.tokens / 1e6).toFixed(1)}M</td>
                    <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money2(m.amount)}</td>
                    <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: m.creditApplied > 0 ? C.ok : C.muted }}>
                      {m.creditApplied > 0 ? `−${money2(m.creditApplied)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "20px 18px", fontFamily: FONT, fontSize: 13, color: C.muted, lineHeight: "19px" }}>
            Not attributable by sandbox. Model calls are metered for the account as a whole while API key attribution is connected.
          </div>
        )
      )}

      {item === "snapshot_storage" && notMetered("every snapshot with its source sandbox, size and cost")}
      {item === "running" && (
        <div style={{ padding: "18px", fontFamily: FONT, fontSize: 13, color: C.muted }}>
          Broken down by agent — switch to <span style={{ color: C.fg }}>By agent</span> above.
        </div>
      )}
    </div>
  );
}

// ── §P1 Usage list — by agent ───────────────────────────────────────────────
// An agent is the level people think at, and the level both cost chains roll up
// to: its template carries storage, its sandboxes carry runtime, egress and
// model calls. The row shows all four so the shape of the bill is visible
// without opening anything; the detail views are for "which sandbox" and "which
// hour", which are different questions.
type AgentboxView = "agent" | "item";

const V21_MARK = (item: BillingItem) => V21_ITEMS.includes(item);

/** §P1 — a meter that does not exist yet shows "—", never $0. */
function Amount({ value, item }: { value: number | null; item?: BillingItem }) {
  if (value === null) {
    return (
      <span
        title={item ? `Metering not yet available${BILLING_STARTS[item] ? ` — billing starts ${BILLING_STARTS[item]}` : ""}` : "Metering not yet available"}
        style={{ fontFamily: MONO, color: C.muted, cursor: "help" }}
      >
        —
      </span>
    );
  }
  return <span style={{ fontFamily: MONO, color: value > 0 ? C.fg : C.muted }}>{money2(value)}</span>;
}

function VersionTag({ v }: { v: "v1" | "v2" | "v1+v2" }) {
  return (
    <span
      title={v === "v1" ? "Pre-redesign billing, charged by container duration" : v === "v1+v2" ? "Spans the redesign cutover" : undefined}
      style={{
        fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
        color: v === "v2" ? C.muted : C.warn,
        border: `1px solid ${v === "v2" ? C.border : "rgba(251,191,36,0.4)"}`,
        borderRadius: 4, padding: "0 5px", whiteSpace: "nowrap",
      }}
    >
      {v.toUpperCase()}
    </span>
  );
}

function AllowanceBar({ label, used, free, unit, note, v21, unavailable }: {
  label: string; used: number; free: number; unit: string; note?: string; v21?: boolean; unavailable?: boolean;
}) {
  const pct = Math.min(100, (used / free) * 100);
  const over = used > free;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: unavailable ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 12.5, color: C.fg }}>
          {label}{v21 && <V21Badge />}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: unavailable ? C.muted : over ? C.warn : C.muted }}>
          {unavailable ? `— / ${free} ${unit}` : `${used.toFixed(used < 10 ? 1 : 0)} / ${free} ${unit}`}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        {!unavailable && <div style={{ width: `${pct}%`, height: "100%", background: over ? C.warn : C.lime }} />}
      </div>
      <span style={{ fontFamily: FONT, fontSize: 11, color: unavailable ? C.muted : over ? C.warn : C.muted, lineHeight: "15px" }}>
        {unavailable ? "Metering not yet available" : note}
      </span>
    </div>
  );
}

function BillingEmptyState() {
  const live = BILLING_ITEMS.filter((i) => !V21_ITEMS.includes(i));
  return (
    <Card>
      <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, marginBottom: 4 }}>No Agentbox usage yet</div>
      <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "0 0 16px", lineHeight: "18px" }}>
        These are the things Agentbox bills for. Registering a template and building it are free.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {live.map((it) => (
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

function Agentbox({ onOpenAgent }: { onOpenAgent: (id: string) => void }) {
  const [view, setView] = useState<AgentboxView>("agent");
  const [range, setRange] = useState<string>(BILLING_MONTH.label);
  const [openItem, setOpenItem] = useState<BillingItem | null>(null);

  const rows = useMemo(() => agentRows(), []);
  const listTotal = periodListTotal();
  const billed = periodBilledTotal();
  const max = Math.max(...rows.map(agentTotal), 0.0001);
  const accruing = rows.filter((a) => a.accruing).length;
  const wholeMonth = range === BILLING_MONTH.label;

  if (rows.length === 0) return <BillingEmptyState />;

  return (
    <>
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
              <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.fg }}>
                Top agents by cost · <span style={{ fontFamily: MONO }}>{money2(billed)}</span>
              </span>
              {billed !== listTotal && (
                <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted }}>
                  <span style={{ fontFamily: MONO }}>{money2(listTotal)}</span> list
                </span>
              )}
              <V2Badge title="V2 splits each agent's cost into Running, Model usage, Template storage and Egress." />
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 3 }}>
              {rows.reduce((a, r) => a + r.runs, 0)} sandboxes · month to date, includes in-progress usage
              {accruing > 0 && <> · <span style={{ color: C.warn }}>{accruing} agent{accruing === 1 ? "" : "s"} still accruing</span></>}
            </div>
          </div>
          <Segmented value={range} options={[BILLING_MONTH.label, "30d", "7d", "24hr"]} onChange={setRange} size="sm" />
        </div>

        {/* One bar per agent, split by what it spent on — the same chart shape as
            before, but the legend is the billing items rather than two columns. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {rows.map((a) => {
            const total = agentTotal(a);
            const parts: { item: BillingItem; amount: number }[] = [
              { item: "running", amount: a.running },
              { item: "model_usage", amount: a.modelUsage },
              { item: "template_storage", amount: a.templateStorage ?? 0 },
              { item: "egress", amount: a.egress ?? 0 },
            ];
            return (
              <div key={a.agentId} style={{ display: "grid", gridTemplateColumns: "165px minmax(0,1fr) 110px", gap: 14, alignItems: "center" }}>
                <button
                  onClick={() => onOpenAgent(a.agentId)}
                  title={`Open ${a.name}`}
                  style={{ background: "transparent", border: "none", padding: 0, textAlign: "right", fontFamily: FONT, fontSize: 13, color: C.fg, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {a.name}
                </button>
                <div style={{ display: "flex", height: 11, borderRadius: 2, overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ width: `${(total / max) * 100}%`, display: "flex", minWidth: 3 }}>
                    {parts.filter((p) => p.amount > 0).map((p) => (
                      <div key={p.item} title={`${ITEM_LABEL[p.item]} ${money2(p.amount)}`}
                           style={{ width: `${(p.amount / total) * 100}%`, background: ITEM_COLOR[p.item], minWidth: 2 }} />
                    ))}
                  </div>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 13, color: C.fg, textAlign: "right" }}>{money2(total)}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
          {(["running", "model_usage", "template_storage", "egress"] as BillingItem[]).map((it) => (
            <span key={it} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 11.5, color: metered(it) ? C.fg : C.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: ITEM_COLOR[it], opacity: metered(it) ? 1 : 0.4 }} />
              {ITEM_LABEL[it]}
            </span>
          ))}
        </div>

        {/* §P1 — allowances belong to a whole calendar month at account scope. */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.borderSoft}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>Free allowances</span>
            <V2Badge title="New in V2 — template storage, egress and snapshot storage each carry a free allowance." />
            <Link href="/settings/quotas" style={{ fontFamily: FONT, fontSize: 12, color: C.link, textDecoration: "none" }}>Quotas →</Link>
          </div>
          {wholeMonth ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20 }}>
              <AllowanceBar label="Template storage" used={templateGBmo} free={TEMPLATE_FREE_GB} unit="GB·mo"
                unavailable={!metered("template_storage")}
                note={templateBillableGBmo > 0 ? `${templateBillableGBmo.toFixed(2)} GB·mo billable` : "Within the free allowance"} />
              <AllowanceBar label="Egress" used={egressUsedGB} free={EGRESS_FREE_GB} unit="GB"
                unavailable={!metered("egress")}
                note={`Resets ${BILLING_MONTH.end.slice(0, 10)} · inbound is always free`} />
              <AllowanceBar label="Snapshot storage" v21 used={0} free={SNAPSHOT_FREE_GB} unit="GB·mo"
                unavailable note="" />
            </div>
          ) : (
            <span style={{ display: "flex", alignItems: "flex-start", gap: 7, fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "17px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              Allowances and month-end projections are available in the monthly account view without filters.
            </span>
          )}
        </div>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px", flexWrap: "wrap" }}>
        <Segmented value={view === "agent" ? "By agent" : "By billing item"}
                   options={["By agent", "By billing item"] as const}
                   onChange={(v) => setView(v === "By agent" ? "agent" : "item")} size="sm" />
        <V2Badge title="New in V2 — the by-item view is where account-level items and their drill-downs live." />
        <Dropdown value={range} options={MONTH_OPTIONS} onChange={setRange} width={185} />
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted }}>Data updated as of {DATA_AS_OF}</span>
          <ExportButton />
        </span>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {view === "agent" ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Agent</th>
                <th style={{ ...thStyle, width: 80 }}>Sandboxes</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Running</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Model usage</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Template storage</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Egress</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                <th style={{ ...thStyle, width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.agentId}
                  onClick={() => onOpenAgent(a.agentId)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(221,234,77,0.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>{a.name}</span>
                      <VersionTag v={a.version} />
                    </div>
                    {a.deletedAt && (
                      <div style={{ fontFamily: FONT, fontSize: 10.5, color: C.muted, marginTop: 3 }}>Deleted {a.deletedAt}</div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: MONO }}>{a.runs}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}><Amount value={a.running} /></td>
                  <td style={{ ...tdStyle, textAlign: "right" }}><Amount value={a.modelUsage} /></td>
                  <td style={{ ...tdStyle, textAlign: "right" }}><Amount value={a.templateStorage} item="template_storage" /></td>
                  <td style={{ ...tdStyle, textAlign: "right" }}><Amount value={a.egress} item="egress" /></td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>
                    {money2(agentTotal(a))}
                    {a.accruing && <div style={{ fontFamily: FONT, fontSize: 10.5, color: C.warn }}>In progress</div>}
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
                <th style={{ ...thStyle, textAlign: "right" }}>Total usage</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Free</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Billable</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                <th style={{ ...thStyle, width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {BILLING_ITEMS.filter((i) => i !== "paused").map((item) => {
                const amount = itemTotal(item);
                return (
                  <tr key={item}
                      onClick={() => setOpenItem(openItem === item ? null : item)}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(221,234,77,0.05)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={tdStyle}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: ITEM_COLOR[item] }} />
                        {ITEM_LABEL[item]}
                        {V21_MARK(item) && <V21Badge />}
                      </span>
                      <div style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted, marginTop: 2 }}>{ITEM_BLURB[item]}</div>
                    </td>
                    {/* §P3 — total, free and billable side by side, so the page
                        reconciles against the invoice without arithmetic. */}
                    <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: C.muted }}>{itemUsage(item)}</td>
                    <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: C.muted }}>{itemFree(item)}</td>
                    <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: C.muted }}>{itemBillable(item)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}><Amount value={amount} item={item} /></td>
                    <td style={{ ...tdStyle, textAlign: "right" }}><Chevron /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {view === "item" && openItem && <ItemDrilldown item={openItem} onClose={() => setOpenItem(null)} />}
    </>
  );
}

function itemUsage(item: BillingItem): string {
  if (!metered(item)) return "—";
  switch (item) {
    case "running":          return `${(SANDBOXES.reduce((a, s) => a + sandboxMinutes(s), 0) / 60).toFixed(1)} h`;
    case "model_usage":      return `${(MODEL_USAGE.reduce((a, m) => a + m.tokens, 0) / 1e6).toFixed(0)}M tokens`;
    case "template_storage": return `${templateGBmo.toFixed(2)} GB·mo`;
    case "egress":           return `${egressUsedGB.toFixed(1)} GB`;
    default:                 return "—";
  }
}
function itemFree(item: BillingItem): string {
  if (!metered(item)) return "—";
  switch (item) {
    case "template_storage": return `${Math.min(templateGBmo, TEMPLATE_FREE_GB).toFixed(2)} GB·mo`;
    case "egress":           return `${Math.min(egressUsedGB, EGRESS_FREE_GB).toFixed(1)} GB`;
    case "model_usage":      return MODEL_USAGE.some((m) => m.creditApplied > 0) ? "credits applied" : "—";
    default:                 return "—";
  }
}
function itemBillable(item: BillingItem): string {
  if (!metered(item)) return "—";
  switch (item) {
    case "template_storage": return `${templateBillableGBmo.toFixed(2)} GB·mo`;
    case "egress":           return `${egressBillableGB.toFixed(1)} GB`;
    default:                 return itemUsage(item);
  }
}

// ── §P1a Agent detail ───────────────────────────────────────────────────────
// Three blocks, because an agent's cost comes from three places: what its
// sandboxes did, what its model calls cost, and what its template stores.
function AgentDetail({ agentId, onOpenSandbox }: { agentId: string; onOpenSandbox: (id: string) => void }) {
  const a = agentById(agentId);
  const boxes = sandboxesForAgent(agentId);
  const tpl = templateForAgent(agentId);
  if (!a) return <div style={{ fontFamily: FONT, color: C.muted }}>No usage recorded for this agent.</div>;

  const split: { item: BillingItem; amount: number | null }[] = [
    { item: "running", amount: a.running },
    { item: "model_usage", amount: a.modelUsage },
    { item: "template_storage", amount: a.templateStorage },
    { item: "egress", amount: a.egress },
  ];

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>{a.name}</h1>
            <VersionTag v={a.version} />
            {a.deletedAt && <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted }}>Deleted {a.deletedAt}</span>}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 6 }}>
            Template ID: <span style={{ fontFamily: MONO, color: C.fg }}>{a.templateId}</span>
            {"  "}Period: <span style={{ fontFamily: MONO, color: C.fg }}>{BILLING_MONTH.start} – {BILLING_MONTH.end}</span>
          </div>
        </div>
        <DownloadButton />
      </div>

      {/* Block 1 — where the money went, for this agent. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, margin: "20px 0 8px" }}>
        {split.map(({ item, amount }) => (
          <Card key={item} style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 12, color: C.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: ITEM_COLOR[item] }} />
              {ITEM_LABEL[item]}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 600, color: amount === null ? C.muted : C.fg, marginTop: 6 }}>
              <Amount value={amount} item={item} />
            </div>
          </Card>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", fontFamily: FONT, fontSize: 12.5, color: C.muted, marginBottom: 22 }}>
        Agent total <span style={{ fontFamily: MONO, color: C.fg, marginLeft: 6 }}>{money2(agentTotal(a))}</span>
      </div>

      {/* Block 2 — its sandboxes. */}
      <h2 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: "0 0 10px" }}>Sandboxes</h2>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={thStyle}>Sandbox</th><th style={thStyle}>Spec</th><th style={thStyle}>Region</th>
            <th style={thStyle}>State</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Running</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Model usage</th>
            <th style={{ ...thStyle, width: 44 }} />
          </tr></thead>
          <tbody>
            {boxes.map((sb) => (
              <tr key={sb.id}
                  onClick={() => onOpenSandbox(sb.id)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(221,234,77,0.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={tdStyle}>
                  {/* §P2 — no display_name means the row IS the id, and says so. */}
                  {sb.name === sb.id
                    ? <span title="No name set" style={{ fontFamily: MONO, fontSize: 12.5, color: C.muted }}>{sb.id}</span>
                    : <>{sb.name}<div style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{sb.id}</div></>}
                </td>
                <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{specOf(sb)}</td>
                <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5, color: C.muted }}>{sb.region}</td>
                <td style={tdStyle}><StateChip state={sb.state} /></td>
                <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money2(sandboxRunning(sb))}</td>
                <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: modelUsageFor(sb.id).length ? C.fg : C.muted }}>
                  {money2(sumRounded(modelUsageFor(sb.id).map(modelNet)))}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}><Chevron /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Block 3 — its template's storage. */}
      <h2 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: "24px 0 10px" }}>Template storage</h2>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {!metered("template_storage") ? (
          <div style={{ padding: "20px 18px", fontFamily: FONT, fontSize: 13, color: C.muted, lineHeight: "19px" }}>
            Metering not yet available.{BILLING_STARTS.template_storage ? ` Billing starts ${BILLING_STARTS.template_storage}.` : ""}
            {tpl && <> This agent's template is <span style={{ color: C.fg }}>{tpl.name} {tpl.version}</span>, {tpl.sizeGB} GB.</>}
          </div>
        ) : tpl ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={thStyle}>Template</th><th style={thStyle}>Version</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Size</th>
              <th style={thStyle}>Last launch</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Period cost</th>
            </tr></thead>
            <tbody>
              <tr>
                <td style={tdStyle}>{tpl.name}</td>
                <td style={{ ...tdStyle, fontFamily: MONO, color: C.muted }}>{tpl.version}</td>
                <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{tpl.sizeGB} GB</td>
                <td style={{ ...tdStyle, color: C.muted }}>{tpl.lastLaunch}</td>
                <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money4(templateCost(tpl))}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "20px 18px", fontFamily: FONT, fontSize: 13, color: C.muted }}>No template on record.</div>
        )}
      </div>
    </>
  );
}

// ── §P2 Sandbox detail ──────────────────────────────────────────────────────
// 2.0 has hourly buckets rather than true segments — `/ce/usage` returns a
// billing minute and an amount per hour, and nothing marks where one run ended.
// The row shape is the same either way, so when Billing adds segment bounds
// this becomes one row per segment without the page changing.
function SandboxDetail({ sandboxId }: { sandboxId: string }) {
  const [tab, setTab] = useState<"Usage" | "Model usage">("Usage");
  const sb = sandboxById(sandboxId);
  if (!sb) return <div style={{ fontFamily: FONT, color: C.muted }}>No usage recorded for this sandbox.</div>;

  const models = modelUsageFor(sb.id);
  const periodTotal = sandboxRunning(sb);
  const lifetime = periodTotal;   // single-period in the prototype
  const modelTotal = sumRounded(models.map(modelNet));

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
            <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>
              {sb.name === sb.id ? <span style={{ fontFamily: MONO, fontSize: 19 }} title="No name set">{sb.id}</span> : sb.name}
            </h1>
            <StateChip state={sb.state} />
            <VersionTag v={sandboxVersion(sb)} />
          </div>
          {/* Constants live here, once — they were per-row columns before. */}
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 8 }}>
            {field("Sandbox", sb.id)}
            {field("Spec", specOf(sb))}
            {field("Region", sb.region)}
            {/* §P2 — the API may not return a creation time. "—" beats a guess. */}
            {field("Created", sb.created ?? <span style={{ color: C.muted }} title="Not returned by the API">—</span>)}
            {sb.deleted && field("Deleted", sb.deleted)}
          </div>
          {sb.legacy && (
            <div style={{ marginTop: 10, display: "inline-flex", alignItems: "flex-start", gap: 7, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.borderSoft}`, borderRadius: 7, padding: "7px 11px", fontFamily: FONT, fontSize: 11.5, color: C.muted, lineHeight: "16px" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              Pre-redesign billing, charged by container duration. One session, no hourly breakdown.
            </div>
          )}
        </div>
        <DownloadButton />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, margin: "22px 0 14px", flexWrap: "wrap" }}>
        <Segmented value={tab} options={["Usage", "Model usage"] as const} onChange={setTab} size="sm" />
        <span style={{ display: "inline-flex", gap: 20, fontFamily: FONT, fontSize: 13, color: C.muted }}>
          <span>Period <span style={{ fontFamily: MONO, color: C.fg }}>{money4(tab === "Usage" ? periodTotal : modelTotal)}</span></span>
          {tab === "Usage" && lifetime !== periodTotal && (
            <span>Lifetime <span style={{ fontFamily: MONO, color: C.fg }}>{money4(lifetime)}</span></span>
          )}
        </span>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {tab === "Usage" ? (
          sb.legacy ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={thStyle}>Session</th><th style={thStyle}>Started</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Duration</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
              </tr></thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{sb.id}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{sb.created}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{sb.legacy.durationLabel}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money4(periodTotal)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={thStyle}>Hour</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Billed minutes</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                </tr></thead>
                <tbody>
                  {sb.buckets.map((b) => (
                    <tr key={b.hourStart}>
                      <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{b.hourStart}</td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{b.minutes} min</td>
                      <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money4(b.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* §P2 — the two things this table cannot yet show, said plainly
                  rather than faked. The resource split must NOT be computed from
                  spec × rate: rates change and discounts multiply the total, so
                  a derived figure would not match the invoice. */}
              <div style={{ padding: "11px 18px", borderTop: `1px solid ${C.borderSoft}`, fontFamily: FONT, fontSize: 11.5, color: C.muted, lineHeight: "17px" }}>
                Billed by the hour. Start and end of each run, and the vCPU / memory / disk split, are not returned yet —
                they appear here once Billing provides them.
              </div>
            </>
          )
        ) : models.length === 0 ? (
          <div style={{ padding: "26px 18px", fontFamily: FONT, fontSize: 13, color: C.muted }}>
            This sandbox made no model calls in this period.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={thStyle}>Model</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Tokens</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Credit applied</th>
            </tr></thead>
            <tbody>
              {models.map((m, i) => (
                <tr key={i}>
                  <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{m.model}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{(m.tokens / 1e6).toFixed(1)}M</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money2(m.amount)}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: m.creditApplied > 0 ? C.ok : C.muted }}>
                    {m.creditApplied > 0 ? `−${money2(m.creditApplied)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/** §P2 — short code for a standard spec, quantities for a custom one; never the SKU string. */
function specOf(sb: SandboxUsage): string {
  if (sb.legacy) return sb.legacy.instanceType;
  return sb.productName ?? specDetail(sb.spec);
}

function StateChip({ state }: { state: SandboxState }) {
  const color = state === "running" ? C.ok : state === "paused" ? "#60a5fa" : state === "error" ? C.err : C.muted;
  return (
    <span style={{ display: "inline-flex", fontFamily: FONT, fontSize: 11.5, color, background: `${color}1f`, border: `1px solid ${color}55`, padding: "2px 9px", borderRadius: 5 }}>
      {state}
    </span>
  );
}

function DownloadButton() {
  return (
    <button style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 13, fontWeight: 500, background: C.pillBg, color: C.fg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      Download
    </button>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function UsageBilling() {
  const [, setLocation] = useLocation();
  // §5 — a sandbox detail is its own URL, so a charge someone is questioning
  // can be linked to directly rather than described.
  // §P1a/§P2 — agent and sandbox are separate addressable levels, so a cost
  // someone is questioning can be linked to at whichever depth it was found.
  const [matchAgent, agentParams] = useRoute("/settings/usage/agentbox/:agentId");
  const [matchSandbox, sbParams] = useRoute("/settings/usage/agentbox/:agentId/:sandboxId");
  const agentId = matchSandbox ? sbParams?.agentId : matchAgent ? agentParams?.agentId : undefined;
  const sandboxId = matchSandbox ? sbParams?.sandboxId : undefined;

  const [side, setSide] = useState<"Inference" | "Compute">("Inference");
  const [tab, setTab] = useState<BillingTab>("Usage");
  const [scope, setScope] = useState<UsageScope>(agentId ? "agentbox" : "inference");

  const base = [
    { label: "Usage & Billing", href: "/settings/usage" },
    { label: "Usage", href: "/settings/usage" },
  ];
  const crumbs: { label: string; href?: string }[] = sandboxId && agentId
    ? [...base, { label: "Agentbox", href: "/settings/usage" },
       { label: agentById(agentId)?.name ?? agentId, href: `/settings/usage/agentbox/${agentId}` },
       { label: sandboxById(sandboxId)?.name ?? sandboxId }]
    : agentId
      ? [...base, { label: "Agentbox", href: "/settings/usage" }, { label: agentById(agentId)?.name ?? agentId }]
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
          ) : agentId ? (
            <AgentDetail
              agentId={agentId}
              onOpenSandbox={(sid) => setLocation(`/settings/usage/agentbox/${agentId}/${encodeURIComponent(sid)}`)}
            />
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
                <Agentbox onOpenAgent={(id) => setLocation(`/settings/usage/agentbox/${encodeURIComponent(id)}`)} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
