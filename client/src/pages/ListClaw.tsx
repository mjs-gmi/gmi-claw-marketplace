import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, CheckCircle, Info, Server, ToggleLeft, ToggleRight,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import { TypeLabel, TYPE_LABELS } from "@/lib/clawData";
import { toast } from "sonner";

// Steps — always the same two-step flow once context is confirmed
const STEPS = ["Listing Info", "Review & Publish"];

const TYPE_DESCRIPTIONS: Record<TypeLabel, string> = {
  Developer:   "Tools for developers — code review, testing, data pipelines, benchmarks",
  Productivity: "Personal & team productivity — daily tasks, scheduling, research, writing",
  Business:    "Business process automation — support, HR, legal, finance, enterprise workflows",
  Creative:    "Creative & media — music, content creation, design, marketing automation",
};

function resolveBadge(useMaaS: boolean, fromDeploy: boolean) {
  if (!fromDeploy) return { label: "Powered by GMI MaaS", color: "#c084fc" };
  if (useMaaS)    return { label: "Verified",             color: "#DDEA4D" };
  return              { label: "Powered by GMI CE",       color: "#7ec8ff" };
}

// ── Parse context from URL query string ─────────────────────────────────────
function parseContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    from:         params.get("from") || "",          // "deploy" | "dashboard" | ""
    templateId:   params.get("templateId") || "",
    projectName:  params.get("projectName") || "",
    projectId:    params.get("projectId") || "",
    useMaaS:      params.get("useMaaS") === "true",
  };
}

export default function ListClaw() {
  const [, setLocation] = useLocation();
  const [ctx]           = useState(parseContext);

  const hasContext = ctx.from === "deploy" || ctx.from === "dashboard";

  const [step,      setStep]      = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [useMaaS,   setUseMaaS]   = useState(ctx.useMaaS);

  const badge = resolveBadge(useMaaS, ctx.from === "deploy");

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

  const canProceed = () => {
    if (step === 0) {
      return (
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
    setSubmitted(true);
    toast.success("Claw listed on Marketplace", {
      description: "Your Claw is now live and discoverable.",
    });
  };

  // ── Guard: no deploy context ─────────────────────────────────────────────
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
              <button
                className="underline"
                style={{ color: "#888" }}
                onClick={() => setLocation("/dashboard")}
              >
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

  // ── Success screen ────────────────────────────────────────────────────────
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

  // ── Multi-step form ───────────────────────────────────────────────────────
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
                ? ctx.from === "deploy" ? "Back to Deploy" : "Back to Dashboard"
                : "Back"}
            </button>

            {/* Header */}
            <div className="mb-8">
              <div className="gmi-label mb-2">Marketplace · Create Listing</div>
              <h1 className="font-display text-4xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
                List a Claw
              </h1>
              <p className="text-gray-300 text-sm font-mono-gmi">
                Listings go live instantly — no review required.
              </p>
            </div>

            {/* Deploy context banner */}
            <div
              className="flex items-start gap-3 p-4 mb-8 font-mono-gmi text-xs"
              style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.2)" }}
            >
              <CheckCircle size={13} className="shrink-0 mt-0.5" style={{ color: "#DDEA4D" }} />
              <div>
                <span style={{ color: "#DDEA4D" }}>
                  {ctx.from === "deploy" ? "Deployed from CE" : "Deployed project"}:{" "}
                </span>
                <span className="text-white">{ctx.projectName || ctx.templateId || ctx.projectId}</span>
                {ctx.templateId && (
                  <span className="text-gray-500 ml-2">· {ctx.templateId}</span>
                )}
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-0 mb-10">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 flex items-center justify-center text-xs font-mono-gmi font-bold"
                      style={{
                        background: i <= step ? "#DDEA4D" : "#111",
                        color: i <= step ? "#000" : "#999",
                        border: i <= step ? "none" : "1px solid #2a2a2a",
                      }}
                    >
                      {i < step ? "✓" : i + 1}
                    </div>
                    <span
                      className="text-xs font-mono-gmi whitespace-nowrap"
                      style={{ color: i === step ? "#fff" : "#999" }}
                    >
                      {s}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className="w-8 h-px mx-3"
                      style={{ background: i < step ? "#DDEA4D" : "#2a2a2a" }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* ── Step 0: Listing Info ── */}
            {step === 0 && (
              <div className="space-y-6">

                {/* MaaS toggle (only for CE-deployed claws) */}
                {ctx.from === "deploy" && (
                  <div className="space-y-3 pb-2">
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
                    This is the public-facing name shown on the Marketplace. Your internal project name stays private.
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

                {/* Subtle info note */}
                <div className="flex items-start gap-2 font-mono-gmi text-xs text-gray-600">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Listing is separate from deployment. Consumers access your Claw through GMI's infrastructure — your internal endpoint is never exposed.{" "}
                    <span className="underline cursor-pointer">Learn more →</span>
                  </span>
                </div>
              </div>
            )}

            {/* ── Step 1: Review ── */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="p-6 space-y-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
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
                    { label: "Listing Name",      value: form.name },
                    { label: "Publisher",          value: form.publisher },
                    { label: "Contact",            value: form.contact },
                    { label: "Type",               value: form.typeLabel },
                    { label: "Short Description",  value: form.description },
                    { label: "Tags",               value: form.tags || "—" },
                    ctx.templateId
                      ? { label: "CE Template", value: ctx.templateId }
                      : { label: "Project",     value: ctx.projectName || ctx.projectId },
                  ].map(({ label, value }) => (
                    <div key={label} className="grid grid-cols-3 gap-4" style={{ borderTop: "1px solid #111", paddingTop: "0.75rem" }}>
                      <div className="gmi-label text-gray-500">{label}</div>
                      <div className="col-span-2 font-mono-gmi text-sm text-gray-300">{value}</div>
                    </div>
                  ))}

                  <div style={{ borderTop: "1px solid #1e1e1e", paddingTop: "1rem" }}>
                    <div className="gmi-label text-gray-500 mb-2">Full Description</div>
                    <div className="font-mono-gmi text-sm text-gray-400 leading-relaxed">{form.fullDescription}</div>
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
                  ? ctx.from === "deploy" ? "Back to Deploy" : "Back to Dashboard"
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
                  className="btn-primary-lime px-8 py-2.5 text-sm font-bold flex items-center gap-2"
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
