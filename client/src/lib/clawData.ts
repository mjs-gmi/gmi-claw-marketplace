// ─── Types ────────────────────────────────────────────────────────────────────

export type InfrastructurePath = "gmi_ce_maas" | "gmi_ce_only" | "self_hosted_maas";
export type Availability = "available" | "early_access" | "unavailable";

export interface BadgeConfig {
  label: string;
  color: string;
  border: string;
  bg: string;
  tooltip: string;
}

export function getBadgeConfig(path: InfrastructurePath): BadgeConfig {
  switch (path) {
    case "gmi_ce_maas":
      return {
        label: "Verified",
        color: "#DDEA4D",
        border: "rgba(221,234,77,0.4)",
        bg: "rgba(221,234,77,0.08)",
        tooltip: "Hosted on GMI Cluster Engine · Model powered by GMI MaaS",
      };
    case "gmi_ce_only":
      return {
        label: "Powered by GMI CE",
        color: "#7ec8ff",
        border: "rgba(126,200,255,0.4)",
        bg: "rgba(126,200,255,0.08)",
        tooltip: "Hosted on GMI Cluster Engine · Dedicated infrastructure",
      };
    case "self_hosted_maas":
      return {
        label: "Powered by GMI MaaS",
        color: "#c084fc",
        border: "rgba(192,132,252,0.4)",
        bg: "rgba(192,132,252,0.08)",
        tooltip: "Connect with GMI · publisher hosts the agent, calls GMI Models",
      };
  }
}

export type TypeLabel =
  | "Code & Dev Tools"
  | "Data & Analytics"
  | "Customer Support"
  | "Content & Marketing"
  | "Research & Knowledge";

export const TYPE_LABELS: TypeLabel[] = [
  "Code & Dev Tools",
  "Data & Analytics",
  "Customer Support",
  "Content & Marketing",
  "Research & Knowledge",
];

export interface Claw {
  id: string;
  name: string;
  publisher: string;
  description: string;
  tags: string[];
  typeLabel: TypeLabel;
  infrastructurePath: InfrastructurePath;
  availability: Availability;
  pricing: string;
  // Retained data flag (agent runs on Claude models). No longer rendered in
  // the UI — kept for possible future use / filtering.
  builtWithAnthropic?: boolean;
  // ── Optional listing fields, one-to-one with the Register & List form ──
  logoUrl?: string;          // Logo (optional) — square ≥256px
  sampleImages?: string[];   // Sample Output (optional) — up to 5 PNG/JPG
  demoVideoUrl?: string;     // Demo Video URL (optional) — external
  docsUrl?: string;          // Documentation Link (optional) — external

  // ── Listing type is DERIVED from the linked template at publish time (NOT a
  //    manual choice). A template that declares secret/env fields, or whose
  //    image registry is private/secret, can't be cloned by others → it lists
  //    as "Try demo". A clean, publishable template lists as "Deploy your own".
  templateHasSecrets?: boolean;      // template declares secret / env fields
  templateSecretRegistry?: boolean;  // template image lives in a private registry
}

export const ALL_CLAWS: Claw[] = [
  {
    id: "topify-claw",
    name: "Topify Claw",
    publisher: "topify",
    description: "Topify Claw brings Topify's Generative Engine Optimization (GEO) platform to the GMI Claw ecosystem. It continuously monitors how your brand is mentioned, ranked, and described across the four major AI search engines: ChatGPT, Gemini, Perplexity, and Google AI Overview.",
    tags: ["seo", "geo", "ai-search", "brand", "marketing"],
    typeLabel: "Content & Marketing",
    infrastructurePath: "gmi_ce_maas",
    availability: "available",
    pricing: "Free",
  },
  {
    id: "code-review-agent",
    name: "Code Review Agent",
    publisher: "gmi",
    description: "Performs deep static analysis and semantic code review on pull requests. Identifies bugs, security vulnerabilities, and style issues. Integrates with GitHub, GitLab, and Bitbucket.",
    tags: ["code", "review", "github", "security", "devtools"],
    typeLabel: "Code & Dev Tools",
    infrastructurePath: "gmi_ce_maas",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
    sampleImages: ["/demos/code-review.svg"],
    docsUrl: "https://docs.gmicloud.ai/agents/code-review",
  },
  {
    id: "enterprise-rag-pipeline",
    name: "Enterprise RAG Pipeline",
    publisher: "gmi",
    description: "Enterprise RAG Pipeline ingests documents from S3, SharePoint, Confluence, and Notion, builds a retrieval index, and answers natural language queries with cited sources. Designed for compliance-sensitive environments.",
    tags: ["rag", "enterprise", "search", "documents", "compliance"],
    typeLabel: "Research & Knowledge",
    infrastructurePath: "gmi_ce_only",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
    templateSecretRegistry: true, // private image → lists as Try demo
  },
  {
    id: "model-benchmark-suite",
    name: "Model Benchmark Suite",
    publisher: "gmi",
    description: "Runs MMLU, HumanEval, GSM8K, and custom task-specific benchmarks across all models available in the GMI MaaS library. Generates comparative reports with accuracy, latency, and cost-per-token analysis.",
    tags: ["benchmark", "evaluation", "models", "testing"],
    typeLabel: "Code & Dev Tools",
    infrastructurePath: "gmi_ce_maas",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "contract-review-agent",
    name: "Contract Review Agent",
    publisher: "legaltech-labs",
    description: "Analyzes legal contracts for risk clauses, missing provisions, and compliance issues. Supports NDA, SaaS agreements, employment contracts, and vendor agreements.",
    tags: ["legal", "contracts", "compliance", "risk"],
    typeLabel: "Research & Knowledge",
    infrastructurePath: "gmi_ce_only",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "data-pipeline-debugger",
    name: "Data Pipeline Debugger",
    publisher: "dataops-io",
    description: "Monitors and debugs ETL pipelines in real-time. Detects schema drift, null anomalies, and volume drops. Integrates with Airflow, dbt, and Spark.",
    tags: ["data", "etl", "debugging", "pipeline", "monitoring"],
    typeLabel: "Data & Analytics",
    infrastructurePath: "self_hosted_maas",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "customer-support-triage",
    name: "Customer Support Triage",
    publisher: "supportai",
    description: "Automatically classifies, prioritizes, and routes incoming support tickets. Drafts responses for tier-1 issues and escalates complex cases with context summaries.",
    tags: ["support", "tickets", "automation", "customer-service"],
    typeLabel: "Customer Support",
    infrastructurePath: "self_hosted_maas",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "meeting-intelligence",
    name: "Meeting Intelligence",
    publisher: "meetingai",
    description: "Transcribes, summarizes, and extracts action items from meetings. Integrates with Zoom, Google Meet, and Microsoft Teams. Sends follow-up emails automatically.",
    tags: ["meetings", "transcription", "summary", "productivity"],
    typeLabel: "Research & Knowledge",
    infrastructurePath: "gmi_ce_only",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "creative-brief-generator",
    name: "Creative Brief Generator",
    publisher: "creativeops",
    description: "Generates structured creative briefs from rough campaign ideas. Produces audience personas, messaging frameworks, and channel recommendations for marketing teams.",
    tags: ["creative", "marketing", "briefs", "campaigns"],
    typeLabel: "Content & Marketing",
    infrastructurePath: "self_hosted_maas",
    availability: "early_access",
    pricing: "Free",
  },
  {
    id: "sql-query-optimizer",
    name: "SQL Query Optimizer",
    publisher: "querylab",
    description: "Analyzes slow SQL queries, suggests index strategies, and rewrites inefficient joins. Supports PostgreSQL, MySQL, BigQuery, and Snowflake.",
    tags: ["sql", "database", "optimization", "performance"],
    typeLabel: "Data & Analytics",
    infrastructurePath: "gmi_ce_only",
    availability: "available",
    pricing: "Free",
  },
  {
    id: "brand-voice-writer",
    name: "Brand Voice Writer",
    publisher: "contentops",
    description: "Generates on-brand copy for blogs, social media, and ad campaigns. Learns your brand voice from existing content and maintains consistency across all outputs.",
    tags: ["writing", "brand", "content", "social-media", "copy"],
    typeLabel: "Content & Marketing",
    infrastructurePath: "gmi_ce_only",
    availability: "unavailable",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "financial-filing-analyzer",
    name: "Financial Filing Analyzer",
    publisher: "fintel-labs",
    description: "Parses 10-K, 10-Q, and earnings-call transcripts to extract risk factors, guidance changes, and segment performance. Produces analyst-ready summaries with page-level citations across hundreds of pages of filings.",
    tags: ["finance", "10-k", "earnings", "analysis", "enterprise"],
    typeLabel: "Data & Analytics",
    infrastructurePath: "gmi_ce_maas",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "compliance-policy-auditor",
    name: "Compliance Policy Auditor",
    publisher: "regops",
    description: "Audits internal policies and controls against SOC 2, GDPR, HIPAA, and ISO 27001. Flags gaps, maps evidence to each requirement, and drafts remediation plans for security, legal, and GRC teams.",
    tags: ["compliance", "soc2", "gdpr", "audit", "security"],
    typeLabel: "Research & Knowledge",
    infrastructurePath: "gmi_ce_only",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "security-incident-copilot",
    name: "Security Incident Copilot",
    publisher: "sentinel-ai",
    description: "Triages SIEM alerts, correlates signals across logs, and drafts incident timelines and postmortems with cited evidence trails. Cuts mean-time-to-resolution for enterprise SOC teams.",
    tags: ["security", "incident", "soc", "siem", "enterprise"],
    typeLabel: "Code & Dev Tools",
    infrastructurePath: "gmi_ce_maas",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "vendor-risk-assessor",
    name: "Vendor Risk Assessor",
    publisher: "trustlayer",
    description: "Reviews vendor security questionnaires, SOC 2 reports, and DPAs to score third-party risk. Generates due-diligence summaries and tracks remediation across your entire vendor portfolio.",
    tags: ["vendor", "risk", "due-diligence", "procurement", "compliance"],
    typeLabel: "Research & Knowledge",
    infrastructurePath: "gmi_ce_only",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "rfp-response-builder",
    name: "RFP Response Builder",
    publisher: "proposalworks",
    description: "Drafts enterprise RFP and security-questionnaire responses from your approved knowledge base. Keeps every answer consistent, on-message, and traceable back to its source document.",
    tags: ["rfp", "sales", "proposals", "knowledge-base", "enterprise"],
    typeLabel: "Content & Marketing",
    infrastructurePath: "gmi_ce_maas",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "support-escalation-agent",
    name: "Enterprise Escalation Agent",
    publisher: "helpdesk-pro",
    description: "Handles tier-2 and tier-3 enterprise support escalations. Reads account history, reproduces issues from logs, and drafts SLA-aware resolution steps before routing to a human owner.",
    tags: ["support", "escalation", "enterprise", "sla", "customer-service"],
    typeLabel: "Customer Support",
    infrastructurePath: "self_hosted_maas",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "data-governance-classifier",
    name: "Data Governance Classifier",
    publisher: "governai",
    description: "Scans data warehouses to classify and tag PII, PHI, and sensitive fields. Enforces retention and access policies and produces audit-ready data-lineage reports for privacy teams.",
    tags: ["data-governance", "pii", "classification", "privacy", "enterprise"],
    typeLabel: "Data & Analytics",
    infrastructurePath: "gmi_ce_only",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
  {
    id: "codebase-modernization-agent",
    name: "Codebase Modernization Agent",
    publisher: "refactorlabs",
    description: "Plans and executes large-scale migrations — framework upgrades, API deprecations, and language ports — across monorepos. Opens reviewed PRs with test coverage and rollback notes.",
    tags: ["migration", "refactor", "monorepo", "devtools", "enterprise"],
    typeLabel: "Code & Dev Tools",
    infrastructurePath: "gmi_ce_maas",
    availability: "available",
    pricing: "Free",
    builtWithAnthropic: true,
  },
];
