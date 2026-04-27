import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle, Info, Server, Cloud, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { TypeLabel, TYPE_LABELS } from "@/lib/clawData";
import { toast } from "sonner";

const STEPS_A = ["Listing Info", "Pricing", "Review & Publish"];
const STEPS_B = ["MaaS & Endpoint", "Listing Info", "Pricing", "Review & Publish"];

type Path = "A" | "B" | null;

// Simulated existing templates (Path A)
const PUBLISHED_TEMPLATES = [
  { id: "tpl_abc123def456", name: "contract-review-v2", badge: "Verified", tier: "Tier C" },
  { id: "tpl_xyz789ghi012", name: "code-review-agent", badge: "Powered by GMI CE", tier: "Tier B" },
];

const TYPE_DESCRIPTIONS: Record<TypeLabel, string> = {
  Developer: "Tools for developers — code review, testing, data pipelines, benchmarks",
  Productivity: "Personal & team productivity — daily tasks, scheduling, research, writing",
  Business: "Business process automation — support, HR, legal, finance, enterprise workflows",
  Creative: "Creative & media — music, content creation, design, marketing automation",
};

export default function ListClaw() {
  const [, setLocation] = useLocation();
  const [path, setPath] = useState<Path>(null);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    name: "",
    publisher: "",
    contact: "",
    typeLabel: "" as TypeLabel | "",
    description: "",
    fullDescription: "",
    tags: "",
    // Path A
    linkedTemplate: "",
    // Path B
    maasKey: "",
    externalEndpoint: "",
    // Pricing
    pricingModel: "per-call" as "per-call" | "subscription" | "free",
    pricePerCall: "0.05",
    subscriptionPrice: "49",
    freeTierCalls: "100",
    revenueShare: "80",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const STEPS = path === "B" ? STEPS_B : STEPS_A;

  const canProceed = () => {
    if (path === "B" && step === 0) {
      return form.maasKey.trim() && form.externalEndpoint.trim();
    }
    const infoStep = path === "B" ? 1 : 0;
    if (step === infoStep) {
      return (
        form.name.trim() &&
        form.publisher.trim() &&
        form.contact.trim() &&
        form.typeLabel &&
        form.description.trim() &&
        form.fullDescription.trim() &&
        (path === "A" ? form.linkedTemplate.trim() : true)
      );
    }
    return true;
  };

  const revenueNum = parseInt(form.revenueShare) || 80;
  const gmiShare = 100 - revenueNum;

  const handleSubmit = () => {
    setSubmitted(true);
    toast.success("Claw listed on Marketplace", {
      description: "Your Claw is now live and discoverable.",
    });
  };

  // ── Eligibility gate ─────────────────────────────────────────────────────
  if (path === null) {
    return (
      <div className="min-h-screen flex bg-black text-white">
        <Navbar />
        <div className="flex-1" style={{ marginLeft: "220px" }}>
          <div className="pt-8 pb-20">
            <div className="px-8 max-w-3xl">
              <button
                onClick={() => setLocation("/dashboard")}
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors font-mono-gmi text-xs mb-10"
              >
                <ArrowLeft size={13} /> Back to Dashboard
              </button>

              <div className="mb-10">
                <div className="gmi-label mb-2">Marketplace · Create Listing</div>
                <h1 className="font-display text-4xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
                  List a Claw
                </h1>
                <p className="text-gray-300 text-sm font-mono-gmi">
                  To list on the GMI Marketplace, your Claw must use at least one GMI product.
                  Listings go live instantly — no review required.
                </p>
              </div>

              {/* Eligibility info */}
              <div className="p-4 mb-8 font-mono-gmi text-xs" style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.2)" }}>
                <div className="font-bold mb-2" style={{ color: "#DDEA4D" }}>Infrastructure Eligibility</div>
                <div className="space-y-1.5 text-gray-300">
                  <div className="flex items-center gap-2"><CheckCircle size={11} style={{ color: "#DDEA4D" }} /><span>GMI CE + GMI MaaS → <span style={{ color: "#DDEA4D" }}>Verified</span></span></div>
                  <div className="flex items-center gap-2"><CheckCircle size={11} style={{ color: "#7ec8ff" }} /><span>GMI CE only → <span style={{ color: "#7ec8ff" }}>Powered by GMI CE</span></span></div>
                  <div className="flex items-center gap-2"><CheckCircle size={11} style={{ color: "#c084fc" }} /><span>Self-hosted + GMI MaaS → <span style={{ color: "#c084fc" }}>Powered by GMI MaaS</span></span></div>
                  <div className="flex items-center gap-2"><AlertCircle size={11} style={{ color: "#999" }} /><span className="text-gray-300">Self-hosted + own model → Not eligible</span></div>
                </div>
              </div>

              {/* Path selection */}
              <div className="space-y-4">
                <div className="gmi-label text-gray-300 mb-3">Select your infrastructure path</div>

                {/* Path A */}
                <button
                  onClick={() => setPath("A")}
                  className="w-full text-left p-5 transition-all group"
                  style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#DDEA4D"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a"; }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(221,234,77,0.08)", border: "1px solid rgba(221,234,77,0.2)" }}>
                      <Server size={16} style={{ color: "#DDEA4D" }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-mono-gmi text-sm font-bold text-white mb-1">Path A — GMI CE Hosted</div>
                      <p className="font-mono-gmi text-xs text-gray-300 leading-relaxed mb-3">
                        Your Claw template is published on GMI Cluster Engine. Link a published template to create your listing.
                        Supports Verified and Powered by GMI CE badges.
                      </p>
                      {PUBLISHED_TEMPLATES.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {PUBLISHED_TEMPLATES.map((t) => (
                            <span key={t.id} className="font-mono-gmi text-xs px-2 py-0.5" style={{ background: "#111", border: "1px solid #2a2a2a", color: "#888" }}>
                              {t.name}
                            </span>
                          ))}
                          <span className="font-mono-gmi text-xs text-gray-300">+ {PUBLISHED_TEMPLATES.length} template{PUBLISHED_TEMPLATES.length !== 1 ? "s" : ""} available</span>
                        </div>
                      ) : (
                        <div className="font-mono-gmi text-xs text-gray-300">No published templates yet — register one first</div>
                      )}
                    </div>
                    <ArrowRight size={14} className="shrink-0 mt-1" style={{ color: "#999" }} />
                  </div>
                </button>

                {/* Path B */}
                <button
                  onClick={() => setPath("B")}
                  className="w-full text-left p-5 transition-all"
                  style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#c084fc"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a"; }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(192,132,252,0.08)", border: "1px solid rgba(192,132,252,0.2)" }}>
                      <Cloud size={16} style={{ color: "#c084fc" }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-mono-gmi text-sm font-bold text-white mb-1">Path B — Self-Hosted + GMI MaaS</div>
                      <p className="font-mono-gmi text-xs text-gray-300 leading-relaxed mb-3">
                        You host your Claw externally and use GMI MaaS as the model layer.
                        Provide your Project-scoped GMI API Key and your Claw's public endpoint URL.
                      </p>
                      <span className="font-mono-gmi text-xs px-2 py-0.5" style={{ background: "rgba(192,132,252,0.08)", border: "1px solid rgba(192,132,252,0.2)", color: "#c084fc" }}>
                        Powered by GMI MaaS
                      </span>
                    </div>
                    <ArrowRight size={14} className="shrink-0 mt-1" style={{ color: "#999" }} />
                  </div>
                </button>

                {/* Ineligible notice */}
                <div className="p-4 font-mono-gmi text-xs" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <div className="flex items-start gap-2 text-gray-300">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    <span>Self-hosted Claws using your own model provider are not eligible for listing. At least one GMI product (CE or MaaS) is required.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // ── Success screen ───────────────────────────────────────────────────────
  if (submitted) {
    const badge = path === "A"
      ? (form.linkedTemplate ? (PUBLISHED_TEMPLATES.find(t => t.id === form.linkedTemplate)?.badge || "Verified") : "Verified")
      : "Powered by GMI MaaS";
    const badgeColor = badge === "Verified" ? "#DDEA4D" : badge === "Powered by GMI CE" ? "#7ec8ff" : "#c084fc";

    return (
      <div className="min-h-screen flex bg-black text-white">
        <Navbar />
        <div className="flex-1" style={{ marginLeft: "220px" }}>
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
                <span className="text-white">{form.name || "Your Claw"}</span> is now live on the GMI Marketplace
                and discoverable by users. Confirmation sent to <span className="text-white">{form.contact}</span>.
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono-gmi text-xs mb-8"
                style={{ background: "rgba(221,234,77,0.06)", border: "1px solid rgba(221,234,77,0.2)", color: badgeColor }}>
                <CheckCircle size={10} />
                {badge}
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
  const infoStep = path === "B" ? 1 : 0;
  const pricingStep = path === "B" ? 2 : 1;
  const reviewStep = path === "B" ? 3 : 2;

  return (
    <div className="min-h-screen flex bg-black text-white">
      <Navbar />

      <div className="flex-1" style={{ marginLeft: "220px" }}>
        <div className="pt-8 pb-20">
          <div className="px-8 max-w-3xl">

            {/* Back */}
            <button
              onClick={() => step === 0 ? setPath(null) : setStep(step - 1)}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors font-mono-gmi text-xs mb-10"
            >
              <ArrowLeft size={13} /> {step === 0 ? "Change Path" : "Back"}
            </button>

            {/* Header */}
            <div className="mb-10">
              <div className="gmi-label mb-2">
                Marketplace · {path === "A" ? "Path A — GMI CE" : "Path B — MaaS"} · Create Listing
              </div>
              <h1 className="font-display text-4xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
                List a Claw
              </h1>
              <p className="text-gray-300 text-sm font-mono-gmi">
                Listings go live instantly — no review required.
              </p>
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

            {/* ── Path B Step 0: MaaS Key + Endpoint ── */}
            {path === "B" && step === 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Cloud size={15} style={{ color: "#c084fc" }} />
                  <h2 className="font-display text-lg text-white">MaaS Key & External Endpoint</h2>
                </div>
                <p className="text-xs text-gray-400 font-mono-gmi -mt-4">
                  Provide your Project-scoped GMI API Key and your Claw's public endpoint URL.
                  GMI will verify both before listing.
                </p>

                <div>
                  <label className="gmi-label block mb-2">Project-Scoped GMI API Key *</label>
                  <input
                    type="password"
                    value={form.maasKey}
                    onChange={(e) => update("maasKey", e.target.value)}
                    placeholder="gmi_sk_..."
                    className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none"
                    style={{ border: "1px solid #2a2a2a" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                  <p className="text-xs text-gray-300 font-mono-gmi mt-1">
                    Must be Inference-scoped. GMI will validate this key is active before listing.
                  </p>
                </div>

                <div>
                  <label className="gmi-label block mb-2">External Claw Endpoint URL *</label>
                  <input
                    type="url"
                    value={form.externalEndpoint}
                    onChange={(e) => update("externalEndpoint", e.target.value)}
                    placeholder="https://your-claw.example.com"
                    className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none"
                    style={{ border: "1px solid #2a2a2a" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#c084fc")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                  <p className="text-xs text-gray-300 font-mono-gmi mt-1">
                    GMI will ping this URL (HTTP GET) and require a 200 response before listing.
                  </p>
                </div>

                <div className="p-4 font-mono-gmi text-xs" style={{ background: "rgba(192,132,252,0.04)", border: "1px solid rgba(192,132,252,0.2)", color: "#c084fc" }}>
                  <div className="font-bold mb-1">Powered by GMI MaaS</div>
                  <p className="text-gray-300 leading-relaxed">
                    Your listing will display the "Powered by GMI MaaS" badge, indicating that the model layer
                    runs on GMI while you self-host the infrastructure.
                  </p>
                </div>
              </div>
            )}

            {/* ── Info step ── */}
            {step === infoStep && (
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="gmi-label block mb-2">Claw Name *</label>
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
                        <div className="font-mono-gmi text-sm font-bold mb-1" style={{ color: form.typeLabel === type ? "#DDEA4D" : "#888" }}>
                          {type}
                        </div>
                        <div className="text-xs text-gray-400 leading-relaxed">{TYPE_DESCRIPTIONS[type]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Short description */}
                <div>
                  <label className="gmi-label block mb-2">Short Description * <span className="text-gray-300 normal-case">(shown on Marketplace card)</span></label>
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
                  <div className="text-xs text-gray-300 font-mono-gmi mt-1 text-right">{form.description.length}/120</div>
                </div>

                {/* Full description */}
                <div>
                  <label className="gmi-label block mb-2">Full Description * <span className="text-gray-300 normal-case">(shown on detail page)</span></label>
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
                  <label className="gmi-label block mb-2">Tags <span className="text-gray-300 normal-case">(comma-separated)</span></label>
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

                {/* Path A: Linked template */}
                {path === "A" && (
                  <div>
                    <label className="gmi-label block mb-2">Linked Template (CE) *</label>
                    <div className="space-y-2">
                      {PUBLISHED_TEMPLATES.map((t) => (
                        <button key={t.id}
                          className="w-full text-left p-4 transition-all"
                          style={{ background: form.linkedTemplate === t.id ? "rgba(221,234,77,0.06)" : "#0a0a0a", border: `1px solid ${form.linkedTemplate === t.id ? "#DDEA4D" : "#2a2a2a"}` }}
                          onClick={() => update("linkedTemplate", t.id)}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-mono-gmi text-sm text-white">{t.name}</div>
                              <div className="font-mono-gmi text-xs text-gray-400 mt-0.5">{t.id} · {t.tier}</div>
                            </div>
                            <span className="font-mono-gmi text-xs px-2 py-0.5" style={{ color: "#DDEA4D", background: "rgba(221,234,77,0.08)" }}>
                              {t.badge}
                            </span>
                          </div>
                        </button>
                      ))}
                      {PUBLISHED_TEMPLATES.length === 0 && (
                        <div className="p-4 font-mono-gmi text-xs text-gray-400" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                          No published templates found.{" "}
                          <button onClick={() => setLocation("/deploy")} className="underline" style={{ color: "#DDEA4D" }}>
                            Register a Claw template first →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Info note */}
                <div className="flex items-start gap-3 p-4 font-mono-gmi text-xs" style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.15)" }}>
                  <Info size={14} className="shrink-0 mt-0.5" style={{ color: "#DDEA4D" }} />
                  <div style={{ color: "#DDEA4D" }}>
                    Listing is separate from deployment. Consumers access your Claw through GMI's infrastructure — you never expose your endpoint directly.
                  </div>
                </div>
              </div>
            )}

            {/* ── Pricing step ── */}
            {step === pricingStep && (
              <div className="space-y-6">
                <h2 className="font-display text-lg text-white">Pricing Configuration</h2>
                <p className="text-xs text-gray-400 font-mono-gmi -mt-4">
                  GMI handles all billing and fraud protection. You receive your share automatically.
                </p>

                <div>
                  <label className="gmi-label block mb-2">Pricing Model *</label>
                  <div className="space-y-2">
                    {[
                      { id: "per-call" as const, label: "Per-Call", desc: "Consumers pay per API call. Best for variable usage." },
                      { id: "subscription" as const, label: "Monthly Subscription", desc: "Flat monthly fee. Best for predictable usage." },
                      { id: "free" as const, label: "Free", desc: "No charge to consumers. Good for open-source or promotional Claws." },
                    ].map((opt) => (
                      <button key={opt.id}
                        onClick={() => update("pricingModel", opt.id)}
                        className="w-full text-left p-4 transition-all"
                        style={{ background: form.pricingModel === opt.id ? "rgba(221,234,77,0.06)" : "#0a0a0a", border: `1px solid ${form.pricingModel === opt.id ? "#DDEA4D" : "#2a2a2a"}` }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-mono-gmi text-sm font-bold" style={{ color: form.pricingModel === opt.id ? "#DDEA4D" : "#888" }}>{opt.label}</div>
                            <div className="text-xs text-gray-400 font-mono-gmi mt-0.5">{opt.desc}</div>
                          </div>
                          <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ml-4"
                            style={{ borderColor: form.pricingModel === opt.id ? "#DDEA4D" : "#444", background: form.pricingModel === opt.id ? "#DDEA4D" : "transparent" }}>
                            {form.pricingModel === opt.id && <div className="w-2 h-2 rounded-full bg-black" />}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {form.pricingModel === "per-call" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="gmi-label block mb-2">Price per Call (USD)</label>
                      <div className="flex items-center" style={{ border: "1px solid #2a2a2a" }}>
                        <span className="px-3 font-mono-gmi text-sm text-gray-400">$</span>
                        <input type="number" min="0" step="0.001" value={form.pricePerCall}
                          onChange={(e) => update("pricePerCall", e.target.value)}
                          className="flex-1 px-2 py-3 text-sm text-white bg-transparent outline-none font-mono-gmi"
                          onFocus={(e) => (e.currentTarget.parentElement!.style.borderColor = "#DDEA4D")}
                          onBlur={(e) => (e.currentTarget.parentElement!.style.borderColor = "#2a2a2a")} />
                      </div>
                    </div>
                    <div>
                      <label className="gmi-label block mb-2">Free Tier (calls/month)</label>
                      <input type="number" min="0" value={form.freeTierCalls}
                        onChange={(e) => update("freeTierCalls", e.target.value)}
                        className="w-full px-4 py-3 text-sm text-white bg-transparent outline-none font-mono-gmi"
                        style={{ border: "1px solid #2a2a2a" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                    </div>
                  </div>
                )}
                {form.pricingModel === "subscription" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="gmi-label block mb-2">Monthly Price (USD)</label>
                      <div className="flex items-center" style={{ border: "1px solid #2a2a2a" }}>
                        <span className="px-3 font-mono-gmi text-sm text-gray-400">$</span>
                        <input type="number" min="0" value={form.subscriptionPrice}
                          onChange={(e) => update("subscriptionPrice", e.target.value)}
                          className="flex-1 px-2 py-3 text-sm text-white bg-transparent outline-none font-mono-gmi"
                          onFocus={(e) => (e.currentTarget.parentElement!.style.borderColor = "#DDEA4D")}
                          onBlur={(e) => (e.currentTarget.parentElement!.style.borderColor = "#2a2a2a")} />
                      </div>
                    </div>
                    <div>
                      <label className="gmi-label block mb-2">Free Tier (calls/month)</label>
                      <input type="number" min="0" value={form.freeTierCalls}
                        onChange={(e) => update("freeTierCalls", e.target.value)}
                        className="w-full px-4 py-3 text-sm text-white bg-transparent outline-none font-mono-gmi"
                        style={{ border: "1px solid #2a2a2a" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                    </div>
                  </div>
                )}

                {form.pricingModel !== "free" && (
                  <div>
                    <label className="gmi-label block mb-2">Revenue Share</label>
                    <div className="p-4 space-y-3" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                      <div className="flex items-center justify-between font-mono-gmi text-sm">
                        <span className="text-gray-400">Your share</span>
                        <span style={{ color: "#DDEA4D" }} className="font-bold">{revenueNum}%</span>
                      </div>
                      <div className="h-2 w-full" style={{ background: "#1a1a1a" }}>
                        <div className="h-full" style={{ width: `${revenueNum}%`, background: "#DDEA4D" }} />
                      </div>
                      <div className="flex items-center justify-between font-mono-gmi text-xs text-gray-400">
                        <span>GMI platform fee: {gmiShare}%</span>
                        <span>Covers billing, fraud, infra</span>
                      </div>
                      <input type="range" min="50" max="90" step="5" value={revenueNum}
                        onChange={(e) => update("revenueShare", e.target.value)}
                        className="w-full" style={{ accentColor: "#DDEA4D" }} />
                      <div className="flex justify-between font-mono-gmi text-xs text-gray-300">
                        <span>50%</span><span>90%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Review step ── */}
            {step === reviewStep && (
              <div className="space-y-6">
                <div className="p-6 space-y-5" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <h2 className="font-display text-lg text-white">Review Listing</h2>

                  {[
                    { label: "Listing Name", value: form.name },
                    { label: "Publisher", value: form.publisher },
                    { label: "Contact", value: form.contact },
                    { label: "Type", value: form.typeLabel },
                    { label: "Short Description", value: form.description },
                    { label: "Tags", value: form.tags || "—" },
                    { label: "Path", value: path === "A" ? "GMI CE Hosted" : "Self-Hosted + GMI MaaS" },
                    { label: "Pricing", value: form.pricingModel === "per-call" ? `$${form.pricePerCall}/call · ${form.freeTierCalls} free/mo · ${revenueNum}% revenue share` : form.pricingModel === "subscription" ? `$${form.subscriptionPrice}/mo · ${form.freeTierCalls} free/mo · ${revenueNum}% revenue share` : "Free" },
                  ].map(({ label, value }) => (
                    <div key={label} className="grid grid-cols-3 gap-4">
                      <div className="gmi-label text-gray-400">{label}</div>
                      <div className="col-span-2 font-mono-gmi text-sm text-gray-300">{value}</div>
                    </div>
                  ))}

                  <div style={{ borderTop: "1px solid #1e1e1e" }} />
                  <div>
                    <div className="gmi-label text-gray-400 mb-2">Full Description</div>
                    <div className="font-mono-gmi text-sm text-gray-400 leading-relaxed">{form.fullDescription}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 font-mono-gmi text-xs" style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.2)", color: "#DDEA4D" }}>
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
                onClick={() => step === 0 ? setPath(null) : setStep(step - 1)}
                className="btn-outline-dashed px-6 py-2.5 text-sm flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                {step === 0 ? "Change Path" : "Back"}
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
