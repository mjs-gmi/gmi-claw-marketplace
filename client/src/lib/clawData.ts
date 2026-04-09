export type TrustTier = "Verified" | "Community";
export type TypeLabel = "Developer" | "Productivity" | "Business" | "Creative";

export interface Claw {
  id: string;
  name: string;
  publisher: string;
  publisherContact: string;
  trustTier: TrustTier;
  typeLabel: TypeLabel;
  description: string;
  fullDescription: string;
  pricing: string;
  pricingDetail: string;
  tags: string[];
  model: string;
  deployed: boolean;
  sampleOutputs?: string[];
  supportedModels?: string[];
}

export const ALL_CLAWS: Claw[] = [
  {
    id: "openhuman",
    name: "OpenHuman",
    publisher: "TinyHuman",
    publisherContact: "hello@tinyhuman.ai",
    trustTier: "Verified",
    typeLabel: "Productivity",
    description:
      "Open-source agentic desktop assistant that integrates into your daily life. One subscription for AI models, search, webhooks, and 3rd-party APIs — no terminal required.",
    fullDescription:
      "OpenHuman is an open-source agentic assistant by TinyHuman, designed to integrate deeply into your daily workflow. It features a clean desktop-first UI with short onboarding paths — from install to a working agent in a few clicks, no terminal needed. One subscription unlocks many agentic APIs: AI models, search, webhooks/tunnels, and 3rd-party integrations. Rich Skills connect Gmail, Slack, Notion, and the rest of your stack via one-click setup wizards. A local knowledge base is built from your data and activity across tools and sessions, stored on-device and compounding over time — not a cloud dossier. Sensitive workloads (vision, speech, summarization) can run on a local AI model via the Rust core. Deep desktop integrations include memory-aware keyboard autocomplete, voice (STT/TTS), and screen intelligence that feeds your local context. Powered by GMI Cloud infrastructure for cloud-side execution when needed.",
    pricing: "Early Access",
    pricingDetail: "Early Access. Sign up to join the waitlist and get started with OpenHuman on GMI Cloud.",
    tags: ["Desktop", "Open Source", "Productivity", "Agentic"],
    model: "Llama 3.1 70B",
    deployed: true,
    sampleOutputs: [
      "Drafting reply to 3 unread Slack threads based on your context — preview ready for review.",
      "Screen context detected: you're reviewing a PR. Autocomplete suggestion: 'LGTM, but consider extracting the helper into a separate module.'",
      "Voice command received: 'Schedule a call with Alex tomorrow at 2pm' — Calendar event created and Slack DM sent.",
    ],
    supportedModels: ["Llama 3.1 70B", "Qwen2.5 72B", "Mistral 7B", "Local (bundled runner)"],
  },
  {
    id: "topify-claw",
    name: "Topify Claw",
    publisher: "Topify",
    publisherContact: "dev@topify.ai",
    trustTier: "Verified",
    typeLabel: "Business",
    description:
      "AI-powered GEO platform that tracks and optimizes your brand's visibility across ChatGPT, Gemini, Perplexity, and Google AI Overview — so AI recommends you first.",
    fullDescription:
      "Topify Claw brings Topify's Generative Engine Optimization (GEO) platform to the GMI Claw ecosystem. It continuously monitors how your brand is mentioned, ranked, and described across the four major AI search engines: ChatGPT, Gemini, Perplexity, and Google AI Overview. The agent tracks seven key GEO metrics — visibility, sentiment, position, volume, mentions, intent, and CVR — and surfaces high-value prompts where competitors outrank you. One-click execution lets you deploy AI-generated content recommendations and optimization actions without manual workflows. Competitor benchmarking shows exactly who AI engines recommend instead of you, and how to close the gap. Powered by GMI Cloud infrastructure for continuous, always-on monitoring and execution.",
    pricing: "Early Access",
    pricingDetail: "Early Access. Sign up at topify.ai to get started. 200+ brands already trust Topify.",
    tags: ["GEO", "Marketing", "AI Visibility", "Brand"],
    model: "Llama 3.1 70B",
    deployed: true,
    sampleOutputs: [
      "Brand visibility report: You appear in 34% of AI responses for 'best project management tool' — up 12% this week.",
      "Competitor alert: Notion now ranks #1 in ChatGPT for 3 of your tracked prompts. Recommended action: update your /about page with structured data.",
      "One-click optimization deployed: 2 content pieces published, estimated +8% visibility lift in 7 days.",
    ],
    supportedModels: ["Llama 3.1 70B", "Mixtral 8x7B"],
  },
  {
    id: "code-reviewer",
    name: "Code Review Agent",
    publisher: "GMI Labs",
    publisherContact: "labs@gmi.ai",
    trustTier: "Verified",
    typeLabel: "Developer",
    description:
      "Performs deep static analysis, security audits, and suggests refactors with line-by-line explanations.",
    fullDescription:
      "Code Review Agent performs comprehensive static analysis on pull requests and code diffs. It identifies security vulnerabilities, anti-patterns, and performance bottlenecks, then generates actionable refactor suggestions with line-by-line explanations. Integrates with GitHub, GitLab, and Bitbucket via webhook. Supports Python, TypeScript, Go, Rust, and Java.",
    pricing: "$49 / month",
    pricingDetail: "Flat monthly subscription. Unlimited reviews up to 10,000 lines/day.",
    tags: ["Code", "Security", "CI/CD"],
    model: "DeepSeek-Coder V2",
    deployed: true,
    sampleOutputs: [
      "PR #847: Found 3 issues — 1 SQL injection risk, 1 unused import, 1 N+1 query pattern.",
    ],
    supportedModels: ["DeepSeek-Coder V2", "Llama 3.1 70B"],
  },
  {
    id: "enterprise-rag",
    name: "Enterprise RAG Pipeline",
    publisher: "GMI Labs",
    publisherContact: "labs@gmi.ai",
    trustTier: "Verified",
    typeLabel: "Business",
    description:
      "Ingests, indexes, and queries internal knowledge bases with citation-backed, hallucination-resistant responses.",
    fullDescription:
      "Enterprise RAG Pipeline ingests documents from S3, SharePoint, Confluence, and Notion, builds a retrieval index, and answers natural language queries with cited sources. Designed for compliance-sensitive environments — all data stays within your GMI deployment. Supports PDF, DOCX, HTML, and plain text.",
    pricing: "Custom",
    pricingDetail: "Contact publisher for enterprise pricing. Minimum 3-month commitment.",
    tags: ["RAG", "Enterprise", "Knowledge"],
    model: "Qwen2.5 72B",
    deployed: true,
    supportedModels: ["Qwen2.5 72B", "Llama 3.1 70B"],
  },
  {
    id: "model-benchmark",
    name: "Model Benchmark Suite",
    publisher: "GMI Labs",
    publisherContact: "labs@gmi.ai",
    trustTier: "Verified",
    typeLabel: "Developer",
    description:
      "Runs standardized benchmarks across GMI MaaS models to help you choose the right model for your use case.",
    fullDescription:
      "Model Benchmark Suite runs MMLU, HumanEval, GSM8K, and custom task-specific benchmarks across all models available in the GMI MaaS library. It generates a comparative report with accuracy, latency, cost-per-token, and context window analysis. Helps Claw Builders select the optimal model before deployment.",
    pricing: "Pay per run",
    pricingDetail: "Charged per benchmark run. Pricing depends on models selected and benchmark size.",
    tags: ["Benchmarks", "Models", "Evaluation"],
    model: "Multiple",
    deployed: true,
    supportedModels: ["All GMI MaaS models"],
  },
  {
    id: "smart-contract-auditor",
    name: "Smart Contract Auditor",
    publisher: "0xSecurity",
    publisherContact: "hello@0xsecurity.io",
    trustTier: "Community",
    typeLabel: "Developer",
    description:
      "Audits Solidity and Rust smart contracts for reentrancy, overflow, and access control vulnerabilities.",
    fullDescription:
      "Smart Contract Auditor performs automated security analysis on Solidity and Rust smart contracts. It detects reentrancy attacks, integer overflow/underflow, access control issues, and front-running vulnerabilities. Generates a structured audit report with severity ratings and remediation guidance.",
    pricing: "$199 / month",
    pricingDetail: "Monthly subscription. Includes up to 50 contract audits per month.",
    tags: ["Security", "Solidity", "Rust"],
    model: "DeepSeek-Coder V2",
    deployed: true,
    sampleOutputs: [
      "Contract TokenVault.sol: HIGH — reentrancy in withdraw(), MEDIUM — missing access control on setOwner()",
    ],
  },
  {
    id: "support-agent",
    name: "Customer Support Agent",
    publisher: "EnterpriseAI",
    publisherContact: "support@enterprise-ai.com",
    trustTier: "Community",
    typeLabel: "Business",
    description:
      "Handles Tier-1 support tickets autonomously, escalating complex issues with full context summaries.",
    fullDescription:
      "Customer Support Agent integrates with Zendesk, Intercom, and Freshdesk to handle incoming Tier-1 support tickets. It classifies intent, retrieves relevant knowledge base articles, drafts responses, and escalates unresolved tickets with full conversation context. Supports English, Spanish, French, and Mandarin.",
    pricing: "$99 / month",
    pricingDetail: "Monthly subscription. Up to 5,000 tickets/month included.",
    tags: ["Support", "Enterprise", "Zendesk"],
    model: "Llama 3.1 8B",
    deployed: true,
  },
  {
    id: "data-pipeline",
    name: "Data Pipeline Orchestrator",
    publisher: "DataOps AI",
    publisherContact: "team@dataops-ai.io",
    trustTier: "Community",
    typeLabel: "Developer",
    description:
      "Designs, schedules, and monitors ETL pipelines. Detects anomalies and auto-heals broken jobs.",
    fullDescription:
      "Data Pipeline Orchestrator uses natural language to design and schedule ETL pipelines across common data sources (PostgreSQL, BigQuery, Snowflake, S3). It monitors job health, detects data quality anomalies, and attempts auto-remediation before alerting on-call engineers. Generates pipeline documentation automatically.",
    pricing: "$149 / month",
    pricingDetail: "Monthly subscription. Includes up to 20 active pipelines.",
    tags: ["ETL", "Data", "BigQuery"],
    model: "DeepSeek-R1 32B",
    deployed: true,
  },
  {
    id: "doc-generator",
    name: "API Doc Generator",
    publisher: "DevTools AI",
    publisherContact: "hello@devtools-ai.dev",
    trustTier: "Community",
    typeLabel: "Developer",
    description:
      "Parses codebases and auto-generates OpenAPI specs, README files, and inline documentation.",
    fullDescription:
      "API Doc Generator parses your codebase and generates OpenAPI 3.0 specs, README files, and inline JSDoc/docstring comments. It infers endpoint behavior from code, identifies undocumented parameters, and produces human-readable documentation in Markdown or HTML. Supports Node.js, Python, and Go.",
    pricing: "$29 / month",
    pricingDetail: "Monthly subscription. Unlimited documentation runs.",
    tags: ["Docs", "API", "OpenAPI"],
    model: "Llama 3.1 70B",
    deployed: true,
  },
  {
    id: "legal-contract-analyzer",
    name: "Legal Contract Analyzer",
    publisher: "LexAI",
    publisherContact: "contact@lexai.legal",
    trustTier: "Community",
    typeLabel: "Business",
    description:
      "Extracts key clauses, flags risk terms, and summarizes obligations from legal contracts.",
    fullDescription:
      "Legal Contract Analyzer processes NDAs, MSAs, SaaS agreements, and employment contracts. It extracts key clauses (termination, liability, IP ownership), flags non-standard or high-risk terms, and generates a structured summary of obligations for each party. Designed for legal teams and procurement departments.",
    pricing: "$299 / month",
    pricingDetail: "Monthly subscription. Up to 200 contract analyses per month.",
    tags: ["Legal", "Contracts", "Enterprise"],
    model: "Qwen2.5 72B",
    deployed: false,
  },
  {
    id: "hr-onboarding",
    name: "HR Onboarding Assistant",
    publisher: "PeopleOps AI",
    publisherContact: "hello@peopleops-ai.com",
    trustTier: "Community",
    typeLabel: "Business",
    description:
      "Guides new hires through onboarding workflows, answers policy questions, and collects required documents.",
    fullDescription:
      "HR Onboarding Assistant integrates with Workday, BambooHR, and Rippling to guide new employees through onboarding checklists, answer HR policy questions, and collect required documentation. It tracks completion status and escalates blockers to the HR team. Supports multi-language onboarding flows.",
    pricing: "$79 / month",
    pricingDetail: "Monthly subscription. Up to 50 active onboarding flows.",
    tags: ["HR", "Onboarding", "Enterprise"],
    model: "Llama 3.1 8B",
    deployed: true,
  },
];

export const TYPE_LABELS: TypeLabel[] = ["Developer", "Productivity", "Business", "Creative"];
