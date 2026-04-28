import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, CheckCircle, Info, Server,
  ToggleLeft, ToggleRight, ChevronDown, Eye, EyeOff,
  AlertTriangle, Loader2, Circle,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import { TypeLabel, TYPE_LABELS } from "@/lib/clawData";
import { toast } from "sonner";

// ── Mock CE templates ─────────────────────────────────────────────────────────
const MOCK_CE_TEMPLATES = [
  { id: "tpl_9f3a-771e-contract", name: "contract-review-v2", runtime: "Node 20",      instances: 3 },
  { id: "tpl_4b2c-code-review",   name: "code-review-agent",  runtime: "Python 3.11",  instances: 1 },
  { id: "tpl_7d1e-rag-pipeline",  name: "rag-pipeline-v1",    runtime: "Python 3.11",  instances: 2 },
];

const TYPE_DESCRIPTIONS: Record<TypeLabel, string> = {
  Developer:    "Tools for developers — code review, testing, data pipelines, benchmarks",
  Productivity: "Personal & team productivity — daily tasks, scheduling, research, writing",
  Business:     "Business process automation — support, HR, legal, finance, enterprise workflows",
  Creative:     "Creative & media — music, content creation, design, marketing automation",
};

function resolveBadge(path: "A" | "B", useMaaS: boolean) {
  if (path === "B") return { label: "Powered by GMI MaaS", color: "#c084fc" };
  if (useMaaS)      return { label: "Verified",             color: "#DDEA4D" };
  return                   { label: "Powered by GMI CE",    color: "#7ec8ff" };
}

function parseContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    from:        params.get("from") || "",
    templateId:  params.get("templateId") || "",
    projectName: params.get("projectName") || "",
    projectId:   params.get("projectId") || "",
    useMaaS:     params.get("useMaaS") === "true",
  };
}

// ── Usage pre-check states ────────────────────────────────────────────────────
type UsageCheckState = "idle" | "checking" | "pass" | "fail";

// Simulate async usage check (in production: real API call)
function simulateUsageCheck(key: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Keys ending in "0" or "fail" → no usage; everything else → pass
      const noUsage = key.endsWith("0") || key.toLowerCase().includes("fail");
      resolve(!noUsage);
    }, 1200);
  });
}

const STEPS_A = ["Listing Info", "Review & Publish"];
const STEPS_B = ["Infrastructure", "Listing Info", "Review & Publish"];

export default function ListClaw() {
  const [, setLocation] = useLocation();
  const [ctx] = useState(parseContext);

  const hasContext = ctx.from === "deploy" || ctx.from === "dashboard";
  const path: "A" | "B" = ctx.from === "deploy" ? "A" : "B";
  const STEPS = path === "A" ? STEPS_A : STEPS_B;

  const [step,      setStep]      = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [useMaaS,   setUseMaaS]   = useState(ctx.useMaaS);

  const [selectedTemplate, setSelectedTemplate] = useState(
    ctx.templateId
      ? MOCK_CE_TEMPLATES.find((t) => t.id === ctx.templateId) || MOCK_CE_TEMPLATES[0]
      : MOCK_CE_TEMPLATES[0]
  );
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  // Path B infra fields
  const [maasKey,     setMaasKey]     = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [showKey,     setShowKey]     = useState(false);

  // Usage pre-check state (Path B only)
  const [usageCheck,     setUsageCheck]     = useState<UsageCheckState>("idle");
  const [usageCheckDone, setUsageCheckDone] = useState(false); // true once checked at least once

  const badge = resolveBadge(path, useMaaS);

  const [form, setForm] = useState({
    name:            ctx.projectName || "",
    publisher:       "",
    contact:         "",
    typeLabel:       "" as TypeLabel | "",
    description:     "",
    fullDescription: "",
    tags:            "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Re-run usage check whenever maasKey changes (with debounce)
  useEffect(() => {
    if (path !== "B") return;
    if (!maasKey.trim()) {
      setUsageCheck("idle");
      setUsageCheckDone(false);
      return;
    }
    const timer = setTimeout(async () => {
      setUsageCheck("checking");
      const pass = await simulateUsageCheck(maasKey);
      setUsageCheck(pass ? "pass" : "fail");
      setUsageCheckDone(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [maasKey, path]);

  const usageBlocked = path === "B" && usageCheckDone && usageCheck === "fail";

  const canProceed = () => {
    if (path === "B" && step === 0) {
      if (usageBlocked) return false;
      return (
        maasKey.trim().length > 0 &&
        endpointUrl.trim().startsWith("https://") &&
        usageCheck === "pass"
      );
    }
    const listingStep = path === "A" ? 0 : 1;
    if (step === listingStep) {
      return !!(
        form.name.trim() &&
        form.publisher.trim() &&
        form.contact.trim() &&
        form.typeLabel &&
        form.description.trim() &&
        form.fullDescription.trim()
      );
    }
    return true;
  };

  const handleSubmit = () => {
    if (usageBlocked) return; // extra guard
    setSubmitted(true);
    toast.success("Claw listed on Marketplace", {
      description: "Your Claw is now live and discoverable.",
    });
  };

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!hasContext) {
    return (
      <div className="min-h-screen flex bg-black text-white">
        <Topbar />
        <Navbar />
        <div className="flex-1 flex items-center justify-center" style={{ marginLeft: "210px", paddingTop: "40px" }}>
          <div className="max-w-md px-8 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(221,234,77,0.06)", border: "1px solid rgba(221,234,77,0.2)" }}
            >
              <Server size={22} style={{ color: "#DDEA4D" }} />
            </div>
            <h1 className="font-display text-2xl text-white mb-3" style={{ letterSpacing: "-0.03em" }}>
              Register first, then list
            </h1>
            <p className="font-mono-gmi text-sm text-gray-400 leading-relaxed mb-8">
              A Marketplace listing requires a deployed Claw on GMI infrastructure.
              Register your Claw on Cluster Engine first — you'll be brought here automatically when it's ready.
            </p>
            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={() => setLocation("/deploy")}
                className="btn-primary-lime w-full px-6 py-3 text-sm font-bold flex items-center justify-center gap-2"
              >
                Register a Claw <ArrowRight size={14} />
              </button>
              <button
                onClick={() => setLocation("/dashboard")}
                className="btn-outline-dashed w-full px-6 py-2.5 text-sm"
              >
                Go to Dashboard
              </button>
            </div>
            <p className="font-mono-gmi text-xs text-gray-600 mt-6">
              Already deployed? Go to{" "}
              <button className="underline" style={{ color: "#888" }} onClick={() => setLocation("/dashboard")}>
                My Claws
              </button>{" "}
              and click "Create Listing" on any unlisted project.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex bg-black text-white">
        <Topbar />
        <Navbar />
        <div className="flex-1" style={{ marginLeft: "210px", paddingTop: "40px" }}>
          <div className="pt-8 pb-20 flex items-center justify-center min-h-screen">
            <div className="text-center max-w-md px-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(221,234,77,0.1)", border: "1px solid rgba(221,234,77,0.3)" }}
              >
                <CheckCircle size={28} style={{ color: "#DDEA4D" }} />
              </div>
              <h1 className="font-display text-3xl text-white mb-3">Claw Listed Successfully</h1>
              <p className="text-gray-300 text-sm font-mono-gmi leading-relaxed mb-4">
                <span className="text-white">{form.name || "Your Claw"}</span> is now live on the GMI Marketplace.
                Confirmation sent to <span className="text-white">{form.contact}</span>.
              </p>
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono-gmi text-xs mb-8"
                style={{ background: `${badge.color}12`, border: `1px solid ${badge.color}44`, color: badge.color }}
              >
                <CheckCircle size={10} />
                {badge.label}
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setLocation("/dashboard")}
                  className="btn-primary-lime px-6 py-2.5 text-sm font-bold flex items-center gap-2"
                >
                  Go to Dashboard <ArrowRight size={14} />
                </button>
                <button
                  onClick={() => setLocation("/marketplace")}
                  className="btn-outline-dashed px-6 py-2.5 text-sm"
                >
                  View Marketplace
                </button>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  const listingInfoStep = path === "A" ? 0 : 1;
  const reviewStep      = path === "A" ? 1 : 2;

  return (
    <div className="min-h-screen flex bg-black text-white">
      <Topbar />
      <Navbar />

      <div className="flex-1" style={{ marginLeft: "210px", paddingTop: "40px" }}>
        <div className="pt-8 pb-20">
          <div className="px-8 max-w-3xl">

            {/* Back */}
            <button
              onClick={() =>
                step === 0
                  ? setLocation(ctx.from === "deploy" ? "/deploy" : "/dashboard")
                  : setStep(step - 1)
              }
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors font-mono-gmi text-xs mb-10"
            >
              <ArrowLeft size={13} />
              {step === 0
                ? ctx.from === "deploy" ? "Back to Register" : "Back to Dashboard"
                : "Back"}
            </button>

            {/* Header */}
            <div className="mb-6">
              <div className="gmi-label mb-2">Marketplace · Create Listing</div>
              <h1 className="font-display text-4xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
                List a Claw
              </h1>
              <p className="text-gray-300 text-sm font-mono-gmi">
                Listings go live instantly — no review required.
              </p>
            </div>

            {/* Path badge */}
            <div className="flex items-center gap-3 mb-8">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 font-mono-gmi text-xs"
                style={
                  path === "A"
                    ? { background: "rgba(221,234,77,0.06)", border: "1px solid rgba(221,234,77,0.25)", color: "#DDEA4D" }
                    : { background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.25)", color: "#60a5fa" }
                }
              >
                {path === "A" ? "Path A · GMI CE Deployment" : "Path B · Self-hosted + MaaS"}
              </div>
              <span className="font-mono-gmi text-xs text-gray-600">
                {path === "A"
                  ? "CE template detected — linking your deployment to this listing"
                  : "No CE template found — you'll provide your own endpoint + MaaS key"}
              </span>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-0 mb-10">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 flex items-center justify-center text-xs font-mono-gmi font-bold"
                      style={{
                        background: i <= step ? (path === "A" ? "#DDEA4D" : "#60a5fa") : "#111",
                        color: i <= step ? "#000" : "#999",
                        border: i <= step ? "none" : "1px solid #2a2a2a",
                      }}
                    >
                      {i < step ? "✓" : i + 1}
                    </div>
                    <span
                      className="font-mono-gmi text-xs"
                      style={{ color: i === step ? "#fff" : "#555" }}
                    >
                      {s}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className="w-8 h-px mx-3"
                      style={{ background: i < step ? (path === "A" ? "#DDEA4D" : "#60a5fa") : "#2a2a2a" }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* ── PATH B · Step 0: Infrastructure ── */}
            {path === "B" && step === 0 && (
              <div className="space-y-6">

                {/* Context note */}
                <div
                  className="flex items-start gap-3 p-4 font-mono-gmi text-xs"
                  style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.2)" }}
                >
                  <Info size={13} className="shrink-0 mt-0.5" style={{ color: "#60a5fa" }} />
                  <div style={{ color: "#93c5fd" }}>
                    No GMI CE deployment was found for this project. To list on the Marketplace,
                    provide a <strong>project-scoped GMI MaaS API key</strong> and your{" "}
                    <strong>external HTTPS endpoint</strong>. GMI will proxy consumer requests to your endpoint.
                  </div>
                </div>

                {/* ── Usage blocking banner (shown when check fails) ── */}
                {usageBlocked && (
                  <div
                    className="flex items-start gap-3 p-4 font-mono-gmi text-xs"
                    style={{
                      background: "rgba(248,113,113,0.06)",
                      border: "1px solid rgba(248,113,113,0.35)",
                    }}
                  >
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "#f87171" }} />
                    <div>
                      <div className="font-bold mb-1" style={{ color: "#fca5a5" }}>
                        MaaS Key has no usage
                      </div>
                      <div style={{ color: "#f87171" }} className="leading-relaxed">
                        To list on the Marketplace, your GMI MaaS key must have at least one inference call recorded.
                        This confirms your Claw is actively using GMI infrastructure.
                        Make at least one inference call with this key, then try again.
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <a
                          href="#"
                          className="underline"
                          style={{ color: "#fca5a5" }}
                          onClick={(e) => e.preventDefault()}
                        >
                          View MaaS usage dashboard →
                        </a>
                        <span style={{ color: "#7f1d1d" }}>·</span>
                        <a
                          href="#"
                          className="underline"
                          style={{ color: "#fca5a5" }}
                          onClick={(e) => e.preventDefault()}
                        >
                          API Quickstart →
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* MaaS API Key */}
                <div>
                  <label className="gmi-label block mb-2">GMI MaaS API Key *</label>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={maasKey}
                      onChange={(e) => setMaasKey(e.target.value)}
                      placeholder="gmi_maas_proj_••••••••••••••••"
                      className="w-full bg-transparent px-4 py-3 pr-20 text-sm text-white font-mono-gmi outline-none"
                      style={{
                        border: `1px solid ${
                          usageCheck === "fail" ? "rgba(248,113,113,0.5)" :
                          usageCheck === "pass" ? "rgba(74,222,128,0.5)" :
                          "#2a2a2a"
                        }`,
                      }}
                      onFocus={(e) => {
                        if (usageCheck !== "fail" && usageCheck !== "pass")
                          e.currentTarget.style.borderColor = "#60a5fa";
                      }}
                      onBlur={(e) => {
                        if (usageCheck !== "fail" && usageCheck !== "pass")
                          e.currentTarget.style.borderColor = "#2a2a2a";
                      }}
                    />
                    {/* Right side: show/hide + check status */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {usageCheck === "checking" && (
                        <Loader2 size={13} className="animate-spin" style={{ color: "#60a5fa" }} />
                      )}
                      {usageCheck === "pass" && (
                        <CheckCircle size={13} style={{ color: "#4ade80" }} />
                      )}
                      {usageCheck === "fail" && (
                        <AlertTriangle size={13} style={{ color: "#f87171" }} />
                      )}
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="text-gray-500 hover:text-gray-300"
                      >
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Inline status message below key field */}
                  {usageCheck === "checking" && (
                    <p className="text-xs font-mono-gmi mt-1.5 flex items-center gap-1.5" style={{ color: "#60a5fa" }}>
                      <Loader2 size={10} className="animate-spin" />
                      Checking MaaS usage…
                    </p>
                  )}
                  {usageCheck === "pass" && (
                    <p className="text-xs font-mono-gmi mt-1.5 flex items-center gap-1.5" style={{ color: "#4ade80" }}>
                      <CheckCircle size={10} />
                      Usage confirmed — key is eligible for listing.
                    </p>
                  )}
                  {usageCheck === "fail" && (
                    <p className="text-xs font-mono-gmi mt-1.5 flex items-center gap-1.5" style={{ color: "#f87171" }}>
                      <AlertTriangle size={10} />
                      No usage found. Listing is blocked.
                    </p>
                  )}
                  {usageCheck === "idle" && (
                    <p className="text-xs text-gray-600 font-mono-gmi mt-1">
                      Must be a project-scoped key (prefix: <code className="text-gray-400">gmi_maas_proj_</code>).
                      Generate one in{" "}
                      <span className="underline cursor-pointer text-gray-400">Settings → API Keys</span>.
                    </p>
                  )}
                </div>

                {/* External Endpoint URL */}
                <div>
                  <label className="gmi-label block mb-2">External Endpoint URL *</label>
                  <input
                    type="url"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    placeholder="https://your-agent.example.com/v1/invoke"
                    className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none"
                    style={{ border: "1px solid #2a2a2a" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#60a5fa")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                  <p className="text-xs text-gray-600 font-mono-gmi mt-1">
                    Must be HTTPS. GMI proxies consumer requests to this URL — your endpoint must be publicly reachable.
                    You are responsible for uptime and latency.
                  </p>
                  {endpointUrl && !endpointUrl.startsWith("https://") && (
                    <p className="text-xs font-mono-gmi mt-1" style={{ color: "#f87171" }}>
                      Endpoint must start with https://
                    </p>
                  )}
                </div>

                {/* Badge preview */}
                <div className="flex items-center gap-2 font-mono-gmi text-xs text-gray-500">
                  <span>Badge on listing:</span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5"
                    style={{ background: "#c084fc12", border: "1px solid #c084fc44", color: "#c084fc" }}
                  >
                    <CheckCircle size={9} />
                    Powered by GMI MaaS
                  </span>
                </div>

                <div
                  className="flex items-start gap-2 p-3 font-mono-gmi text-xs"
                  style={{ background: "#0a0a0a", border: "1px solid #1e1e1e", color: "#666" }}
                >
                  <Info size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Want the <span style={{ color: "#DDEA4D" }}>Verified</span> badge and GMI-managed infrastructure?{" "}
                    <button
                      className="underline"
                      style={{ color: "#888" }}
                      onClick={() => setLocation("/deploy")}
                    >
                      Register with GMI CE instead →
                    </button>
                  </span>
                </div>
              </div>
            )}

            {/* ── PATH A · Step 0 / PATH B · Step 1: Listing Info ── */}
            {step === listingInfoStep && (
              <div className="space-y-6">

                {/* Path A: CE Template selector + MaaS toggle */}
                {path === "A" && (
                  <div className="space-y-4 pb-2">
                    <div>
                      <label className="gmi-label block mb-2">CE Template *</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowTemplateDropdown((v) => !v)}
                          className="w-full flex items-center justify-between px-4 py-3 text-sm font-mono-gmi text-white text-left"
                          style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full" style={{ background: "#DDEA4D" }} />
                            <span>{selectedTemplate.name}</span>
                            <span className="text-gray-500 text-xs">{selectedTemplate.id}</span>
                          </div>
                          <ChevronDown size={14} className="text-gray-500" />
                        </button>
                        {showTemplateDropdown && (
                          <div
                            className="absolute top-full left-0 right-0 z-10 mt-1"
                            style={{ background: "#111", border: "1px solid #2a2a2a" }}
                          >
                            {MOCK_CE_TEMPLATES.map((tpl) => (
                              <button
                                key={tpl.id}
                                type="button"
                                onClick={() => { setSelectedTemplate(tpl); setShowTemplateDropdown(false); }}
                                className="w-full flex items-center justify-between px-4 py-3 text-sm font-mono-gmi text-left hover:bg-white/5 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ background: tpl.id === selectedTemplate.id ? "#DDEA4D" : "#333" }}
                                  />
                                  <span className="text-white">{tpl.name}</span>
                                  <span className="text-gray-500 text-xs">{tpl.runtime}</span>
                                </div>
                                <span className="text-gray-600 text-xs">{tpl.instances} inst.</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-mono-gmi mt-1">
                        This CE template will be linked to the listing. Consumers access your Claw through GMI's infrastructure.
                      </p>
                    </div>

                    {/* MaaS toggle */}
                    <div
                      className="flex items-center justify-between p-4"
                      style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
                    >
                      <div>
                        <div className="font-mono-gmi text-sm text-white mb-0.5">Also using GMI MaaS?</div>
                        <div className="font-mono-gmi text-xs text-gray-500">
                          Enables the{" "}
                          <span style={{ color: "#DDEA4D" }}>Verified</span> badge
                          {" "}(vs{" "}
                          <span style={{ color: "#7ec8ff" }}>Powered by GMI CE</span>)
                        </div>
                      </div>
                      <button
                        onClick={() => setUseMaaS((v) => !v)}
                        className="flex items-center gap-2 font-mono-gmi text-xs transition-colors"
                      >
                        {useMaaS
                          ? <ToggleRight size={28} style={{ color: "#DDEA4D" }} />
                          : <ToggleLeft size={28} style={{ color: "#444" }} />}
                      </button>
                    </div>

                    {/* Live badge preview */}
                    <div className="flex items-center gap-2 font-mono-gmi text-xs text-gray-500">
                      <span>Badge preview:</span>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5"
                        style={{
                          background: `${badge.color}12`,
                          border: `1px solid ${badge.color}44`,
                          color: badge.color,
                        }}
                      >
                        <CheckCircle size={9} />
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ borderTop: "1px solid #1a1a1a" }} />
                  </div>
                )}

                {/* Claw Name */}
                <div>
                  <label className="gmi-label block mb-2">Listing Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="e.g. Contract Review Agent"
                    className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none"
                    style={{ border: "1px solid #2a2a2a" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                  <p className="text-xs text-gray-600 font-mono-gmi mt-1">
                    Public-facing name on the Marketplace. Your internal project name stays private.
                  </p>
                </div>

                {/* Publisher + Contact */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="gmi-label block mb-2">Publisher Name *</label>
                    <input
                      type="text"
                      value={form.publisher}
                      onChange={(e) => update("publisher", e.target.value)}
                      placeholder="Your company or name"
                      className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none"
                      style={{ border: "1px solid #2a2a2a" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    />
                  </div>
                  <div>
                    <label className="gmi-label block mb-2">Contact Email *</label>
                    <input
                      type="email"
                      value={form.contact}
                      onChange={(e) => update("contact", e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none"
                      style={{ border: "1px solid #2a2a2a" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                    />
                  </div>
                </div>

                {/* Type Label */}
                <div>
                  <label className="gmi-label block mb-2">Claw Type *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {TYPE_LABELS.map((type) => (
                      <button
                        key={type}
                        onClick={() => update("typeLabel", type)}
                        className="text-left p-4 transition-all"
                        style={{
                          background: form.typeLabel === type ? "rgba(221,234,77,0.06)" : "#0a0a0a",
                          border: `1px solid ${form.typeLabel === type ? "#DDEA4D" : "#2a2a2a"}`,
                        }}
                      >
                        <div
                          className="font-mono-gmi text-sm font-bold mb-1"
                          style={{ color: form.typeLabel === type ? "#DDEA4D" : "#888" }}
                        >
                          {type}
                        </div>
                        <div className="text-xs text-gray-400 leading-relaxed">{TYPE_DESCRIPTIONS[type]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Short description */}
                <div>
                  <label className="gmi-label block mb-2">
                    Short Description * <span className="text-gray-500 normal-case">(shown on Marketplace card)</span>
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="One sentence describing what this Claw does"
                    maxLength={120}
                    className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none"
                    style={{ border: "1px solid #2a2a2a" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                  <div className="text-xs text-gray-500 font-mono-gmi mt-1 text-right">{form.description.length}/120</div>
                </div>

                {/* Full description */}
                <div>
                  <label className="gmi-label block mb-2">
                    Full Description * <span className="text-gray-500 normal-case">(shown on detail page)</span>
                  </label>
                  <textarea
                    value={form.fullDescription}
                    onChange={(e) => update("fullDescription", e.target.value)}
                    placeholder="Describe what your Claw does, who it's for, what inputs it accepts, and what outputs it produces."
                    rows={5}
                    className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none resize-none"
                    style={{ border: "1px solid #2a2a2a" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="gmi-label block mb-2">
                    Tags <span className="text-gray-500 normal-case">(comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => update("tags", e.target.value)}
                    placeholder="e.g. Security, Solidity, Audit"
                    className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none"
                    style={{ border: "1px solid #2a2a2a" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                </div>

                <div className="flex items-start gap-2 font-mono-gmi text-xs text-gray-600">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Listing is separate from deployment. Consumers access your Claw through GMI's infrastructure — your internal endpoint is never exposed.{" "}
                    <span className="underline cursor-pointer">Learn more →</span>
                  </span>
                </div>
              </div>
            )}

            {/* ── Review step ── */}
            {step === reviewStep && (
              <div className="space-y-6">

                {/* Two-column layout: listing summary + pre-submit checks */}
                <div className="grid grid-cols-3 gap-6">

                  {/* Left: listing summary (2/3 width) */}
                  <div className="col-span-2 p-6 space-y-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-lg text-white">Review Listing</h2>
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 font-mono-gmi text-xs"
                        style={{
                          background: `${badge.color}12`,
                          border: `1px solid ${badge.color}44`,
                          color: badge.color,
                        }}
                      >
                        <CheckCircle size={9} />
                        {badge.label}
                      </span>
                    </div>

                    {[
                      { label: "Listing Name",     value: form.name },
                      { label: "Publisher",         value: form.publisher },
                      { label: "Contact",           value: form.contact },
                      { label: "Type",              value: form.typeLabel },
                      { label: "Short Description", value: form.description },
                      { label: "Tags",              value: form.tags || "—" },
                      path === "A"
                        ? { label: "CE Template", value: `${selectedTemplate.name} · ${selectedTemplate.id}` }
                        : { label: "Endpoint",    value: endpointUrl },
                    ].map(({ label, value }) => (
                      <div key={label} className="grid grid-cols-3 gap-4" style={{ borderTop: "1px solid #111", paddingTop: "0.75rem" }}>
                        <div className="gmi-label text-gray-500">{label}</div>
                        <div className="col-span-2 font-mono-gmi text-sm text-gray-300 break-all">{value}</div>
                      </div>
                    ))}

                    <div style={{ borderTop: "1px solid #1e1e1e", paddingTop: "1rem" }}>
                      <div className="gmi-label text-gray-500 mb-2">Full Description</div>
                      <div className="font-mono-gmi text-sm text-gray-400 leading-relaxed">{form.fullDescription}</div>
                    </div>
                  </div>

                  {/* Right: Pre-submit checks (1/3 width) */}
                  <div className="p-5 space-y-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                    <div className="gmi-label text-gray-400 mb-3">Pre-submit Checks</div>

                    {/* Check 1: MaaS Key has usage — Path B only */}
                    {path === "B" && (
                      <div className="flex items-start gap-2 font-mono-gmi text-xs">
                        <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
                        <span style={{ color: "#86efac" }}>MaaS Key has usage</span>
                      </div>
                    )}

                    {/* Check 2: Endpoint reachable — Path B only */}
                    {path === "B" && (
                      <div className="flex items-start gap-2 font-mono-gmi text-xs">
                        <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
                        <span style={{ color: "#86efac" }}>Endpoint reachable (HTTP 200)</span>
                      </div>
                    )}

                    {/* Check 3: Listing review on submit */}
                    <div className="flex items-start gap-2 font-mono-gmi text-xs">
                      <Circle size={12} className="shrink-0 mt-0.5" style={{ color: "#555" }} />
                      <span style={{ color: "#666" }}>Listing review on submit</span>
                    </div>

                    {/* Path A: CE template linked */}
                    {path === "A" && (
                      <div className="flex items-start gap-2 font-mono-gmi text-xs">
                        <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: "#4ade80" }} />
                        <span style={{ color: "#86efac" }}>CE template linked</span>
                      </div>
                    )}

                    <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "0.75rem" }}>
                      <div className="font-mono-gmi text-xs" style={{ color: "#444" }}>
                        Listings go live immediately after submission. No manual review required.
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-start gap-3 p-4 font-mono-gmi text-xs"
                  style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.2)", color: "#DDEA4D" }}
                >
                  <CheckCircle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    By publishing, you confirm this Claw complies with the{" "}
                    <span className="underline cursor-pointer">GMI Marketplace Guidelines</span>.
                    Your listing will go live immediately. Confirmation to {form.contact}.
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-10">
              <button
                onClick={() =>
                  step === 0
                    ? setLocation(ctx.from === "deploy" ? "/deploy" : "/dashboard")
                    : setStep(step - 1)
                }
                className="btn-outline-dashed px-6 py-2.5 text-sm flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                {step === 0
                  ? ctx.from === "deploy" ? "Back to Register" : "Back to Dashboard"
                  : "Back"}
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="btn-primary-lime px-8 py-2.5 text-sm font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={usageBlocked}
                  className="btn-primary-lime px-8 py-2.5 text-sm font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Publish Claw <CheckCircle size={14} />
                </button>
              )}
            </div>

          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
