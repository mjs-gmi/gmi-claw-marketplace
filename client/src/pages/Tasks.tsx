import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import { C, FONT, MONO } from "@/lib/tokens";
import { loadTasks, modelName, type Task, type TaskStatus } from "@/lib/tasksModel";

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  queued:    { label: "Queued",    color: "#9a9a9a" },
  running:   { label: "Running",   color: "#fbbf24" },
  succeeded: { label: "Succeeded", color: "#34d399" },
  failed:    { label: "Failed",    color: "#ef4444" },
};

function ago(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function dur(t: Task): string {
  if (t.status === "running") return "—";
  return t.durationSec != null ? `${t.durationSec}s` : "—";
}
function cost(t: Task): string {
  return t.costUsd != null ? `$${t.costUsd.toFixed(3)}` : "—";
}

export default function Tasks() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const tasks = useMemo(() => loadTasks().sort((a, b) => b.createdAt - a.createdAt), []);
  const rows = tasks.filter((t) => filter === "all" || t.status === filter);

  const FILTERS: Array<{ k: "all" | TaskStatus; label: string }> = [
    { k: "all", label: "All" }, { k: "running", label: "Running" },
    { k: "succeeded", label: "Succeeded" }, { k: "failed", label: "Failed" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar /><Navbar />
      <div style={{ marginLeft: 210, paddingTop: 40 }}>
        <div style={{ padding: "24px 32px 40px" }}>
          <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: C.fg, margin: 0 }}>Tasks</h1>
          <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: "4px 0 16px" }}>
            Each task runs an Agent once in an isolated environment. The environment is released after completion unless kept.
          </p>

          {/* Filters */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {FILTERS.map((f) => (
              <button key={f.k} onClick={() => setFilter(f.k)} style={{
                fontFamily: FONT, fontSize: 13, fontWeight: 500,
                color: filter === f.k ? C.fg : C.muted,
                background: filter === f.k ? "rgba(255,255,255,0.06)" : "transparent",
                border: "1px solid transparent", padding: "6px 12px", borderRadius: 6, cursor: "pointer",
              }}>{f.label}</button>
            ))}
          </div>

          {/* Table */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.1fr 0.9fr 0.7fr 0.7fr 1.4fr", gap: 12, padding: "10px 16px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${C.border}`, fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>
              <div>Task</div><div>Agent</div><div>Status</div><div>Duration</div><div>Cost</div><div>Result</div>
            </div>
            {rows.length === 0 ? (
              <div style={{ padding: "40px 16px", textAlign: "center", fontFamily: FONT, fontSize: 13, color: C.muted }}>
                No tasks yet. Run one from an Agent in Browse Agents.
              </div>
            ) : rows.map((t, i) => {
              const sm = STATUS_META[t.status];
              return (
                <div
                  key={t.id}
                  onClick={() => setLocation(`/tasks/${t.id}`)}
                  style={{ display: "grid", gridTemplateColumns: "1.6fr 1.1fr 0.9fr 0.7fr 0.7fr 1.4fr", gap: 12, padding: "12px 16px", alignItems: "center", borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`, cursor: "pointer", fontFamily: FONT, fontSize: 13, color: C.fg }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.id}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{ago(t.createdAt)} · {modelName(t.model)}</span>
                  </div>
                  <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.agentName} <span style={{ color: C.muted, fontFamily: MONO, fontSize: 11 }}>{t.agentVersion}</span>
                  </div>
                  <div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: sm.color, background: `${sm.color}1f`, border: `1px solid ${sm.color}55`, padding: "2px 8px", borderRadius: 6 }}>
                      {t.status === "running" && <span style={{ width: 6, height: 6, borderRadius: 999, background: sm.color, animation: "pulse 1.2s ease-in-out infinite" }} />}
                      {sm.label}
                    </span>
                    {t.runtimeKept && <span style={{ marginLeft: 6, fontFamily: FONT, fontSize: 10, color: "#60a5fa" }} title="Environment kept">env kept</span>}
                  </div>
                  <div style={{ color: C.muted }}>{dur(t)}</div>
                  <div style={{ color: C.muted }}>{cost(t)}</div>
                  <div style={{ minWidth: 0, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.result ?? (t.status === "running" ? "In progress…" : "—")}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
