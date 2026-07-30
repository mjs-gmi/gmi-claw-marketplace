import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle, ExternalLink, AlertCircle, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import { ALL_CLAWS, getBadgeConfig } from "@/lib/clawData";
import { FONT, C, TYPE_COLOR } from "@/lib/tokens";
import { PlanBadge, DiscountedPrice } from "@/components/PlanUI";
import { isPlanEligibleAgent, discountPriceString, CODING_AGENT_PLAN } from "@/lib/modelsPlan";
import { toast } from "sonner";

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

// ─── Full Description renderer ──────────────────────────────────────────
// The publish form collects Full Description as Markdown. Dependency-free,
// line-based parser: ## / ### headings, - / * bullet lists, blank-line
// paragraphs, and inline **bold**. Handles the heading + paragraph + list
// mix used by real listings without pulling in a markdown parser.
const FD_FONT = FONT;

function renderInline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} style={{ color: C.fg, fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

type FdBlock =
  | { kind: "h"; level: 2 | 3; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

function parseMarkdownLite(text: string): FdBlock[] {
  const blocks: FdBlock[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push({ kind: "p", text: para.join(" ") }); para = []; } };
  const flushList = () => { if (list.length) { blocks.push({ kind: "ul", items: list }); list = []; } };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    const heading = line.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      flushPara(); flushList();
      blocks.push({ kind: "h", level: heading[1].length as 2 | 3, text: heading[2] });
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) { flushPara(); list.push(bullet[1]); continue; }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return blocks;
}

function FullDescription({ text }: { text: string }) {
  const blocks = parseMarkdownLite(text);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          // Sans subheading — matches the List-an-Agent form's typography.
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT,
                fontSize: b.level === 2 ? 16 : 14,
                fontWeight: 600,
                color: C.fg,
                lineHeight: "22px",
                letterSpacing: "-0.01em",
                marginTop: i === 0 ? 0 : 14,
              }}
            >
              {b.text}
            </div>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {b.items.map((it, j) => (
                <li key={j} style={{ fontFamily: FD_FONT, fontSize: 14.5, lineHeight: "24px", color: "#c4c4c4" }}>
                  {renderInline(it)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} style={{ fontFamily: FD_FONT, fontSize: 14.5, fontWeight: 400, lineHeight: "25px", color: "#c4c4c4", margin: 0, maxWidth: "70ch" }}>
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}

// The Short Description (hero tagline) and Full Description are separate
// required fields, but publishers often make Full a superset of Short — which
// reads as a duplicate on the page. Drop any leading Full sentences that are
// already verbatim in Short so "About" starts with genuinely new detail.
function aboutBody(full: string, short: string): string {
  // Authored markdown (headings / bullets) is deliberate — never reflow it.
  // The sentence-level de-dupe below is only safe on flat single-paragraph prose.
  if (/(^|\n)\s*(#{1,3}\s|[-*]\s)/.test(full)) return full.trim();
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase().replace(/[.!?]+$/, "");
  const shortSents = short.split(/(?<=[.!?])\s+/).map(norm).filter(Boolean);
  // A leading Full sentence is redundant if it equals a hero sentence or merely
  // extends one ("…Bitbucket." vs "…Bitbucket via webhooks.").
  const redundant = (p: string) => {
    const n = norm(p);
    return shortSents.some((ss) => n === ss || n.startsWith(ss + " "));
  };
  const parts = full.split(/(?<=[.!?])\s+/);
  let i = 0;
  while (i < parts.length && redundant(parts[i])) i++;
  return parts.slice(i).join(" ").trim();
}

// Tag chip — sharp, mono, hover→lime. The one interactive micro-detail on the
// page; gives the body scannable structure beyond the prose paragraph.
function TagChip({ label }: { label: string }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: FONT,
        fontSize: 12,
        lineHeight: "16px",
        color: hover ? C.lime : C.muted,
        border: `1px solid ${hover ? C.lime : "#303030"}`,
        background: hover ? "rgba(221,234,77,0.06)" : "rgba(255,255,255,0.02)",
        padding: "5px 11px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        transition: "color 0.12s ease, border-color 0.12s ease, background 0.12s ease",
        cursor: "default",
      }}
    >
      {label}
    </span>
  );
}

// Publisher avatar — renders the uploaded Logo when present, else a monogram
// fallback so the header always carries visual weight (logo is optional).
function PublisherAvatar({ publisher, color, size = 34, logoUrl }: { publisher: string; color: string; size?: number; logoUrl?: string }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${publisher} logo`}
        width={size}
        height={size}
        style={{ width: size, height: size, flexShrink: 0, objectFit: "cover", border: "1px solid #303030", background: C.bg, borderRadius: 8 }}
      />
    );
  }
  const clean = publisher.replace(/[^a-zA-Z0-9]/g, "");
  const display = clean ? clean[0].toUpperCase() + (clean[1] || "").toLowerCase() : "?";
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: 8,
        background: `${color}1f`,
        border: `1px solid ${color}59`,
        color,
        fontFamily: FONT,
        fontSize: Math.round(size * 0.4),
        fontWeight: 700,
        letterSpacing: "-0.02em",
      }}
    >
      {display}
    </span>
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
  const typeColor = TYPE_COLOR[claw.typeLabel] ?? "#888";
  const fullDescription = FULL_DESCRIPTIONS[claw.id] || claw.description;
  const about = aboutBody(fullDescription, claw.description);

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

              {/* Left: Main content — content-first. The required fields carry
                  the page (Category, Name, Publisher, Short Description as the
                  hero line, then Full Description). Media is optional and only
                  appears, below the fold, when the publisher provided one. */}
              <div className="lg:col-span-2" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {/* Identity panel — rounded card holding every required identity field
                    (Category, Name, Publisher, Short Description) as one unit,
                    so the page has a strong hero without needing any media. */}
                <div
                  style={{ border: "1px solid #262626", background: C.cardSolid, padding: "24px 26px", borderRadius: 10 }}
                >
                  {/* Category (+ Anthropic) — rounded pills */}
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 18 }}>
                    <span
                      className="inline-flex items-center"
                      style={{
                        gap: 6,
                        fontFamily: FONT,
                        fontSize: 12,
                        fontWeight: 500,
                        lineHeight: "16px",
                        color: "#c4c4c4",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid #303030",
                        padding: "4px 10px",
                        borderRadius: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: typeColor, flexShrink: 0 }} />
                      {claw.typeLabel}
                    </span>
                  </div>

                  {/* Agent Name + verified check */}
                  <div className="flex items-center gap-2.5 flex-wrap" style={{ marginBottom: 12 }}>
                    <h1
                      className="text-white"
                      style={{
                        fontFamily: FONT,
                        fontSize: 32,
                        fontWeight: 700,
                        lineHeight: "38px",
                        letterSpacing: "-0.025em",
                      }}
                    >
                      {claw.name}
                    </h1>
                    {claw.infrastructurePath === "gmi_ce_maas" && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#3b82f6" style={{ flexShrink: 0 }} aria-label="Verified" role="img">
                        <title>{badge.tooltip}</title>
                        <path d="M12 1l2.5 1.8 3-.4 1.2 2.8 2.8 1.2-.4 3L23 12l-1.8 2.5.4 3-2.8 1.2-1.2 2.8-3-.4L12 23l-2.5-1.8-3 .4-1.2-2.8L2.5 17.5l.4-3L1 12l1.9-2.5-.4-3 2.8-1.2L6.5 2.4l3 .4z" />
                        <path d="M10.6 14.6l-2.2-2.2-1.4 1.4 3.6 3.6 6-6-1.4-1.4z" fill="#fff" />
                      </svg>
                    )}
                  </div>

                  {/* Short Description — the hero tagline */}
                  <p
                    style={{
                      fontFamily: FONT,
                      fontSize: 17,
                      fontWeight: 400,
                      lineHeight: "27px",
                      color: "#c4c4c4",
                      maxWidth: "58ch",
                      margin: 0,
                    }}
                  >
                    {claw.description}
                  </p>

                  <div className="grid-line-h" style={{ margin: "22px 0" }} />

                  {/* Datasheet meta — Publisher / Hosting */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div>
                      <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: "#8a8a8a", marginBottom: 8 }}>Publisher</div>
                      <div className="flex items-center gap-2.5">
                        <PublisherAvatar publisher={claw.publisher} color={typeColor} size={28} logoUrl={claw.logoUrl} />
                        <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: "#e5e5e5", lineHeight: "18px" }}>
                          {claw.publisher}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: "#8a8a8a", marginBottom: 8 }}>Hosting</div>
                      <div className="flex items-center gap-2" style={{ minHeight: 28 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 2, flexShrink: 0, background: badge.color }} />
                        <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: "#e5e5e5", lineHeight: "18px" }}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* About / Sample output / Tags — stacked in the main column so
                    prose and images stay at a readable ~2/3 width, not full-bleed. */}
                {about && (
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.fg, letterSpacing: "-0.01em", marginBottom: 16 }}>
                      About this Agent
                    </div>
                    <FullDescription text={about} />
                    <a
                      href={claw.docsUrl || `https://docs.gmicloud.ai/agents/${claw.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5"
                      style={{ marginTop: 20, fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.lime, textDecoration: "none" }}
                    >
                      View documentation
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )}

                {claw.sampleImages && claw.sampleImages.length > 0 && (
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.fg, letterSpacing: "-0.01em", marginBottom: 16 }}>
                      Sample output
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: claw.sampleImages.length > 1 ? "repeat(auto-fit, minmax(280px, 1fr))" : "1fr", gap: 16 }}>
                      {claw.sampleImages.slice(0, 5).map((src, i) => (
                        <div key={i} style={{ border: "1px solid #262626", background: C.bg, overflow: "hidden", borderRadius: 10 }}>
                          <img src={src} alt={`${claw.name} sample output ${i + 1}`} loading="lazy" style={{ display: "block", width: "100%", height: "auto" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {claw.tags.length > 0 && (
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.fg, letterSpacing: "-0.01em", marginBottom: 14 }}>
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {claw.tags.map((t) => (
                        <TagChip key={t} label={t} />
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Right: sticky deploy + guarantees panel */}
              <div className="lg:col-span-1">
                <div className="sticky top-24" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* CTA — Deploy this Agent (Console flow): opens the deploy wizard with
                      this template; instances are launched and managed from My Agents. */}
                  {claw.availability === "available" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <button
                        onClick={() => setLocation(`/deploy?use=${claw.id}`)}
                        className="w-full flex items-center justify-center gap-2 transition-colors"
                        style={{
                          padding: "13px 16px",
                          fontFamily: FONT,
                          fontSize: 14, fontWeight: 600,
                          borderRadius: 10,
                          background: C.lime, color: "#000000", border: "1px solid #DDEA4D", cursor: "pointer",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#c8d63a"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = C.lime; }}
                      >
                        Deploy
                      </button>
                      <p style={{ fontFamily: FONT, fontSize: 12, lineHeight: "17px", color: "#8a8a8a", margin: 0 }}>
                        Opens the deploy wizard with this template — launch and manage instances from My Agents.
                      </p>
                    </div>
                  )}

                  {/* Models & billing scope (Agent Detail) + your account price
                      (Access) + auto-discount note (Billing) — Coding Agent Plan */}
                  {claw.availability === "available" && (() => {
                    const eligible = isPlanEligibleAgent(claw.typeLabel);
                    const d = eligible ? discountPriceString(CODING_AGENT_PLAN.featuredModelInPrice) : null;
                    return (
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>Models &amp; billing</span>
                          {eligible && <PlanBadge />}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12 }}>
                          <span style={{ color: C.muted }}>Runs on</span>
                          <span style={{ color: C.fg }}>GMI MaaS · {CODING_AGENT_PLAN.featuredModelName}</span>
                        </div>
                        <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, marginTop: -4 }}>Default model · change at launch</span>
                        {/* F-08 rule 6 — one line when the viewer already has a Saved
                            Launch Configuration for this Agent. Copy says "default",
                            never "recommended": the platform does not evaluate which
                            model performs better for a given agent. Still TBD whether
                            the Browse Agents endpoint can read per-user state. */}
                        <span
                          title="TBD — confirm the Browse Agents endpoint can read per-user saved launch state"
                          style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}
                        >
                          You last ran this with <span style={{ color: C.fg }}>Claude Opus 4.8</span>
                        </span>
                        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12 }}>
                          <span style={{ color: C.muted }}>Billing scope</span>
                          <span style={{ color: C.fg }}>Pay per token used</span>
                        </div>
                        {eligible && d ? (
                          <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontFamily: FONT, fontSize: 12, color: C.muted }}>Your price with {CODING_AGENT_PLAN.name}</span>
                            <DiscountedPrice original={d.original} discounted={d.discounted} size={14} />
                            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                              Discount is applied automatically at billing for your account.
                            </span>
                          </div>
                        ) : (
                          <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 10 }}>
                            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                              Standard token pricing. Not covered by the {CODING_AGENT_PLAN.name}.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {claw.availability === "early_access" && (
                    <button
                      onClick={handleEarlyAccess}
                      className="w-full flex items-center justify-center gap-2 transition-colors"
                      style={{
                        padding: "13px 16px",
                        fontFamily: FONT,
                        fontSize: 14, fontWeight: 600, borderRadius: 10,
                        border: "1px solid #fb923c", color: "#fb923c", background: "transparent",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,146,60,0.08)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >
                      <Clock size={14} />
                      Request early access
                    </button>
                  )}

                  {claw.availability === "unavailable" && (
                    <div
                      className="w-full flex items-center justify-center gap-2 cursor-not-allowed"
                      style={{
                        padding: "13px 16px",
                        fontFamily: FONT,
                        fontSize: 14, fontWeight: 600, borderRadius: 10,
                        background: "#111", color: "#666", border: "1px solid #333",
                      }}
                    >
                      <AlertCircle size={14} />
                      Unavailable
                    </div>
                  )}

                  {/* Trust card */}
                  <div
                    style={{
                      background: C.cardSolid,
                      border: "1px solid #262626",
                      padding: "16px 18px",
                      borderRadius: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: "#8a8a8a" }}>Guarantees</div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <CheckCircle size={14} className="shrink-0" style={{ color: C.lime, marginTop: 1 }} />
                      <span style={{ fontFamily: FONT, fontSize: 13, color: "#c4c4c4", lineHeight: "19px" }}>
                        {badge.tooltip}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <CheckCircle size={14} className="shrink-0" style={{ color: C.lime, marginTop: 1 }} />
                      <span style={{ fontFamily: FONT, fontSize: 13, color: "#c4c4c4", lineHeight: "19px" }}>
                        Browser-based. No SDK, API key, or installation required.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
