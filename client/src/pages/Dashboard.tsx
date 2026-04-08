import { useState } from "react";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

/* ─── Mock Data ──────────────────────────────────────────────────────────── */

const MY_CLAWS = [
  {
    id: "claw-001",
    name: "Support Sentinel",
    status: "live" as const,
    runsMTD: "21,200",
    revenueMTD: "$848",
    model: "Claude 3.5",
  },
  {
    id: "claw-002",
    name: "NPC Brain Engine",
    status: "live" as const,
    runsMTD: "7,241",
    revenueMTD: "$290",
    model: "Llama 3.1 70B",
  },
  {
    id: "claw-003",
    name: "Finance Ops Agent v2",
    status: "review" as const,
    runsMTD: "—",
    revenueMTD: "—",
    model: "Qwen 2.5",
  },
];

const STATS = [
  { label: "Published Claws", value: "2", accent: true, delta: "1 under review", deltaDown: false },
  { label: "Total Runs", value: "28,441", accent: false, delta: "↑ +22% this month", deltaDown: false },
  { label: "Revenue (MTD)", value: "$1,138", accent: false, delta: "↑ +$312 vs last month", deltaDown: false },
  { label: "Token Spend", value: "$244", accent: false, delta: "↑ utilization up", deltaDown: true },
];

const ACTIVITY = [
  { active: true, text: <><strong>Support Sentinel</strong> processed 142 tickets — avg resolution 3.2 min</>, time: "2m ago" },
  { active: true, text: <><strong>NPC Brain Engine</strong> served 88 dialogue requests — 0 errors</>, time: "11m ago" },
  { active: false, text: <><strong>Finance Ops Agent v2</strong> submitted for review — awaiting approval</>, time: "34m ago" },
  { active: false, text: <><strong>Support Sentinel</strong> completed batch #12 — 18.3% escalation rate</>, time: "1h ago" },
  { active: false, text: <>API key rotated successfully — all Claws reconnected</>, time: "2h ago" },
];

const SIDEBAR_ITEMS = [
  { group: "BUILD", items: [
    { icon: "▦", label: "Dashboard", active: true, badge: null },
    { icon: "＋", label: "Submit Claw", active: false, badge: null },
    { icon: "📦", label: "My Claws", active: false, badge: "2" },
  ]},
  { group: "INFRASTRUCTURE", items: [
    { icon: "🖥", label: "Cluster Engine", active: false, badge: null },
    { icon: "🧠", label: "Model Library", active: false, badge: null },
    { icon: "🔑", label: "API Keys", active: false, badge: null },
  ]},
  { group: "REVENUE", items: [
    { icon: "💰", label: "Earnings", active: false, badge: null },
    { icon: "📊", label: "Analytics", active: false, badge: null },
  ]},
];

/* ─── Status helpers ─────────────────────────────────────────────────────── */

function StatusPill({ status }: { status: "live" | "review" | "pending" }) {
  const map = {
    live: { cls: "status-live", label: "● LIVE" },
    review: { cls: "status-review", label: "◌ IN REVIEW" },
    pending: { cls: "status-pending", label: "◌ PENDING" },
  };
  const { cls, label } = map[status];
  return <span className={`status-pill ${cls}`}>{label}</span>;
}

/* ─── Submit Claw Form ───────────────────────────────────────────────────── */

function SubmitClawForm() {
  const [form, setForm] = useState({
    name: "",
    category: "Sales",
    pricing: "Per Run ($/run)",
    docker: "",
    description: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    toast.success("Claw submitted for review!");
  }

  return (
    <form className="submit-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label className="form-label">CLAW NAME</label>
        <input
          className="form-input"
          type="text"
          placeholder="e.g. Sales Outreach Pro"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="form-row-2">
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label className="form-label">CATEGORY</label>
          <select
            className="form-input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {["Sales", "Support", "Finance", "DeFi", "Gaming", "Ops"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label className="form-label">PRICING MODEL</label>
          <select
            className="form-input"
            value={form.pricing}
            onChange={(e) => setForm({ ...form, pricing: e.target.value })}
          >
            {["Per Run ($/run)", "Monthly Subscription", "Token-based"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 16 }}>
        <label className="form-label">DOCKER IMAGE URL</label>
        <input
          className="form-input"
          type="text"
          placeholder="docker.io/yourorg/claw-name:v1.0"
          value={form.docker}
          onChange={(e) => setForm({ ...form, docker: e.target.value })}
        />
      </div>
      <div className="form-row">
        <label className="form-label">DESCRIPTION</label>
        <textarea
          className="form-input"
          rows={3}
          placeholder="What does your Claw do? Who is it for?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <button type="submit" className="btn-lg primary" style={{ width: "100%", textAlign: "center", display: "block" }}>
        SUBMIT FOR REVIEW ▶
      </button>
    </form>
  );
}

/* ─── API Key Panel ──────────────────────────────────────────────────────── */

function ApiKeyPanel() {
  const [showApiKey, setShowApiKey] = useState(false);
  const maskedKey = "gmi_sk_live_••••••••••••••••••••••••••••••••";
  const realKey = "gmi_sk_live_xK9mP2qR7nL4vW8jT3hY6cB1dF5eA0sN";

  return (
    <div style={{ border: "1px solid var(--d4)", padding: "28px 32px", background: "var(--d1)", marginBottom: 32 }}>
      <div style={{ marginBottom: 16 }}>
        <span className="form-label" style={{ fontSize: 10, color: "#aaa", letterSpacing: 2 }}>API ACCESS</span>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label className="form-label">API KEY</label>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1,
            background: "var(--black)",
            border: "1px solid var(--d4)",
            padding: "10px 14px",
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "#aaa",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}>
            {showApiKey ? realKey : maskedKey}
          </div>
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            style={{ padding: "10px 12px", background: "transparent", border: "1px solid var(--d4)", color: "#666", cursor: "pointer" }}
          >
            {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(realKey); toast.success("API key copied"); }}
            style={{ padding: "10px 12px", background: "transparent", border: "1px solid var(--d4)", color: "#666", cursor: "pointer" }}
          >
            <Copy size={13} />
          </button>
        </div>
      </div>
      <div>
        <label className="form-label">QUICK START</label>
        <div style={{ background: "var(--black)", border: "1px solid var(--d4)", padding: "16px", fontFamily: "var(--mono)", fontSize: 11, color: "#aaa", lineHeight: 1.8 }}>
          <div style={{ color: "#444" }}># Install the GMI SDK</div>
          <div style={{ color: "var(--accent)" }}>pip install gmi-sdk</div>
          <div style={{ marginTop: 8, color: "#444" }}># Deploy a Claw</div>
          <div>from gmi import ClawClient</div>
          <div>client = ClawClient(api_key=<span style={{ color: "var(--accent)" }}>"YOUR_KEY"</span>)</div>
          <div>result = client.deploy(<span style={{ color: "var(--accent)" }}>"support-sentinel"</span>)</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className="btn-xs ghost" style={{ flex: 1, textAlign: "center" }}
          onClick={() => toast.info("Docs coming soon!")}>
          VIEW DOCS →
        </button>
        <button className="btn-xs primary" style={{ flex: 1, textAlign: "center" }}
          onClick={() => toast.info("API Playground coming soon!")}>
          API PLAYGROUND
        </button>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("Dashboard");

  return (
    <div style={{ minHeight: "100vh", background: "var(--black)", color: "var(--white)", display: "flex", flexDirection: "column" }}>

      {/* ── Top Nav ── */}
      <nav>
        <div className="logo">
          <span className="logo-icon">🦞</span>
          GMI CLAW
        </div>
        <div className="nav-tabs">
          {["HOME", "MARKETPLACE", "USER PORTAL", "DEV PORTAL", "PRICING"].map((tab) => (
            <button
              key={tab}
              className={`nav-tab${tab === "DEV PORTAL" ? " active" : ""}`}
              onClick={() => {
                if (tab === "HOME") window.location.href = "/";
                if (tab === "MARKETPLACE") window.location.href = "/marketplace";
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="nav-right">
          <button className="btn-sm btn-ghost">LOG IN</button>
          <button className="btn-sm btn-accent">GET ACCESS ▶</button>
        </div>
      </nav>

      {/* ── Portal Layout ── */}
      <div className="portal-layout" style={{ flex: 1, marginTop: 60 }}>

        {/* Sidebar */}
        <aside className="portal-sidebar">
          <div style={{ padding: "20px 20px", borderBottom: "1px solid var(--d4)" }}>
            <div style={{ fontFamily: "var(--pixel)", fontSize: 8, color: "var(--accent)", marginBottom: 4 }}>DEV: @builderlabs</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "#555" }}>Developer Plan</div>
          </div>
          {SIDEBAR_ITEMS.map((group) => (
            <div key={group.group}>
              <span className="sidebar-label">{group.group}</span>
              {group.items.map((item) => (
                <button
                  key={item.label}
                  className={`sidebar-item${activeSection === item.label ? " active" : ""}`}
                  onClick={() => setActiveSection(item.label)}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {item.label}
                  {item.badge && <span className="sidebar-badge">{item.badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <main className="portal-main">
          {/* Topbar */}
          <div className="portal-topbar">
            <div className="portal-title">DEVELOPER DASHBOARD</div>
            <button
              className="btn-sm btn-accent"
              onClick={() => { setActiveSection("Submit Claw"); toast.info("Fill in the form below to submit your Claw."); }}
            >
              + SUBMIT NEW CLAW
            </button>
          </div>

          <div className="portal-content">

            {/* ── Stats Widgets ── */}
            <div className="widget-grid">
              {STATS.map((s) => (
                <div key={s.label} className="widget">
                  <span className="widget-label">{s.label}</span>
                  <span className={`widget-value${s.accent ? " accent" : ""}`}>{s.value}</span>
                  <span className={`widget-delta${s.deltaDown ? " down" : ""}`}>{s.delta}</span>
                </div>
              ))}
            </div>

            {/* ── Submit Claw Form ── */}
            <div className="section-hd">
              <h3>SUBMIT A CLAW</h3>
            </div>
            <SubmitClawForm />

            {/* ── My Claws Table ── */}
            <div className="section-hd">
              <h3>MY CLAWS</h3>
              <button className="see-all" onClick={() => toast.info("Full claw list coming soon!")}>
                View all →
              </button>
            </div>
            <table className="data-table" style={{ marginBottom: 32 }}>
              <thead>
                <tr>
                  <th>CLAW NAME</th>
                  <th>STATUS</th>
                  <th>RUNS (MTD)</th>
                  <th>REVENUE (MTD)</th>
                  <th>MODEL</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {MY_CLAWS.map((claw) => (
                  <tr key={claw.id}>
                    <td style={{ color: claw.status === "review" ? "#666" : "var(--white)" }}>{claw.name}</td>
                    <td><StatusPill status={claw.status} /></td>
                    <td>{claw.runsMTD}</td>
                    <td style={{ color: claw.revenueMTD !== "—" ? "var(--accent)" : undefined }}>{claw.revenueMTD}</td>
                    <td>{claw.model}</td>
                    <td>
                      {claw.status === "live" ? (
                        <button className="btn-xs ghost" onClick={() => toast.info(`Editing ${claw.name}`)}>EDIT</button>
                      ) : (
                        <button className="btn-xs ghost" onClick={() => toast.info(`Viewing ${claw.name}`)}>VIEW</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Bottom: Activity + API Key ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, marginBottom: 0 }}>
              {/* Activity Feed */}
              <div>
                <div className="section-hd">
                  <h3>RECENT ACTIVITY</h3>
                  <button className="see-all" onClick={() => toast.info("Full activity log coming soon!")}>See all →</button>
                </div>
                <div className="activity-list">
                  {ACTIVITY.map((item, i) => (
                    <div key={i} className="activity-item">
                      <div className={`activity-dot${item.active ? "" : " gray"}`} />
                      <div className="activity-text">{item.text}</div>
                      <div className="activity-time">{item.time}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* API Key */}
              <div style={{ paddingLeft: 32 }}>
                <div className="section-hd">
                  <h3>API ACCESS</h3>
                </div>
                <ApiKeyPanel />
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
