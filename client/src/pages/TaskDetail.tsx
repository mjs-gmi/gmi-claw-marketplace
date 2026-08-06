import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import { C, FONT, MONO } from "@/lib/tokens";
import { getTask, upsertTask, modelName, estimateCostUsd, type Task } from "@/lib/tasksModel";

type Tab = "result" | "files" | "logs" | "details";

const STATUS_COLOR: Record<Task["status"], string> = {
  queued: "#9a9a9a", running: "#fbbf24", succeeded: "#34d399", failed: "#ef4444",
};

export default function TaskDetail() {
  const [, params] = useRoute("/tasks/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ?? "";
  const [task, setTask] = useState<Task | undefined>(() => getTask(id));
  const [tab, setTab] = useState<Tab>("result");

  // Simulate the run completing (running → succeeded) for a freshly created task.
  useEffect(() => {
    if (!task || task.status !== "running") return;
    const timer = setTimeout(() => {
      const done: Task = {
        ...task,
        status: "succeeded",
        durationSec: 26,
        costUsd: estimateCostUsd(task.model),
        result: "Task completed. Output written to output/result.json.",
        files: ["output/result.json", "logs/run.log"],
      };
      upsertTask(done);
      setTask(done);
    }, 2500);
    return () => clearTimeout(timer);
  }, [task]);

  if (!task) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
        <Topbar /><Navbar />
        <div style={{ marginLeft: 210, paddingTop: 80, textAlign: "center", color: C.muted }}>
          Task not found. <button onClick={() => setLocation("/tasks")} style={{ color: C.lime, background: "none", border: "none", cursor: "pointer" }}>Back to Tasks</button>
        </div>
      </div>
    );
  }

  const sc = STATUS_COLOR[task.status];
  const running = task.status === "running";
  const kept = task.runtimeKept && task.status !== "failed";

  const release = () => { const t = { ...task, runtimeKept: false }; upsertTask(t); setTask(t); };

  const row = (label: string, value: React.ReactNode, mono = false) => (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, padding: "9px 0", borderTop: `1px solid ${C.borderSoft}`, alignItems: "center" }}>
      <span style={{ fontFamily: FONT, fontSize: 13, color: C.muted }}>{label}</span>
      <span style={{ fontFamily: mono ? MONO : FONT, fontSize: 13, color: C.fg, wordBreak: "break-all" }}>{value}</span>
    </div>
  );

  const TABS: Array<{ k: Tab; label: string }> = [
    { k: "result", label: "Result" }, { k: "files", label: "Files" }, { k: "logs", label: "Logs" }, { k: "details", label: "Details" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar /><Navbar />
      <div style={{ marginLeft: 210, paddingTop: 40 }}>
        <div style={{ maxWidth: 820, width: "100%", margin: "0 auto", padding: "24px 32px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Header */}
          <div>
            <button onClick={() => setLocation("/tasks")} style={{ fontFamily: FONT, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>← Tasks</button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 0", flexWrap: "wrap" }}>
              <h1 style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: C.fg, margin: 0 }}>{task.id}</h1>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: sc, background: `${sc}1f`, border: `1px solid ${sc}55`, padding: "2px 8px", borderRadius: 6 }}>
                {running && <span style={{ width: 6, height: 6, borderRadius: 999, background: sc, animation: "pulse 1.2s ease-in-out infinite" }} />}
                {task.status[0].toUpperCase() + task.status.slice(1)}
              </span>
            </div>
            <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: "4px 0 0" }}>
              {task.agentName} <span style={{ fontFamily: MONO }}>{task.agentVersion}</span> · {modelName(task.model)}
            </p>
          </div>

          {/* Kept-environment actions */}
          {kept && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.35)", borderRadius: 10, padding: "10px 14px" }}>
              <span style={{ fontFamily: FONT, fontSize: 12, color: C.fg }}>Environment kept — <span style={{ fontFamily: MONO, color: "#60a5fa" }}>{task.runtimeId}</span></span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={() => setLocation("/dashboard")} style={btn(C)}>Save as Snapshot</button>
                <button onClick={() => setLocation("/dashboard")} style={btn(C)}>Open in My Agents</button>
                <button onClick={release} style={btn(C)}>Release environment</button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}` }}>
            {TABS.map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                fontFamily: FONT, fontSize: 13, fontWeight: 500, background: "transparent",
                color: tab === t.k ? C.fg : C.muted, border: "none",
                borderBottom: `2px solid ${tab === t.k ? C.lime : "transparent"}`,
                padding: "8px 12px", marginBottom: -1, cursor: "pointer",
              }}>{t.label}</button>
            ))}
          </div>

          {/* Tab body */}
          {tab === "result" && (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", fontFamily: FONT, fontSize: 13, color: C.fg, lineHeight: "20px" }}>
              {running ? <span style={{ color: C.muted }}>Running… the result appears here when the task completes.</span> : (task.result ?? "—")}
            </div>
          )}
          {tab === "files" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                {(task.files ?? []).length === 0 ? (
                  <div style={{ padding: "20px 16px", textAlign: "center", fontFamily: FONT, fontSize: 13, color: C.muted }}>{running ? "No files yet." : "No output files."}</div>
                ) : (task.files ?? []).map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.borderSoft}`, fontFamily: MONO, fontSize: 12, color: C.fg }}>
                    <span>{f}</span>
                    <button style={btn(C)}>Download</button>
                  </div>
                ))}
              </div>
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "15px" }}>
                Files live on the task's Runtime. Once the environment is released, download or Snapshot to keep them.
              </span>
            </div>
          )}
          {tab === "logs" && (
            <div style={{ background: "#000", border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "12px 14px", fontFamily: MONO, fontSize: 12, lineHeight: "19px", color: C.fg, whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto" }}>
              {`[00:00] runtime: starting from Template ${task.agentVersion}\n[00:01] runtime: ready\n[00:01] exec: GMI_MODEL_ID=${task.model}\n[00:02] exec: running task…\n` + (running ? "[00:03] exec: in progress…" : `[00:26] exec: done (exit_code 0)\n[00:26] runtime: ${task.runtimeKept ? "kept" : "released"}`)}
            </div>
          )}
          {tab === "details" && (
            <div>
              {row("Task ID", task.id, true)}
              {row("Agent", `${task.agentName} · ${task.agentVersion}`)}
              {row("Model", `${modelName(task.model)} · GMI_MODEL_ID`)}
              {row("Input", task.input, true)}
              {row("Runtime", task.runtimeId, true)}
              {row("Environment", task.runtimeKept ? "Kept (persists after task)" : "Released after completion")}
              {row("Actual cost", task.costUsd != null ? `$${task.costUsd.toFixed(3)}` : "—")}
              {row("Duration", task.durationSec != null ? `${task.durationSec}s` : "—")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function btn(c: typeof C): React.CSSProperties {
  return { fontFamily: FONT, fontSize: 12, fontWeight: 600, color: c.fg, background: "transparent", border: `1px solid ${c.border}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer" };
}
