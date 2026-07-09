import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle, ExternalLink, Tag, AlertCircle, Clock, Copy } from "lucide-react";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import { ALL_CLAWS, getBadgeConfig } from "@/lib/clawData";
import { toast } from "sonner";

const TYPE_CONFIG: Record<string, { color: string; bg: string }> = {
  "Code & Dev Tools":     { color: "#7ec8ff", bg: "rgba(126,200,255,0.08)" },
  "Data & Analytics":     { color: "#DDEA4D", bg: "rgba(221,234,77,0.08)" },
  "Customer Support":     { color: "#34d399", bg: "rgba(52,211,153,0.08)" },
  "Content & Marketing":  { color: "#f9a8d4", bg: "rgba(249,168,212,0.08)" },
  "Research & Knowledge": { color: "#c084fc", bg: "rgba(192,132,252,0.08)" },
};

// Extended descriptions for detail page
const FULL_DESCRIPTIONS: Record<string, string> = {
  "topify-claw": "Topify Claw brings Topify's Generative Engine Optimization (GEO) platform to the GMI Claw ecosystem. It continuously monitors how your brand is mentioned, ranked, and described across the four major AI search engines: ChatGPT, Gemini, Perplexity, and Google AI Overview. Get real-time alerts, competitor comparisons, and actionable recommendations to improve your brand's AI visibility.",
  "code-review-agent": "Performs deep static analysis and semantic code review on pull requests. Identifies bugs, security vulnerabilities, and style issues. Integrates with GitHub, GitLab, and Bitbucket via webhooks. Supports over 30 programming languages including TypeScript, Python, Go, Rust, and Solidity. Provides line-by-line annotations and a summary report with severity ratings.",
  "enterprise-rag-pipeline": "Enterprise RAG Pipeline ingests documents from S3, SharePoint, Confluence, and Notion, builds a retrieval index, and answers natural language queries with cited sources. Designed for compliance-sensitive environments with full audit logs. Supports PDF, DOCX, HTML, Markdown, and plain text. Built-in access control mirrors your existing document permissions.",
  "model-benchmark-suite": "Runs MMLU, HumanEval, GSM8K, and custom task-specific benchmarks across all models available in the GMI MaaS library. Generates comparative reports with accuracy, latency, and cost-per-token analysis. Schedule automated benchmark runs to track model performance over time. Export results to CSV, JSON, or push to your observability stack.",
  "contract-review-agent": "Analyzes legal contracts for risk clauses, missing provisions, and compliance issues. Supports NDA, SaaS agreements, employment contracts, and vendor agreements. Flags jurisdiction-specific risks and provides plain-language summaries. Trained on 10M+ contracts. Not a substitute for legal counsel — use to accelerate review, not replace it.",
  "data-pipeline-debugger": "Monitors and debugs ETL pipelines in real-time. Detects schema drift, null anomalies, and volume drops. Integrates with Airflow, dbt, and Spark. Provides root-cause analysis and suggests fixes. Connects to your alerting stack (PagerDuty, Slack, OpsGenie) for immediate incident notification.",
  "customer-support-triage": "Automatically classifies, prioritizes, and routes incoming support tickets. Drafts responses for tier-1 issues and escalates complex cases with context summaries. Integrates with Zendesk, Intercom, and Freshdesk. Learns your support playbook over time. Tracks resolution rate and customer satisfaction scores.",
  "meeting-intelligence": "Transcribes, summarizes, and extracts action items from meetings. Integrates with Zoom, Google Meet, and Microsoft Teams. Sends follow-up emails automatically. Identifies decisions, owners, and deadlines. Stores searchable meeting archives. GDPR-compliant with automatic PII redaction options.",
  "creative-brief-generator": "Generates structured creative briefs from rough campaign ideas. Produces audience personas, messaging frameworks, and channel recommendations for marketing teams. Supports brand guideline uploads for consistency checks. Outputs editable briefs in PDF, Notion, or Google Docs format.",
  "sql-query-optimizer": "Analyzes slow SQL queries, suggests index strategies, and rewrites inefficient joins. Supports PostgreSQL, MySQL, BigQuery, and Snowflake. Connects to your database via read-only credentials to analyze EXPLAIN plans. Tracks query performance over time and alerts on regressions.",
  "brand-voice-writer": "Generates on-brand copy for blogs, social media, and ad campaigns. Learns your brand voice from existing content and maintains consistency across all outputs. Supports 25+ output formats. Includes a tone calibration tool and a style guide compliance checker.",
};

// ─── Image pull pre-check (PRD M6.4 clone preflight) ────────────────────
// Anonymous HEAD /v2/<name>/manifests/<ref>. Result governs whether the
// "Deploy your own" path is offered as a real clone or downgraded to
// "Try demo". The prototype maps each catalog claw to one of three
// outcomes via a deterministic mock.
type ImagePullState = "public" | "private" | "missing";
function mockImagePullState(clawId: string): ImagePullState {
  // Demo: one private, rest public. Easy to extend later.
  if (clawId === "enterprise-rag-pipeline") return "private";
  return "public";
}

function ImagePullStatus({ state }: { state: ImagePullState }) {
  if (state === "public") {
    // Public is the happy path — surface as a small inline chip, not a card.
    return (
      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: "'Geist', system-ui, sans-serif",
          fontSize: 11, fontWeight: 500, lineHeight: "16px",
          color: "#34d399",
          background: "rgba(52,211,153,0.08)",
          border: "1px solid rgba(52,211,153,0.30)",
          padding: "3px 9px",
          borderRadius: 999,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
        Cloneable · public image
      </div>
    );
  }
  if (state === "private") {
    // Structured warning card: title, body, fallback path.
    return (
      <div
        style={{
          background: "rgba(251,191,36,0.06)",
          border: "1px solid rgba(251,191,36,0.30)",
          borderRadius: 8,
          padding: "12px 14px",
          display: "flex", gap: 10, alignItems: "flex-start",
          fontFamily: "'Geist', system-ui, sans-serif",
        }}
      >
        <span
          style={{
            width: 22, height: 22, borderRadius: 999, flexShrink: 0,
            background: "rgba(251,191,36,0.14)",
            border: "1px solid rgba(251,191,36,0.45)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "#fbbf24",
            marginTop: 1,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fafafa", lineHeight: "18px" }}>
            Private image
          </div>
          <div style={{ fontSize: 12, fontWeight: 400, color: "#a3a3a3", lineHeight: "17px", marginTop: 2 }}>
            Image availability check returned 401/403 — only the publisher can pull this image.
            Deploy-your-own won't work as a clone; you can still try the publisher's
            running instance via <span style={{ color: "#fafafa" }}>Try demo</span> below.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        background: "rgba(248,113,113,0.06)",
        border: "1px solid rgba(248,113,113,0.30)",
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex", gap: 10, alignItems: "flex-start",
        fontFamily: "'Geist', system-ui, sans-serif",
      }}
    >
      <span
        style={{
          width: 22, height: 22, borderRadius: 999, flexShrink: 0,
          background: "rgba(248,113,113,0.14)",
          border: "1px solid rgba(248,113,113,0.45)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "#f87171",
          marginTop: 1,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
        </svg>
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#fafafa", lineHeight: "18px" }}>
          Image not found
        </div>
        <div style={{ fontSize: 12, fontWeight: 400, color: "#a3a3a3", lineHeight: "17px", marginTop: 2 }}>
          Image availability check returned 404 — the image reference is broken. Cloning is blocked
          until the publisher fixes the listing.
        </div>
      </div>
    </div>
  );
}

export default function ClawDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const claw = ALL_CLAWS.find((c) => c.id === id);

  if (!claw) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono-gmi text-sm text-[#a3a3a3] mb-4">// Claw not found</div>
          <Link href="/marketplace">
            <button className="btn-primary-lime text-xs px-6 py-2.5 font-bold">
              Back to Marketplace
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const badge = getBadgeConfig(claw.infrastructurePath);
  const typeStyle = TYPE_CONFIG[claw.typeLabel] || { color: "#888", bg: "rgba(136,136,136,0.08)" };
  const fullDescription = FULL_DESCRIPTIONS[claw.id] || claw.description;

  const handleAccess = () => {
    toast.success(`Connecting to ${claw.name}...`, {
      description: "You will be redirected to the Claw interface.",
    });
  };

  const handleEarlyAccess = () => {
    toast.success(`Early access requested for ${claw.name}`, {
      description: "We'll notify you when your access is granted.",
    });
  };

  return (
    <div className="min-h-screen flex bg-black text-white">
      <Topbar />
      <Navbar />

      <div className="flex-1" style={{ marginLeft: "210px", paddingTop: "40px" }}>
        <div className="pt-8 pb-20">
          <div className="px-8 max-w-6xl">

            {/* Back */}
            <Link href="/marketplace">
              <button className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors font-mono-gmi text-xs mb-10">
                <ArrowLeft size={13} /> Back to Marketplace
              </button>
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

              {/* Left: Main content — text-first layout (no media reserved) */}
              <div className="lg:col-span-2" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {/* Header */}
                <div>
                  {/* Badges row */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {/* Infrastructure badge */}
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-mono-gmi px-2.5 py-1"
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                      title={badge.tooltip}
                    >
                      <CheckCircle size={10} />
                      {badge.label}
                    </span>
                    {/* Type label */}
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-mono-gmi px-2.5 py-1"
                      style={{
                        background: typeStyle.bg,
                        color: typeStyle.color,
                        border: `1px solid ${typeStyle.color}33`,
                      }}
                    >
                      <Tag size={10} />
                      {claw.typeLabel}
                    </span>
                    {/* Built with Anthropic */}
                    {claw.builtWithAnthropic && (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-mono-gmi px-2.5 py-1"
                        style={{
                          background: "rgba(217,119,87,0.08)",
                          color: "#d97757",
                          border: "1px solid rgba(217,119,87,0.35)",
                        }}
                        title="Built with Anthropic — powered by Claude models"
                      >
                        <Tag size={10} />
                        Built with Anthropic
                      </span>
                    )}
                  </div>

                  <h1
                    className="text-white mb-3"
                    style={{
                      fontFamily: "'Geist', system-ui, sans-serif",
                      fontSize: 24,
                      fontWeight: 700,
                      lineHeight: "30px",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {claw.name}
                  </h1>

                  <div className="flex items-center gap-2 font-mono-gmi text-sm text-gray-300">
                    <span>by</span>
                    <span className="text-gray-300">{claw.publisher}</span>
                  </div>
                </div>

                {/* Two-col band: prose (lead + optional long) | Details facts card.
                    Both sides always carry content, so there's no empty half and
                    no reserved image slot to leave a hole. */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
                    gap: 24,
                    alignItems: "start",
                  }}
                >
                  {/* Prose — single substantial intro (richest text available),
                      elevated to carry the visual weight in place of an image.
                      Shown once so a superset fullDescription never repeats the
                      opening sentences. */}
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontFamily: "'Geist', system-ui, sans-serif",
                      fontSize: 16, fontWeight: 400, lineHeight: "27px",
                      color: "#e5e5e5", maxWidth: "62ch", margin: 0,
                    }}>
                      {fullDescription}
                    </p>
                  </div>

                  {/* Details facts card — surfaces Pricing / Availability / Publisher
                      and folds the old Infrastructure block into a caption. */}
                  {(() => {
                    const availLabel =
                      claw.availability === "available" ? "Available" :
                      claw.availability === "early_access" ? "Early access" : "Unavailable";
                    const availColor =
                      claw.availability === "available" ? "#DDEA4D" :
                      claw.availability === "early_access" ? "#fb923c" : "#a3a3a3";
                    const rows: { label: string; value: string; color: string }[] = [
                      { label: "Pricing", value: claw.pricing, color: "#fafafa" },
                      { label: "Availability", value: availLabel, color: availColor },
                      { label: "Publisher", value: claw.publisher, color: "#fafafa" },
                    ];
                    return (
                      <div style={{ background: "#0a0a0a", border: "1px solid #404040", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 13, fontWeight: 600, color: "#fafafa", lineHeight: "18px" }}>
                          Details
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {rows.map((r) => (
                            <div key={r.label} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                              <span style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 12, color: "#a3a3a3", lineHeight: "18px" }}>{r.label}</span>
                              <span style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 13, fontWeight: 500, color: r.color, lineHeight: "18px", textAlign: "right" }}>{r.value}</span>
                            </div>
                          ))}
                        </div>
                        {/* Infrastructure — folded in as a caption */}
                        <div style={{ borderTop: "1px solid #262626", paddingTop: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <span style={{ color: badge.color, display: "inline-flex", marginTop: 1, flexShrink: 0 }}><CheckCircle size={12} /></span>
                          <div style={{ minWidth: 0 }}>
                            <div className="font-mono-gmi" style={{ fontSize: 12, fontWeight: 700, color: badge.color, lineHeight: "16px" }}>{badge.label}</div>
                            <div className="font-mono-gmi" style={{ fontSize: 11, color: "#a3a3a3", lineHeight: "16px", marginTop: 2 }}>{badge.tooltip}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Tags — full-width module */}
                {claw.tags.length > 0 && (
                  <div>
                    <div style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 14, fontWeight: 600, color: "#fafafa", lineHeight: "20px", marginBottom: 10 }}>
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {claw.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs font-mono-gmi px-2.5 py-1 text-gray-300"
                          style={{ border: "1px solid #404040" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Right: Pricing + CTA panel */}
              <div className="lg:col-span-1">
                <div
                  className="sticky top-24 p-6 space-y-6"
                  style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
                >
                  {/* Availability status */}
                  <div className="flex items-center gap-2 font-mono-gmi text-xs">
                    {claw.availability === "available" && (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#DDEA4D" }} />
                        <span style={{ color: "#DDEA4D" }}>Available</span>
                      </>
                    )}
                    {claw.availability === "early_access" && (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#fb923c" }} />
                        <span style={{ color: "#fb923c" }}>Early Access</span>
                      </>
                    )}
                    {claw.availability === "unavailable" && (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#999" }} />
                        <span className="text-[#a3a3a3]">Unavailable</span>
                      </>
                    )}
                  </div>

                  {/* CTA — fork template into Register & List wizard */}
                  {claw.availability === "available" && (() => {
                    const pullState = mockImagePullState(claw.id);
                    const canClone = pullState !== "missing";
                    return (
                      <div className="space-y-3">
                        <ImagePullStatus state={pullState} />
                        <button
                          disabled={!canClone}
                          onClick={() => canClone && setLocation(`/deploy?use=${claw.id}`)}
                          className="w-full py-3 font-bold text-sm flex items-center justify-center gap-2 transition-all"
                          style={{
                            background: canClone ? "#DDEA4D" : "#404040",
                            color: canClone ? "#000000" : "#666",
                            cursor: canClone ? "pointer" : "not-allowed",
                          }}
                          onMouseEnter={(e) => { if (canClone) (e.currentTarget as HTMLButtonElement).style.background = "#e8f060"; }}
                          onMouseLeave={(e) => { if (canClone) (e.currentTarget as HTMLButtonElement).style.background = "#DDEA4D"; }}
                        >
                          <Copy size={13} />
                          {pullState === "private" ? "Try demo ↗" : "Deploy your own ↗"}
                        </button>
                        <p className="text-xs text-[#a3a3a3] font-mono-gmi text-center mt-1">
                          {pullState === "public"
                            ? "Opens Register & List pre-filled with image, env declarations, and ports. You bring your own GMI key + billing."
                            : pullState === "private"
                              ? "Image is publisher-only — uses the publisher's running instance + their billing."
                              : "Listing is broken; cloning is blocked until fixed."}
                        </p>
                      </div>
                    );
                  })()}

                  {claw.availability === "early_access" && (
                    <div className="space-y-3">
                      <button
                        onClick={handleEarlyAccess}
                        className="w-full py-3 font-bold text-sm flex items-center justify-center gap-2 transition-all"
                        style={{ border: "1px solid #fb923c", color: "#fb923c", background: "transparent" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,146,60,0.08)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                      >
                        <Clock size={14} />
                        Request Early Access
                      </button>
                      <p className="text-xs text-gray-300 font-mono-gmi text-center">
                        Limited beta. Join the waitlist to be notified when access opens.
                      </p>
                    </div>
                  )}

                  {claw.availability === "unavailable" && (
                    <div>
                      <div
                        className="w-full py-3 text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                        style={{ background: "#111", color: "#999", border: "1px solid #404040" }}
                      >
                        <AlertCircle size={14} />
                        Unavailable
                      </div>
                      <p className="text-xs text-gray-300 font-mono-gmi mt-2 text-center">
                        This Claw is not currently accepting new users.
                      </p>
                    </div>
                  )}

                  {/* Trust info */}
                  <div style={{ borderTop: "1px solid #1e1e1e" }} />
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-xs text-[#a3a3a3] font-mono-gmi">
                      <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: badge.color }} />
                      <span>{badge.tooltip}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-[#a3a3a3] font-mono-gmi">
                      <CheckCircle size={12} className="shrink-0 mt-0.5 text-gray-300" />
                      <span>Browser-based. No SDK, API key, or installation required.</span>
                    </div>

                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
