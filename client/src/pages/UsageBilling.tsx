import { useMemo, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { C, FONT, MONO } from "@/lib/tokens";
import V2Badge from "@/components/V2Badge";
import V21Badge from "@/components/V21Badge";
import BatchBadge from "@/components/BatchBadge";
import {
  BILLING_ITEMS_2_0, ITEM_LABEL, ITEM_COLOR, ITEM_BLURB, V21_ITEMS,
  money2, money4, rate6, sumRounded, round2, specDetail, runningRate, pausedRate,
  type BillingItem,
} from "@/lib/billingModel";
import {
  BILLING_MONTH, DATA_AS_OF, MONTH_OPTIONS, BILLING_STARTS, metered,
  INFERENCE_MODELS, INFERENCE_MODELS_MORE, INFERENCE_TOTAL, INFERENCE_ROWS,
  STUDIO_TOTAL, STUDIO_ROWS, inferenceSeries, USAGE_PERIOD,
  SANDBOXES, sandboxById, sandboxRunning, sandboxItem, sandboxVersion,
  sandboxesForAgent, agentRows, agentTotal, agentById,
  MODEL_USAGE, modelUsageFor, modelNet,
  TERMINATE_AT,
  itemTotal, periodListTotal, periodBilledTotal,
  type UsageScope, type SandboxState, type SandboxUsage,
} from "@/lib/billingUsage";
import { templatesForAgent, daysToArchive, relativeDay, ARCHIVE_WARN_DAYS, type TemplateRecord } from "@/lib/templates";

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

// ── Cost breakdown ──────────────────────────────────────────────────────────
// Three cells, summing to the header total. This replaces the by-billing-item
// page: with Egress out of 2.0 and Templates free, there are exactly three
// things being charged for, and a separate page holding three numbers is a
// navigation step that answers nothing. It becomes four cells when Snapshots
// land, and only then is it worth asking whether it needs a page of its own.
//
// The by-agent view is the one worth building out. Account-level cost-by-type
// is what everyone ships; per-agent money is not.
function CostBreakdown({ rows }: { rows: ReturnType<typeof agentRows> }) {
  const cells = BILLING_ITEMS_2_0.map((item) => ({
    item,
    amount: round2(
      item === "running" ? sumRounded(rows.map((r) => r.running))
      : item === "paused" ? sumRounded(rows.map((r) => r.paused))
      : sumRounded(rows.map((r) => r.modelUsage)),
    ),
  }));
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cells.length}, minmax(0,1fr))`, gap: 12, marginBottom: 20 }}>
      {cells.map(({ item, amount }) => (
        <div key={item} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 9, padding: "13px 15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 12, color: C.muted }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: ITEM_COLOR[item] }} />
            {ITEM_LABEL[item]}
            {/* Paused figures are real in the model but cannot accrue until the
                backend lands, so the cell says which batch it belongs to. */}
            {item === "paused" && <BatchBadge batch={2} />}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 19, fontWeight: 600, color: amount > 0 ? C.fg : C.muted, marginTop: 5 }}>
            {money2(amount)}
          </div>
          <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, marginTop: 3, lineHeight: "15px" }}>
            {ITEM_BLURB[item]}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── §P1 Usage list — by agent ───────────────────────────────────────────────
// An agent is the level people think at, and the level both cost chains roll up
// to: its template carries storage, its sandboxes carry runtime, egress and
// model calls. The row shows all four so the shape of the bill is visible
// without opening anything; the detail views are for "which sandbox" and "which
// hour", which are different questions.
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

function BillingEmptyState() {
  const live = BILLING_ITEMS_2_0;
  return (
    <Card>
      <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, marginBottom: 4 }}>No Agentbox usage yet</div>
      <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "0 0 16px", lineHeight: "18px" }}>
        Sandboxes are billed for the time they spend running and paused; model calls are billed per token.
        {" "}<span style={{ color: C.fg }}>Building and storing templates is free.</span>
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
  const [range, setRange] = useState<string>(BILLING_MONTH.label);

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
              {/* One marker per surface, and it carries both facts: new in V2,
                  and shipping in the first batch. A V2 badge beside it would be
                  a second badge making the same claim. */}
              <BatchBadge batch={1} title="V2 batch 1 — this page is new in Agentbox 2.0 and ships with the UI release. Only the Paused figures wait for batch 2." />
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 3 }}>
              {rows.reduce((a, r) => a + r.runs, 0)} sandboxes · month to date, includes in-progress usage
              {accruing > 0 && <> · <span style={{ color: C.warn }}>{accruing} agent{accruing === 1 ? "" : "s"} still accruing</span></>}
            </div>
          </div>
          <Segmented value={range} options={[BILLING_MONTH.label, "30d", "7d", "24hr"]} onChange={setRange} size="sm" />
        </div>

        {/* The three things 2.0 charges for, summing to the total above. */}
        <CostBreakdown rows={rows} />

        {/* One bar per agent, split by what it spent on. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {rows.map((a) => {
            const total = agentTotal(a);
            const parts: { item: BillingItem; amount: number }[] = [
              { item: "running", amount: a.running },
              { item: "paused", amount: a.paused },
              { item: "model_usage", amount: a.modelUsage },
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
          {BILLING_ITEMS_2_0.map((it) => (
            <span key={it} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 11.5, color: metered(it) ? C.fg : C.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: ITEM_COLOR[it], opacity: metered(it) ? 1 : 0.4 }} />
              {ITEM_LABEL[it]}
              {it === "paused" && <BatchBadge batch={2} />}
            </span>
          ))}
        </div>

        {/* No free allowances in 2.0. Templates are capped by count rather than
            charged, and Egress is out of scope — the first allowance arrives
            with Snapshots in 2.1, and lives on the quota page until then. An
            empty "Free allowances" panel would only invite the question. */}
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px", flexWrap: "wrap" }}>
        <Dropdown value={range} options={MONTH_OPTIONS} onChange={setRange} width={185} />
        <Link href="/settings/quotas" style={{ fontFamily: FONT, fontSize: 12.5, color: C.link, textDecoration: "none" }}>Quotas →</Link>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted }}>Data updated as of {DATA_AS_OF}</span>
          <ExportButton />
        </span>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Agent</th>
                <th style={{ ...thStyle, width: 80 }}>Sandboxes</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Running</th>
                <th style={{ ...thStyle, textAlign: "right" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>Paused <BatchBadge batch={2} /></span>
                </th>
                <th style={{ ...thStyle, textAlign: "right" }}>Model usage</th>
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
                  <td style={{ ...tdStyle, textAlign: "right" }}><Amount value={a.paused} /></td>
                  <td style={{ ...tdStyle, textAlign: "right" }}><Amount value={a.modelUsage} /></td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>
                    {money2(agentTotal(a))}
                    {a.accruing && <div style={{ fontFamily: FONT, fontSize: 10.5, color: C.warn }}>In progress</div>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}><Chevron /></td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </>
  );
}

// ── §P1a Agent detail ───────────────────────────────────────────────────────
// Three blocks, because an agent's cost comes from three places: what its
// sandboxes did, what its model calls cost, and what its template stores.
function AgentDetail({ agentId, onOpenSandbox }: { agentId: string; onOpenSandbox: (id: string) => void }) {
  const a = agentById(agentId);
  const boxes = sandboxesForAgent(agentId);
  const templates = templatesForAgent(agentId);
  if (!a) return <div style={{ fontFamily: FONT, color: C.muted }}>No usage recorded for this agent.</div>;

  // The same three cells as the list header, scoped to this agent, and summing
  // to its total. Templates are not here: they cost nothing, and a $0 card
  // invites the question "why is my template storage free this month".
  // Snapshot storage becomes a fourth cell when Snapshots ship in 2.1.
  const split: { item: BillingItem; amount: number }[] = [
    { item: "running", amount: a.running },
    { item: "paused", amount: a.paused },
    { item: "model_usage", amount: a.modelUsage },
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

      {/* Block 3 — its templates, read-only. Same rows as the Templates page
          but no actions: this is a billing screen, and a Delete button here
          would be a destructive control in a place nobody came to act. It
          links out instead. Templates carry no cost anywhere. */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "24px 0 10px" }}>
        <h2 style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg, margin: 0 }}>Templates</h2>
        <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.muted }}>Free</span>
        <Link href="/dashboard" style={{ fontFamily: FONT, fontSize: 12, color: C.link, textDecoration: "none" }}>Open in My Agents →</Link>
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {templates.length === 0 ? (
          <div style={{ padding: "20px 18px", fontFamily: FONT, fontSize: 13, color: C.muted }}>No templates on record.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={thStyle}>Template</th>
              <th style={thStyle}>Version</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Last launched</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Archives in</th>
              <th style={{ ...thStyle, width: 40 }} />
            </tr></thead>
            <tbody>
              {templates.map((t) => <TemplateRow key={t.id} t={t} />)}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function TemplateRow({ t }: { t: TemplateRecord }) {
  const [, setLocation] = useLocation();
  const left = daysToArchive(t);
  const soon = left !== null && left <= ARCHIVE_WARN_DAYS;
  const color = t.status === "ready" ? C.ok : t.status === "building" ? C.warn : t.status === "error" ? C.err : C.muted;
  return (
    // Read-only, but it leads somewhere: My Agents is where a template can
    // actually be rebuilt or deleted. A billing page is not.
    <tr
      onClick={() => setLocation("/dashboard")}
      style={{ cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(221,234,77,0.05)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <td style={tdStyle}>{t.name}<div style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{t.id}</div></td>
      <td style={{ ...tdStyle, fontFamily: MONO, color: C.muted }}>{t.version}</td>
      <td style={tdStyle}>
        <span style={{ display: "inline-flex", fontFamily: FONT, fontSize: 11.5, color, background: `${color}1f`, border: `1px solid ${color}55`, padding: "2px 9px", borderRadius: 5 }}>
          {t.status}
        </span>
      </td>
      <td style={{ ...tdStyle, color: C.muted }}>{relativeDay(t.lastLaunch)}</td>
      {/* Inactivity is the only clock on a template, so it is the column. */}
      <td style={{ ...tdStyle, textAlign: "right", fontFamily: MONO, color: soon ? C.warn : C.muted }}>
        {left === null ? "—" : `${left} d`}
      </td>
      <td style={{ ...tdStyle, textAlign: "right", width: 40 }}><Chevron /></td>
    </tr>
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
  const periodTotal = sandboxRunning(sb);   // running + paused, summed by row
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
            {/* Shown only while the account is overdue — the moment this sandbox
                is torn down if the balance is not settled. */}
            {TERMINATE_AT && (
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: FONT, fontSize: 11.5, color: C.warn }}>Terminates</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.warn }}>{TERMINATE_AT}</span>
              </span>
            )}
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
                  <th style={thStyle}>Segment</th>
                  <th style={thStyle}>From</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Billed minutes</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Rate</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                </tr></thead>
                <tbody>
                  {sb.buckets.map((b) => {
                    const hourly = b.state === "running"
                      ? runningRate(sb.spec, sb.productName)
                      : pausedRate(sb.spec, sb.productName);
                    return (
                      <tr key={b.hourStart + b.state}>
                        {/* §P2 — each segment carries its state, and a paused one
                            prices at the paused rate: about 1% of running. Without
                            the state on the row the two are indistinguishable and a
                            paused sandbox looks billed as if it had been running. */}
                        <td style={tdStyle}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: ITEM_COLOR[b.state] }} />
                            {b.state === "running" ? "Running" : "Paused"}
                            {b.state === "paused" && <BatchBadge batch={2} />}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{b.hourStart}</td>
                        <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{b.minutes} min</td>
                        <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: C.muted }}>{money4(hourly)}/h</td>
                        <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{money4(b.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* §P2 — what this table still cannot show, said plainly rather
                  than faked. The resource split must NOT be computed from
                  spec × rate: rates change and discounts multiply the total, so
                  a derived figure would not match the invoice. */}
              <div style={{ padding: "11px 18px", borderTop: `1px solid ${C.borderSoft}`, fontFamily: FONT, fontSize: 11.5, color: C.muted, lineHeight: "17px" }}>
                Minutes are rounded up — a 30-second run bills as one minute. Exact segment start and end, and the
                vCPU / memory / disk split, are not returned yet; they appear here once Billing provides them.
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
