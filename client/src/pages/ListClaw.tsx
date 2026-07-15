import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import { TYPE_LABELS, type TypeLabel } from "@/lib/clawData";
import { FONT, MONO, C, TYPE_COLOR } from "@/lib/tokens";
import { SEED_AGENTS } from "@/lib/seedAgents";
import { PlanBadge } from "@/components/PlanUI";
import { isPlanEligibleAgent, CODING_AGENT_PLAN } from "@/lib/modelsPlan";

// ─── Storage keys (shared with DeployWizard / Dashboard) ────────────────────
const REGISTERED_AGENTS_KEY = "gmi:registered-agents";
const LISTINGS_KEY          = "gmi:listings";

// Stand-in for a real session — in production this comes from the auth/account
// service. We auto-fill the Publisher field from this so the user doesn't have
// to re-type their own org each time.
function getCurrentUser() {
  return { name: "Mingjun Sun", email: "mingjun.s@gmicloud.ai" };
}

type ListingState = "draft" | "pending_review" | "live" | "rejected";
type HostMode     = "gmi" | "connect";

interface RegisteredAgent {
  id: string;
  name: string;
  templateId: string;
  hostMode: HostMode;
  maasKey: string;
  accessUrl: string;
  category: string;
  registeredAt: string;
  listingState?: ListingState;
  // optional extras from DeployWizard
  dockerImage?: string;
  region?: string;
}

interface ListingDraft {
  agentId: string;
  name: string;
  publisher: string;
  category: TypeLabel | "";
  tags: string[];
  shortDesc: string;
  logoDataUrl: string;
  fullDesc: string;
  sampleOutputDataUrl: string;
  // publicUrl: where marketplace browsers go to USE the agent (landing page,
  // hosted demo, docs). Required for "connect" mode (no cloneable image, so
  // this is the only way for users to access it). Optional for "gmi" mode
  // (users can clone the image themselves via "Deploy your own").
  publicUrl: string;
  demoVideoUrl: string;
  docsUrl: string;
  updatedAt: string;
}

const SHORT_DESC_MAX = 120;
const TAG_MAX        = 5;

// ─── localStorage helpers ───────────────────────────────────────────────────
function loadAgent(): RegisteredAgent | null {
  // Honor ?agentId=xxx to target a specific listing. Fall back to the latest
  // registered agent (so the post-register success → "List on Agentbox" flow
  // continues to Just Work without an explicit id).
  try {
    const params = new URLSearchParams(window.location.search);
    const wantedId = params.get("agentId");
    const stored: RegisteredAgent[] = JSON.parse(localStorage.getItem(REGISTERED_AGENTS_KEY) || "[]");
    // Merge localStorage agents (registered this session) with the shared demo
    // seed so the register-first guard matches what Dashboard's My Agents shows.
    const all: RegisteredAgent[] = [...(Array.isArray(stored) ? stored : []), ...SEED_AGENTS];
    if (all.length === 0) return null;
    if (wantedId) {
      const match = all.find((a) => a.id === wantedId);
      if (match) return match;
    }
    return all[0];
  } catch { return null; }
}

function loadListing(agentId: string): ListingDraft | null {
  try {
    const obj = JSON.parse(localStorage.getItem(LISTINGS_KEY) || "{}");
    return obj[agentId] || null;
  } catch { return null; }
}

function saveListing(listing: ListingDraft) {
  try {
    const obj = JSON.parse(localStorage.getItem(LISTINGS_KEY) || "{}");
    obj[listing.agentId] = listing;
    localStorage.setItem(LISTINGS_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

function flipAgentListingState(agentId: string, next: ListingState) {
  try {
    const arr: RegisteredAgent[] = JSON.parse(localStorage.getItem(REGISTERED_AGENTS_KEY) || "[]");
    const idx = arr.findIndex((a) => a.id === agentId);
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], listingState: next };
      localStorage.setItem(REGISTERED_AGENTS_KEY, JSON.stringify(arr));
    }
  } catch { /* ignore */ }
}


// ─── Icons ──────────────────────────────────────────────────────────────────
const Icon = {
  back: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  ),
  check: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  lock: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  ext: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
  x: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  ),
  upload: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
};

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ListClaw() {
  const [, setLocation] = useLocation();

  // Latest registered agent — pulled from localStorage on mount.
  const [agent] = useState<RegisteredAgent | null>(loadAgent);

  // Resolve initial listing values: existing draft → else prefill from agent.
  // (Hooks must run unconditionally — guard is rendered below the hook block.)
  const initial: ListingDraft = useMemo(() => {
    if (!agent) {
      return {
        agentId: "", name: "", publisher: "", category: "",
        tags: [], shortDesc: "", logoDataUrl: "", fullDesc: "",
        sampleOutputDataUrl: "", publicUrl: "", demoVideoUrl: "", docsUrl: "",
        updatedAt: "",
      };
    }
    const existing = loadListing(agent.id);
    if (existing) return { ...existing, publicUrl: existing.publicUrl ?? "", docsUrl: existing.docsUrl ?? "" };
    return {
      agentId:             agent.id,
      name:                agent.name || "",
      publisher:           getCurrentUser().name, // auto-fill from account
      category:            (agent.category as TypeLabel) || "",
      tags:                [],
      shortDesc:           "",
      logoDataUrl:         "",
      fullDesc:            "",
      sampleOutputDataUrl: "",
      publicUrl:           "",
      demoVideoUrl:        "",
      docsUrl:             "",
      updatedAt:           "",
    };
  }, [agent]);

  const [draft, setDraft] = useState<ListingDraft>(initial);
  const update = <K extends keyof ListingDraft>(k: K, v: ListingDraft[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  // Autosave — write to localStorage whenever draft changes. Replaces the
  // explicit "Save draft" button so we can match production's single-CTA
  // layout (only "Continue to Review →"). Skipped when draft.agentId is empty
  // (no agent yet → NoAgentGuard handles it).
  useEffect(() => {
    if (!draft.agentId) return;
    saveListing(draft);
  }, [draft]);

  // All registered agents — for the "Linked Template" picker. localStorage
  // agents first, then the shared demo seed (same source as Dashboard).
  const allAgents = useMemo<RegisteredAgent[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(REGISTERED_AGENTS_KEY) || "[]");
      return [...(Array.isArray(stored) ? stored : []), ...SEED_AGENTS];
    } catch { return [...SEED_AGENTS]; }
  }, []);

  // Empty state — no registered agent → show register-first guard.
  if (!agent) {
    return <NoAgentGuard onRegister={() => setLocation("/deploy")} onDashboard={() => setLocation("/dashboard")} />;
  }


  // Agent Access URL — required ONLY for "Connect with GMI" listings (the
  // publisher hosts the agent themselves, so they MUST provide a public URL
  // for the "Try demo" CTA per M6 PRD §M6.2 / §M6.3). "Host on GMI" listings
  // are cloneable via the "Deploy your own" CTA, so no Access URL is needed
  // — we show no field at all.
  const showPublicUrl = agent?.hostMode === "connect";

  // Validation — minimum bar to submit for review.
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!draft.name.trim())               e.name      = "Agent name is required";
    if (!draft.publisher.trim())          e.publisher = "Publisher name is required";
    if (!draft.category)                  e.category  = "Pick a category";
    if (!draft.shortDesc.trim())          e.shortDesc = "Add a short description for the card";
    if (draft.shortDesc.length > SHORT_DESC_MAX) e.shortDesc = `Max ${SHORT_DESC_MAX} characters`;
    // Full description is now optional — if blank, the detail page falls back
    // to the short description plus auto-generated source info. Power users
    // can expand "Add more details" and provide markdown.
    if (showPublicUrl) {
      if (!draft.publicUrl.trim()) e.publicUrl = "Required — users need a landing page to access your agent";
      else if (!/^https?:\/\//i.test(draft.publicUrl.trim())) e.publicUrl = "Must start with https://";
    }
    return e;
  }, [draft, showPublicUrl]);

  const canSubmit = Object.keys(errors).length === 0;

  const submitForReview = () => {
    if (!canSubmit) return;
    const finalDraft = { ...draft, updatedAt: new Date(2025, 0, 1).toISOString() };
    saveListing(finalDraft);
    flipAgentListingState(agent.id, "pending_review");
    setLocation("/dashboard?listed=1");
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar />
      <Navbar />

      <div style={{ marginLeft: 210, paddingTop: 40, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <header style={{ padding: "24px 24px 20px" }}>
          <button
            onClick={() => setLocation("/dashboard")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontFamily: FONT, fontSize: 12, padding: 0, marginBottom: 12 }}
          >
            <Icon.back /> My Agents
          </button>
          <h1 style={{ fontFamily: FONT, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, lineHeight: "34px" }}>List an Agent</h1>
          <p style={{ fontFamily: FONT, fontSize: 14, color: C.muted, margin: "6px 0 0", lineHeight: "20px" }}>List an Agent on the Agentbox</p>
        </header>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, padding: "0 24px 96px" }}>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 24, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>

              <SectionCard title="Link a Template" subtitle={`Each listing links to exactly one published ${agent.hostMode === "connect" ? "self-hosted" : "CE"} template`} required>
                <Field label="Linked Template" required>
                  <Select
                    value={agent.id}
                    onChange={(id) => setLocation(`/list-claw?agentId=${encodeURIComponent(id)}`)}
                    options={allAgents.map((a) => a.id)}
                    renderOption={(id) => { const a = allAgents.find((x) => x.id === id); return a ? a.name : id; }}
                    placeholder="Select a template"
                  />
                </Field>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 12, color: C.muted }}>
                  Detected badge:
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 12, fontWeight: 600, color: C.fg }}>
                    <span style={{ color: "#3b82f6", display: "inline-flex" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.5 1.8 3-.4 1.2 2.8 2.8 1.2-.4 3L23 12l-1.8 2.5.4 3-2.8 1.2-1.2 2.8-3-.4L12 23l-2.5-1.8-3 .4-1.2-2.8L2.5 17.5l.4-3L1 12l1.9-2.5-.4-3 2.8-1.2L6.5 2.4l3 .4z"/><path d="M10.6 14.6l-2.2-2.2-1.4 1.4 3.6 3.6 6-6-1.4-1.4z" fill="#fff"/></svg>
                    </span>
                    {agent.hostMode === "connect" ? "MaaS — external endpoint detected" : "CE + MaaS — full GMI stack detected"}
                  </span>
                </div>

                {/* Consent callout — CE-hosted (Deploy-your-own) explains what gets copied */}
                {agent.hostMode !== "connect" && (
                  <div style={{ background: "rgba(221,234,77,0.06)", border: `1px solid rgba(221,234,77,0.35)`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>Deploy-your-own listing</div>
                    <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "18px" }}>
                      Users click <span style={{ color: C.fg, fontWeight: 600 }}>Deploy your own</span> and GMI copies your image + config into their account. They run it, pay for compute, and bring their own GMI Models key.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14, rowGap: 6, fontFamily: FONT, fontSize: 12, lineHeight: "18px", marginTop: 2 }}>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", alignSelf: "center" }}>Copied</span>
                      <span style={{ color: C.fg }}>image <span style={{ color: C.muted }}>·</span> env names + defaults <span style={{ color: C.muted }}>·</span> ports + infra config</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", alignSelf: "center" }}>Not copied</span>
                      <span style={{ color: C.fg }}>your secrets <span style={{ color: C.muted }}>·</span> GMI Models key</span>
                    </div>
                  </div>
                )}
              </SectionCard>

              {/* Agent Access URL — only for Self-hosted (Connect) listings; the
                  Try demo CTA needs a public URL. CE-hosted is cloneable instead. */}
              {showPublicUrl && (
                <SectionCard title="Agent Access URL" subtitle="This link directs to your agent. Use your agent landing page or documentation URL" required>
                  <Field label="Access URL" required error={errors.publicUrl} hint="Must be publicly reachable over HTTPS. GMI checks the page loads (HTTP 200) before listing">
                    <TextInput value={draft.publicUrl || agent.accessUrl || ""} onChange={(v) => update("publicUrl", v)} placeholder="https://your-agent.yourdomain.com" />
                  </Field>
                </SectionCard>
              )}

              <SectionCard title="Listing Identity">
                <Row>
                  <Field label="Agent Name" required error={errors.name}>
                    <TextInput value={draft.name} onChange={(v) => update("name", v)} placeholder="e.g. Contract Review Agent" />
                  </Field>
                  <Field label="Publisher Name" required error={errors.publisher}>
                    <TextInput value={draft.publisher} onChange={(v) => update("publisher", v)} placeholder="e.g. Acme Labs" />
                  </Field>
                </Row>
                <Row>
                  <Field label="Category" required error={errors.category}>
                    <Select value={draft.category} onChange={(v) => update("category", v as TypeLabel | "")} options={TYPE_LABELS} placeholder="Pick a category" />
                  </Field>
                  <Field label="Tags (max 5)">
                    <TagInput tags={draft.tags} onChange={(t) => update("tags", t)} max={TAG_MAX} />
                  </Field>
                </Row>
                {/* Coding Agent Plan — category-driven recommendation (second nudge) */}
                {isPlanEligibleAgent(draft.category) && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(221,234,77,0.05)", border: "1px solid rgba(221,234,77,0.30)", borderRadius: 8, padding: "10px 12px" }}>
                    <PlanBadge text={CODING_AGENT_PLAN.name} />
                    <span style={{ fontFamily: FONT, fontSize: 12, color: C.fg, lineHeight: "18px" }}>
                      Coding agents qualify for the {CODING_AGENT_PLAN.name}. Pairing with{" "}
                      <span style={{ color: C.lime, fontWeight: 600 }}>{CODING_AGENT_PLAN.featuredModelName}</span>{" "}
                      lets adopters run it at {CODING_AGENT_PLAN.discountPct}% off token pricing — a strong listing signal.
                    </span>
                  </div>
                )}
                <Row>
                  <Field label="Logo (optional)" hint="Square PNG/JPG, at least 256px. Auto-generated from name + category if blank.">
                    <LogoUploader value={draft.logoDataUrl} onChange={(v) => update("logoDataUrl", v)} fallbackName={draft.name || agent.name} fallbackColor={draft.category ? TYPE_COLOR[draft.category as TypeLabel] : C.lime} />
                  </Field>
                  <Field label="Short Description (shown on card)" required error={errors.shortDesc} hint={`${draft.shortDesc.length} / ${SHORT_DESC_MAX} characters`} hintAlign="right">
                    <TextArea value={draft.shortDesc} onChange={(v) => update("shortDesc", v.slice(0, SHORT_DESC_MAX))} placeholder="Real-time document translation across 40+ languages, hosted on Acme infrastructure." rows={3} />
                  </Field>
                </Row>
              </SectionCard>

              <SectionCard title="Description & Media">
                <Field label="Full Description (Markdown)" required hint="Markdown supported. Use ## What it does and ## How it works.">
                  <TextArea value={draft.fullDesc} onChange={(v) => update("fullDesc", v)} placeholder={"## What it does\nContract Review Agent ingests PDF or DOCX contracts and produces a clause-by-clause risk report.\n\n## How it works\nCombines deterministic clause extraction with semantic risk classification."} rows={6} monospace />
                </Field>
                <Field label="Sample Output (optional)" hint="Up to 5 images, PNG or JPG.">
                  <SampleUploader value={draft.sampleOutputDataUrl} onChange={(v) => update("sampleOutputDataUrl", v)} />
                </Field>
                <Row>
                  <Field label="Demo Video URL">
                    <TextInput value={draft.demoVideoUrl} onChange={(v) => update("demoVideoUrl", v)} placeholder="https://" />
                  </Field>
                  <Field label="Documentation Link">
                    <TextInput value={draft.docsUrl} onChange={(v) => update("docsUrl", v)} placeholder="https://docs.acme.com/..." />
                  </Field>
                </Row>
              </SectionCard>
            </div>

            {/* Aside — live preview + submit */}
            <aside style={{ position: "sticky", top: 88 }}>
              <div style={{ background: C.cardSolid, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.fg, letterSpacing: "-0.01em" }}>Live Card Preview</div>
                <LivePreviewCard draft={draft} fallbackName={agent.name} />
                <button
                  onClick={submitForReview}
                  disabled={!canSubmit}
                  style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, background: canSubmit ? C.lime : "rgba(221,234,77,0.25)", color: canSubmit ? C.limeText : "rgba(10,10,10,0.5)", border: "none", padding: "12px 18px", borderRadius: 10, cursor: canSubmit ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%" }}
                >
                  Continue to Review <Icon.ext />
                </button>
                <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "17px", margin: 0 }}>
                  Listing review runs on submit · Auto-approved if it passes. Unpublish any time — provisioned containers unaffected.
                </p>
              </div>
            </aside>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}

// ─── Section card — bordered rounded card with a title + optional REQUIRED
//     badge, matching the List-an-Agent form layout. ───────────────────────
function SectionCard({ title, subtitle, required, children }: { title: string; subtitle?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: C.cardSolid, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, margin: 0, color: C.fg, letterSpacing: "-0.01em" }}>{title}</h2>
          {subtitle && <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: "5px 0 0", lineHeight: "18px" }}>{subtitle}</p>}
        </div>
        {required && (
          <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap", flexShrink: 0 }}>Required</span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

// Sample Output uploader — a wide dashed drop target that reads one image to a
// data URL (prototype stand-in for real upload).
function SampleUploader({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  return (
    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 96, border: `1px dashed ${C.border}`, borderRadius: 8, background: C.bg, cursor: "pointer", padding: 12 }}>
      <input type="file" accept="image/png,image/jpeg" onChange={onFile} style={{ display: "none" }} />
      {value ? (
        <img src={value} alt="sample output" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 6 }} />
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 13, color: C.muted }}>
          <Icon.upload /> Upload image (PNG, JPG)
        </span>
      )}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
}

// ─── Field wrapper ──────────────────────────────────────────────────────────
function Field({
  label, required, error, hint, hintAlign, children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  hintAlign?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.fg }}>{label}</span>
        {required && <span style={{ color: C.err, fontSize: 11, lineHeight: 1 }}>*</span>}
      </div>
      {children}
      {(hint || error) && (
        <div
          style={{
            fontFamily: FONT, fontSize: 11,
            color: error ? C.err : C.muted,
            textAlign: hintAlign || "left",
          }}
        >
          {error || hint}
        </div>
      )}
    </div>
  );
}

// ─── Inputs ─────────────────────────────────────────────────────────────────
function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontFamily: FONT, fontSize: 13,
        background: C.bg, color: C.fg,
        border: `1px solid ${C.border}`,
        padding: "8px 10px", borderRadius: 6,
        outline: "none",
        width: "100%",
      }}
    />
  );
}

function TextArea({
  value, onChange, placeholder, rows, monospace,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; monospace?: boolean }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows || 3}
      style={{
        fontFamily: monospace ? MONO : FONT,
        fontSize: monospace ? 12 : 13,
        background: C.bg, color: C.fg,
        border: `1px solid ${C.border}`,
        padding: "8px 10px", borderRadius: 6,
        outline: "none",
        width: "100%",
        resize: "vertical",
        lineHeight: "20px",
      }}
    />
  );
}

function Select({
  value, onChange, options, placeholder, renderOption,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  renderOption?: (v: string) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontFamily: FONT, fontSize: 13,
        background: C.bg, color: value ? C.fg : C.muted,
        border: `1px solid ${C.border}`,
        padding: "8px 10px", borderRadius: 6,
        outline: "none",
        width: "100%",
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23a3a3a3' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        paddingRight: 28,
      }}
    >
      <option value="" disabled>{placeholder || "Choose"}</option>
      {options.map((o) => (
        <option key={o} value={o}>{renderOption ? renderOption(o) : o}</option>
      ))}
    </select>
  );
}

function TagInput({ tags, onChange, max }: { tags: string[]; onChange: (t: string[]) => void; max: number }) {
  const [pending, setPending] = useState("");
  const commit = () => {
    const v = pending.trim();
    if (!v) return;
    if (tags.includes(v) || tags.length >= max) { setPending(""); return; }
    onChange([...tags, v]);
    setPending("");
  };
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        background: C.bg, color: C.fg,
        border: `1px solid ${C.border}`,
        padding: "6px 8px", borderRadius: 6,
        minHeight: 36,
      }}
    >
      {tags.map((t) => (
        <span
          key={t}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: C.pillBg,
            color: C.fg,
            fontFamily: FONT, fontSize: 12,
            padding: "3px 4px 3px 8px", borderRadius: 4,
          }}
        >
          {t}
          <button
            onClick={() => onChange(tags.filter((x) => x !== t))}
            aria-label={`Remove ${t}`}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", color: C.muted, cursor: "pointer",
              padding: 2,
            }}
          >
            <Icon.x />
          </button>
        </span>
      ))}
      {tags.length < max && (
        <input
          type="text"
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
            else if (e.key === "Backspace" && !pending && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={commit}
          placeholder={tags.length === 0 ? "Translation, Multilingual…" : ""}
          style={{
            flex: 1, minWidth: 80,
            fontFamily: FONT, fontSize: 12,
            background: "transparent", color: C.fg, border: "none", outline: "none",
            padding: "2px 0",
          }}
        />
      )}
    </div>
  );
}

function LogoUploader({
  value, onChange, fallbackName, fallbackColor,
}: { value: string; onChange: (v: string) => void; fallbackName: string; fallbackColor: string }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pick = () => fileRef.current?.click();
  const onFile = (f?: File | null) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onChange(typeof r.result === "string" ? r.result : "");
    r.readAsDataURL(f);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 56, height: 56, borderRadius: 8,
          background: value ? "transparent" : `${fallbackColor}1a`,
          border: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          color: fallbackColor,
          fontFamily: FONT, fontSize: 18, fontWeight: 700,
        }}
      >
        {value
          ? <img src={value} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : (fallbackName?.[0]?.toUpperCase() || "A")
        }
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={pick}
          style={{
            fontFamily: FONT, fontSize: 12,
            background: "transparent", color: C.fg,
            border: `1px solid ${C.border}`,
            padding: "6px 10px", borderRadius: 6, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          <Icon.upload /> {value ? "Replace" : "Upload"}
        </button>
        {value && (
          <button
            onClick={() => onChange("")}
            style={{
              fontFamily: FONT, fontSize: 12, color: C.muted,
              background: "transparent", border: "none", padding: "6px 4px", cursor: "pointer",
            }}
          >
            Remove
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          style={{ display: "none" }}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

// ─── Live preview card (mock of marketplace card) ───────────────────────────
function LivePreviewCard({ draft, fallbackName }: { draft: ListingDraft; fallbackName: string }) {
  const name      = draft.name || fallbackName || "Your agent name";
  const publisher = draft.publisher || "Publisher name";
  const desc      = draft.shortDesc || "A one-line description of what your agent does.";
  const category  = draft.category || "Pick a category";
  const color     = draft.category ? TYPE_COLOR[draft.category as TypeLabel] : C.muted;
  const filledName    = !!draft.name;
  const filledDesc    = !!draft.shortDesc;
  const filledCat     = !!draft.category;

  return (
    <div
      style={{
        background: C.cardSolid,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 14,
        display: "flex", flexDirection: "column", gap: 10,
        minHeight: 152,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 6,
            background: draft.logoDataUrl ? "transparent" : `${color}1f`,
            border: `1px solid ${color}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: color,
            fontFamily: FONT, fontSize: 13, fontWeight: 700,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {draft.logoDataUrl
            ? <img src={draft.logoDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : (name[0]?.toUpperCase() || "A")
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT, fontSize: 14, fontWeight: 600, lineHeight: "20px",
              color: filledName ? C.fg : C.muted,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {publisher}
          </div>
        </div>
      </div>
      <p
        style={{
          fontFamily: FONT, fontSize: 12, lineHeight: "17px",
          color: filledDesc ? C.muted : "#525252",
          margin: 0,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          flex: 1,
        }}
      >
        {desc}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: FONT, fontSize: 11,
            color: filledCat ? color : C.muted,
            padding: "2px 8px", borderRadius: 4,
            background: filledCat ? `${color}14` : "rgba(255,255,255,0.04)",
            border: `1px solid ${filledCat ? `${color}40` : C.borderSoft}`,
          }}
        >
          <span style={{ width: 6, height: 6, background: filledCat ? color : C.muted, borderRadius: 1 }} />
          {category}
        </span>
        {draft.tags.slice(0, 2).map((t) => (
          <span
            key={t}
            style={{
              fontFamily: FONT, fontSize: 11, color: C.muted,
              padding: "2px 6px", borderRadius: 4,
              border: `1px solid ${C.borderSoft}`,
            }}
          >
            {t}
          </span>
        ))}
        {draft.tags.length > 2 && (
          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted }}>+{draft.tags.length - 2}</span>
        )}
      </div>
    </div>
  );
}

function ReassureLine({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 12, color: C.muted }}>
      <span style={{ color: C.ok, display: "inline-flex" }}><Icon.check /></span>
      {text}
    </div>
  );
}

// ─── Guard: no registered agent yet ─────────────────────────────────────────
function NoAgentGuard({ onRegister, onDashboard }: { onRegister: () => void; onDashboard: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar />
      <Navbar />
      <div style={{ marginLeft: 210, paddingTop: 40, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 440, textAlign: "center", padding: "0 24px" }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(221,234,77,0.08)",
              border: "1px solid rgba(221,234,77,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
              color: C.lime,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, margin: 0, letterSpacing: "-0.02em" }}>
            Register an Agent first
          </h1>
          <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, lineHeight: "20px", margin: "8px 0 24px" }}>
            A Marketplace listing needs a registered Agent — either hosted by GMI or connected to your endpoint. Register one and you'll be brought back here.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={onRegister}
              style={{
                fontFamily: FONT, fontSize: 13, fontWeight: 700,
                background: C.lime, color: C.limeText,
                border: "none", padding: "10px 16px", borderRadius: 8, cursor: "pointer",
              }}
            >
              Register an Agent
            </button>
            <button
              onClick={onDashboard}
              style={{
                fontFamily: FONT, fontSize: 13,
                background: "transparent", color: C.muted,
                border: `1px solid ${C.border}`,
                padding: "9px 16px", borderRadius: 8, cursor: "pointer",
              }}
            >
              Back to My Agents
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

