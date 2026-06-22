import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ALL_CLAWS } from "@/lib/clawData";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";

// ─── Tokens ───────────────────────────────────────────────────────────────
const FONT = "'Geist', system-ui, sans-serif";
const MONO = "'GeistMono', ui-monospace, monospace";
const C = {
  bg:           "#0a0a0a",
  fg:           "#fafafa",
  muted:        "#a3a3a3",
  border:       "#404040",
  borderSoft:   "#262626",
  card:         "rgba(23,23,23,0.95)",
  cardSolid:    "#171717",
  warnBg:       "#1e1e1e",
  pillBg:       "rgba(82,82,82,0.3)",
  selectedYel:  "rgba(99,105,35,0.3)",
  selectedYelB: "rgba(221,234,77,0.55)",
  lime:         "#DDEA4D",
  limeText:     "#0a0a0a",
  link:         "#5b94f0",
  warn:         "#fbbf24",
  ok:           "#34d399",
} as const;

const STEPS = [
  { id: 1, title: "Basics & Template" },
  { id: 2, title: "Infrastructure" },
  { id: 3, title: "Networking" },
  { id: 4, title: "Env Variables" },
  { id: 5, title: "Review & Register" },
] as const;

// Connect-your-agent flow: a different 4-section path (no infra/networking/env — the user runs it themselves)
const CONNECT_STEPS = [
  { id: 1, title: "Basic" },
  { id: 2, title: "MaaS Key" },
  { id: 3, title: "Endpoint" },
  { id: 4, title: "Review & Submit" },
] as const;

type StepId = (typeof STEPS)[number]["id"];
type HostMode = "gmi" | "connect";

// Shared between Connect submit + Dashboard read (My Agents shows the synced MaaS key).
// Persisted in localStorage so re-visiting the dashboard picks them up.
const REGISTERED_AGENTS_KEY = "gmi:registered-agents";

export interface RegisteredAgent {
  id: string;
  name: string;
  templateId: string;
  hostMode: HostMode;
  maasKey: string;
  accessUrl: string;
  category: string;
  registeredAt: string;
}

function genMaasKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "gmi_";
  for (let i = 0; i < 40; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function persistRegisteredAgent(agent: RegisteredAgent) {
  try {
    const existing: RegisteredAgent[] = JSON.parse(localStorage.getItem(REGISTERED_AGENTS_KEY) || "[]");
    existing.unshift(agent);  // most recent first
    localStorage.setItem(REGISTERED_AGENTS_KEY, JSON.stringify(existing));
  } catch { /* ignore — localStorage may be disabled */ }
}

// ─── Mock infra catalog ──────────────────────────────────────────────────
interface Region { id: string; name: string; sub: string; popular?: boolean }
const REGIONS: Region[] = [
  { id: "us-ia-iowa-1",   name: "IOWA IDC-1",      sub: "US-IA, US",    popular: true },
  { id: "us-or-portland", name: "Portland IDC-1",  sub: "US-OR, US" },
  { id: "eu-de-frankfurt",name: "Frankfurt IDC-1", sub: "DE-HE, Germany" },
  { id: "ap-sg-singapore",name: "Singapore IDC-1", sub: "SG, Singapore" },
];

interface ComputeTier {
  id: string; name: string; sub: string;
  cpu: string; ram: string; pricePerHr: number;
}
const COMPUTE_TIERS: ComputeTier[] = [
  { id: "container", name: "Container", sub: "Instance type for the Agentbox marketplace",
    cpu: "2 vCPU", ram: "4 GB", pricePerHr: 0.0475 },
  { id: "standard",  name: "Standard",  sub: "Most production agents",
    cpu: "4 vCPU", ram: "8 GB", pricePerHr: 0.094 },
  { id: "performance", name: "Performance", sub: "High-throughput agents",
    cpu: "8 vCPU", ram: "16 GB", pricePerHr: 0.182 },
];

interface ModelSpec {
  id: string; name: string; ctx: string;
  inPrice: string; outPrice?: string;
}
const MODELS: ModelSpec[] = [
  { id: "deepseek-v4-flash", name: "DeepSeek-V4-Flash", ctx: "1M ctx",
    inPrice: "$0.098 / 1M tok" },
  { id: "claude-opus-48",    name: "Claude Opus 4.8",   ctx: "409.6K ctx",
    inPrice: "$5.00 / 1M tok", outPrice: "$25.00 / 1M tok" },
  { id: "gpt-55",            name: "GPT-5.5",           ctx: "1.1M ctx",
    inPrice: "$5.00 / 1M tok", outPrice: "$20.00 / 1M tok" },
];

interface PortMap {
  id: string;
  protocol: string;
  listening: string;
  internal: string;
  name: string;
}
const DEFAULT_PORTS: PortMap[] = [
  { id: "p1", protocol: "HTTPS/2", listening: "", internal: "8080", name: "web" },
];

interface CustomEnv { id: string; key: string; value: string; secret: boolean }

// ─── Template fork (Use this agent) ───────────────────────────────────────
// Per-catalog template config consumed when wizard is loaded with ?use=<id>.
// Image / ports / env / region / tier come from the published agent's template.
// In prod this would come from the catalog API; for prototype we synthesize.
interface AgentTemplate {
  image: string;
  region: string;
  tier: string;
  ports: PortMap[];
  envDeclarations: CustomEnv[];
  model: string;
}
function synthesizeTemplate(id: string, name: string): AgentTemplate {
  const baseImage = (slug: string) => `registry.gmi/${slug}:latest`;
  const cleanSlug = id.replace(/-claw$/, "").replace(/-agent$/, "");
  const declarations: Record<string, CustomEnv[]> = {
    "topify-claw": [
      { id: "e1", key: "TOPIFY_API_KEY", value: "", secret: true },
      { id: "e2", key: "TOPIFY_BRAND_ID", value: "", secret: false },
    ],
    "code-review-agent": [
      { id: "e1", key: "GITHUB_TOKEN", value: "", secret: true },
      { id: "e2", key: "MAX_FILES_PER_PR", value: "100", secret: false },
    ],
    "enterprise-rag-pipeline": [
      { id: "e1", key: "S3_BUCKET", value: "", secret: false },
      { id: "e2", key: "S3_ACCESS_KEY", value: "", secret: true },
      { id: "e3", key: "S3_SECRET_KEY", value: "", secret: true },
    ],
    "contract-review-agent": [
      { id: "e1", key: "JURISDICTION", value: "US-CA", secret: false },
    ],
    "data-pipeline-debugger": [
      { id: "e1", key: "AIRFLOW_URL", value: "", secret: false },
      { id: "e2", key: "PAGERDUTY_KEY", value: "", secret: true },
    ],
    "customer-support-triage": [
      { id: "e1", key: "ZENDESK_SUBDOMAIN", value: "", secret: false },
      { id: "e2", key: "ZENDESK_API_TOKEN", value: "", secret: true },
    ],
    "sql-query-optimizer": [
      { id: "e1", key: "DATABASE_URL", value: "", secret: true },
    ],
  };
  return {
    image: baseImage(cleanSlug || id),
    region: "us-ia-iowa-1",
    tier: "container",
    ports: [{ id: "p1", protocol: "HTTPS/2", listening: "", internal: "8080", name: "web" }],
    envDeclarations: declarations[id] ?? [],
    model: "",
  };
}
function lookupTemplate(id: string): { template: AgentTemplate; name: string } | null {
  const claw = ALL_CLAWS.find((c) => c.id === id);
  if (!claw) return null;
  return { template: synthesizeTemplate(id, claw.name), name: claw.name };
}

// ─── Icons ────────────────────────────────────────────────────────────────
const IconCheck = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconChevronDown = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IconArrowExternal = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);
const IconUpload = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
);
const IconWarn = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);
const IconLock = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconInfo = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
  </svg>
);
const IconPlus = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconX = ({ size = 14, color = C.muted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconGlobe = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20" />
  </svg>
);

// ─── Small UI helpers ─────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <span
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: 36, height: 20,
        background: on ? C.lime : C.border,
        borderRadius: 999,
        position: "relative",
        cursor: "pointer",
        transition: "background .15s ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 16, height: 16,
          background: on ? C.limeText : "#fafafa",
          borderRadius: 999,
          transition: "left .15s ease",
        }}
      />
    </span>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px", color: C.fg }}>
      {children}{required && <span style={{ color: C.lime, marginLeft: 2 }}>*</span>}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, mono = false, disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        background: disabled ? "rgba(40,40,40,0.5)" : C.pillBg,
        border: `1px solid ${C.border}`,
        color: disabled ? C.muted : C.fg,
        fontFamily: mono ? MONO : FONT,
        fontSize: 14, fontWeight: 400, lineHeight: "20px",
        padding: "10px 14px",
        borderRadius: 8,
        outline: "none",
        cursor: disabled ? "not-allowed" : "text",
      }}
    />
  );
}

function Select({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          width: "100%",
          background: C.pillBg,
          border: `1px solid ${C.border}`,
          color: value ? C.fg : C.muted,
          fontFamily: FONT, fontSize: 14, fontWeight: 400, lineHeight: "20px",
          padding: "10px 32px 10px 14px",
          borderRadius: 8,
          outline: "none",
          cursor: "pointer",
        }}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: C.cardSolid, color: C.fg }}>
            {o.label}
          </option>
        ))}
      </select>
      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none" }}>
        <IconChevronDown />
      </span>
    </div>
  );
}

// ─── Host mode toggle (two big cards) ─────────────────────────────────────
function HostModeCard({
  selected, title, badge, description, icon, onClick,
}: {
  selected: boolean;
  title: string;
  badge?: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        textAlign: "left",
        background: selected ? C.selectedYel : C.cardSolid,
        border: `1px solid ${selected ? C.selectedYelB : C.border}`,
        borderRadius: 10,
        padding: "14px 20px",
        cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 4,
        fontFamily: FONT,
        transition: "background .15s ease, border-color .15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: selected ? C.lime : C.muted, display: "inline-flex" }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, lineHeight: "20px", color: selected ? "#fff" : C.muted }}>
          {title}
        </span>
        {badge && (
          <span
            style={{
              fontSize: 11, fontWeight: 600, lineHeight: "16px",
              color: C.fg,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${C.border}`,
              padding: "1px 7px",
              borderRadius: 4,
              letterSpacing: "0.04em",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <p style={{ margin: "2px 0 0 22px", fontSize: 12, fontWeight: 400, lineHeight: "16px", color: C.muted }}>
        {description}
      </p>
    </button>
  );
}

// ─── Stepper row (accordion-style) ────────────────────────────────────────
function StepperRow({
  step, title, state, onClick,
}: {
  step: StepId;
  title: string;
  state: "active" | "done" | "pending";
  onClick: () => void;
}) {
  const numberBg = state === "active" ? C.lime : "transparent";
  const numberFg = state === "active" ? C.limeText : C.muted;
  const numberBorder = state === "active" ? "transparent" : C.border;
  const titleColor = state === "active" ? C.fg : state === "done" ? C.muted : C.muted;
  const titleWeight: number = state === "active" ? 600 : 500;

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        background: "transparent", border: "none",
        padding: "10px 0",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
      }}
    >
      <span
        style={{
          width: 22, height: 22,
          borderRadius: 4,
          background: numberBg,
          color: numberFg,
          border: `1px solid ${numberBorder}`,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT, fontSize: 12, fontWeight: 600, lineHeight: "16px",
          flexShrink: 0,
        }}
      >
        {state === "done" ? <IconCheck size={12} /> : step}
      </span>
      <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: titleWeight, lineHeight: "20px", color: titleColor }}>
        {title}
      </span>
    </button>
  );
}

// ─── Live Cost Estimate sticky panel ──────────────────────────────────────
function LiveCostPanel({
  computeRate, tip, onBack, onContinue, continueLabel = "Continue", continueDisabled,
}: {
  computeRate: number; // $/hr
  tip?: string;
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
}) {
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 56 }}>
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "18px 20px",
          display: "flex", flexDirection: "column", gap: 6,
        }}
      >
        <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg }}>Live Cost Estimate</div>
        <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 700, lineHeight: "36px", color: C.fg, letterSpacing: "-0.02em" }}>
          ${computeRate.toFixed(4)}<span style={{ fontSize: 16, fontWeight: 500, color: C.muted }}>/hr</span>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "16px" }}>
          {computeRate === 0 ? "Select a compute tier · per active instance" : "Container tier · per active instance"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, paddingTop: 10, borderTop: `1px solid ${C.borderSoft}` }}>
          <span style={{ width: 6, height: 6, background: C.muted, borderRadius: 2 }} />
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted }}>MaaS: pay per token used</span>
        </div>
      </div>

      {tip && (
        <div
          style={{
            background: C.cardSolid,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "12px 14px",
            fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "16px",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}
        >
          <span style={{ color: C.muted, marginTop: 1 }}><IconInfo size={12} /></span>
          <span>{tip}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onBack}
          style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
            background: "transparent", color: C.fg,
            border: `1px solid ${C.border}`,
            padding: "8px 18px", borderRadius: 8, cursor: "pointer",
          }}
        >
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={continueDisabled}
          style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
            background: continueDisabled ? "#3a3a1f" : C.lime,
            color: continueDisabled ? "#666" : C.limeText,
            border: "none",
            padding: "8px 18px", borderRadius: 8,
            cursor: continueDisabled ? "not-allowed" : "pointer",
          }}
        >
          {continueLabel}
        </button>
      </div>
    </aside>
  );
}

// ─── Section header for single-page wizard layout ─────────────────────────
function SectionHeader({
  number, title,
}: { number: number; title: string; subtitle?: string | null }) {
  // "Pre-configured" subtitle pill was removed — the collapsed chip-row + Customize link
  // inside the section already communicate "default applied"; keep the header clean.
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 22, height: 22,
          borderRadius: 6,
          background: C.lime,
          color: C.limeText,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT, fontSize: 12, fontWeight: 700, lineHeight: "16px",
          flexShrink: 0,
        }}
      >
        {number}
      </span>
      <h2 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "22px", color: C.fg, margin: 0 }}>
        {title}
      </h2>
    </div>
  );
}

// ─── Right sticky panel — cost + Register CTA (single-page mode) ──────────
function RegisterPanel({
  computeRate, canRegister, onCancel, onRegister, ctaLabel = "Register Agent", hideComputeCost = false,
}: {
  computeRate: number;
  canRegister: boolean;
  onCancel: () => void;
  onRegister: () => void;
  ctaLabel?: string;
  hideComputeCost?: boolean;
}) {
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 8, position: "sticky", top: 48 }}>
      {!hideComputeCost && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex", flexDirection: "column", gap: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Live Cost</span>
            <span style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, lineHeight: "24px", color: C.fg, letterSpacing: "-0.02em" }}>
              ${computeRate.toFixed(4)}<span style={{ fontSize: 12, fontWeight: 500, color: C.muted }}>/hr</span>
            </span>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>Container · per active instance · MaaS pay-per-token</div>
        </div>
      )}

      <div
        style={{
          background: C.cardSolid,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: "8px 12px",
          fontFamily: FONT, fontSize: 11, fontWeight: 400, color: C.muted, lineHeight: "14px",
          display: "flex", gap: 6, alignItems: "flex-start",
        }}
      >
        <span style={{ color: C.muted, marginTop: 1 }}><IconInfo size={11} /></span>
        <span>
          {hideComputeCost
            ? <><span style={{ color: C.fg, fontWeight: 600 }}>Self-hosted</span> — you own compute & uptime. GMI auto-checks URL + key, then lists.</>
            : <><span style={{ color: C.fg, fontWeight: 600 }}>Registration ≠ Listing</span> — list publicly later from Dashboard.</>
          }
        </span>
      </div>

      <button
        onClick={onRegister}
        disabled={!canRegister}
        style={{
          width: "100%",
          fontFamily: FONT, fontSize: 13, fontWeight: 600, lineHeight: "18px",
          background: canRegister ? C.lime : "#3a3a1f",
          color: canRegister ? C.limeText : "#666",
          border: "none",
          padding: "8px 14px",
          borderRadius: 8,
          cursor: canRegister ? "pointer" : "not-allowed",
        }}
      >
        {ctaLabel}
      </button>
      <button
        onClick={onCancel}
        style={{
          width: "100%",
          fontFamily: FONT, fontSize: 12, fontWeight: 500, lineHeight: "16px",
          background: "transparent",
          color: C.muted,
          border: "none",
          padding: "2px 0",
          cursor: "pointer",
        }}
      >
        Cancel
      </button>
    </aside>
  );
}

// ─── Step 1: Basics & Template ───────────────────────────────────────────
function StepBasics({
  projectName, setProjectName, onCancel, onContinue, showEnvWarning = true,
}: {
  projectName: string;
  setProjectName: (v: string) => void;
  onCancel?: () => void;
  onContinue?: () => void;
  showEnvWarning?: boolean;
}) {
  const canContinue = projectName.trim().length > 1;
  const showFooter = !!(onCancel && onContinue);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel required>Internal Project Name</FieldLabel>
        <TextInput value={projectName} onChange={setProjectName} placeholder="e.g. contract-review-v2" />
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "16px", color: C.muted }}>
          This is your internal identifier — not shown publicly on the Agentbox
        </span>
      </div>

      {/* GMI-injected env vars notice */}
      {showEnvWarning && (
        <div
          style={{
            background: C.warnBg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "8px 12px",
            display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
            fontFamily: FONT, fontSize: 12, lineHeight: "18px",
          }}
        >
          <span style={{ color: C.warn, flexShrink: 0, display: "inline-flex" }}><IconWarn size={12} /></span>
          <span style={{ color: C.fg, fontWeight: 600 }}>Your container must read</span>
          <code style={{ fontFamily: MONO, fontSize: 11, color: C.fg, background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>GMI_MAAS_API_KEY</code>
          <code style={{ fontFamily: MONO, fontSize: 11, color: C.fg, background: "rgba(255,255,255,0.04)", padding: "1px 6px", borderRadius: 4 }}>GMI_MAAS_BASE_URL</code>
          <span style={{ color: C.muted }}>— injected at deploy.</span>
          <a href="#" style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.link, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2, marginLeft: "auto" }}>
            Setup guide <IconArrowExternal size={10} />
          </a>
        </div>
      )}

      {showFooter && (
        <FooterButtons leftLabel="Cancel" onLeft={onCancel!} rightLabel="Continue" onRight={onContinue!} rightDisabled={!canContinue} />
      )}
    </div>
  );
}

// ─── Step 2: Infrastructure ───────────────────────────────────────────────
function StepInfrastructure({
  dockerSource, setDockerSource,
  dockerImage, setDockerImage,
  enableCreds, setEnableCreds,
  region, setRegion,
  computeTier, setComputeTier,
  maxLifetime, setMaxLifetime,
  idleTimeout, setIdleTimeout,
  addModels, setAddModels,
  selectedModel, setSelectedModel,
  forkedFromTemplate = false,
}: {
  dockerSource: "registry" | "upload";
  setDockerSource: (v: "registry" | "upload") => void;
  dockerImage: string;
  setDockerImage: (v: string) => void;
  enableCreds: boolean;
  setEnableCreds: (v: boolean) => void;
  region: string;
  setRegion: (v: string) => void;
  computeTier: string;
  setComputeTier: (v: string) => void;
  maxLifetime: string;
  setMaxLifetime: (v: string) => void;
  idleTimeout: string;
  setIdleTimeout: (v: string) => void;
  addModels: boolean;
  setAddModels: (v: boolean) => void;
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  forkedFromTemplate?: boolean;
}) {
  // Collapse step when everything is at its GMI default; expand on user click
  // or as soon as any field drifts from default. When forked from a template,
  // start collapsed regardless of values — user explicitly opts into editing.
  const allDefault =
    dockerSource  === "registry" &&
    dockerImage   === "gmi/starter-agent:latest" &&
    enableCreds   === false &&
    region        === "us-ia-iowa-1" &&
    computeTier   === "container" &&
    maxLifetime   === "1h" &&
    idleTimeout   === "5min" &&
    addModels     === true &&
    selectedModel === "";
  const [userExpanded, setUserExpanded] = useState(false);
  const collapsed = !userExpanded && (allDefault || forkedFromTemplate);

  if (collapsed) {
    const chips: string[] = forkedFromTemplate
      ? ["Pre-filled from template"]
      : [
          "Starter image",
          "Container tier",
          "IOWA IDC-1",
          "Max 1h · idle 5min",
          "GMI Models on",
        ];
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}
      >
        {chips.map((c) => (
          <span
            key={c}
            style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 500, lineHeight: "14px",
              color: C.fg,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.border}`,
              padding: "1px 8px",
              borderRadius: 999,
            }}
          >
            {c}
          </span>
        ))}
        <button
          onClick={() => setUserExpanded(true)}
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 3,
            fontFamily: FONT, fontSize: 11, fontWeight: 500,
            background: "transparent", color: "#7dd3fc",
            border: "none", padding: 0, cursor: "pointer",
          }}
        >
          Customize <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
        </button>
      </div>
    );
  }

  const resetToDefaults = () => {
    setDockerSource("registry");
    setDockerImage("gmi/starter-agent:latest");
    setEnableCreds(false);
    setRegion("us-ia-iowa-1");
    setComputeTier("container");
    setMaxLifetime("1h");
    setIdleTimeout("5min");
    setAddModels(true);
    setSelectedModel("");
    setUserExpanded(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Collapse-back link — only when nothing has drifted from default */}
      {allDefault && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setUserExpanded(false)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: FONT, fontSize: 12, fontWeight: 500, lineHeight: "16px",
              background: "transparent", color: C.muted,
              border: "none", padding: 0, cursor: "pointer",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 15-6-6-6 6" />
            </svg>
            Collapse · use GMI defaults
          </button>
        </div>
      )}
      {!allDefault && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={resetToDefaults}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: FONT, fontSize: 12, fontWeight: 500, lineHeight: "16px",
              background: "transparent", color: "#7dd3fc",
              border: "none", padding: 0, cursor: "pointer",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
            </svg>
            Reset to GMI defaults
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Top section */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "16px 20px",
          display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        {/* Docker Image Source */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FieldLabel required>Docker Image Source</FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <SourceCard
              selected={dockerSource === "registry"}
              title="Registry URL"
              description="Pull from Docker Hub, GHCR, ECR, etc"
              onClick={() => setDockerSource("registry")}
              icon={<IconGlobe />}
            />
            <SourceCard
              selected={false}
              disabled
              title="Upload Image"
              description="Coming soon"
              onClick={() => {}}
              icon={<IconUpload />}
            />
          </div>
          {dockerSource === "registry" && (
            <TextInput value={dockerImage} onChange={setDockerImage} placeholder="docker.io/acme/agent:1.0.0" mono />
          )}
        </div>

        {/* Enable Credentials */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, lineHeight: "20px", color: C.fg }}>
              Enable Credentials
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "16px", color: C.muted, marginTop: 2 }}>
              Enable credentials if your Docker registry requires authentication for pulling images.
            </div>
            {enableCreds && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <TextInput value="" onChange={() => {}} placeholder="Registry username" />
                <TextInput value="" onChange={() => {}} placeholder="Registry password / token" />
              </div>
            )}
          </div>
          <Toggle on={enableCreds} onChange={setEnableCreds} />
        </div>

        {/* Region */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FieldLabel required>Data Center Region</FieldLabel>
          <Select
            value={region}
            onChange={setRegion}
            placeholder="Select a data center region"
            options={REGIONS.map((r) => ({ value: r.id, label: `${r.name} — ${r.sub}` }))}
          />

          <div style={{ marginTop: 6 }}>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, marginBottom: 6 }}>Popular regions</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {REGIONS.filter((r) => r.popular).map((r) => {
                const isActive = region === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setRegion(r.id)}
                    style={{
                      background: isActive ? C.selectedYel : C.cardSolid,
                      border: `1px solid ${isActive ? C.selectedYelB : C.border}`,
                      borderRadius: 8,
                      padding: "10px 14px",
                      textAlign: "left",
                      display: "flex", alignItems: "center", gap: 10,
                      cursor: "pointer",
                      fontFamily: FONT,
                    }}
                  >
                    <span
                      style={{
                        width: 12, height: 12, borderRadius: 999,
                        border: `1.5px solid ${isActive ? C.lime : C.border}`,
                        background: isActive ? C.lime : "transparent",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.fg, lineHeight: "18px" }}>{r.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "16px" }}>{r.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Compute Tier */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FieldLabel required>Compute Tier</FieldLabel>
          {!region ? (
            <div
              style={{
                fontFamily: FONT, fontSize: 13, fontWeight: 400, color: C.muted,
                background: C.cardSolid,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              Select a region first
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {COMPUTE_TIERS.map((t) => {
                const isActive = computeTier === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setComputeTier(t.id)}
                    style={{
                      background: isActive ? C.selectedYel : C.cardSolid,
                      border: `1px solid ${isActive ? C.selectedYelB : C.border}`,
                      borderRadius: 8,
                      padding: "12px 14px",
                      textAlign: "left",
                      display: "flex", flexDirection: "column", gap: 4,
                      cursor: "pointer",
                      fontFamily: FONT,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.fg, lineHeight: "18px" }}>{t.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, color: C.muted, lineHeight: "14px" }}>{t.cpu} · {t.ram}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.lime, marginTop: 4 }}>${t.pricePerHr.toFixed(4)}/hr</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* PRD F-09 — Lifecycle defaults (template-level; per-task override via SDK at task create) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FieldLabel>Lifecycle defaults</FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>Default task lifetime</span>
              <Select
                value={maxLifetime}
                onChange={setMaxLifetime}
                options={[
                  { value: "30min", label: "30 min" },
                  { value: "1h",    label: "1 hour" },
                  { value: "2h",    label: "2 hours" },
                  { value: "4h",    label: "4 hours" },
                  { value: "8h",    label: "8 hours" },
                  { value: "24h",   label: "24 hours" },
                  { value: "off",   label: "No limit" },
                ]}
              />
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 400, color: C.muted, lineHeight: "16px" }}>
                Hard cap — task auto-stops after this duration.
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>Idle auto-stop</span>
              <Select
                value={idleTimeout}
                onChange={setIdleTimeout}
                options={[
                  { value: "1min",  label: "1 min" },
                  { value: "5min",  label: "5 min" },
                  { value: "15min", label: "15 min" },
                  { value: "30min", label: "30 min" },
                  { value: "1h",    label: "1 hour" },
                  { value: "off",   label: "Off" },
                ]}
              />
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 400, color: C.muted, lineHeight: "16px" }}>
                Auto-stop after N seconds of inactivity.
              </span>
            </div>
          </div>
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "16px", marginTop: 2 }}>
            Callers can override these per-task via the SDK at task create.
          </span>
        </div>
      </div>

      {/* Add GMI Models */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "16px 20px",
          display: "flex", flexDirection: "column", gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, lineHeight: "24px", color: C.fg, margin: 0 }}>
              Add GMI Models
            </h3>
            <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 400, lineHeight: "20px", color: C.muted, margin: "4px 0 0" }}>
              Access 200+ frontier models from inside your container.
            </p>
          </div>
          <Toggle on={addModels} onChange={setAddModels} />
        </div>

        {addModels && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <FieldLabel>Select Model</FieldLabel>
              <Select
                value={selectedModel}
                onChange={setSelectedModel}
                placeholder="Select an option"
                options={MODELS.map((m) => ({ value: m.id, label: m.name }))}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {MODELS.map((m) => {
                const isActive = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    style={{
                      background: isActive ? C.selectedYel : C.cardSolid,
                      border: `1px solid ${isActive ? C.selectedYelB : C.border}`,
                      borderRadius: 10,
                      padding: "14px 16px",
                      textAlign: "left",
                      display: "flex", flexDirection: "column", gap: 6,
                      cursor: "pointer",
                      fontFamily: FONT,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.fg, lineHeight: "20px" }}>{m.name}</div>
                    <div
                      style={{
                        display: "inline-flex", alignSelf: "flex-start",
                        fontSize: 11, fontWeight: 600, color: C.fg,
                        background: "rgba(125,211,252,0.10)",
                        border: "1px solid rgba(125,211,252,0.35)",
                        padding: "1px 7px", borderRadius: 999,
                      }}
                    >
                      {m.ctx}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "18px", marginTop: 2 }}>
                      Input {m.inPrice}
                    </div>
                    {m.outPrice && (
                      <div style={{ fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "18px" }}>
                        Output {m.outPrice}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

function SourceCard({
  selected, disabled, title, description, icon, onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        background: selected ? C.selectedYel : C.cardSolid,
        border: `1px solid ${selected ? C.selectedYelB : C.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        textAlign: "left",
        display: "flex", flexDirection: "column", gap: 4,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 14, height: 14, borderRadius: 999,
            border: `1.5px solid ${selected ? C.lime : C.border}`,
            background: selected ? C.lime : "transparent",
            flexShrink: 0,
          }}
        />
        <span style={{ color: selected ? C.lime : C.muted, display: "inline-flex" }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.fg, lineHeight: "20px" }}>{title}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "16px", marginLeft: 30 }}>{description}</div>
    </button>
  );
}

// ─── Step 3: Networking ───────────────────────────────────────────────────
function StepNetworking({
  ports, setPorts,
  webhookEnabled, setWebhookEnabled,
  webhookPort, setWebhookPort,
  webhookSecret, setWebhookSecret,
  projectName,
  forkedFromTemplate = false,
}: {
  ports: PortMap[];
  setPorts: (v: PortMap[]) => void;
  webhookEnabled: boolean;
  setWebhookEnabled: (v: boolean) => void;
  webhookPort: string;
  setWebhookPort: (v: string) => void;
  webhookSecret: string;
  setWebhookSecret: (v: string) => void;
  projectName: string;
  forkedFromTemplate?: boolean;
}) {
  const updatePort = (id: string, patch: Partial<PortMap>) => {
    setPorts(ports.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const removePort = (id: string) => setPorts(ports.filter((p) => p.id !== id));
  const addPort = () => setPorts([...ports, { id: `p${Date.now()}`, protocol: "HTTPS/2", listening: "", internal: "", name: "" }]);
  const slug = projectName.trim() ? projectName.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") : "your-agent";
  const webhookUrl = `https://hooks.gmi.cloud/${slug}`;

  const allDefault =
    ports.length === 1 &&
    ports[0].protocol === "HTTPS/2" &&
    ports[0].internal === "8080" &&
    ports[0].name === "web" &&
    !ports[0].listening &&
    !webhookEnabled;
  const [userExpanded, setUserExpanded] = useState(false);
  const collapsed = !userExpanded && (allDefault || forkedFromTemplate);
  const resetToDefaults = () => {
    setPorts([{ id: "p1", protocol: "HTTPS/2", listening: "", internal: "8080", name: "web" }]);
    setWebhookEnabled(false);
    setWebhookPort("8080");
    setWebhookSecret("");
    setUserExpanded(false);
  };

  if (collapsed) {
    const chipLabels = forkedFromTemplate
      ? ["Pre-filled from template"]
      : ["Public IP auto-allocated", "HTTPS/2 :8080 (web)"];
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}
      >
        {chipLabels.map((c) => (
          <span
            key={c}
            style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 500, lineHeight: "14px",
              color: C.fg,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.border}`,
              padding: "1px 8px",
              borderRadius: 999,
            }}
          >
            {c}
          </span>
        ))}
        <button
          onClick={() => setUserExpanded(true)}
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 3,
            fontFamily: FONT, fontSize: 11, fontWeight: 500,
            background: "transparent", color: "#7dd3fc",
            border: "none", padding: 0, cursor: "pointer",
          }}
        >
          Customize <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <button
        onClick={allDefault ? () => setUserExpanded(false) : resetToDefaults}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontFamily: FONT, fontSize: 12, fontWeight: 500, lineHeight: "16px",
          background: "transparent",
          color: allDefault ? C.muted : "#7dd3fc",
          border: "none", padding: 0, cursor: "pointer",
        }}
      >
        {allDefault ? (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 15-6-6-6 6" />
            </svg>
            Collapse · use GMI defaults
          </>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
            </svg>
            Reset to GMI defaults
          </>
        )}
      </button>
    </div>
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex", flexDirection: "column", gap: 20,
      }}
    >
      {/* Public IP */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel>Public IP address</FieldLabel>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(40,40,40,0.5)",
            border: `1px dashed ${C.border}`,
            borderRadius: 8,
            padding: "10px 14px",
            color: C.muted,
            fontFamily: FONT, fontSize: 13,
          }}
        >
          <IconInfo size={13} />
          <span>Public IP address will be allocated automatically by the platform.</span>
        </div>
      </div>

      {/* Port Mapping */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FieldLabel>Port Mapping</FieldLabel>
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "16px", color: C.muted, marginTop: -4 }}>
          Change below if your app listens on a different port.
        </span>
        <div
          style={{
            background: C.cardSolid,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            overflow: "hidden",
            marginTop: 8,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr 1fr 1fr 32px",
              gap: 12,
              padding: "10px 16px",
              fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: "16px",
              borderBottom: `1px solid ${C.borderSoft}`,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div>Protocol</div>
            <div>Listening Port</div>
            <div>Internal Port</div>
            <div>Port name</div>
            <div />
          </div>
          {ports.map((p) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 1fr 1fr 32px",
                gap: 12,
                padding: "10px 16px",
                alignItems: "center",
                borderTop: `1px solid ${C.borderSoft}`,
              }}
            >
              <Select
                value={p.protocol}
                onChange={(v) => updatePort(p.id, { protocol: v })}
                options={["HTTPS/2", "HTTPS/1.1", "HTTP", "TCP", "gRPC"].map((x) => ({ value: x, label: x }))}
              />
              <TextInput value={p.listening} onChange={(v) => updatePort(p.id, { listening: v })} placeholder="443" />
              <TextInput value={p.internal}  onChange={(v) => updatePort(p.id, { internal: v })}  placeholder="8080" />
              <TextInput value={p.name}      onChange={(v) => updatePort(p.id, { name: v })}      placeholder="web" />
              <button
                onClick={() => removePort(p.id)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: 4, display: "inline-flex" }}
                aria-label="Remove port"
              >
                <IconX color="#ef4444" />
              </button>
            </div>
          ))}
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.borderSoft}` }}>
            <button
              onClick={addPort}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "transparent", color: C.fg,
                border: `1px solid ${C.border}`,
                padding: "6px 12px", borderRadius: 8,
                fontFamily: FONT, fontSize: 13, fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <IconPlus size={12} /> Add port mapping
            </button>
          </div>
        </div>
      </div>

      {/* Public webhook receiver — opt-in public HTTPS ingress for 3rd-party webhooks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <FieldLabel>Public webhook receiver</FieldLabel>
          <Toggle on={webhookEnabled} onChange={setWebhookEnabled} />
        </div>
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "18px", color: C.muted, marginTop: -4 }}>
          Expose a stable public HTTPS URL so third-party services (Stripe, GitHub, Slack, etc.) can POST events to your Agent.
        </span>

        {webhookEnabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>Webhook URL</span>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: C.pillBg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                }}
              >
                <code style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {webhookUrl}
                </code>
                <CopyInline value={webhookUrl} />
              </div>
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
                Stable across redeploys. GMI proxies POSTs to your container on the port below.
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>Forward to internal port</span>
                <TextInput value={webhookPort} onChange={setWebhookPort} placeholder="8080" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>HMAC signing secret · optional</span>
                  <button
                    onClick={() => {
                      const r = () => Math.random().toString(36).slice(2, 12);
                      setWebhookSecret(`whsec_${r()}${r()}${r()}`);
                    }}
                    style={{
                      fontFamily: FONT, fontSize: 11, fontWeight: 500,
                      color: "#7dd3fc",
                      background: "rgba(125,211,252,0.08)",
                      border: "1px solid rgba(125,211,252,0.30)",
                      padding: "1px 8px",
                      borderRadius: 999,
                      cursor: "pointer",
                    }}
                  >
                    Generate
                  </button>
                </div>
                <TextInput value={webhookSecret} onChange={setWebhookSecret} placeholder="whsec_…" mono />
              </div>
            </div>
            <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>
              If set, GMI signs each forwarded request with{" "}
              <code style={{ fontFamily: MONO, color: C.fg, background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 3 }}>X-GMI-Signature</code>
              {" "}so your code can verify authenticity.
            </span>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// ─── Step 4: Env Variables ───────────────────────────────────────────────
function StepEnvVars({
  customEnvs, setCustomEnvs,
  forkedFromTemplate = false,
}: {
  customEnvs: CustomEnv[];
  setCustomEnvs: (v: CustomEnv[]) => void;
  forkedFromTemplate?: boolean;
}) {
  const update = (id: string, patch: Partial<CustomEnv>) =>
    setCustomEnvs(customEnvs.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => setCustomEnvs(customEnvs.filter((e) => e.id !== id));
  const add = () => setCustomEnvs([...customEnvs, { id: `env${Date.now()}`, key: "", value: "", secret: false }]);

  const allDefault = customEnvs.length === 0;
  const [userExpanded, setUserExpanded] = useState(false);
  const collapsed = !userExpanded && (allDefault || forkedFromTemplate);
  const resetToDefaults = () => { setCustomEnvs([]); setUserExpanded(false); };

  if (collapsed) {
    const chipList = forkedFromTemplate
      ? [{ l: "Pre-filled from template", mono: false }]
      : [
          { l: "GMI_MAAS_API_KEY",  mono: true },
          { l: "GMI_MAAS_BASE_URL", mono: true },
          { l: "No custom vars",    mono: false },
        ];
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}
      >
        {chipList.map((c) => (
          <span
            key={c.l}
            style={{
              fontFamily: c.mono ? "'GeistMono', monospace" : FONT,
              fontSize: 11, fontWeight: 500, lineHeight: "14px",
              color: C.fg,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.border}`,
              padding: "1px 8px",
              borderRadius: 999,
            }}
          >
            {c.l}
          </span>
        ))}
        <button
          onClick={() => setUserExpanded(true)}
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 3,
            fontFamily: FONT, fontSize: 11, fontWeight: 500,
            background: "transparent", color: "#7dd3fc",
            border: "none", padding: 0, cursor: "pointer",
          }}
        >
          Customize <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <button
        onClick={allDefault ? () => setUserExpanded(false) : resetToDefaults}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontFamily: FONT, fontSize: 12, fontWeight: 500, lineHeight: "16px",
          background: "transparent",
          color: allDefault ? C.muted : "#7dd3fc",
          border: "none", padding: 0, cursor: "pointer",
        }}
      >
        {allDefault ? (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 15-6-6-6 6" />
            </svg>
            Collapse · use GMI defaults
          </>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
            </svg>
            Reset to GMI defaults
          </>
        )}
      </button>
    </div>
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex", flexDirection: "column", gap: 20,
      }}
    >
      {/* Auto-injected */}
      <section
        style={{
          background: C.cardSolid,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg,
            borderBottom: `1px solid ${C.borderSoft}`,
          }}
        >
          Auto-Injected by GMI
        </div>
        <div
          style={{
            display: "grid", gridTemplateColumns: "1.2fr 1.4fr 90px",
            gap: 12, padding: "10px 16px",
            fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: "16px",
            borderBottom: `1px solid ${C.borderSoft}`,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div>Key</div><div>Value</div><div style={{ textAlign: "right" }}>Type</div>
        </div>
        {[
          { key: "GMI_MAAS_API_KEY",  value: "Auto-generated on deploy" },
          { key: "GMI_MAAS_BASE_URL", value: "https://api.gmi-serving.com" },
        ].map((row, i) => (
          <div
            key={row.key}
            style={{
              display: "grid", gridTemplateColumns: "1.2fr 1.4fr 90px",
              gap: 12, padding: "12px 16px",
              borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: C.fg }}>{row.key}</span>
              <span style={{ color: C.muted }}><IconLock size={12} /></span>
            </div>
            <div style={{ fontFamily: row.value.startsWith("http") ? MONO : FONT, fontSize: 13, color: C.fg }}>{row.value}</div>
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  fontSize: 11, fontWeight: 600, lineHeight: "16px",
                  color: C.fg,
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${C.border}`,
                  padding: "1px 7px", borderRadius: 4,
                  letterSpacing: "0.04em",
                }}
              >
                AUTO
              </span>
            </div>
          </div>
        ))}
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.borderSoft}`, fontFamily: FONT, fontSize: 12, color: C.muted }}>
          Locked. These are managed by GMI and cannot be overridden.
        </div>
      </section>

      {/* Custom Variables */}
      <section
        style={{
          background: C.cardSolid,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "16px",
          display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg }}>Custom Variables</div>
          <button
            onClick={add}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: C.lime, color: C.limeText,
              border: "none",
              padding: "6px 12px", borderRadius: 8,
              fontFamily: FONT, fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <IconPlus size={12} /> Add variable
          </button>
        </div>

        {customEnvs.length === 0 ? (
          <div style={{ fontFamily: FONT, fontSize: 13, color: C.muted, padding: "8px 0" }}>
            No custom variables yet.
          </div>
        ) : (
          customEnvs.map((env) => (
            <div
              key={env.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.4fr 110px 32px",
                gap: 8,
                alignItems: "center",
              }}
            >
              <TextInput value={env.key}   onChange={(v) => update(env.id, { key: v })}   placeholder="MY_API_KEY" mono />
              <TextInput value={env.value} onChange={(v) => update(env.id, { value: v })} placeholder={env.secret ? "••••••••" : "value"} mono />
              <button
                onClick={() => update(env.id, { secret: !env.secret })}
                style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 500,
                  background: env.secret ? "rgba(199,167,255,0.12)" : "transparent",
                  color: env.secret ? "#c7a7ff" : C.muted,
                  border: `1px solid ${env.secret ? "rgba(199,167,255,0.35)" : C.border}`,
                  padding: "6px 10px", borderRadius: 999,
                  cursor: "pointer",
                }}
              >
                {env.secret ? "Secret" : "Plain"}
              </button>
              <button
                onClick={() => remove(env.id)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: 4, display: "inline-flex" }}
              >
                <IconX color="#ef4444" />
              </button>
            </div>
          ))
        )}
      </section>

      <div
        style={{
          background: C.cardSolid,
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 8,
          padding: "10px 14px",
          fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted,
          display: "flex", gap: 8, alignItems: "flex-start",
        }}
      >
        <span style={{ color: C.muted, marginTop: 2 }}><IconInfo size={12} /></span>
        <span>Reminder — Secrets are encrypted at rest with AES-256. Plaintext values are never written to logs or audit history.</span>
      </div>
    </div>
    </div>
  );
}

// ─── Connect-your-agent flow: MaaS Key step ──────────────────────────────
function StepMaasKey({
  maasKey, setMaasKey,
}: {
  maasKey: string;
  setMaasKey: (v: string) => void;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex", flexDirection: "column", gap: 18,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <FieldLabel>
            MaaS API Key
            <span style={{ color: C.muted, fontWeight: 400, marginLeft: 6 }}>· optional</span>
          </FieldLabel>
          <button
            onClick={() => setMaasKey(genMaasKey())}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontFamily: FONT, fontSize: 12, fontWeight: 500,
              color: "#7dd3fc",
              background: "rgba(125,211,252,0.08)",
              border: "1px solid rgba(125,211,252,0.30)",
              padding: "2px 10px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            Generate one
          </button>
        </div>
        <TextInput value={maasKey} onChange={setMaasKey} placeholder="Paste an existing key, or click Generate" mono />
        <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "18px", color: C.muted, margin: "2px 0 0" }}>
          Leave blank and we auto-issue one at deploy. Your code must read{" "}
          <code style={{ fontFamily: MONO, fontSize: 11, color: C.fg, background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 3 }}>GMI_MAAS_API_KEY</code>
          {" "}at runtime — self-hosted Agents get the{" "}
          <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, color: C.fg, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, padding: "1px 6px", borderRadius: 3, letterSpacing: "0.04em" }}>POWERED BY GMI MODELS</span>
          {" "}badge.
        </p>
      </div>
    </div>
  );
}

// ─── Connect-your-agent flow: Endpoint step ──────────────────────────────
function StepEndpoint({
  accessUrl, setAccessUrl,
}: {
  accessUrl: string;
  setAccessUrl: (v: string) => void;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex", flexDirection: "column", gap: 18,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <FieldLabel required>Access URL</FieldLabel>
        <TextInput value={accessUrl} onChange={setAccessUrl} placeholder="https://your-agent.yourdomain.com" mono />
        <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "18px", color: C.muted, margin: "2px 0 0" }}>
          Public HTTPS URL (GMI checks HTTP 200 before listing).
          <span style={{ color: C.warn }}> ⚠</span>{" "}
          <span style={{ color: C.fg, fontWeight: 600 }}>You own uptime</span> — if it goes down, the listing is hidden. No SLA on self-hosted Agents.
        </p>
      </div>
    </div>
  );
}

// ─── Connect-your-agent flow: Review & Submit step ───────────────────────
function StepConnectReview({
  projectName, maasKey, accessUrl,
}: {
  projectName: string;
  maasKey: string;
  accessUrl: string;
}) {
  const rows = [
    { label: "Project Name", value: projectName || "—" },
    { label: "Deployment Type", value: "Self-hosted + GMI MaaS" },
    { label: "MaaS API Key", value: maasKey ? `${maasKey.slice(0, 6)}…${maasKey.slice(-4)}` : "Auto-issued at deploy time" },
    { label: "Access URL", value: accessUrl || "—" },
    { label: "Badge", value: "POWERED BY GMI MODELS", badge: true as const },
  ];

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex", flexDirection: "column", gap: 16,
      }}
    >
      <section
        style={{
          background: C.cardSolid,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            fontFamily: FONT, fontSize: 12, fontWeight: 600,
            color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase",
            borderBottom: `1px solid ${C.borderSoft}`,
          }}
        >
          Configuration Summary
        </div>
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              display: "grid", gridTemplateColumns: "200px 1fr",
              padding: "16px 20px",
              borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
              alignItems: "center",
            }}
          >
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 400, color: C.muted }}>{row.label}</div>
            <div>
              {row.badge ? (
                <span
                  style={{
                    fontFamily: FONT, fontSize: 11, fontWeight: 600,
                    color: C.fg,
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${C.border}`,
                    padding: "2px 8px",
                    borderRadius: 4,
                    letterSpacing: "0.04em",
                  }}
                >
                  {row.value}
                </span>
              ) : (
                <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>{row.value}</span>
              )}
            </div>
          </div>
        ))}
      </section>

      <div
        style={{
          background: "rgba(125,211,252,0.06)",
          border: `1px solid rgba(125,211,252,0.30)`,
          borderRadius: 10,
          padding: "16px 20px",
          fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "18px",
          display: "flex", gap: 8, alignItems: "flex-start",
        }}
      >
        <span style={{ color: "#7dd3fc", marginTop: 2 }}><IconInfo size={13} /></span>
        <span>
          <span style={{ color: C.fg, fontWeight: 600 }}>Auto-approval on submit</span>
          {" "}— GMI probes your Access URL and, if a MaaS key was provided, re-runs the key check. If all checks pass, your listing goes live immediately.
        </span>
      </div>
    </div>
  );
}

// ─── Post-submit Success view (Connect-your-agent flow) ──────────────────
function SuccessView({
  projectName, accessUrl, maasKey, onViewAgents, onListOnAgentbox,
}: {
  projectName: string;
  accessUrl: string;
  maasKey: string;
  onViewAgents: () => void;
  onListOnAgentbox: () => void;
}) {
  const displayedKey = maasKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRhMDc2ZTY3LWY1N2YtNDYyNS05ZDJiLTcwODRhMjY4Y2Y5MiIsInNjb3BlIjoiaW5mZXJlbmNlIn0.demo-auto-issued";
  const curl = [
    "# 1. Verify your GMI MaaS API key",
    "# Run in your terminal — same check GMI ran during registration",
    "curl https://api.gmi-serving.com/v1/models \\",
    "  -H \"Authorization: Bearer $GMI_MAAS_API_KEY\"",
  ].join("\n");

  return (
    <section style={{ padding: "32px 32px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Status pill */}
      <span
        style={{
          alignSelf: "flex-start",
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: FONT, fontSize: 12, fontWeight: 600, lineHeight: "16px",
          color: "#86efac",
          background: "rgba(134,239,172,0.10)",
          border: "1px solid rgba(134,239,172,0.35)",
          padding: "3px 10px",
          borderRadius: 999,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Registration Successful
      </span>

      <div>
        <h1 style={{ fontFamily: FONT, fontSize: 28, fontWeight: 700, lineHeight: "36px", color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>
          Your Agent {projectName ? `"${projectName}" ` : ""}is registered. Call GMI MaaS from your code anytime.
        </h1>
        <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 400, lineHeight: "20px", color: C.muted, margin: "8px 0 0", maxWidth: 880 }}>
          Auto-approved — your MaaS key is active (Inference-scoped) and your external endpoint is reachable. Not yet listed on the Agentbox; only your account is linked to this Agent until you publish.
        </p>
      </div>

      {/* Deployment Type / Badge cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}
        >
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>Deployment Type</span>
          <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg }}>Self-hosted + GMI MaaS</span>
        </div>
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "14px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}
        >
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>Badge</span>
          <span
            style={{
              fontFamily: FONT, fontSize: 11, fontWeight: 600,
              color: C.fg,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${C.border}`,
              padding: "2px 8px",
              borderRadius: 4,
              letterSpacing: "0.04em",
            }}
          >
            POWERED BY GMI MODELS
          </span>
        </div>
      </div>

      {/* External Endpoint URL */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}
      >
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted }}>External Endpoint URL</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {accessUrl || "https://your-agent.yourdomain.com"}
          </span>
          <CopyInline value={accessUrl || "https://your-agent.yourdomain.com"} />
        </div>
      </div>

      {/* Verify your key — curl snippet */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg }}>Verify your registered key in 5 seconds</span>
          <CopyInline value={curl} />
        </div>
        <pre
          style={{
            margin: 0, padding: "14px 16px",
            fontFamily: MONO, fontSize: 13, lineHeight: "22px",
            color: C.fg,
            whiteSpace: "pre",
            overflowX: "auto",
          }}
        >
          {curl.split("\n").map((line, i) => (
            <div key={i} style={{ color: line.startsWith("#") ? C.muted : C.fg }}>
              <span style={{ color: C.muted, marginRight: 12, userSelect: "none" }}>{String(i + 1).padStart(2, " ")}</span>
              {line}
            </div>
          ))}
        </pre>
      </div>

      {/* Key display */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <code style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: C.muted, letterSpacing: "0.04em" }}>GMI_MAAS_API_KEY</code>
          <CopyInline value={displayedKey} />
        </div>
        <pre
          style={{
            margin: 0, padding: "12px 16px",
            fontFamily: MONO, fontSize: 12, lineHeight: "18px",
            color: C.fg,
            whiteSpace: "nowrap",
            overflowX: "auto",
          }}
        >
          <span style={{ color: C.muted, marginRight: 12, userSelect: "none" }}>1</span>
          {displayedKey}
        </pre>
      </div>

      <div style={{ fontFamily: FONT, fontSize: 13, lineHeight: "20px", color: C.muted }}>
        Browse available models in{" "}
        <a href="#" style={{ color: "#7dd3fc", textDecoration: "none" }}>Models Hub →</a>{" "}
        · SDK examples and integration patterns in{" "}
        <a href="#" style={{ color: "#7dd3fc", textDecoration: "none" }}>Docs →</a>{" "}
        · Manage keys in{" "}
        <a href="#" style={{ color: "#7dd3fc", textDecoration: "none" }}>Console → API Keys →</a>
      </div>

      <div
        style={{
          fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "18px", color: C.muted,
          background: C.cardSolid,
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 8,
          padding: "10px 14px",
        }}
      >
        <span style={{ color: C.fg, fontWeight: 600 }}>Reminder:</span>{" "}
        GMI does not host your Agent. Keep{" "}
        <span style={{ fontFamily: MONO, color: C.fg }}>{accessUrl || "your access URL"}</span>{" "}
        reachable at all times — if it goes down, moves, or changes auth, users will receive errors when calling your Agent.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <button
          onClick={onViewAgents}
          style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
            background: "transparent", color: C.fg,
            border: `1px solid ${C.border}`,
            padding: "8px 18px", borderRadius: 8, cursor: "pointer",
          }}
        >
          View My Agents
        </button>
        <button
          onClick={onListOnAgentbox}
          style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 600, lineHeight: "20px",
            background: C.lime, color: C.limeText,
            border: "none",
            padding: "8px 18px", borderRadius: 8, cursor: "pointer",
          }}
        >
          List on Agentbox
        </button>
      </div>
    </section>
  );
}

// Lightweight inline copy button (no state in component tree)
function CopyInline({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: "transparent", border: "none",
        color: copied ? C.lime : C.muted,
        fontFamily: FONT, fontSize: 12, fontWeight: 500,
        cursor: "pointer", padding: 2,
      }}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}

// ─── Step 5: Review & Register ────────────────────────────────────────────
function StepReview({
  summary,
}: {
  summary: { label: string; value: string; highlight?: boolean }[];
  computeRate: number;
  modelInfo: ModelSpec | null;
}) {
  return (
    <div
      style={{
        background: C.cardSolid,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {summary.map((row, i) => (
        <div
          key={row.label}
          style={{
            display: "grid", gridTemplateColumns: "160px 1fr",
            padding: "8px 16px",
            borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
            background: row.highlight ? "rgba(99,105,35,0.18)" : "transparent",
            alignItems: "center",
          }}
        >
          <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 400, color: C.muted }}>{row.label}</div>
          <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Footer (Cancel/Back + Continue) ──────────────────────────────────────
function FooterButtons({
  leftLabel, onLeft, rightLabel, onRight, rightDisabled,
}: {
  leftLabel: string;
  onLeft: () => void;
  rightLabel: string;
  onRight: () => void;
  rightDisabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
        paddingTop: 16, marginTop: 8, borderTop: `1px solid ${C.borderSoft}`,
      }}
    >
      <button
        onClick={onLeft}
        style={{
          fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
          background: "transparent", color: C.fg,
          border: `1px solid ${C.border}`,
          padding: "8px 18px", borderRadius: 8, cursor: "pointer",
        }}
      >
        {leftLabel}
      </button>
      <button
        onClick={onRight}
        disabled={rightDisabled}
        style={{
          fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
          background: rightDisabled ? "#3a3a1f" : C.lime,
          color: rightDisabled ? "#666" : C.limeText,
          border: "none",
          padding: "8px 18px", borderRadius: 8,
          cursor: rightDisabled ? "not-allowed" : "pointer",
        }}
      >
        {rightLabel}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function DeployWizard() {
  const [, setLocation] = useLocation();
  const [hostMode, setHostMode] = useState<HostMode>("gmi");

  // Step 1
  const [projectName, setProjectName] = useState("");

  // Step 2 — PRD F-06: starter image + region/tier defaulted
  const [dockerSource, setDockerSource] = useState<"registry" | "upload">("registry");
  const [dockerImage, setDockerImage] = useState("gmi/starter-agent:latest");
  const [enableCreds, setEnableCreds] = useState(false);
  const [region, setRegion] = useState("us-ia-iowa-1");
  const [computeTier, setComputeTier] = useState("container");
  const [addModels, setAddModels] = useState(true);
  const [selectedModel, setSelectedModel] = useState("");

  // Step 2 — PRD F-09: lifecycle TTL (template default; per-task override via SDK)
  const [maxLifetime, setMaxLifetime] = useState("1h");
  const [idleTimeout, setIdleTimeout] = useState("5min");

  // Step 3
  const [ports, setPorts] = useState<PortMap[]>(DEFAULT_PORTS);
  // Webhook receiver — opt-in public HTTPS ingress for 3rd-party webhooks
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookPort, setWebhookPort] = useState("8080");
  const [webhookSecret, setWebhookSecret] = useState("");

  // Step 4
  const [customEnvs, setCustomEnvs] = useState<CustomEnv[]>([]);

  // Connect-your-agent flow (hostMode = "connect") — its own 4-section set
  const [maasKey, setMaasKey] = useState("");
  const [accessUrl, setAccessUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // ?use=<id> — Use-this-agent fork. Wizard is pre-filled from a marketplace
  // template; user lands on a collapsed view and expands to customize.
  const [forkedFrom, setForkedFrom] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const useId = params.get("use");
    if (!useId) return;
    const found = lookupTemplate(useId);
    if (!found) return;
    setHostMode("gmi");
    setForkedFrom(found.name);
    setProjectName(`${useId}-copy`);
    setDockerSource("registry");
    setDockerImage(found.template.image);
    setRegion(found.template.region);
    setComputeTier(found.template.tier);
    setPorts(found.template.ports);
    setCustomEnvs(found.template.envDeclarations);
    setSelectedModel(found.template.model);
  }, []);

  const tierInfo = useMemo(() => COMPUTE_TIERS.find((t) => t.id === computeTier) || null, [computeTier]);
  const modelInfo = useMemo(() => MODELS.find((m) => m.id === selectedModel) || null, [selectedModel]);
  const regionInfo = useMemo(() => REGIONS.find((r) => r.id === region) || null, [region]);

  const computeRate = tierInfo?.pricePerHr ?? 0;

  const summary = useMemo(() => [
    { label: "Project Name", value: projectName || "—" },
    { label: "Docker Image", value: dockerImage || "—" },
    { label: "Registry Credentials", value: enableCreds ? "Configured" : "Public image", highlight: !enableCreds },
    { label: "Compute Tier",   value: tierInfo ? `${tierInfo.name} — ${tierInfo.cpu} · ${tierInfo.ram}` : "—" },
    { label: "Region",         value: regionInfo ? `${regionInfo.name} · ${regionInfo.sub}` : "—" },
    { label: "Lifetime",       value: `max ${maxLifetime} · idle ${idleTimeout}` },
    { label: "Port Mappings",  value: ports.length > 0
        ? ports.map((p) => `${p.protocol} ${p.internal || "?"} (${p.name || "port"})`).join(", ")
        : "—" },
    { label: "Webhook receiver",
        value: webhookEnabled
          ? `Public · forwards to :${webhookPort}${webhookSecret ? " · signed" : ""}`
          : "Off" },
    { label: "MaaS",           value: modelInfo ? modelInfo.name : "—" },
    { label: "Custom Env Vars", value: customEnvs.length > 0 ? `${customEnvs.length} configured` : "—" },
  ], [projectName, dockerImage, enableCreds, tierInfo, regionInfo, maxLifetime, idleTimeout, ports, webhookEnabled, webhookPort, webhookSecret, modelInfo, customEnvs]);

  // "Pre-configured" subtitle in the section header — flips off the moment user customizes.
  const step2AllDefault =
    dockerSource === "registry" &&
    dockerImage === "gmi/starter-agent:latest" &&
    !enableCreds &&
    region === "us-ia-iowa-1" &&
    computeTier === "container" &&
    maxLifetime === "1h" &&
    idleTimeout === "5min" &&
    addModels && selectedModel === "";

  const step3AllDefault =
    ports.length === 1 &&
    ports[0].protocol === "HTTPS/2" &&
    ports[0].internal === "8080" &&
    ports[0].name === "web" &&
    !ports[0].listening &&
    !webhookEnabled;

  const step4AllDefault = customEnvs.length === 0;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar />
      <Navbar />

      <div style={{ marginLeft: 210, paddingTop: 40 }}>

        {/* Page header + host mode chooser — one tight row */}
        <header style={{ padding: "14px 24px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1
              style={{
                fontFamily: FONT, fontSize: 20, fontWeight: 700, lineHeight: "26px",
                color: C.fg, margin: 0, letterSpacing: "-0.02em",
              }}
            >
              Register an Agent
            </h1>
            <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "16px", color: C.muted, margin: "2px 0 0" }}>
              Configure infrastructure and register your Agent. List on the Agentbox after testing.
            </p>
          </div>
          {/* Host mode — compact segmented switch */}
          <div
            style={{
              display: "inline-flex",
              background: C.pillBg,
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              padding: 3,
            }}
          >
            <button
              onClick={() => setHostMode("gmi")}
              style={{
                fontFamily: FONT, fontSize: 13, fontWeight: 500, lineHeight: "18px",
                background: hostMode === "gmi" ? "rgba(221,234,77,0.18)" : "transparent",
                color: hostMode === "gmi" ? C.lime : C.muted,
                border: "none",
                padding: "4px 12px",
                borderRadius: 999,
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <IconGlobe size={12} /> Host on GMI
              {hostMode === "gmi" && (
                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.7, marginLeft: 2 }}>DEFAULT</span>
              )}
            </button>
            <button
              onClick={() => setHostMode("connect")}
              style={{
                fontFamily: FONT, fontSize: 13, fontWeight: 500, lineHeight: "18px",
                background: hostMode === "connect" ? "rgba(221,234,77,0.18)" : "transparent",
                color: hostMode === "connect" ? C.lime : C.muted,
                border: "none",
                padding: "4px 12px",
                borderRadius: 999,
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <IconUpload size={12} /> Connect your agent
            </button>
          </div>
        </header>

        {/* Pre-filled banner — visible when wizard was forked from a catalog template */}
        {forkedFrom && (
          <div
            style={{
              margin: "8px 24px 0",
              padding: "10px 14px",
              background: "rgba(125,211,252,0.06)",
              border: "1px solid rgba(125,211,252,0.30)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ display: "inline-flex", color: "#7dd3fc" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857C20 21.09 19.105 22 18 22h-8c-1.105 0-2-.911-2-2.036V9.107c0-1.124.895-2.036 2-2.036z"/>
                </svg>
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg, lineHeight: "18px" }}>
                  Pre-filled from <span style={{ color: "#7dd3fc" }}>{forkedFrom}</span>
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "16px", marginTop: 1 }}>
                  Image, env declarations, ports and defaults come from the template. Expand any section below to customize.
                </div>
              </div>
            </div>
            <button
              onClick={() => setLocation("/marketplace")}
              style={{
                fontFamily: FONT, fontSize: 12, fontWeight: 500,
                background: "transparent", color: C.muted,
                border: `1px solid ${C.border}`,
                padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Wizard area — branches on hostMode (GMI / Connect) and submitted (Success view) */}
        {submitted && hostMode === "connect" ? (
          <SuccessView
            projectName={projectName}
            accessUrl={accessUrl}
            maasKey={maasKey}
            onViewAgents={() => setLocation("/dashboard")}
            onListOnAgentbox={() => setLocation("/marketplace")}
          />
        ) : (
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 260px",
              gap: 16,
              padding: "8px 24px 16px",
              alignItems: "start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
              {hostMode === "gmi" ? (
                STEPS.map((s) => {
                  const forkedSubtitle = "Pre-filled — expand to customize";
                  const subtitle =
                    s.id === 2 ? (forkedFrom ? forkedSubtitle : step2AllDefault ? "Pre-configured with GMI defaults" : null) :
                    s.id === 3 ? (forkedFrom ? forkedSubtitle : step3AllDefault ? "Pre-configured with GMI defaults" : null) :
                    s.id === 4 ? (forkedFrom ? forkedSubtitle : step4AllDefault ? "Pre-configured with GMI defaults" : null) : null;
                  return (
                    <div key={s.id} id={`step-${s.id}`}>
                      <SectionHeader number={s.id} title={s.title} subtitle={subtitle} />
                      <div style={{ marginTop: 12 }}>
                        {s.id === 1 && (
                          <div style={{
                            background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                            padding: "16px 20px",
                          }}>
                            <StepBasics
                              projectName={projectName} setProjectName={setProjectName}
                            />
                          </div>
                        )}
                        {s.id === 2 && (
                          <StepInfrastructure
                            dockerSource={dockerSource} setDockerSource={setDockerSource}
                            dockerImage={dockerImage} setDockerImage={setDockerImage}
                            enableCreds={enableCreds} setEnableCreds={setEnableCreds}
                            region={region} setRegion={setRegion}
                            computeTier={computeTier} setComputeTier={setComputeTier}
                            maxLifetime={maxLifetime} setMaxLifetime={setMaxLifetime}
                            idleTimeout={idleTimeout} setIdleTimeout={setIdleTimeout}
                            addModels={addModels} setAddModels={setAddModels}
                            selectedModel={selectedModel} setSelectedModel={setSelectedModel}
                            forkedFromTemplate={!!forkedFrom}
                          />
                        )}
                        {s.id === 3 && (
                          <StepNetworking
                            ports={ports} setPorts={setPorts}
                            webhookEnabled={webhookEnabled} setWebhookEnabled={setWebhookEnabled}
                            webhookPort={webhookPort} setWebhookPort={setWebhookPort}
                            webhookSecret={webhookSecret} setWebhookSecret={setWebhookSecret}
                            projectName={projectName}
                            forkedFromTemplate={!!forkedFrom}
                          />
                        )}
                        {s.id === 4 && <StepEnvVars customEnvs={customEnvs} setCustomEnvs={setCustomEnvs} forkedFromTemplate={!!forkedFrom} />}
                        {s.id === 5 && (
                          <StepReview
                            summary={summary}
                            computeRate={computeRate}
                            modelInfo={modelInfo}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                // Connect-your-agent flow — 4 sections
                CONNECT_STEPS.map((s) => (
                  <div key={s.id} id={`connect-step-${s.id}`}>
                    <SectionHeader number={s.id} title={s.title} subtitle={null} />
                    <div style={{ marginTop: 12 }}>
                      {s.id === 1 && (
                        <div style={{
                          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                          padding: "16px 20px",
                        }}>
                          <StepBasics
                            projectName={projectName} setProjectName={setProjectName}
                            showEnvWarning={false}
                          />
                        </div>
                      )}
                      {s.id === 2 && <StepMaasKey maasKey={maasKey} setMaasKey={setMaasKey} />}
                      {s.id === 3 && <StepEndpoint accessUrl={accessUrl} setAccessUrl={setAccessUrl} />}
                      {s.id === 4 && (
                        <StepConnectReview
                          projectName={projectName}
                          maasKey={maasKey}
                          accessUrl={accessUrl}
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Right: sticky cost + Register/Submit CTA */}
            <RegisterPanel
              computeRate={computeRate}
              hideComputeCost={hostMode === "connect"}
              canRegister={
                hostMode === "gmi"
                  ? projectName.trim().length > 1
                  : projectName.trim().length > 1 && /^https:\/\//i.test(accessUrl.trim())
              }
              ctaLabel={hostMode === "connect" ? "Submit" : "Register Agent"}
              onCancel={() => setLocation("/marketplace")}
              onRegister={() => {
                if (hostMode === "connect") {
                  // Auto-issue a key if user left it blank (matches PRD: "system auto-issues")
                  const effectiveKey = maasKey || genMaasKey();
                  if (!maasKey) setMaasKey(effectiveKey);
                  persistRegisteredAgent({
                    id: `ag_${Date.now().toString(36)}`,
                    name: projectName.trim() || "self-hosted-agent",
                    templateId: `tpl_${Date.now().toString(36)}`,
                    hostMode: "connect",
                    maasKey: effectiveKey,
                    accessUrl: accessUrl.trim(),
                    category: "Code & Dev Tools",
                    registeredAt: new Date().toISOString(),
                  });
                  setSubmitted(true);
                } else {
                  setLocation("/dashboard");
                }
              }}
            />
          </section>
        )}

        <Footer />
      </div>
    </div>
  );
}
