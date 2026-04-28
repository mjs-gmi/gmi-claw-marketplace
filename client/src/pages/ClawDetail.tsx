import { useParams, Link } from "wouter";
import { ArrowLeft, CheckCircle, ExternalLink, Tag, AlertCircle, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import { ALL_CLAWS, getBadgeConfig } from "@/lib/clawData";
import { toast } from "sonner";
import { ImageIcon } from "lucide-react";

const TYPE_CONFIG: Record<string, { color: string; bg: string }> = {
  Developer: { color: "#7ec8ff", bg: "rgba(126,200,255,0.08)" },
  Productivity: { color: "#c084fc", bg: "rgba(192,132,252,0.08)" },
  Business: { color: "#fb923c", bg: "rgba(251,146,60,0.08)" },
  Creative: { color: "#DDEA4D", bg: "rgba(221,234,77,0.08)" },
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

export default function ClawDetail() {
  const { id } = useParams<{ id: string }>();
  const claw = ALL_CLAWS.find((c) => c.id === id);

  if (!claw) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono-gmi text-sm text-gray-400 mb-4">// Claw not found</div>
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

              {/* Left: Main content */}
              <div className="lg:col-span-2 space-y-8">

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
                  </div>

                  <h1
                    className="font-display text-4xl text-white mb-3"
                    style={{ letterSpacing: "-0.03em" }}
                  >
                    {claw.name}
                  </h1>

                  <div className="flex items-center gap-2 font-mono-gmi text-sm text-gray-300">
                    <span>by</span>
                    <span className="text-gray-300">{claw.publisher}</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {claw.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-mono-gmi px-2.5 py-1 text-gray-300"
                      style={{ border: "1px solid #2a2a2a" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Description */}
                <div>
                  <h2 className="font-display text-lg text-white mb-3">About this Claw</h2>
                  <p className="text-gray-400 leading-relaxed text-sm">{fullDescription}</p>
                </div>

                {/* Image placeholder */}
                <div>
                  <h2 className="font-display text-lg text-white mb-3">Preview</h2>
                  <div
                    className="w-full flex flex-col items-center justify-center gap-3"
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid #1e1e1e",
                      aspectRatio: "16/9",
                    }}
                  >
                    <ImageIcon size={36} className="text-gray-700" />
                    <span className="font-mono-gmi text-xs text-gray-600">Image / Demo coming soon</span>
                  </div>
                </div>

                {/* Infrastructure info */}
                <div>
                  <h2 className="font-display text-lg text-white mb-3">Infrastructure</h2>
                  <div
                    className="p-4 flex items-start gap-3"
                    style={{ background: "#0a0a0a", border: `1px solid ${badge.border}` }}
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: badge.color }}
                    />
                    <div>
                      <div className="font-mono-gmi text-sm font-bold mb-1" style={{ color: badge.color }}>
                        {badge.label}
                      </div>
                      <div className="text-xs text-gray-300 font-mono-gmi leading-relaxed">
                        {badge.tooltip}
                      </div>
                    </div>
                  </div>
                </div>

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
                        <span className="text-gray-400">Unavailable</span>
                      </>
                    )}
                  </div>

                  {/* CTA */}
                  {claw.availability === "available" && (
                    <button
                      onClick={handleAccess}
                      className="w-full py-3 font-bold text-sm flex items-center justify-center gap-2 transition-all"
                      style={{ background: "#DDEA4D", color: "#000000" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#e8f060")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#DDEA4D")}
                    >
                      Access Claw <ExternalLink size={14} />
                    </button>
                  )}

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
                        style={{ background: "#111", color: "#999", border: "1px solid #2a2a2a" }}
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
                    <div className="flex items-start gap-2 text-xs text-gray-400 font-mono-gmi">
                      <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: badge.color }} />
                      <span>{badge.tooltip}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-gray-400 font-mono-gmi">
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
