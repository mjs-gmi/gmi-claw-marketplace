import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import { TYPE_LABELS, type TypeLabel } from "@/lib/clawData";

// ─── Tokens (kept in sync with DeployWizard / Dashboard / Marketplace) ──────
const FONT = "'Geist', system-ui, sans-serif";
const MONO = "'GeistMono', ui-monospace, monospace";
const C = {
  bg:         "#0a0a0a",
  fg:         "#fafafa",
  muted:      "#a3a3a3",
  border:     "#404040",
  borderSoft: "#262626",
  card:       "rgba(23,23,23,0.95)",
  cardSolid:  "#171717",
  pillBg:     "rgba(82,82,82,0.3)",
  lime:       "#DDEA4D",
  limeText:   "#0a0a0a",
  link:       "#5b94f0",
  warn:       "#fbbf24",
  ok:         "#34d399",
  err:        "#f87171",
} as const;

const TYPE_COLOR: Record<TypeLabel, string> = {
  "Code & Dev Tools":     "#c7a7ff",
  "Data & Analytics":     C.lime,
  "Customer Support":     "#7dd3fc",
  "Content & Marketing":  "#86efac",
  "Research & Knowledge": "#f9a8d4",
};

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
    const arr: RegisteredAgent[] = JSON.parse(localStorage.getItem(REGISTERED_AGENTS_KEY) || "[]");
    if (!Array.isArray(arr) || arr.length === 0) return null;
    if (wantedId) {
      const match = arr.find((a) => a.id === wantedId);
      if (match) return match;
    }
    return arr[0];
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

// Same heuristic the wizard / ClawDetail uses — keeps probe truth consistent.
type ImageProbe = "ok" | "private" | "missing" | "empty" | "n/a";
function probeImage(image: string | undefined): ImageProbe {
  if (image === undefined) return "n/a";
  const v = image.trim().toLowerCase();
  if (!v) return "empty";
  if (v.includes("private") || v.includes("internal") || v.includes("ghcr.io/yourorg")) return "private";
  if (v.includes("404") || v.includes("missing") || v.includes("does-not-exist")) return "missing";
  return "ok";
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
        sampleOutputDataUrl: "", publicUrl: "", demoVideoUrl: "",
        updatedAt: "",
      };
    }
    const existing = loadListing(agent.id);
    if (existing) return { ...existing, publicUrl: existing.publicUrl ?? "" };
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

  // Empty state — no registered agent → show register-first guard.
  if (!agent) {
    return <NoAgentGuard onRegister={() => setLocation("/deploy")} onDashboard={() => setLocation("/dashboard")} />;
  }

  const probe = probeImage(agent.dockerImage);

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

  const saveDraft = () => {
    const finalDraft = { ...draft, updatedAt: new Date(2025, 0, 1).toISOString() };
    saveListing(finalDraft);
    // keep listingState as draft
    setLocation("/dashboard?draft=1");
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar />
      <Navbar />

      <div style={{ marginLeft: 210, paddingTop: 40, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* ── Header strip ─────────────────────────────────────────────── */}
        <header style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <button
            onClick={() => setLocation("/dashboard")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", border: "none", color: C.muted, cursor: "pointer",
              fontFamily: FONT, fontSize: 12, padding: 0, marginBottom: 10,
            }}
          >
            <Icon.back /> My Agents
          </button>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontFamily: FONT, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, lineHeight: "28px" }}>
                List your Agent on the Marketplace
              </h1>
              <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: "6px 0 0", lineHeight: "20px" }}>
                Fill in what users will see, then submit for review. Your provisioned containers keep running either way.
              </p>
            </div>
            <LifecycleStepper currentStep="list" />
          </div>
        </header>

        {/* ── Body: form + sticky live preview ─────────────────────────── */}
        <section
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: 24,
            padding: "16px 24px 96px",
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

            {/* 1) Link a Template — picks which registered agent this
                 listing is for. Pre-selected from ?agentId or latest. After
                 selection, shows the auto-detected hosting mode + image. */}
            <TemplatePicker
              agent={agent}
              probe={probe}
              onEditRegistration={() => setLocation("/deploy")}
            />

            {/* 2) Essentials — the bare minimum needed to publish.
                 Everything else lives in the collapsible "Add more details"
                 block below — listings are living docs that can be polished
                 later via Edit listing. */}
            <FlatSection
              title="The essentials"
              subtitle="Five fields. Everything else is polish you can add later."
            >
              <Row>
                <Field label="Agent name" required error={errors.name}>
                  <TextInput
                    value={draft.name}
                    onChange={(v) => update("name", v)}
                    placeholder="e.g. Contract Review Agent"
                  />
                </Field>
                <Field
                  label="Category"
                  required
                  error={errors.category}
                  hint="Where users find you in Browse Agents."
                >
                  <Select
                    value={draft.category}
                    onChange={(v) => update("category", v as TypeLabel | "")}
                    options={TYPE_LABELS}
                    placeholder="Pick a category"
                  />
                </Field>
              </Row>
              <Field
                label="Publisher"
                required
                error={errors.publisher}
              >
                <TextInput
                  value={draft.publisher}
                  onChange={(v) => update("publisher", v)}
                  placeholder="e.g. Acme Labs"
                />
              </Field>
              <Field
                label="Short description"
                required
                error={errors.shortDesc}
                hint={`${draft.shortDesc.length}/${SHORT_DESC_MAX} characters — one tight sentence about what it does.`}
                hintAlign="right"
              >
                <TextArea
                  value={draft.shortDesc}
                  onChange={(v) => update("shortDesc", v.slice(0, SHORT_DESC_MAX))}
                  placeholder="Real-time document translation across 40+ languages, hosted on Acme infrastructure."
                  rows={2}
                />
              </Field>
              {showPublicUrl ? (
                <>
                  <Field
                    label="Agent Access URL"
                    required
                    error={errors.publicUrl}
                    hint="This link directs to your agent. Public landing page, demo, docs or another repo — anywhere users can interact with what you built. Pre-filled from your registration; override to a different URL if you want."
                  >
                    <TextInput
                      value={draft.publicUrl || agent.accessUrl || ""}
                      onChange={(v) => update("publicUrl", v)}
                      placeholder="https://your-agent.yourdomain.com"
                    />
                  </Field>
                  {/* Connect mode — light explainer of how the URL is used.
                      Try demo just links out; nothing of the publisher is
                      copied or exposed. */}
                  <div
                    style={{
                      background: "rgba(125,211,252,0.04)",
                      border: `1px solid rgba(125,211,252,0.20)`,
                      borderRadius: 8,
                      padding: "8px 12px",
                      display: "flex", alignItems: "center", gap: 8,
                      fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "18px",
                    }}
                  >
                    <span style={{ color: "#7dd3fc", display: "inline-flex" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </span>
                    <span>
                      <span style={{ color: C.fg, fontWeight: 500 }}>Users see a Try demo ↗ button</span> pointing to this URL. You host the agent and own uptime — nothing of yours is shared.
                    </span>
                  </div>
                </>
              ) : (
                // Host on GMI — M6.5 §"Consent at publish": one strong reminder
                // that the publisher is opting into letting others clone their
                // image + config. Definition-list layout — keeps the strong
                // consent presence but drops the bullet/column visual noise.
                <div
                  style={{
                    background: "rgba(221,234,77,0.06)",
                    border: `1px solid rgba(221,234,77,0.35)`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex", flexDirection: "column", gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.lime, display: "inline-flex" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.fg }}>
                      Deploy-your-own listing
                    </span>
                    <span style={{ fontFamily: FONT, fontSize: 12, color: C.muted }}>
                      — others get a copy of your image
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      columnGap: 14,
                      rowGap: 4,
                      fontFamily: FONT, fontSize: 12, lineHeight: "18px",
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", alignSelf: "center" }}>
                      Copied
                    </span>
                    <span style={{ color: C.fg }}>
                      image <span style={{ color: C.muted }}>·</span> env names + defaults <span style={{ color: C.muted }}>·</span> ports + infra config
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", alignSelf: "center" }}>
                      Not copied
                    </span>
                    <span style={{ color: C.fg }}>
                      your secrets <span style={{ color: C.muted }}>·</span> GMI Models key
                    </span>
                  </div>
                </div>
              )}
            </FlatSection>

            {/* 3) Add more details — collapsed by default. The fields here
                 are all optional and polish the public detail page. */}
            <CollapsibleSection
              title="Add more details"
              subtitle="Optional · all of these can be added now or later via Edit listing"
              defaultOpen={false}
              badge={countPolishFilled(draft)}
            >
              <Field
                label="Full description"
                hint="Markdown supported — use ## What it does and ## How it works. If blank, your short description appears on the detail page."
              >
                <TextArea
                  value={draft.fullDesc}
                  onChange={(v) => update("fullDesc", v)}
                  placeholder={"## What it does\nAcme Translate runs glossary-aware document translation across 40+ language pairs.\n\n## How it works\nHosted on Acme infra with GMI Models as the underlying model layer."}
                  rows={6}
                  monospace
                />
              </Field>
              <Row>
                <Field label="Logo" hint="Square PNG/JPG up to 256×256. Auto-generated from name + category if blank.">
                  <LogoUploader
                    value={draft.logoDataUrl}
                    onChange={(v) => update("logoDataUrl", v)}
                    fallbackName={draft.name || agent.name}
                    fallbackColor={draft.category ? TYPE_COLOR[draft.category as TypeLabel] : C.lime}
                  />
                </Field>
                <Field label="Tags" hint={`Up to ${TAG_MAX}. Press Enter to add.`}>
                  <TagInput
                    tags={draft.tags}
                    onChange={(t) => update("tags", t)}
                    max={TAG_MAX}
                  />
                </Field>
              </Row>
              <Field label="Demo video URL" hint="YouTube / Loom / Vimeo — embedded above the description on the detail page.">
                <TextInput
                  value={draft.demoVideoUrl}
                  onChange={(v) => update("demoVideoUrl", v)}
                  placeholder="https://"
                />
              </Field>
            </CollapsibleSection>
          </div>

          {/* ── Right column: live preview card + inline CTA (matches
                production's Continue to Review pattern — no sticky bottom bar) */}
          <aside style={{ position: "sticky", top: 88, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Live Card Preview
            </div>
            <LivePreviewCard draft={draft} fallbackName={agent.name} />

            {/* Detail-page CTA mock — surfaces the mode (Cloneable vs Try demo)
                visually so the publisher sees what button users will see when
                they click into the listing. Pairs with the inline outcome chip
                in the Link a Template section. */}
            <div
              style={{
                background: C.cardSolid,
                border: `1px solid ${C.borderSoft}`,
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex", flexDirection: "column", gap: 8,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                On detail page · users see
              </div>
              {agent.hostMode === "connect" ? (
                <>
                  <div
                    style={{
                      fontFamily: FONT, fontSize: 12, fontWeight: 700,
                      background: C.lime, color: C.limeText,
                      border: "none",
                      padding: "8px 12px", borderRadius: 8,
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                      width: "100%",
                    }}
                  >
                    Try demo <Icon.ext />
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                    Points to your URL — you host, you own uptime.
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      fontFamily: FONT, fontSize: 12, fontWeight: 700,
                      background: C.lime, color: C.limeText,
                      border: "none",
                      padding: "8px 12px", borderRadius: 8,
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                      width: "100%",
                    }}
                  >
                    Deploy your own <Icon.ext />
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
                    Clones your image into the user's own account.
                  </div>
                </>
              )}
            </div>

            <button
              onClick={submitForReview}
              disabled={!canSubmit}
              style={{
                marginTop: 4,
                fontFamily: FONT, fontSize: 13, fontWeight: 700,
                background: canSubmit ? C.lime : "rgba(221,234,77,0.25)",
                color: canSubmit ? C.limeText : "rgba(10,10,10,0.5)",
                border: "none",
                padding: "10px 18px", borderRadius: 8,
                cursor: canSubmit ? "pointer" : "not-allowed",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                width: "100%",
              }}
            >
              Continue to Review <Icon.ext />
            </button>

            <p style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px", margin: 0, padding: "2px 2px" }}>
              Listing review runs on submit · auto-approved if it passes. Unpublish anytime — provisioned containers unaffected.
            </p>

            {/* Image probe hint (only when Host on GMI + non-public image) */}
            {agent.hostMode === "gmi" && (probe === "private" || probe === "missing") && (
              <ProbeHint probe={probe} image={agent.dockerImage} />
            )}
          </aside>
        </section>

        <Footer />
      </div>
    </div>
  );
}

// ─── Lifecycle stepper (4 phases) ───────────────────────────────────────────
type LifecycleStep = "register" | "list" | "review" | "live";
function LifecycleStepper({ currentStep }: { currentStep: LifecycleStep }) {
  const steps: { id: LifecycleStep; label: string; subtitle?: string }[] = [
    { id: "register", label: "Register" },
    { id: "list",     label: "List" },
    { id: "review",   label: "Review", subtitle: "~1 business day" },
    { id: "live",     label: "Live" },
  ];
  const idx = steps.findIndex((s) => s.id === currentStep);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {steps.map((s, i) => {
        const isPast    = i < idx;
        const isCurrent = i === idx;
        const isFuture  = i > idx;
        const fg =
          isPast    ? C.ok
          : isCurrent ? C.lime
          : C.muted;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 64 }}>
              <div
                style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: isCurrent ? C.lime : isPast ? "rgba(52,211,153,0.15)" : "transparent",
                  border: isFuture ? `1px dashed ${C.border}` : `1px solid ${fg}`,
                  color: isCurrent ? C.limeText : fg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: MONO, fontSize: 11, fontWeight: 700,
                }}
              >
                {isPast ? <Icon.check /> : i + 1}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: isCurrent ? 600 : 500, color: isCurrent ? C.fg : C.muted }}>
                  {s.label}
                </div>
                {s.subtitle && (
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginTop: 1 }}>
                    {s.subtitle}
                  </div>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 24, height: 1,
                  background: i < idx ? C.ok : C.border,
                  marginTop: -16,
                  alignSelf: "center",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Template picker — "Link a Template" section (matches production) ──────
// Lets the publisher pick which registered Agent this listing is for. After
// selection, shows the auto-detected hosting mode + image (read-only) so the
// publisher confirms what's being listed. PRD: every listing links to exactly
// one registered template.
function TemplatePicker({
  agent, probe, onEditRegistration,
}: {
  agent: RegisteredAgent;
  probe: ImageProbe;
  onEditRegistration: () => void;
}) {
  const [, setLocation] = useLocation();
  const allAgents: RegisteredAgent[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(REGISTERED_AGENTS_KEY) || "[]"); }
    catch { return []; }
  }, []);

  const isConnect = agent.hostMode === "connect";

  return (
    <FlatSection
      title="Link a Template"
      subtitle="Each listing links to exactly one registered Agent. Pick which one this listing represents."
    >
      <Field label="Linked Template" required>
        <Select
          value={agent.id}
          onChange={(id) => setLocation(`/list-claw?agentId=${encodeURIComponent(id)}`)}
          options={allAgents.map((a) => a.id)}
          renderOption={(id) => {
            const a = allAgents.find((x) => x.id === id);
            return a ? `${a.name} · ${a.hostMode === "connect" ? "Connect with GMI" : "Host on GMI"}` : id;
          }}
          placeholder="Select a template"
        />
      </Field>

      {/* Auto-detected info — confirms what user picked, lets them go modify */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px",
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 6,
          fontFamily: MONO, fontSize: 11,
        }}
      >
        <span style={{ color: C.ok, display: "inline-flex" }}><Icon.check /></span>
        <span
          style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 500,
            color: isConnect ? "#7dd3fc" : C.lime,
            padding: "1px 6px", borderRadius: 4,
            border: `1px solid ${isConnect ? "rgba(125,211,252,0.30)" : "rgba(221,234,77,0.30)"}`,
            background: isConnect ? "rgba(125,211,252,0.06)" : "rgba(221,234,77,0.06)",
          }}
        >
          {isConnect ? "Connect with GMI" : "Host on GMI"}
        </span>
        <span style={{ color: C.muted }}>·</span>
        <span
          style={{
            color: C.muted, flex: 1, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {isConnect ? agent.accessUrl || "—" : agent.dockerImage || "—"}
        </span>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontFamily: FONT, fontSize: 10, fontWeight: 600,
            letterSpacing: "0.06em", textTransform: "uppercase",
            color: C.fg,
            padding: "2px 8px", borderRadius: 4,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${C.border}`,
            whiteSpace: "nowrap",
          }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7"/>
          </svg>
          {isConnect ? "Try demo" : "Deploy your own"}
        </span>
      </div>

      {/* Plain-language explainer of what the chip means — what the consumer
          actually does, who pays, who hosts. Teaches the Cloneable vs Try-demo
          concept right where the publisher first sees it, so they don't have
          to scroll down to the consent callout to understand. */}
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          fontFamily: FONT, fontSize: 12, color: C.muted, lineHeight: "18px",
          padding: "0 2px",
        }}
      >
        <span style={{ color: C.muted, marginTop: 1 }}>↳</span>
        {isConnect ? (
          <div>
            <span style={{ color: C.fg }}>Just a link.</span> Users click your <code style={{ fontFamily: MONO, fontSize: 11, color: C.fg }}>Try demo ↗</code> button and visit a URL you provide — your agent's endpoint, docs, or landing page.<br />
            Nothing is cloned <span style={{ color: C.muted }}>·</span> you keep hosting <span style={{ color: C.muted }}>·</span> users don't get your image or config.
          </div>
        ) : (
          <div>
            <span style={{ color: C.fg }}>Cloneable recipe.</span> Users click <code style={{ fontFamily: MONO, fontSize: 11, color: C.fg }}>Deploy your own ↗</code> and GMI copies your image + config into their account.<br />
            They pay for compute <span style={{ color: C.muted }}>·</span> they bring their own GMI Models key <span style={{ color: C.muted }}>·</span> your secrets aren't copied.
          </div>
        )}
      </div>
    </FlatSection>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────
// FlatSection: lighter, less "boxy" feel — title + horizontal rule instead of
// the previous card-in-card chrome. Used for the essentials block.
function FlatSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ paddingBottom: 8, borderBottom: `1px solid ${C.borderSoft}` }}>
        <h2 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, margin: 0, color: C.fg, letterSpacing: "-0.005em" }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "3px 0 0", lineHeight: "18px" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

// CollapsibleSection: optional polish block. Shows a "+N filled" badge so the
// user knows what they've already optionally completed without expanding.
function CollapsibleSection({
  title, subtitle, defaultOpen = false, badge = 0, children,
}: {
  title: string; subtitle?: string; defaultOpen?: boolean; badge?: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: open ? 14 : 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "transparent",
          border: "none",
          padding: "8px 0",
          borderBottom: `1px solid ${C.borderSoft}`,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          width: "100%", textAlign: "left",
          color: C.fg,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, margin: 0, color: C.fg, letterSpacing: "-0.005em" }}>
              {title}
            </h2>
            {badge > 0 && (
              <span
                style={{
                  fontFamily: MONO, fontSize: 10, color: C.ok,
                  padding: "1px 6px", borderRadius: 999,
                  background: "rgba(52,211,153,0.08)",
                  border: `1px solid rgba(52,211,153,0.3)`,
                }}
              >
                {badge} filled
              </span>
            )}
          </div>
          {subtitle && (
            <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "3px 0 0", lineHeight: "18px" }}>
              {subtitle}
            </p>
          )}
        </div>
        <span style={{ color: C.muted, fontSize: 14, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>⌄</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function countPolishFilled(d: ListingDraft): number {
  let n = 0;
  if (d.fullDesc.trim())        n++;
  if (d.logoDataUrl)            n++;
  if (d.tags.length > 0)        n++;
  if (d.demoVideoUrl.trim())    n++;
  return n;
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

// ─── Probe hint (only when GMI-hosted with non-public image) ────────────────
function ProbeHint({ probe, image }: { probe: ImageProbe; image?: string }) {
  if (probe === "ok" || probe === "n/a") return null;
  const isPrivate = probe === "private";
  const isMissing = probe === "missing";
  const accent = isMissing ? C.err : C.warn;
  const title  = isMissing
    ? "Image not reachable"
    : isPrivate
      ? "Private image detected"
      : "No image set";
  const body  = isMissing
    ? "We couldn't pull this image. Submitting will fail review until it's reachable."
    : isPrivate
      ? "Cloners can't pull this image. Your listing will surface as Try demo instead of Deploy your own."
      : "Without a public image, your listing will run as demo-only.";
  return (
    <div
      style={{
        background: C.cardSolid,
        border: `1px solid ${accent}55`,
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: accent, fontFamily: FONT, fontSize: 12, fontWeight: 600 }}>
        {title}
      </div>
      <div style={{ fontFamily: FONT, fontSize: 11, color: C.muted, marginTop: 4, lineHeight: "16px" }}>
        {body}
      </div>
      {image && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {image}
        </div>
      )}
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

