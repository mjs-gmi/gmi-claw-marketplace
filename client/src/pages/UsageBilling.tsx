import { useMemo, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { C, FONT, MONO } from "@/lib/tokens";
import V2Badge from "@/components/V2Badge";
import {
  USAGE_PERIOD, INFERENCE_MODELS, INFERENCE_MODELS_MORE, INFERENCE_TOTAL,
  INFERENCE_ROWS, STUDIO_TOTAL, STUDIO_ROWS, inferenceSeries,
  AGENTBOX_TOP, AGENTBOX_TOP_TOTAL, AGENTBOX_RUNS, AGENTBOX_MONTH, AGENTBOX_MONTHS,
  agentTotal, agentUsageById, sessionsFor, tokenCallsFor, usd,
  type UsageScope, type AgentUsage,
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
const CONTAINER_COLOR = "#2dd4bf";
const TOKEN_COLOR = C.lime;

function Agentbox({ onOpen }: { onOpen: (a: AgentUsage) => void }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("30d");
  const [month, setMonth] = useState(AGENTBOX_MONTHS[0]);
  const max = Math.max(...AGENTBOX_TOP.map(agentTotal));

  return (
    <>
      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.fg }}>
              Top agents by cost · <span style={{ fontFamily: MONO }}>{usd(AGENTBOX_TOP_TOTAL)}</span>
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 3 }}>
              {AGENTBOX_RUNS} runs · {USAGE_PERIOD.from} – {USAGE_PERIOD.to}
            </div>
          </div>
          <Segmented value={range} options={RANGES} onChange={setRange} size="sm" />
        </div>

        {/* One row per agent, split by what it actually spent on. The split is
            the point: these two are metered on different clocks, and a stacked
            bar is the only way to see that one agent's cost is all tokens. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {AGENTBOX_TOP.map((a) => {
            const total = agentTotal(a);
            return (
              <div key={a.agentId} style={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr) 110px", gap: 14, alignItems: "center" }}>
                <button
                  onClick={() => onOpen(a)}
                  title={`Open ${a.name}`}
                  style={{ background: "transparent", border: "none", padding: 0, textAlign: "right", fontFamily: FONT, fontSize: 13, color: C.fg, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {a.name}
                </button>
                <div style={{ display: "flex", height: 11, borderRadius: 2, overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ width: `${(total / max) * 100}%`, display: "flex", minWidth: 3 }}>
                    <div title={`Container ${usd(a.container)}`} style={{ width: `${total ? (a.container / total) * 100 : 0}%`, background: CONTAINER_COLOR, minWidth: a.container > 0 ? 3 : 0 }} />
                    <div title={`Token ${usd(a.token)}`} style={{ width: `${total ? (a.token / total) * 100 : 0}%`, background: TOKEN_COLOR }} />
                  </div>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 13, color: C.fg, textAlign: "right" }}>{usd(total)}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginTop: 18 }}>
          {[["Container Amount", CONTAINER_COLOR], ["Token Amount", TOKEN_COLOR]].map(([label, color]) => (
            <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 11.5, color: C.fg }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color as string }} />
              {label}
            </span>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px" }}>
        <Dropdown value={month} options={AGENTBOX_MONTHS} onChange={setMonth} width={210} />
        <span style={{ marginLeft: "auto" }}><ExportButton /></span>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Agent</th>
              <th style={{ ...thStyle, width: 110 }}>Runs</th>
              <th style={{ ...thStyle, width: 150, textAlign: "right" }}>Container</th>
              <th style={{ ...thStyle, width: 170, textAlign: "right" }}>Token</th>
              <th style={{ ...thStyle, width: 170, textAlign: "right" }}>Total</th>
              <th style={{ ...thStyle, width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {AGENTBOX_MONTH.map((a) => (
              <tr
                key={a.agentId}
                onClick={() => onOpen(a)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(221,234,77,0.05)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <td style={tdStyle}>{a.name}</td>
                <td style={{ ...tdStyle, fontFamily: MONO }}>{a.runs}</td>
                <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{usd(a.container)}</td>
                {/* A zero here is a fact, not a gap: the agent made no model
                    calls. Rendering it muted keeps the eye on the ones that did. */}
                <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right", color: a.token > 0 ? C.fg : C.muted }}>{usd(a.token)}</td>
                <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{usd(agentTotal(a))}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}><Chevron /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Agent drill-down ────────────────────────────────────────────────────────
function AgentDetail({ agentId }: { agentId: string }) {
  const [tab, setTab] = useState<"Container Sessions" | "Token Calls">("Container Sessions");
  const agent = agentUsageById(agentId);
  const sessions = sessionsFor(agentId);
  const calls = tokenCallsFor(agentId);
  if (!agent) return <div style={{ fontFamily: FONT, color: C.muted }}>No usage recorded for this agent.</div>;

  const total = tab === "Container Sessions"
    ? sessions.reduce((a, s) => a + s.amount, 0)
    : calls.reduce((a, c) => a + c.amount, 0);

  const statusColor = (s: string) => (s === "Running" ? C.ok : s === "Failed" ? C.err : C.muted);

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>{agent.name}</h1>
          <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 5 }}>
            Template ID: <span style={{ fontFamily: MONO, color: C.fg }}>{agent.templateId}</span>
            {"  "}Period: <span style={{ fontFamily: MONO, color: C.fg }}>09/01/2026 – 09/30/2026</span>
          </div>
        </div>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 13, fontWeight: 500, background: C.pillBg, color: C.fg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, margin: "20px 0 14px", flexWrap: "wrap" }}>
        <Segmented value={tab} options={["Container Sessions", "Token Calls"] as const} onChange={setTab} size="sm" />
        <span style={{ fontFamily: FONT, fontSize: 13, color: C.muted }}>
          Total: <span style={{ fontFamily: MONO, color: C.fg }}>{usd(total)}</span>
        </span>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {tab === "Container Sessions" ? (
          sessions.length === 0 ? (
            <div style={{ padding: "26px 18px", fontFamily: FONT, fontSize: 13, color: C.muted }}>
              No container sessions in this period.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Session ID</th>
                  <th style={thStyle}>IDC</th>
                  <th style={thStyle}>Instance Type</th>
                  <th style={thStyle}>Started</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{s.id}</td>
                    <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{s.idc}</td>
                    <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{s.instanceType}</td>
                    <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{s.started}</td>
                    <td style={tdStyle}>{s.duration}</td>
                    <td style={tdStyle}>
                      <span style={{ display: "inline-flex", fontFamily: FONT, fontSize: 11.5, color: statusColor(s.status), background: `${statusColor(s.status)}1f`, border: `1px solid ${statusColor(s.status)}55`, padding: "2px 9px", borderRadius: 5 }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{usd(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : calls.length === 0 ? (
          // §Agentbox — an agent that never calls a model is normal, and the
          // empty state has to say which of the two meters it is, or it reads
          // as a loading failure.
          <div style={{ padding: "26px 18px", fontFamily: FONT, fontSize: 13, color: C.muted, lineHeight: "20px" }}>
            This agent made no model calls in this period.<br />
            Its cost is all container time — see <span style={{ color: C.fg }}>Container Sessions</span>.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Model</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Calls</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Input tokens</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Output tokens</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...tdStyle, fontFamily: MONO, fontSize: 12.5 }}>{c.model}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{c.calls.toLocaleString()}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{c.inputTokens.toLocaleString()}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{c.outputTokens.toLocaleString()}</td>
                  <td style={{ ...tdStyle, fontFamily: MONO, textAlign: "right" }}>{usd(c.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function UsageBilling() {
  const [, setLocation] = useLocation();
  const [matchAgent, params] = useRoute("/settings/usage/agentbox/:agentId");
  const agentId = matchAgent ? params?.agentId : undefined;

  const [side, setSide] = useState<"Inference" | "Compute">("Inference");
  const [tab, setTab] = useState<BillingTab>("Usage");
  const [scope, setScope] = useState<UsageScope>(agentId ? "agentbox" : "inference");

  const crumbs: { label: string; href?: string }[] = agentId
    ? [
        { label: "Usage & Billing", href: "/settings/usage" },
        { label: "Usage", href: "/settings/usage" },
        { label: "Agentbox", href: "/settings/usage" },
        { label: agentUsageById(agentId)?.name ?? agentId },
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
          ) : agentId ? (
            <AgentDetail agentId={agentId} />
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
                <Agentbox onOpen={(a) => setLocation(`/settings/usage/agentbox/${a.agentId}`)} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
