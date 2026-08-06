import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import { C, FONT, MONO } from "@/lib/tokens";
import {
  getAgent, TASK_MODELS, FEATURED_TASK_MODEL, estimateCostUsd, modelName,
  upsertTask, newTaskId, type EnvPolicy, type Task,
} from "@/lib/tasksModel";

// Run Task — the projection of Agent Version → Saved Launch Config → Task → Runtime.
// A user picks a version, model, credentials, input, and environment policy, then
// runs. Running creates a Task (with its Runtime) and routes to the Task detail.
export default function RunTask() {
  const [, params] = useRoute("/run/:agentId");
  const [, setLocation] = useLocation();
  const agentId = params?.agentId ?? "";
  const agent = getAgent(agentId);

  const [model, setModel] = useState(agent?.model ?? FEATURED_TASK_MODEL.id);
  const [credential, setCredential] = useState("");
  const [input, setInput] = useState("");
  const [envPolicy, setEnvPolicy] = useState<EnvPolicy>("release");
  const [ackOutOfPlan, setAckOutOfPlan] = useState(false); // friction gate for out-of-plan models

  if (!agent) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
        <Topbar /><Navbar />
        <div style={{ marginLeft: 210, paddingTop: 80, textAlign: "center", color: C.muted }}>
          Agent not found. <button onClick={() => setLocation("/marketplace")} style={{ color: C.lime, background: "none", border: "none", cursor: "pointer" }}>Browse Agents</button>
        </div>
      </div>
    );
  }

  const cost = estimateCostUsd(model);
  const inPlan = !!TASK_MODELS.find((m) => m.id === model)?.plan;
  const blocked = !inPlan && !ackOutOfPlan; // must acknowledge before leaving the Coding Plan

  const run = () => {
    const id = newTaskId();
    const task: Task = {
      id, agentId: agent.id, agentName: agent.name, agentVersion: agent.version,
      model, input: input.trim() || "(no input)",
      status: "running", createdAt: Date.now(),
      envPolicy, runtimeId: `rt_${id.slice(5, 13)}`, runtimeKept: envPolicy === "keep",
    };
    upsertTask(task);
    setLocation(`/tasks/${id}`);
  };

  const label: React.CSSProperties = { fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" };
  const field: React.CSSProperties = { background: C.pillBg, border: `1px solid ${C.border}`, color: C.fg, fontFamily: FONT, fontSize: 13, padding: "9px 11px", borderRadius: 8, outline: "none", width: "100%" };
  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar /><Navbar />
      <div style={{ marginLeft: 210, paddingTop: 40, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div style={{ maxWidth: 720, width: "100%", margin: "0 auto", padding: "24px 32px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Header */}
          <div>
            <button onClick={() => setLocation(`/marketplace/${agent.id}`)} style={{ fontFamily: FONT, fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>← {agent.name}</button>
            <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: C.fg, margin: "6px 0 0" }}>Run Task</h1>
            <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: "4px 0 0" }}>
              Runs <span style={{ color: C.fg }}>{agent.name}</span> in an isolated environment and returns a result.
            </p>
          </div>

          {/* Version */}
          <div style={card}>
            <span style={label}>Version</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 13, color: C.fg }}>
              {agent.name} · <span style={{ color: C.lime }}>{agent.version}</span>
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>(Production)</span>
            </div>
          </div>

          {/* Input */}
          <div style={card}>
            <span style={label}>Input</span>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe the task or pass parameters…" rows={4} style={{ ...field, resize: "vertical", fontFamily: MONO, fontSize: 12 }} />
          </div>

          {/* Model (F-08) */}
          <div style={card}>
            <span style={label}>Model</span>
            <select value={model} onChange={(e) => { setModel(e.target.value); setAckOutOfPlan(false); }} style={{ ...field, cursor: "pointer" }}>
              <optgroup label="In your Coding Plan">
                {TASK_MODELS.filter((m) => m.plan).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.featured ? " · Featured" : ""}</option>
                ))}
              </optgroup>
              {TASK_MODELS.some((m) => !m.plan) && (
                <optgroup label="Other models · not covered">
                  {TASK_MODELS.filter((m) => !m.plan).map((m) => <option key={m.id} value={m.id}>{m.name} — pay-as-you-go</option>)}
                </optgroup>
              )}
            </select>
            {inPlan ? (
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>Covered by your Coding Plan · injected as locked <span style={{ fontFamily: MONO }}>GMI_MODEL_ID</span>.</span>
            ) : (
              /* Friction — leaving the Coding Plan requires an explicit acknowledgement */
              <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.40)", borderRadius: 8, padding: "10px 12px" }}>
                <span style={{ fontFamily: FONT, fontSize: 12, color: C.fg, lineHeight: "17px" }}>
                  <span style={{ color: "#fbbf24", fontWeight: 700 }}>⚠ Not in your Coding Plan.</span> {modelName(model)} is billed pay-as-you-go and is not covered by your plan — expect a higher cost per run.
                </span>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={ackOutOfPlan} onChange={(e) => setAckOutOfPlan(e.target.checked)} style={{ accentColor: "#fbbf24", width: 15, height: 15 }} />
                  <span style={{ fontFamily: FONT, fontSize: 12, color: C.fg }}>I understand this run isn't covered by my Coding Plan.</span>
                </label>
              </div>
            )}
          </div>

          {/* Credentials */}
          <div style={card}>
            <span style={label}>Credentials <span style={{ color: C.muted, textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· optional</span></span>
            <input value={credential} onChange={(e) => setCredential(e.target.value)} placeholder="e.g. GITHUB_TOKEN — required secrets this agent declares" style={{ ...field, fontFamily: MONO, fontSize: 12 }} />
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>Secrets are injected fresh per task and never written to a Snapshot.</span>
          </div>

          {/* Environment lifecycle */}
          <div style={card}>
            <span style={label}>Environment</span>
            {(["release", "keep"] as const).map((p) => (
              <label key={p} style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
                <input type="radio" name="envpolicy" checked={envPolicy === p} onChange={() => setEnvPolicy(p)} style={{ accentColor: C.lime, width: 15, height: 15, marginTop: 2 }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: C.fg }}>{p === "release" ? "Release after completion" : "Keep environment after completion"}</span>
                  <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
                    {p === "release" ? "Default — the Runtime is deleted when the task finishes; only the result is kept." : "Advanced — the Runtime persists so you can Resume, Snapshot, or reach its Endpoint."}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {/* Estimated cost + Run */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 16 }}>
            <span style={{ fontFamily: FONT, fontSize: 13, color: C.muted }}>
              Estimated cost <span style={{ color: C.fg, fontWeight: 600 }}>≈ ${cost.toFixed(2)}</span> · {modelName(model)}
              {!inPlan && <span style={{ color: "#fbbf24" }}> · pay-as-you-go</span>}
            </span>
            <button
              onClick={run}
              disabled={blocked}
              title={blocked ? "Acknowledge the out-of-plan cost above to run" : undefined}
              style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, background: blocked ? "#3a3a1f" : C.lime, color: blocked ? "#6b6b52" : C.limeText, border: "none", borderRadius: 10, padding: "10px 22px", cursor: blocked ? "not-allowed" : "pointer" }}
            >
              Run Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
