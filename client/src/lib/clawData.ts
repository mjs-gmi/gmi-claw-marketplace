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
  },
];
