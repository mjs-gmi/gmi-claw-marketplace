import { Play, ImageIcon } from "lucide-react";

// Each claw gets a unique demo preview — styled as a mock UI screenshot / data viz
const DEMO_CONFIGS: Record<string, {
  label: string;
  accent: string;
  render: () => JSX.Element;
}> = {
  "topify-claw": {
    label: "Live Demo Preview",
    accent: "#DDEA4D",
    render: () => (
      <div className="w-full h-full p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono-gmi" style={{ color: "#DDEA4D" }}>AI VISIBILITY SCORE</span>
          <span className="text-xs font-mono-gmi text-gray-500">live · updated 2m ago</span>
        </div>
        {/* Score bars */}
        {[
          { engine: "ChatGPT", score: 82, color: "#10b981" },
          { engine: "Gemini", score: 67, color: "#3b82f6" },
          { engine: "Perplexity", score: 74, color: "#a855f7" },
          { engine: "Google AI", score: 59, color: "#f59e0b" },
        ].map(({ engine, score, color }) => (
          <div key={engine} className="flex items-center gap-3">
            <span className="text-xs font-mono-gmi text-gray-400 w-20 shrink-0">{engine}</span>
            <div className="flex-1 h-2 rounded-full" style={{ background: "#1a1a1a" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${score}%`, background: color }}
              />
            </div>
            <span className="text-xs font-mono-gmi w-8 text-right" style={{ color }}>{score}</span>
          </div>
        ))}
        <div className="mt-2 p-3 text-xs font-mono-gmi" style={{ background: "rgba(221,234,77,0.06)", border: "1px solid rgba(221,234,77,0.2)", color: "#DDEA4D" }}>
          ↑ Brand mentions up 14% this week across AI search engines
        </div>
      </div>
    ),
  },

  "code-review-agent": {
    label: "Demo Preview",
    accent: "#7ec8ff",
    render: () => (
      <div className="w-full h-full p-5 flex flex-col gap-3 font-mono-gmi text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-gray-500 ml-2">pull_request_handler.ts — Code Review</span>
        </div>
        <div className="space-y-1.5">
          {[
            { line: "23", type: "error", msg: "SQL injection risk: unsanitized input", color: "#f87171" },
            { line: "41", type: "warn", msg: "Unused variable `tempResult`", color: "#fbbf24" },
            { line: "67", type: "info", msg: "Consider memoizing this computation", color: "#7ec8ff" },
            { line: "89", type: "ok", msg: "Auth check correctly placed", color: "#34d399" },
          ].map(({ line, type, msg, color }) => (
            <div key={line} className="flex items-start gap-2 p-2" style={{ background: "#0d0d0d", border: `1px solid ${color}22` }}>
              <span style={{ color: "#444" }}>L{line}</span>
              <span className="uppercase text-[10px] px-1 rounded" style={{ background: `${color}22`, color }}>{type}</span>
              <span style={{ color: "#aaa" }}>{msg}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto flex gap-4 text-[10px] text-gray-500">
          <span style={{ color: "#f87171" }}>● 1 error</span>
          <span style={{ color: "#fbbf24" }}>● 1 warning</span>
          <span style={{ color: "#7ec8ff" }}>● 1 suggestion</span>
        </div>
      </div>
    ),
  },

  "enterprise-rag-pipeline": {
    label: "Demo Preview",
    accent: "#7ec8ff",
    render: () => (
      <div className="w-full h-full p-5 flex flex-col gap-3 font-mono-gmi text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: "#7ec8ff" }}>QUERY</span>
          <span className="text-gray-600">→</span>
          <span className="text-gray-400">enterprise-rag-pipeline</span>
        </div>
        <div className="p-3 text-gray-300" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
          "What is our data retention policy for EU customers?"
        </div>
        <div className="text-gray-500 text-[10px]">Retrieving from 3 sources…</div>
        <div className="space-y-2">
          {[
            { src: "privacy-policy-v3.pdf", excerpt: "EU customer data retained for 24 months per GDPR Art. 5(1)(e)…", score: 0.97 },
            { src: "compliance-handbook.docx", excerpt: "Data minimisation applies to all PII collected after Jan 2023…", score: 0.91 },
            { src: "Confluence: Data Governance", excerpt: "Retention schedule reviewed quarterly by DPO…", score: 0.84 },
          ].map(({ src, excerpt, score }) => (
            <div key={src} className="p-2.5" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
              <div className="flex justify-between mb-1">
                <span style={{ color: "#7ec8ff" }}>{src}</span>
                <span className="text-gray-500">score: {score}</span>
              </div>
              <span className="text-gray-400 text-[11px]">{excerpt}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  "model-benchmark-suite": {
    label: "Demo Preview",
    accent: "#DDEA4D",
    render: () => (
      <div className="w-full h-full p-5 flex flex-col gap-3 font-mono-gmi text-xs">
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: "#DDEA4D" }}>BENCHMARK RESULTS</span>
          <span className="text-gray-500">HumanEval · GSM8K · MMLU</span>
        </div>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-gray-500">
              <td className="pb-2">Model</td>
              <td className="pb-2 text-right">HumanEval</td>
              <td className="pb-2 text-right">GSM8K</td>
              <td className="pb-2 text-right">Latency</td>
            </tr>
          </thead>
          <tbody>
            {[
              { model: "Llama-3.1-70B", he: "82.3%", gsm: "91.2%", lat: "210ms", top: true },
              { model: "Qwen2.5-72B", he: "79.8%", gsm: "89.5%", lat: "198ms", top: false },
              { model: "Mistral-7B", he: "64.1%", gsm: "71.3%", lat: "88ms", top: false },
              { model: "DeepSeek-R1", he: "88.7%", gsm: "94.1%", lat: "340ms", top: false },
            ].map(({ model, he, gsm, lat, top }) => (
              <tr key={model} style={{ color: top ? "#DDEA4D" : "#888", borderTop: "1px solid #1a1a1a" }}>
                <td className="py-1.5">{top ? "★ " : ""}{model}</td>
                <td className="text-right">{he}</td>
                <td className="text-right">{gsm}</td>
                <td className="text-right">{lat}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-auto text-[10px] text-gray-600">Run on GMI MaaS · Apr 2025</div>
      </div>
    ),
  },

  "contract-review-agent": {
    label: "Demo Preview",
    accent: "#fb923c",
    render: () => (
      <div className="w-full h-full p-5 flex flex-col gap-3 font-mono-gmi text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: "#fb923c" }}>CONTRACT ANALYSIS</span>
          <span className="text-gray-600">NDA_v2_final.pdf</span>
        </div>
        <div className="space-y-2">
          {[
            { clause: "Liability Cap", risk: "HIGH", note: "Uncapped liability for IP infringement", color: "#f87171" },
            { clause: "Non-Compete", risk: "MED", note: "2-year scope may be unenforceable in CA", color: "#fbbf24" },
            { clause: "Governing Law", risk: "LOW", note: "Delaware — standard for SaaS agreements", color: "#34d399" },
            { clause: "Auto-Renewal", risk: "MED", note: "30-day notice window is shorter than standard", color: "#fbbf24" },
          ].map(({ clause, risk, note, color }) => (
            <div key={clause} className="flex items-start gap-2 p-2.5" style={{ background: "#0d0d0d", border: `1px solid ${color}33` }}>
              <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded" style={{ background: `${color}22`, color }}>{risk}</span>
              <div>
                <div className="font-bold text-gray-300 mb-0.5">{clause}</div>
                <div className="text-gray-500">{note}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto text-[10px] text-gray-600">4 clauses reviewed · 2 require attention</div>
      </div>
    ),
  },

  "data-pipeline-debugger": {
    label: "Demo Preview",
    accent: "#c084fc",
    render: () => (
      <div className="w-full h-full p-5 flex flex-col gap-3 font-mono-gmi text-xs">
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: "#c084fc" }}>PIPELINE MONITOR</span>
          <span className="text-gray-500">dbt · Airflow · Spark</span>
        </div>
        {[
          { step: "raw_events_ingest", status: "ok", rows: "2.4M", time: "1.2s" },
          { step: "user_sessions_join", status: "warn", rows: "1.1M", time: "8.7s" },
          { step: "revenue_aggregation", status: "error", rows: "—", time: "—" },
          { step: "dashboard_export", status: "blocked", rows: "—", time: "—" },
        ].map(({ step, status, rows, time }) => {
          const colors: Record<string, string> = { ok: "#34d399", warn: "#fbbf24", error: "#f87171", blocked: "#555" };
          return (
            <div key={step} className="flex items-center gap-3 p-2" style={{ background: "#0d0d0d", border: `1px solid ${colors[status]}33` }}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[status] }} />
              <span className="flex-1 text-gray-300">{step}</span>
              <span className="text-gray-500">{rows}</span>
              <span style={{ color: colors[status] }}>{time}</span>
            </div>
          );
        })}
        <div className="p-2.5 text-[11px]" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
          ⚠ Schema drift detected in <strong>revenue_aggregation</strong>: column `amount_usd` missing
        </div>
      </div>
    ),
  },

  "customer-support-triage": {
    label: "Demo Preview",
    accent: "#c084fc",
    render: () => (
      <div className="w-full h-full p-5 flex flex-col gap-3 font-mono-gmi text-xs">
        <div className="flex items-center justify-between mb-1">
          <span style={{ color: "#c084fc" }}>TICKET TRIAGE</span>
          <span className="text-gray-500">12 new · 3 escalated</span>
        </div>
        <div className="space-y-2">
          {[
            { id: "#4821", subject: "Can't log in after password reset", priority: "P1", action: "Auto-replied", color: "#f87171" },
            { id: "#4820", subject: "Invoice discrepancy for March", priority: "P2", action: "Escalated → Billing", color: "#fbbf24" },
            { id: "#4819", subject: "How do I export my data?", priority: "P3", action: "Auto-replied", color: "#34d399" },
            { id: "#4818", subject: "Feature request: dark mode", priority: "P4", action: "Tagged → Product", color: "#7ec8ff" },
          ].map(({ id, subject, priority, action, color }) => (
            <div key={id} className="p-2.5" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-gray-500">{id}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${color}22`, color }}>{priority}</span>
              </div>
              <div className="text-gray-300 mb-0.5">{subject}</div>
              <div className="text-[10px]" style={{ color }}>{action}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  "meeting-intelligence": {
    label: "Demo Preview",
    accent: "#7ec8ff",
    render: () => (
      <div className="w-full h-full p-5 flex flex-col gap-3 font-mono-gmi text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: "#7ec8ff" }}>MEETING SUMMARY</span>
          <span className="text-gray-600">Q2 Planning · 47 min</span>
        </div>
        <div className="p-3 text-gray-400 leading-relaxed" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
          Discussed roadmap priorities for Q2. Team aligned on launching the API v2 by May 15. Marketing to prepare launch assets by May 1.
        </div>
        <div style={{ color: "#7ec8ff" }} className="mt-1">ACTION ITEMS</div>
        <div className="space-y-1.5">
          {[
            { owner: "Sarah", task: "Finalize API v2 spec", due: "Apr 30" },
            { owner: "James", task: "Draft launch blog post", due: "May 1" },
            { owner: "Priya", task: "Set up staging environment", due: "Apr 28" },
          ].map(({ owner, task, due }) => (
            <div key={task} className="flex items-center gap-2 p-2" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: "rgba(126,200,255,0.15)", color: "#7ec8ff" }}>{owner[0]}</div>
              <span className="flex-1 text-gray-300">{task}</span>
              <span className="text-gray-500">{due}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  "creative-brief-generator": {
    label: "Demo Preview",
    accent: "#DDEA4D",
    render: () => (
      <div className="w-full h-full p-5 flex flex-col gap-3 font-mono-gmi text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: "#DDEA4D" }}>CREATIVE BRIEF</span>
          <span className="text-gray-600">Summer Launch Campaign</span>
        </div>
        {[
          { label: "OBJECTIVE", value: "Drive 20% uplift in trial signups among SMB segment" },
          { label: "AUDIENCE", value: "Ops managers, 30–45, SaaS-native, cost-conscious" },
          { label: "TONE", value: "Confident · Practical · No fluff" },
          { label: "CHANNELS", value: "LinkedIn Ads · Email · Product Hunt" },
          { label: "KEY MESSAGE", value: "\"Cut your ops overhead in half — in one afternoon.\"" },
        ].map(({ label, value }) => (
          <div key={label} className="p-2.5" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
            <div className="text-[10px] mb-0.5" style={{ color: "#DDEA4D" }}>{label}</div>
            <div className="text-gray-300">{value}</div>
          </div>
        ))}
      </div>
    ),
  },

  "sql-query-optimizer": {
    label: "Demo Preview",
    accent: "#7ec8ff",
    render: () => (
      <div className="w-full h-full p-5 flex flex-col gap-3 font-mono-gmi text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: "#7ec8ff" }}>QUERY ANALYSIS</span>
          <span className="text-gray-600">PostgreSQL · 2.4s → 0.08s</span>
        </div>
        <div className="p-3" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
          <div className="text-gray-500 mb-1">BEFORE</div>
          <code className="text-[11px] text-gray-400 leading-relaxed">
            SELECT * FROM orders o<br />
            JOIN users u ON o.user_id = u.id<br />
            WHERE o.created_at &gt; '2024-01-01'<br />
            ORDER BY o.total DESC
          </code>
        </div>
        <div className="p-3" style={{ background: "rgba(126,200,255,0.04)", border: "1px solid rgba(126,200,255,0.3)" }}>
          <div className="mb-1" style={{ color: "#7ec8ff" }}>OPTIMIZED</div>
          <code className="text-[11px] text-gray-300 leading-relaxed">
            SELECT o.id, o.total, u.name<br />
            FROM orders o<br />
            JOIN users u ON o.user_id = u.id<br />
            WHERE o.created_at &gt; '2024-01-01'<br />
            ORDER BY o.total DESC
          </code>
        </div>
        <div className="text-[10px] text-gray-500">+ Added index on <span style={{ color: "#7ec8ff" }}>orders(created_at, total)</span></div>
      </div>
    ),
  },

  "brand-voice-writer": {
    label: "Demo Preview",
    accent: "#DDEA4D",
    render: () => (
      <div className="w-full h-full p-5 flex flex-col gap-3 font-mono-gmi text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: "#DDEA4D" }}>BRAND VOICE OUTPUT</span>
          <span className="text-gray-600">LinkedIn Post</span>
        </div>
        <div className="p-3 text-gray-300 leading-relaxed" style={{ background: "#0d0d0d", border: "1px solid #1e1e1e" }}>
          We just shipped something we've been building for months.<br /><br />
          Not a feature. A rethink.<br /><br />
          Most teams spend 40% of their week on work about work. We built a way to cut that in half — without changing how your team operates.<br /><br />
          Details in the comments. 👇
        </div>
        <div className="flex gap-3 text-[10px]">
          <span className="px-2 py-1 rounded" style={{ background: "rgba(221,234,77,0.08)", color: "#DDEA4D", border: "1px solid rgba(221,234,77,0.2)" }}>✓ On-brand</span>
          <span className="px-2 py-1 rounded" style={{ background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>✓ Tone match: 96%</span>
        </div>
      </div>
    ),
  },
};

// Fallback for any claw without a specific config
function FallbackPreview({ name, accent }: { name: string; accent: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: `${accent}18`, border: `1px solid ${accent}44` }}
      >
        <ImageIcon size={28} style={{ color: accent }} />
      </div>
      <div className="text-center">
        <div className="font-mono-gmi text-sm font-bold text-gray-300 mb-1">{name}</div>
        <div className="font-mono-gmi text-xs text-gray-600">Demo preview coming soon</div>
      </div>
    </div>
  );
}

interface ClawDemoPreviewProps {
  clawId: string;
  clawName: string;
  accent?: string;
}

export default function ClawDemoPreview({ clawId, clawName, accent = "#DDEA4D" }: ClawDemoPreviewProps) {
  const config = DEMO_CONFIGS[clawId];

  return (
    <div className="w-full">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg text-white">Preview</h2>
        <div className="flex items-center gap-1.5 font-mono-gmi text-xs text-gray-500">
          <Play size={10} />
          {config?.label ?? "Demo Preview"}
        </div>
      </div>

      {/* Preview frame */}
      <div
        className="w-full overflow-hidden"
        style={{
          background: "#080808",
          border: "1px solid #1e1e1e",
          minHeight: "280px",
          position: "relative",
        }}
      >
        {/* Top bar chrome */}
        <div
          className="flex items-center gap-1.5 px-4 py-2.5"
          style={{ borderBottom: "1px solid #141414", background: "#0a0a0a" }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: "#2a2a2a" }} />
          <div className="w-2 h-2 rounded-full" style={{ background: "#2a2a2a" }} />
          <div className="w-2 h-2 rounded-full" style={{ background: "#2a2a2a" }} />
          <div
            className="ml-3 flex-1 h-5 rounded-sm flex items-center px-2 font-mono-gmi text-[10px] text-gray-600"
            style={{ background: "#111", maxWidth: "260px" }}
          >
            claw.gmi.ai/{clawId}
          </div>
        </div>

        {/* Content */}
        <div style={{ minHeight: "240px" }}>
          {config ? (
            config.render()
          ) : (
            <FallbackPreview name={clawName} accent={accent} />
          )}
        </div>

        {/* Subtle overlay badge */}
        <div
          className="absolute bottom-3 right-3 font-mono-gmi text-[10px] px-2 py-1"
          style={{ background: "rgba(0,0,0,0.7)", color: "#333", border: "1px solid #1a1a1a" }}
        >
          DEMO · NOT LIVE DATA
        </div>
      </div>
    </div>
  );
}
