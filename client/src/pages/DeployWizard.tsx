import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ALL_CLAWS } from "@/lib/clawData";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import CopyButton from "@/components/CopyButton";
import { C as baseC, FONT, MONO } from "@/lib/tokens";
import { PlanBadge, DiscountedPrice } from "@/components/PlanUI";
import { isPlanEligibleModel, discountPriceString, CODING_AGENT_PLAN } from "@/lib/modelsPlan";

// ─── Tokens — shared base from @/lib/tokens, plus a few page-local keys.
const C = {
  ...baseC,
  warnBg:       "#1e1e1e",
  selectedYel:  "rgba(99,105,35,0.3)",
  selectedYelB: "rgba(221,234,77,0.55)",
};

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
  { id: 2, title: "GMI Models key" },
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
  // M4 listing state: "draft" by default after Register; flips to "pending_review"
  // when user clicks "List on Agentbox" from the success view.
  listingState?: "draft" | "pending_review" | "live" | "rejected";
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
  { id: "us-ia-iowa-1",   name: "IOWA IDC-1",      sub: "US-IA · US",     popular: true },
  { id: "us-or-portland", name: "Portland IDC-1",  sub: "US-OR · US" },
  { id: "eu-de-frankfurt",name: "Frankfurt IDC-1", sub: "DE-HE · Germany" },
  { id: "ap-sg-singapore",name: "Singapore IDC-1", sub: "SG · Singapore" },
];

interface ComputeTier {
  id: string; name: string; sub: string;
  cpu: string; ram: string; storage: string; pricePerHr: number;
}
const COMPUTE_TIERS: ComputeTier[] = [
  { id: "container", name: "Container", sub: "Instance type for the Agentbox marketplace",
    cpu: "0.5 Core CPU", ram: "800 MiB Memory", storage: "10 GiB OS Storage (Ephemeral)", pricePerHr: 0.0098 },
  { id: "standard",  name: "Standard",  sub: "Most production agents",
    cpu: "4 Core CPU", ram: "8 GiB Memory", storage: "40 GiB OS Storage", pricePerHr: 0.094 },
  { id: "performance", name: "Performance", sub: "High-throughput agents",
    cpu: "8 Core CPU", ram: "16 GiB Memory", storage: "80 GiB OS Storage", pricePerHr: 0.182 },
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

// Env role per PRD M6.3:
// - "config"               — default copied, editable (e.g. MODEL_NAME)
// - "secret_user_supplied" — shown as required blank field on clone; masked input (e.g. OPENAI_API_KEY)
// - "gmi_managed"          — auto-injected by platform per task; locked + masked (GMI_MAAS_*)
type EnvRole = "config" | "secret_user_supplied" | "gmi_managed";
interface CustomEnv { id: string; key: string; value: string; secret: boolean; role?: EnvRole }

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

// Labeled "key · value" summary chip used in collapsed section rows.
// Matches the production console: muted label + bold value inside one pill.
function SpecChip({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "baseline", gap: 6,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: "4px 10px",
        fontFamily: FONT, fontSize: 12, lineHeight: "16px",
        maxWidth: "100%",
      }}
    >
      <span style={{ color: C.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ color: C.fg, fontWeight: 600, fontFamily: mono ? MONO : FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </span>
    </span>
  );
}

// Lime "Customize →" affordance shown on the right of each collapsed section.
function CustomizeLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: "inline-flex", alignItems: "center", gap: 4,
        fontFamily: FONT, fontSize: 12, fontWeight: 600,
        background: "transparent", color: C.lime,
        border: "none", padding: 0, cursor: "pointer",
      }}
    >
      Customize
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
    </button>
  );
}

// Shared shell for a collapsed section: chips on the left, Customize on the right.
function CollapsedRow({ children, onCustomize }: { children: React.ReactNode; onCustomize: () => void }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1, minWidth: 0 }}>
        {children}
      </div>
      <CustomizeLink onClick={onCustomize} />
    </div>
  );
}

// Small info icon with an instant custom hover tooltip (native `title` has a
// ~1s delay and is easy to miss).
function InfoHint({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", color: C.muted, cursor: "help" }}
    >
      <IconInfo size={13} />
      {show && (
        <span
          role="tooltip"
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            width: 260,
            background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "8px 10px",
            fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "16px",
            color: C.fg, textAlign: "left", whiteSpace: "normal",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            zIndex: 50, pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

// Searchable data-center combobox — trigger + filterable list panel.
function RegionSelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string; sub: string; popular?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const selected = options.find((o) => o.id === value);
  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) =>
    !q || o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || o.sub.toLowerCase().includes(q),
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          background: C.pillBg, border: `1px solid ${open ? C.lime : C.border}`, borderRadius: 8,
          padding: "10px 14px", cursor: "pointer",
          fontFamily: FONT, fontSize: 14, lineHeight: "20px",
          color: selected ? C.fg : C.muted, textAlign: "left",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? `${selected.name} (${selected.id})` : "Select a data center"}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.muted, flexShrink: 0, transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 8,
            zIndex: 40, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", overflow: "hidden",
          }}
        >
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: `1px solid ${C.borderSoft}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.muted, flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.fg, fontFamily: FONT, fontSize: 14, lineHeight: "20px" }}
            />
          </div>
          {/* Options */}
          <div style={{ maxHeight: 220, overflowY: "auto", padding: 4 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "10px 12px", fontFamily: FONT, fontSize: 13, color: C.muted }}>—</div>
            ) : (
              filtered.map((o) => {
                const active = o.id === value;
                return (
                  <button
                    type="button"
                    key={o.id}
                    onClick={() => { onChange(o.id); setOpen(false); setQuery(""); }}
                    style={{
                      width: "100%", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px",
                      background: active ? C.selectedYel : "transparent",
                      borderLeft: `2px solid ${active ? C.lime : "transparent"}`,
                      borderTop: "none", borderRight: "none", borderBottom: "none",
                      borderRadius: 4, cursor: "pointer",
                      fontFamily: FONT, fontSize: 14, lineHeight: "20px", color: C.fg,
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <span>{o.name} <span style={{ color: C.muted }}>({o.id})</span></span>
                    {o.popular && (
                      <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", color: C.lime, background: "rgba(221,234,77,0.10)", border: "1px solid rgba(221,234,77,0.35)", padding: "0 6px", borderRadius: 999 }}>
                        POPULAR
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, mono = false, disabled = false, invalid = false, onPaste,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onPaste={onPaste}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        background: disabled ? "rgba(40,40,40,0.5)" : C.pillBg,
        border: `1px solid ${invalid ? C.err : C.border}`,
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
          {computeRate === 0 ? "Select a compute tier · per active instance" : "Compute size · per active instance"}
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
          background: "transparent",
          color: C.lime,
          border: `1px solid ${C.lime}`,
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
  computeRate, canRegister, onCancel, onRegister, ctaLabel = "Register", hideComputeCost = false,
}: {
  computeRate: number;
  canRegister: boolean;
  onCancel: () => void;
  onRegister: () => void;
  ctaLabel?: string;
  hideComputeCost?: boolean;
}) {
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 56 }}>
      {/* Live Cost Estimate */}
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
        {hideComputeCost ? (
          <>
            <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, lineHeight: "28px", color: C.fg, letterSpacing: "-0.02em" }}>You own compute</div>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "16px" }}>GMI hosts nothing — you run the Agent on your own infrastructure.</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 700, lineHeight: "36px", color: C.fg, letterSpacing: "-0.02em" }}>
              ${computeRate.toFixed(4)}<span style={{ fontSize: 16, fontWeight: 500, color: C.muted }}>/hr</span>
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "16px" }}>Container tier · per active instance</div>
          </>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, paddingTop: 10, borderTop: `1px solid ${C.borderSoft}` }}>
          <span style={{ width: 6, height: 6, background: C.muted, borderRadius: 2 }} />
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted }}>MaaS: pay per token used</span>
        </div>
      </div>

      {/* Tip */}
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
        <span style={{ color: C.muted, marginTop: 1, flexShrink: 0 }}><IconInfo size={12} /></span>
        <span>
          {hideComputeCost
            ? <><span style={{ color: C.fg, fontWeight: 600 }}>Connect with GMI</span> — GMI auto-checks your access URL + key, then lists it. You own uptime.</>
            : <><span style={{ color: C.fg, fontWeight: 600 }}>Tip</span> — Standard tier covers most production agents. Bump to Performance only if you regularly hit CPU saturation or need 25 Gbps egress.</>
          }
        </span>
      </div>

      {/* Cancel + Register */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 500, lineHeight: "20px",
            background: "transparent", color: C.fg,
            border: `1px solid ${C.border}`,
            padding: "8px 18px", borderRadius: 8, cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={onRegister}
          disabled={!canRegister}
          style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 600, lineHeight: "20px",
            background: canRegister ? C.lime : "#3a3a1f",
            color: canRegister ? C.limeText : "#666",
            border: "none",
            padding: "8px 18px", borderRadius: 8,
            cursor: canRegister ? "pointer" : "not-allowed",
          }}
        >
          {ctaLabel}
        </button>
      </div>
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

      {/* Compressed pre-build notice — single line + mono chips for the two
          required env var names + inline setup-guide link. Used to be a 4-line
          callout with a 2-row table; same information, ~75% less vertical space. */}
      {showEnvWarning && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${C.borderSoft}`,
            borderRadius: 8,
            padding: "6px 10px",
            fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "18px",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.warn, flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>Image must read</span>
          <code style={{ fontFamily: MONO, fontSize: 11, color: C.fg, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, padding: "1px 6px", borderRadius: 4 }}>
            GMI_MAAS_API_KEY
          </code>
          <span style={{ color: C.muted }}>+</span>
          <code style={{ fontFamily: MONO, fontSize: 11, color: C.fg, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, padding: "1px 6px", borderRadius: 4 }}>
            GMI_MAAS_BASE_URL
          </code>
          <span>— required for Models calls.</span>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{ color: C.lime, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, marginLeft: "auto" }}
          >
            View setup guide
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
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
  // Collapse step when *infrastructure* defaults hold. Docker image is allowed
  // to be blank — it's surfaced as the first chip in the strip with a clear
  // "Set image →" prompt so the user can edit inline without expanding everything.
  const allDefault =
    dockerSource  === "registry" &&
    enableCreds   === false &&
    region        === "us-ia-iowa-1" &&
    computeTier   === "container" &&
    maxLifetime   === "1h" &&
    idleTimeout   === "5min" &&
    addModels     === true &&
    selectedModel === "deepseek-v4-flash";
  const [userExpanded, setUserExpanded] = useState(false);
  const collapsed = !userExpanded && (allDefault || forkedFromTemplate);

  if (collapsed) {
    const tier = COMPUTE_TIERS.find((t) => t.id === computeTier);
    const reg = REGIONS.find((r) => r.id === region);
    const model = MODELS.find((m) => m.id === selectedModel);
    return (
      <CollapsedRow onCustomize={() => setUserExpanded(true)}>
        {forkedFromTemplate ? (
          <SpecChip label="Template" value="Pre-filled" />
        ) : (
          <>
            <SpecChip label="Docker Image" value={dockerImage.trim() || "Not set"} mono={!!dockerImage.trim()} />
            <SpecChip label="Registry Credentials" value={enableCreds ? "Configured" : "Public image"} />
            <SpecChip label="Compute Tier" value={tier ? `${tier.name} · ${tier.cpu} · ${tier.ram} · ${tier.storage}` : "—"} />
            <SpecChip label="Data Center Region" value={reg ? `${reg.name} · ${reg.sub}` : "—"} />
            <SpecChip label="MaaS" value={addModels ? (model ? model.name : "Not selected") : "Off"} />
          </>
        )}
      </CollapsedRow>
    );
  }

  const resetToDefaults = () => {
    setDockerSource("registry");
    setDockerImage("");
    setEnableCreds(false);
    setRegion("us-ia-iowa-1");
    setComputeTier("container");
    setMaxLifetime("1h");
    setIdleTimeout("5min");
    setAddModels(true);
    setSelectedModel("deepseek-v4-flash");
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
              background: "transparent", color: C.muted,
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
        {/* Docker Image Source — registry URL text box; helper folded into an info tooltip */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FieldLabel required>Docker Image Source</FieldLabel>
            <InfoHint text="Pull from any registry — Docker Hub, GHCR, ECR. Upload-image flow coming later." />
          </div>
          <TextInput value={dockerImage} onChange={setDockerImage} placeholder="Registry URL" mono />
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

        {/* Data Center — searchable combobox */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FieldLabel required>Data Center</FieldLabel>
          <RegionSelect value={region} onChange={setRegion} options={REGIONS} />
        </div>

        {/* Compute Tier */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FieldLabel required>Compute size</FieldLabel>
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
            {/* Coding Agent Plan — adoption callout: featured model pinned, discounted */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "rgba(221,234,77,0.05)", border: "1px solid rgba(221,234,77,0.30)", borderRadius: 8, padding: "8px 12px" }}>
              <PlanBadge text={CODING_AGENT_PLAN.name} />
              <span style={{ fontFamily: FONT, fontSize: 12, color: C.fg }}>
                {CODING_AGENT_PLAN.discountPct}% off coding models — <span style={{ color: C.lime, fontWeight: 600 }}>{CODING_AGENT_PLAN.featuredModelName}</span> recommended for this agent.
              </span>
            </div>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.fg, lineHeight: "20px" }}>{m.name}</div>
                      {m.id === CODING_AGENT_PLAN.featuredModelId && (
                        <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: C.limeText, background: C.lime, padding: "1px 6px", borderRadius: 4 }}>FEATURED</span>
                      )}
                      {isPlanEligibleModel(m.id) && <PlanBadge />}
                    </div>
                    <div
                      style={{
                        display: "inline-flex", alignSelf: "flex-start",
                        fontSize: 11, fontWeight: 600, color: C.fg,
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${C.border}`,
                        padding: "1px 7px", borderRadius: 999,
                      }}
                    >
                      {m.ctx}
                    </div>
                    {(() => {
                      const d = isPlanEligibleModel(m.id) ? discountPriceString(m.inPrice) : null;
                      return d ? (
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: C.muted }}>Input</span>
                          <DiscountedPrice original={d.original} discounted={d.discounted} size={12} />
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "18px", marginTop: 2 }}>
                          Input {m.inPrice}
                        </div>
                      );
                    })()}
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
  forkedFromTemplate = false,
}: {
  ports: PortMap[];
  setPorts: (v: PortMap[]) => void;
  forkedFromTemplate?: boolean;
}) {
  const updatePort = (id: string, patch: Partial<PortMap>) => {
    setPorts(ports.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const removePort = (id: string) => setPorts(ports.filter((p) => p.id !== id));
  const addPort = () => setPorts([...ports, { id: `p${Date.now()}`, protocol: "HTTPS/2", listening: "", internal: "", name: "" }]);

  const allDefault =
    ports.length === 1 &&
    ports[0].protocol === "HTTPS/2" &&
    ports[0].internal === "8080" &&
    ports[0].name === "web" &&
    !ports[0].listening;
  const [userExpanded, setUserExpanded] = useState(false);
  const collapsed = !userExpanded && (allDefault || forkedFromTemplate);
  const resetToDefaults = () => {
    setPorts([{ id: "p1", protocol: "HTTPS/2", listening: "", internal: "8080", name: "web" }]);
    setUserExpanded(false);
  };

  if (collapsed) {
    const portsVal = ports.length
      ? ports.map((p) => `${p.protocol} ${p.internal || "?"} (${p.name || "port"})`).join(", ")
      : "None";
    return (
      <CollapsedRow onCustomize={() => setUserExpanded(true)}>
        {forkedFromTemplate
          ? <SpecChip label="Template" value="Pre-filled" />
          : <SpecChip label="Port Mappings" value={portsVal} />}
      </CollapsedRow>
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
          color: C.muted,
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
  // Original manual add — single blank row the user types into directly.
  const add = () => setCustomEnvs([...customEnvs, { id: `env${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, key: "", value: "", secret: false, role: "config" }]);

  // Bulk paste — toggled by a separate secondary button. Coexists with the
  // manual "+ Add variable" flow so users keep both options.
  const [pasteOpen, setPasteOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const parseEnvText = (text: string): CustomEnv[] => {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const parsed: CustomEnv[] = [];
    for (const line of lines) {
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (/^GMI_MAAS_/i.test(key)) continue;
      // Heuristic: keys whose final segment is KEY / TOKEN / SECRET / PASSWORD / PWD
      // default to secret. Suffix-based — avoids false positives like MAX_TOKENS.
      const looksSecret = /_(KEY|TOKEN|SECRET|PASSWORD|PWD)$/i.test(key) || /^(KEY|TOKEN|SECRET|PASSWORD|PWD)$/i.test(key);
      parsed.push({
        id: `env${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${parsed.length}`,
        key, value, secret: looksSecret,
        role: looksSecret ? "secret_user_supplied" : "config",
      });
    }
    return parsed;
  };
  const applyAdd = () => {
    const parsed = parseEnvText(addText);
    if (parsed.length) setCustomEnvs([...customEnvs, ...parsed]);
    setAddText("");
    setPasteOpen(false);
  };
  // Honor the "paste .env into a Key field" tip — if the pasted text looks like
  // KEY=value content, parse it into rows instead of dumping raw text.
  const onKeyPaste = (rowId: string) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("=")) return;
    const parsed = parseEnvText(text);
    if (!parsed.length) return;
    e.preventDefault();
    const row = customEnvs.find((r) => r.id === rowId);
    const base = row && !row.key && !row.value ? customEnvs.filter((r) => r.id !== rowId) : customEnvs;
    setCustomEnvs([...base, ...parsed]);
  };

  const allDefault = customEnvs.length === 0;
  const [userExpanded, setUserExpanded] = useState(false);
  const collapsed = !userExpanded && (allDefault || forkedFromTemplate);
  const resetToDefaults = () => { setCustomEnvs([]); setUserExpanded(false); };

  if (collapsed) {
    return (
      <CollapsedRow onCustomize={() => setUserExpanded(true)}>
        {forkedFromTemplate
          ? <SpecChip label="Template" value="Pre-filled" />
          : <SpecChip label="Custom Env Vars" value={customEnvs.length ? `${customEnvs.length} set` : "Not set"} />}
      </CollapsedRow>
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
          color: C.muted,
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
      {/* Subtitle — auto-inject note */}
      <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "16px", marginTop: -4 }}>
        Runtime configuration. <code style={{ fontFamily: MONO, fontSize: 11, color: C.fg }}>GMI_MAAS_API_KEY</code> is auto-injected by CE at runtime; builders must not override.
      </div>

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
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setPasteOpen((o) => !o)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: pasteOpen ? "rgba(255,255,255,0.04)" : "transparent",
                color: C.fg,
                border: `1px solid ${C.border}`,
                padding: "6px 12px", borderRadius: 8,
                fontFamily: FONT, fontSize: 13, fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/>
              </svg>
              {pasteOpen ? "Cancel" : "Add from .env"}
            </button>
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
        </div>

        {/* Bulk paste panel — toggled by Paste .env; independent of the manual + Add variable */}
        {pasteOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "10px 12px" }}>
            <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Type or paste KEY=value · one per line
            </span>
            <textarea
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder={"OPENAI_API_KEY=sk-...\nMODEL_NAME=gpt-4o\nMAX_TOKENS=4096"}
              rows={5}
              autoFocus
              style={{
                background: "#000",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "8px 10px",
                fontFamily: MONO, fontSize: 12, lineHeight: "18px",
                color: C.fg, outline: "none", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                Keys ending in <code style={{ fontFamily: MONO, color: C.fg }}>_KEY / _TOKEN / _SECRET / _PASSWORD</code> default to Secret. GMI_MAAS_* keys are skipped.
              </span>
              <button onClick={applyAdd} disabled={!addText.trim()} style={{
                fontFamily: FONT, fontSize: 13, fontWeight: 600,
                background: addText.trim() ? C.lime : "#3a3a1f",
                color: addText.trim() ? C.limeText : "#666",
                border: "none",
                padding: "6px 16px", borderRadius: 6,
                cursor: addText.trim() ? "pointer" : "not-allowed",
              }}>Add</button>
            </div>
          </div>
        )}

        {/* Table — header + rows */}
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          {/* Header row — lime-tinted */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1.4fr 90px 44px", gap: 8,
            padding: "8px 12px", background: C.selectedYel,
            borderBottom: `1px solid ${C.borderSoft}`,
            fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, lineHeight: "16px",
          }}>
            <div>Key</div><div>Value</div><div>Type</div><div style={{ textAlign: "right" }}>Action</div>
          </div>
          {customEnvs.length === 0 ? (
            <div style={{ padding: "14px 12px", fontFamily: FONT, fontSize: 13, color: C.muted }}>
              No custom variables yet.
            </div>
          ) : (
            customEnvs.map((env, i) => (
              <div
                key={env.id}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 1.4fr 90px 44px", gap: 8,
                  padding: "8px 12px", alignItems: "center",
                  borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
                }}
              >
                <TextInput value={env.key}   onChange={(v) => update(env.id, { key: v })} onPaste={onKeyPaste(env.id)} placeholder="KEY_NAME" mono />
                <TextInput value={env.value} onChange={(v) => update(env.id, { value: v })} placeholder={env.secret ? "••••••••" : "value"} mono />
                <div>
                  <button
                    onClick={() => update(env.id, { secret: !env.secret, role: !env.secret ? "secret_user_supplied" : "config" })}
                    style={{
                      fontFamily: FONT, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
                      color: env.secret ? "#c7a7ff" : C.fg,
                      background: env.secret ? "rgba(199,167,255,0.12)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${env.secret ? "rgba(199,167,255,0.35)" : C.border}`,
                      padding: "2px 8px", borderRadius: 4, cursor: "pointer",
                    }}
                  >
                    {env.secret ? "SECRET" : "TEXT"}
                  </button>
                </div>
                <div style={{ textAlign: "right" }}>
                  <button
                    onClick={() => remove(env.id)}
                    title="Remove"
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: C.muted, padding: 4, display: "inline-flex" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tip */}
        <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "16px" }}>
          Tip: paste .env contents directly into a Key field to add multiple variables at once.
        </div>
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
        <span style={{ color: C.muted, marginTop: 1, display: "inline-flex" }}><IconLock size={12} /></span>
        <span>
          <span style={{ color: C.fg, fontWeight: 500 }}>Reminder</span> — Secrets are encrypted at rest with AES-256. Plaintext values are never written to logs or audit history.
        </span>
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
  const badge: React.CSSProperties = {
    fontFamily: MONO, fontSize: 10, fontWeight: 600, color: C.fg,
    background: "#0a0a0a", border: `1px solid ${C.border}`,
    padding: "2px 7px", borderRadius: 4, letterSpacing: "0.04em", whiteSpace: "nowrap",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Card */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "16px 20px",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, lineHeight: "22px" }}>
            GMI MaaS API Key
          </div>
          <p style={{ fontFamily: FONT, fontSize: 13, fontWeight: 400, lineHeight: "20px", color: C.muted, margin: 0 }}>
            Provide a MaaS API key. GMI uses it to validate your account, meter usage, and enable the Powered-by badge. If you leave this blank, the system will auto-issue one for your Agent.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            MaaS API Key
          </span>
          <TextInput value={maasKey} onChange={setMaasKey} placeholder="Enter your MaaS API key" />
          <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "18px", color: C.muted, margin: 0 }}>
            Find your key in <a href="/dashboard" style={{ color: C.link, textDecoration: "none" }}>My Agents → Analytics</a> on any existing agent
          </p>
        </div>
      </div>

      {/* Footer explainer */}
      <div
        style={{
          background: C.cardSolid,
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 8,
          padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 10,
          fontFamily: FONT, fontSize: 12, lineHeight: "18px", color: C.muted,
        }}
      >
        <div>
          <span style={{ color: C.fg, fontWeight: 600 }}>Powered by GMI MaaS</span> — Self-hosted Agents receive the{" "}
          <span style={badge}>POWERED BY GMI MODELS</span> badge instead of{" "}
          <span style={{ display: "inline-flex", verticalAlign: "text-bottom", color: "#3b82f6" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6" aria-hidden="true">
              <path d="M12 1l2.5 1.8 3-.4 1.2 2.8 2.8 1.2-.4 3L23 12l-1.8 2.5.4 3-2.8 1.2-1.2 2.8-3-.4L12 23l-2.5-1.8-3 .4-1.2-2.8L2.5 17.5l.4-3L1 12l1.9-2.5-.4-3 2.8-1.2L6.5 2.4l3 .4z"/>
              <path d="M10.6 14.6l-2.2-2.2-1.4 1.4 3.6 3.6 6-6-1.4-1.4z" fill="#fff"/>
            </svg>
          </span>{" "}
          You retain full responsibility for compute, scaling, and uptime.
        </div>
        <div>
          <span style={{ color: C.fg, fontWeight: 600 }}>Code requirement</span> — Your code must reference the env variable{" "}
          <span style={badge}>GMI_MAAS_API_KEY</span>. GMI will validate this key if you provide one, otherwise an auto-issued key is injected at deploy time.
        </div>
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
    { label: "Deployment Type", value: "Connect with GMI" },
    { label: "GMI Models key", value: maasKey ? `${maasKey.slice(0, 6)}…${maasKey.slice(-4)}` : "Auto-issued at deploy time" },
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
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 10,
          padding: "16px 20px",
          fontFamily: FONT, fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: "18px",
          display: "flex", gap: 8, alignItems: "flex-start",
        }}
      >
        <span style={{ color: C.muted, marginTop: 2 }}><IconInfo size={13} /></span>
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
  projectName, accessUrl, maasKey, onViewAgents, onListOnAgentbox, hostMode = "connect",
}: {
  projectName: string;
  accessUrl: string;
  maasKey: string;
  onViewAgents: () => void;
  onListOnAgentbox: () => void;
  hostMode?: HostMode;
}) {
  const isGmi = hostMode === "gmi";
  const displayedKey = maasKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImRhMDc2ZTY3LWY1N2YtNDYyNS05ZDJiLTcwODRhMjY4Y2Y5MiIsInNjb3BlIjoiaW5mZXJlbmNlIn0.demo-auto-issued";
  const curl = [
    "# 1. Verify your GMI Models key",
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
          Your Agent {projectName ? `"${projectName}" ` : ""}is registered.
        </h1>
        <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 400, lineHeight: "20px", color: C.muted, margin: "8px 0 0", maxWidth: 880 }}>
          {isGmi
            ? "Your template is saved. Provision your first instance from My Agents to get an endpoint URL. Not yet listed on the Agentbox; only your account is linked until you publish."
            : "Auto-approved — your MaaS key is active (Inference-scoped) and your external endpoint is reachable. Not yet listed on the Agentbox; only your account is linked to this Agent until you publish."}
        </p>
      </div>

      {/* Runtime preparation in progress — Launch gate (PRD F-01) */}
      {isGmi && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.30)", borderRadius: 10, padding: "12px 16px", maxWidth: 880 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: C.warn, marginTop: 5, flexShrink: 0, animation: "pulse 1.2s ease-in-out infinite" }} />
          <span style={{ fontFamily: FONT, fontSize: 13, color: C.fg, lineHeight: "19px" }}>
            <span style={{ fontWeight: 600 }}>Runtime preparation is in progress.</span> Launch will be available when preparation completes — track its status on the Agent's page in My Agents.
          </span>
        </div>
      )}

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
          <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg }}>
            {isGmi ? "Host on GMI" : "Connect with GMI"}
          </span>
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

      {/* External Endpoint URL — Connect-flow only (GMI gets endpoint per-task) */}
      {!isGmi && (
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
            <CopyButton value={accessUrl || "https://your-agent.yourdomain.com"} label={false} />
          </div>
        </div>
      )}

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
          <CopyButton value={curl} label={false} />
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
          <CopyButton value={displayedKey} label={false} />
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
        <a href="#" style={{ color: C.lime, textDecoration: "none" }}>Models Hub →</a>{" "}
        · SDK examples and integration patterns in{" "}
        <a href="#" style={{ color: C.lime, textDecoration: "none" }}>Docs →</a>{" "}
        · Manage keys in{" "}
        <a href="#" style={{ color: C.lime, textDecoration: "none" }}>Console → API Keys →</a>
      </div>

      {!isGmi && (
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
      )}

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
// ─── Step 5: Review & Register ────────────────────────────────────────────
// Per PRD M6.4: anonymous image manifest probe at publish (this) + clone (ClawDetail).
// Same heuristic as ClawDetail's mockImagePullState — keeps prototype outcomes consistent.
type PublishProbeState = "ok" | "private" | "missing" | "empty";
function probePublishImage(image: string): PublishProbeState {
  const v = image.trim().toLowerCase();
  if (!v) return "empty";
  if (v.includes("private") || v.includes("internal") || v.includes("ghcr.io/yourorg")) return "private";
  if (v.includes("404") || v.includes("missing") || v.includes("does-not-exist")) return "missing";
  return "ok";
}

function StepReview({
  summary, dockerImage, computeRate, modelInfo,
}: {
  summary: {
    group: string;
    rows: { label: string; value: string; highlight?: boolean }[];
  }[];
  computeRate: number;
  modelInfo: ModelSpec | null;
  dockerImage: string;
}) {
  // Always expanded — Review & Register is one of the two default-visible steps.
  const rows = summary.flatMap((g) => g.rows);
  const dayRate = computeRate * 24;
  const inAmt = modelInfo ? modelInfo.inPrice.split("/")[0].trim() : "—";
  const outAmt = modelInfo?.outPrice ? modelInfo.outPrice.split("/")[0].trim() : null;
  const imgState = probePublishImage(dockerImage);

  const costCard: React.CSSProperties = {
    background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 10,
    padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8,
  };
  const costLabel: React.CSSProperties = {
    fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted,
    letterSpacing: "0.06em", textTransform: "uppercase",
  };
  const bigNum: React.CSSProperties = {
    fontFamily: FONT, fontSize: 22, fontWeight: 700, color: C.fg,
    textAlign: "right", letterSpacing: "-0.01em", lineHeight: "26px",
  };
  const unit: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: C.muted };
  const io: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: C.muted, marginLeft: 4 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Configuration Summary */}
      <div style={{ background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg }}>Configuration Summary</div>
        <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: 8, overflow: "hidden" }}>
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "grid", gridTemplateColumns: "200px 1fr", gap: 12,
                padding: "10px 14px", alignItems: "center",
                borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
              }}
            >
              <div style={{ fontFamily: FONT, fontSize: 13, color: C.muted }}>{row.label}</div>
              <div style={{ fontFamily: row.label === "Docker Image" ? MONO : FONT, fontSize: 13, fontWeight: 500, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted }}>Need to change something? Use Back to return to the previous step.</div>
      </div>

      {/* Cost Estimate */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg }}>Cost Estimate</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={costCard}>
            <div style={costLabel}>Compute cost</div>
            <div style={bigNum}>~${computeRate.toFixed(4)}<span style={unit}>/hr</span></div>
            <div style={{ ...bigNum, fontSize: 16, color: C.muted }}>~${dayRate.toFixed(2)}<span style={unit}>/day</span></div>
          </div>
          <div style={costCard}>
            <div style={costLabel}>Models tokens</div>
            {modelInfo ? (
              <>
                <div style={bigNum}>{inAmt}<span style={unit}>/ 1M</span><span style={io}>Input</span></div>
                {outAmt && <div style={bigNum}>{outAmt}<span style={unit}>/ 1M</span><span style={io}>Output</span></div>}
              </>
            ) : (
              <div style={{ ...bigNum, color: C.muted }}>—</div>
            )}
          </div>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted }}>Billing begins immediately upon clicking Register.</div>
      </div>

      {/* Notification — Registration ≠ Listing */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "18px" }}>
        <span style={{ color: C.muted, display: "inline-flex", marginTop: 1, flexShrink: 0 }}><IconInfo size={13} /></span>
        <span>
          <span style={{ color: C.fg, fontWeight: 600 }}>Registration ≠ Listing</span> — Registering the Agent provisions infrastructure with GMI but does not make it public on the Agentbox. List it explicitly from the Dashboard once you have tested it.
        </span>
      </div>

      {/* Publish-time image availability — only surface blocking states (private / 404) */}
      {imgState === "private" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.30)", borderRadius: 8, fontFamily: FONT, fontSize: 12, color: C.fg, lineHeight: "18px" }}>
          <span style={{ color: C.warn, display: "inline-flex", marginTop: 2 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
          <span><span style={{ color: C.fg, fontWeight: 600 }}>Image is private (401/403)</span> — listing will go live in <span style={{ color: C.fg }}>Try demo</span> mode (cloners can't pull your image). Make it public or attach registry credentials to enable Deploy-your-own.</span>
        </div>
      )}
      {imgState === "missing" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.30)", borderRadius: 8, fontFamily: FONT, fontSize: 12, color: C.fg, lineHeight: "18px" }}>
          <span style={{ color: C.err, display: "inline-flex", marginTop: 2 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
          </span>
          <span><span style={{ color: C.fg, fontWeight: 600 }}>Image not found (404)</span> — Register will be blocked until the image reference is fixed.</span>
        </div>
      )}
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

// ─── Edit-template right panel — Live Cost Estimate + Back / Save changes ──
function EditCostPanel({
  computeRate, onBack, onSave,
}: {
  computeRate: number;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 48 }}>
      <div style={{ background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg }}>Live Cost Estimate</div>
        <div style={{ fontFamily: FONT, fontSize: 28, fontWeight: 700, color: C.fg, letterSpacing: "-0.02em", lineHeight: "32px" }}>
          ${computeRate.toFixed(4)}<span style={{ fontSize: 15, fontWeight: 500, color: C.muted }}>/hr</span>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted }}>Container tier · per active instance</div>
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, marginTop: 4, paddingTop: 10, display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 12, color: C.muted }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: C.lime, display: "inline-block", flexShrink: 0 }} />
          MaaS: pay per token used
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
          onClick={onSave}
          style={{
            fontFamily: FONT, fontSize: 14, fontWeight: 600, lineHeight: "20px",
            background: C.lime, color: C.limeText,
            border: "none",
            padding: "8px 18px", borderRadius: 8, cursor: "pointer",
          }}
        >
          Save changes
        </button>
      </div>
    </aside>
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
  const [dockerImage, setDockerImage] = useState("");
  const [enableCreds, setEnableCreds] = useState(false);
  const [region, setRegion] = useState("us-ia-iowa-1");
  const [computeTier, setComputeTier] = useState("container");
  const [addModels, setAddModels] = useState(true);
  const [selectedModel, setSelectedModel] = useState("deepseek-v4-flash");

  // Step 2 — PRD F-09: lifecycle TTL (template default; per-task override via SDK)
  const [maxLifetime, setMaxLifetime] = useState("1h");
  const [idleTimeout, setIdleTimeout] = useState("5min");

  // Step 3
  const [ports, setPorts] = useState<PortMap[]>(DEFAULT_PORTS);

  // Step 4
  const [customEnvs, setCustomEnvs] = useState<CustomEnv[]>([]);

  // Connect-your-agent flow (hostMode = "connect") — its own 4-section set
  const [maasKey, setMaasKey] = useState("");
  const [accessUrl, setAccessUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // ?use=<id> — Use-this-agent fork. Wizard is pre-filled from a marketplace
  // template; user lands on a collapsed view and expands to customize.
  const [forkedFrom, setForkedFrom] = useState<string | null>(null);
  // ?edit=<id> — Edit-template mode (opened from My Agents). Shows a focused
  // review of the template config with a Save changes CTA (no re-registration).
  const [editMode] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("edit"),
  );
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
  // Pre-fill the edit view from the agent being edited (demo values).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("edit")) return;
    setHostMode("gmi");
    setProjectName(params.get("name") || "Openclaw test");
    setDockerSource("registry");
    setDockerImage("ghcr.io/mjs-gmi/openclaw-gmi:v5-mode-none");
    setRegion("us-ia-iowa-1");
    setComputeTier("container");
    setSelectedModel("claude-opus-48");
  }, []);

  const tierInfo = useMemo(() => COMPUTE_TIERS.find((t) => t.id === computeTier) || null, [computeTier]);
  const modelInfo = useMemo(() => MODELS.find((m) => m.id === selectedModel) || null, [selectedModel]);
  const regionInfo = useMemo(() => REGIONS.find((r) => r.id === region) || null, [region]);

  const computeRate = tierInfo?.pricePerHr ?? 0;

  const summary = useMemo(() => [
    {
      group: "Container",
      rows: [
        { label: "Project Name",         value: projectName || "—" },
        { label: "Docker Image",         value: dockerImage || "—" },
        { label: "Registry Credentials", value: enableCreds ? "Configured" : "Public image" },
        { label: "Compute Tier",         value: tierInfo ? `${tierInfo.name} - ${tierInfo.sub}` : "—" },
        { label: "Region",               value: regionInfo ? `${regionInfo.name} · ${regionInfo.sub}` : "—" },
      ],
    },
    {
      group: "Network",
      rows: [
        { label: "Port Mappings", value: ports.length > 0
            ? ports.map((p) => `${p.protocol} ${p.internal || "?"} (${p.name || "port"})`).join(", ")
            : "—" },
      ],
    },
    {
      group: "Model & MaaS",
      rows: [
        { label: "MaaS",            value: modelInfo ? modelInfo.name : "—" },
        { label: "Custom Env Vars", value: customEnvs.length > 0 ? `${customEnvs.length} configured` : "—" },
      ],
    },
  ], [projectName, dockerImage, enableCreds, tierInfo, regionInfo, maxLifetime, idleTimeout, ports, modelInfo, customEnvs]);

  // "Pre-configured" subtitle in the section header — flips off the moment user customizes.
  const step2AllDefault =
    dockerSource === "registry" &&
    !enableCreds &&
    region === "us-ia-iowa-1" &&
    computeTier === "container" &&
    maxLifetime === "1h" &&
    idleTimeout === "5min" &&
    addModels && selectedModel === "deepseek-v4-flash";

  const step3AllDefault =
    ports.length === 1 &&
    ports[0].protocol === "HTTPS/2" &&
    ports[0].internal === "8080" &&
    ports[0].name === "web" &&
    !ports[0].listening;

  const step4AllDefault = customEnvs.length === 0;

  // ── Edit-template view — focused review of the template config ────────────
  if (editMode) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
        <Topbar />
        <Navbar />
        <div style={{ marginLeft: 210, paddingTop: 40 }}>
          <header style={{ padding: "14px 24px 8px" }}>
            <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, lineHeight: "30px", color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>
              Edit template
            </h1>
            <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "16px", color: C.muted, margin: "2px 0 0" }}>
              Update your template configuration
            </p>
          </header>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 300px",
              gap: 16,
              padding: "8px 24px 24px",
              alignItems: "start",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <StepReview summary={summary} dockerImage={dockerImage} computeRate={computeRate} modelInfo={modelInfo} />
            </div>
            <EditCostPanel
              computeRate={computeRate}
              onBack={() => setLocation("/dashboard")}
              onSave={() => {
                setLocation("/dashboard");
              }}
            />
          </section>
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar />
      <Navbar />

      <div style={{ marginLeft: 210, paddingTop: 40 }}>

        {/* Page header — title + compact host-mode segmented toggle (top-right) */}
        <header style={{ padding: "14px 24px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, lineHeight: "30px", color: C.fg, margin: 0, letterSpacing: "-0.02em" }}>
              Register an Agent
            </h1>
            <p style={{ fontFamily: FONT, fontSize: 12, fontWeight: 400, lineHeight: "16px", color: C.muted, margin: "2px 0 0" }}>
              Configure infrastructure and register your Agent. List it on the Agentbox after testing.
            </p>
          </div>

          <div style={{ display: "inline-flex", flexShrink: 0, border: `1px solid ${C.border}`, borderRadius: 10, background: C.cardSolid, padding: 3, gap: 3 }}>
            <button
              onClick={() => setHostMode("gmi")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
                fontFamily: FONT, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                padding: "7px 12px", borderRadius: 7, border: "none",
                background: hostMode === "gmi" ? "rgba(99,105,35,0.30)" : "transparent",
                color: hostMode === "gmi" ? C.fg : C.muted,
              }}
            >
              <span style={{ color: hostMode === "gmi" ? C.lime : C.muted, display: "inline-flex" }}><IconGlobe size={14} /></span>
              Host on GMI
              <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", color: hostMode === "gmi" ? C.lime : C.muted, background: hostMode === "gmi" ? "rgba(221,234,77,0.10)" : "transparent", border: `1px solid ${hostMode === "gmi" ? "rgba(221,234,77,0.35)" : C.border}`, padding: "1px 5px", borderRadius: 4 }}>DEFAULT</span>
            </button>
            <button
              onClick={() => setHostMode("connect")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
                fontFamily: FONT, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                padding: "7px 12px", borderRadius: 7, border: "none",
                background: hostMode === "connect" ? "rgba(99,105,35,0.30)" : "transparent",
                color: hostMode === "connect" ? C.fg : C.muted,
              }}
            >
              <span style={{ color: hostMode === "connect" ? C.lime : C.muted, display: "inline-flex" }}><IconUpload size={14} /></span>
              Connect your agent
            </button>
          </div>
        </header>

        {/* Pre-filled banner — visible when wizard was forked from a catalog template */}
        {forkedFrom && (
          <div
            style={{
              margin: "8px 24px 0",
              padding: "10px 14px",
              background: "rgba(221,234,77,0.05)",
              border: "1px solid rgba(221,234,77,0.30)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ display: "inline-flex", color: C.lime, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857C20 21.09 19.105 22 18 22h-8c-1.105 0-2-.911-2-2.036V9.107c0-1.124.895-2.036 2-2.036z"/>
              </svg>
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg, lineHeight: "18px" }}>
                Pre-filled from <span style={{ color: C.lime }}>{forkedFrom}</span>
              </div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "16px", marginTop: 1 }}>
                Image, env declarations, ports and defaults come from the template. Expand any section below to customize.
              </div>
            </div>
          </div>
        )}

        {/* Wizard area — branches on hostMode (GMI / Connect) and submitted (Success view) */}
        {submitted ? (
          <SuccessView
            projectName={projectName}
            accessUrl={hostMode === "connect" ? accessUrl : ""}
            maasKey={maasKey}
            hostMode={hostMode}
            onViewAgents={() => setLocation("/dashboard")}
            onListOnAgentbox={() => {
              // M3: navigate to the List-an-Agent form (instead of flipping
              // state directly). The form is where the user fills marketplace
              // identity, description & media, then submits for review.
              setLocation("/list-claw?from=deploy");
            }}
          />
        ) : (
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 300px",
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
                          <>
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
                            {/* R1 decision: Register does NOT set runtime lifecycle — it's
                                configured per instance at Launch (org default prefilled). */}
                            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(255,255,255,0.02)", border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: "9px 12px" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.muted, flexShrink: 0, marginTop: 1 }}>
                                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                              </svg>
                              <span style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "18px" }}>
                                <span style={{ color: C.fg, fontWeight: 600 }}>Runtime lifecycle is configured per instance at Launch</span> — maximum active runtime, inactivity, and disk retention use your Organization default and can be customized when you launch an instance (not here).{" "}
                                <span style={{ color: C.muted }}>Register defines how the Agent runs; Launch defines how long each instance runs.</span>
                              </span>
                            </div>
                          </>
                        )}
                        {s.id === 3 && (
                          <StepNetworking
                            ports={ports} setPorts={setPorts}
                            forkedFromTemplate={!!forkedFrom}
                          />
                        )}
                        {s.id === 4 && <StepEnvVars customEnvs={customEnvs} setCustomEnvs={setCustomEnvs} forkedFromTemplate={!!forkedFrom} />}
                        {s.id === 5 && (
                          <StepReview
                            summary={summary}
                            computeRate={computeRate}
                            modelInfo={modelInfo}
                            dockerImage={dockerImage}
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
                // M6.4: block publish when the image is known-missing (404).
                // Private (401/403) and public both allowed — review gate handles them.
                hostMode === "gmi"
                  ? projectName.trim().length > 1 && probePublishImage(dockerImage) !== "missing" && dockerImage.trim().length > 0
                  : projectName.trim().length > 1 && /^https:\/\//i.test(accessUrl.trim())
              }
              ctaLabel={hostMode === "connect" ? "Submit" : "Register"}
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
                    listingState: "draft",
                  });
                  setSubmitted(true);
                } else {
                  // Host on GMI: persist + show success view with 2 distinct CTAs
                  // per PRD F-02 ("Register success → two distinct CTAs").
                  const effectiveKey = maasKey || genMaasKey();
                  if (!maasKey) setMaasKey(effectiveKey);
                  persistRegisteredAgent({
                    id: `ag_${Date.now().toString(36)}`,
                    name: projectName.trim() || "hosted-agent",
                    templateId: `tpl_${Date.now().toString(36)}`,
                    hostMode: "gmi",
                    maasKey: effectiveKey,
                    accessUrl: "",
                    category: "Code & Dev Tools",
                    registeredAt: new Date().toISOString(),
                    listingState: "draft",
                  });
                  setSubmitted(true);
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
