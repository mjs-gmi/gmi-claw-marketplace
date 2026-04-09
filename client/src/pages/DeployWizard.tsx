import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Server,
  Cpu,
  Github,
  DollarSign,
  FileText,
  Upload,
  Globe,
  Lock,
  Zap,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";

// ─── Step definitions ──────────────────────────────────────────────────────
const STEPS = [
  { id: 0, label: "Identity", icon: FileText },
  { id: 1, label: "Source & Runtime", icon: Github },
  { id: 2, label: "Compute", icon: Cpu },
  { id: 3, label: "Pricing", icon: DollarSign },
  { id: 4, label: "Review & Deploy", icon: Zap },
];

// ─── Data ──────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "Code & Dev Tools",
  "Data Analysis",
  "Content & Writing",
  "Research",
  "Customer Support",
  "Finance",
  "Security",
  "Other",
];

const RUNTIME_VERSIONS = [
  { id: "openclaw-1.2", label: "OpenClaw 1.2", note: "Latest stable · Recommended" },
  { id: "openclaw-1.1", label: "OpenClaw 1.1", note: "Previous stable" },
  { id: "openclaw-1.0", label: "OpenClaw 1.0", note: "Legacy" },
];

const COMPUTE_PRESETS = [
  {
    id: "S",
    label: "Small",
    cpu: "1 vCPU",
    ram: "8 GiB",
    gpu: "None",
    price: "$0.08 / hr",
    note: "Lightweight tasks, low concurrency",
  },
  {
    id: "M",
    label: "Medium",
    cpu: "2 vCPU",
    ram: "16 GiB",
    gpu: "None",
    price: "$0.18 / hr",
    note: "Most Claws — recommended starting point",
    recommended: true,
  },
  {
    id: "L",
    label: "Large",
    cpu: "4 vCPU",
    ram: "32 GiB",
    gpu: "1× A10G",
    price: "$0.72 / hr",
    note: "GPU-accelerated, high-throughput workloads",
  },
  {
    id: "XL",
    label: "X-Large",
    cpu: "8 vCPU",
    ram: "64 GiB",
    gpu: "1× A100",
    price: "$2.40 / hr",
    note: "Enterprise-grade, large model inference",
  },
];

const MAAS_MODELS = [
  { id: "llama-3-1-70b", name: "Llama 3.1 70B", context: "128K", category: "Open Source" },
  { id: "llama-3-1-8b", name: "Llama 3.1 8B", context: "128K", category: "Open Source" },
  { id: "deepseek-coder-v2", name: "DeepSeek-Coder V2", context: "128K", category: "Open Source" },
  { id: "deepseek-r1-32b", name: "DeepSeek-R1 32B", context: "64K", category: "Open Source" },
  { id: "qwen2-5-72b", name: "Qwen2.5 72B", context: "128K", category: "Open Source" },
  { id: "mixtral-8x7b", name: "Mixtral 8x7B", context: "32K", category: "Open Source" },
  { id: "gemma-2-27b", name: "Gemma 2 27B", context: "8K", category: "Open Source" },
  { id: "none", name: "No model (bring your own)", context: "—", category: "Custom" },
];

// ─── Shared sub-components ─────────────────────────────────────────────────
function RadioCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5 transition-all"
      style={{
        background: selected ? "rgba(221,234,77,0.06)" : "#0a0a0a",
        border: `1px solid ${selected ? "#DDEA4D" : "#2a2a2a"}`,
      }}
    >
      {children}
    </button>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <div
      className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
      style={{
        borderColor: selected ? "#DDEA4D" : "#444",
        background: selected ? "#DDEA4D" : "transparent",
      }}
    >
      {selected && <div className="w-2 h-2 rounded-full bg-black" />}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-mono-gmi text-xs uppercase tracking-widest mb-1"
      style={{ color: "#DDEA4D" }}
    >
      {children}
    </p>
  );
}

function TextInput({
  label,
  placeholder,
  value,
  onChange,
  mono = false,
  hint,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block font-mono-gmi text-xs text-gray-500 uppercase tracking-widest mb-1.5">
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 text-sm text-white bg-transparent outline-none transition-all"
        style={{
          border: "1px solid #2a2a2a",
          fontFamily: mono ? "var(--font-mono-gmi)" : undefined,
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
      />
      {hint && <p className="text-xs text-gray-600 font-mono-gmi mt-1">{hint}</p>}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function DeployWizard() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [deployed, setDeployed] = useState(false);

  // ── Config state ──
  const [config, setConfig] = useState({
    // Step 0 — Identity
    name: "",
    version: "1.0.0",
    description: "",
    category: "Code & Dev Tools",
    visibility: "public" as "public" | "private",

    // Step 1 — Source & Runtime
    sourceType: "github" as "github" | "upload",
    repoUrl: "",
    runtime: "openclaw-1.2",

    // Step 2 — Compute
    computePreset: "M",
    model: "llama-3-1-70b",

    // Step 3 — Pricing
    pricingModel: "per-call" as "per-call" | "free",
    pricePerCall: "0.01",
    freeTierCalls: "100",
  });

  const selectedPreset = COMPUTE_PRESETS.find((p) => p.id === config.computePreset)!;
  const selectedModel = MAAS_MODELS.find((m) => m.id === config.model)!;

  const revenueShare = parseFloat(config.pricePerCall || "0") * 0.8;

  const handleDeploy = () => {
    setDeployed(true);
    toast.success("Deployment initiated", {
      description: "Your Claw is being provisioned. You'll receive a confirmation email shortly.",
    });
  };

  // ─── Deployed success screen ────────────────────────────────────────────
  if (deployed) {
    return (
      <div className="min-h-screen flex bg-black text-white">
        <Navbar />
        <div className="flex-1" style={{ marginLeft: "220px" }}>
          <div className="pt-16 pb-20 flex items-center justify-center min-h-screen">
            <div className="text-center max-w-md px-4">
              <div
                className="w-16 h-16 flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(221,234,77,0.1)", border: "1px solid rgba(221,234,77,0.3)" }}
              >
                <CheckCircle size={28} style={{ color: "#DDEA4D" }} />
              </div>
              <div className="gmi-label mb-2" style={{ color: "#DDEA4D" }}>Deployment Initiated</div>
              <h1 className="font-display text-3xl text-white mb-3" style={{ letterSpacing: "-0.03em" }}>
                {config.name || "Your Claw"} is live
              </h1>
              <p className="text-gray-500 text-sm font-mono-gmi leading-relaxed mb-2">
                Your Claw is being provisioned on GMI infrastructure. A confirmation email will be sent when it's ready.
              </p>
              <div
                className="text-xs font-mono-gmi px-4 py-3 mb-2 text-left space-y-1"
                style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
              >
                <div className="flex justify-between text-gray-600">
                  <span>Version</span>
                  <span className="text-gray-400">{config.version}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Compute</span>
                  <span className="text-gray-400">{selectedPreset.label} — {selectedPreset.cpu} · {selectedPreset.ram}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Model</span>
                  <span className="text-gray-400">{selectedModel.name}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Pricing</span>
                  <span className="text-gray-400">
                    {config.pricingModel === "free" ? "Free" : `$${config.pricePerCall} / call`}
                  </span>
                </div>
              </div>
              <div
                className="flex items-start gap-3 p-4 font-mono-gmi text-xs mb-8 text-left"
                style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.2)", color: "#DDEA4D" }}
              >
                <Zap size={13} className="shrink-0 mt-0.5" />
                <span>Compute billing begins on first request. Monitor usage and revenue in your Developer Console.</span>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setLocation("/dashboard")}
                  className="btn-primary-lime px-6 py-2.5 text-sm font-bold flex items-center gap-2"
                >
                  Go to Console <ArrowRight size={14} />
                </button>
                <button
                  onClick={() => setLocation("/marketplace")}
                  className="btn-outline-dashed px-6 py-2.5 text-sm"
                >
                  Marketplace
                </button>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // ─── Wizard ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-black text-white">
      <Navbar />

      <div className="flex-1" style={{ marginLeft: "220px" }}>
        <div className="pt-8 pb-20">
          <div className="px-8 max-w-3xl">

            {/* Back */}
            <button
              onClick={() => setLocation("/list-claw")}
              className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-mono-gmi text-xs mb-10"
            >
              <ArrowLeft size={13} /> Back to Listing
            </button>

            {/* Header */}
            <div className="mb-10">
              <div className="gmi-label mb-2">Deploy a Claw</div>
              <h1
                className="font-display text-4xl text-white mb-2"
                style={{ letterSpacing: "-0.03em" }}
              >
                Configure Deployment
              </h1>
              <p className="text-gray-500 text-sm font-mono-gmi">
                Complete all 5 steps to publish your Claw to the GMI Marketplace.
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-0 mb-10 overflow-x-auto pb-2">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 flex items-center justify-center text-xs font-mono-gmi font-bold shrink-0"
                      style={{
                        background: i <= step ? "#DDEA4D" : "#111",
                        color: i <= step ? "#000" : "#555",
                        border: i <= step ? "none" : "1px solid #2a2a2a",
                      }}
                    >
                      {i < step ? "✓" : i + 1}
                    </div>
                    <span
                      className="text-xs font-mono-gmi hidden sm:inline whitespace-nowrap"
                      style={{ color: i === step ? "#fff" : "#555" }}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className="w-8 h-px mx-3 shrink-0"
                      style={{ background: i < step ? "#DDEA4D" : "#2a2a2a" }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* ── STEP 0: Identity ─────────────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={16} style={{ color: "#DDEA4D" }} />
                  <h2 className="font-display text-lg text-white">Claw Identity</h2>
                </div>

                <TextInput
                  label="Claw Name *"
                  placeholder="e.g. Code Review Agent"
                  value={config.name}
                  onChange={(v) => setConfig((c) => ({ ...c, name: v }))}
                />

                <TextInput
                  label="Version Tag *"
                  placeholder="1.0.0"
                  value={config.version}
                  onChange={(v) => setConfig((c) => ({ ...c, version: v }))}
                  mono
                  hint="Semantic version — shown publicly on the Marketplace listing."
                />

                <div>
                  <label className="block font-mono-gmi text-xs text-gray-500 uppercase tracking-widest mb-1.5">
                    Description *
                  </label>
                  <textarea
                    placeholder="What does this Claw do? Be specific — this is shown on your Marketplace listing."
                    value={config.description}
                    onChange={(e) => setConfig((c) => ({ ...c, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 text-sm text-white bg-transparent outline-none resize-none transition-all"
                    style={{ border: "1px solid #2a2a2a" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                </div>

                <div>
                  <label className="block font-mono-gmi text-xs text-gray-500 uppercase tracking-widest mb-2">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setConfig((c) => ({ ...c, category: cat }))}
                        className="px-3 py-1.5 text-xs font-mono-gmi transition-all"
                        style={{
                          background: config.category === cat ? "rgba(221,234,77,0.12)" : "#0a0a0a",
                          border: `1px solid ${config.category === cat ? "#DDEA4D" : "#2a2a2a"}`,
                          color: config.category === cat ? "#DDEA4D" : "#888",
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-mono-gmi text-xs text-gray-500 uppercase tracking-widest mb-2">
                    Visibility
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "public" as const, icon: Globe, label: "Public", desc: "Listed on the GMI Marketplace" },
                      { id: "private" as const, icon: Lock, label: "Private", desc: "Accessible only via direct link" },
                    ].map((opt) => (
                      <RadioCard
                        key={opt.id}
                        selected={config.visibility === opt.id}
                        onClick={() => setConfig((c) => ({ ...c, visibility: opt.id }))}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <opt.icon size={13} style={{ color: config.visibility === opt.id ? "#DDEA4D" : "#555" }} />
                            <span
                              className="font-mono-gmi text-sm font-bold"
                              style={{ color: config.visibility === opt.id ? "#DDEA4D" : "#888" }}
                            >
                              {opt.label}
                            </span>
                          </div>
                          <RadioDot selected={config.visibility === opt.id} />
                        </div>
                        <p className="text-xs text-gray-600 font-mono-gmi">{opt.desc}</p>
                      </RadioCard>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 1: Source & Runtime ──────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Github size={16} style={{ color: "#DDEA4D" }} />
                  <h2 className="font-display text-lg text-white">Source & Runtime</h2>
                </div>

                <div>
                  <label className="block font-mono-gmi text-xs text-gray-500 uppercase tracking-widest mb-2">
                    Source Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "github" as const, icon: Github, label: "GitHub Repository", desc: "Connect a public or private repo" },
                      { id: "upload" as const, icon: Upload, label: "Upload Package", desc: "Upload a .zip or .tar.gz bundle" },
                    ].map((opt) => (
                      <RadioCard
                        key={opt.id}
                        selected={config.sourceType === opt.id}
                        onClick={() => setConfig((c) => ({ ...c, sourceType: opt.id }))}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <opt.icon size={13} style={{ color: config.sourceType === opt.id ? "#DDEA4D" : "#555" }} />
                            <span
                              className="font-mono-gmi text-sm font-bold"
                              style={{ color: config.sourceType === opt.id ? "#DDEA4D" : "#888" }}
                            >
                              {opt.label}
                            </span>
                          </div>
                          <RadioDot selected={config.sourceType === opt.id} />
                        </div>
                        <p className="text-xs text-gray-600 font-mono-gmi">{opt.desc}</p>
                      </RadioCard>
                    ))}
                  </div>
                </div>

                {config.sourceType === "github" ? (
                  <TextInput
                    label="Repository URL *"
                    placeholder="https://github.com/your-org/your-claw"
                    value={config.repoUrl}
                    onChange={(v) => setConfig((c) => ({ ...c, repoUrl: v }))}
                    mono
                    hint="The repo must contain a valid openclaw.json manifest at its root."
                  />
                ) : (
                  <div>
                    <label className="block font-mono-gmi text-xs text-gray-500 uppercase tracking-widest mb-2">
                      Package File
                    </label>
                    <div
                      className="w-full p-8 text-center font-mono-gmi text-xs text-gray-600 transition-all cursor-pointer"
                      style={{ border: "1px dashed #2a2a2a" }}
                      onClick={() => toast.info("File upload coming soon — use GitHub for now.")}
                    >
                      <Upload size={20} className="mx-auto mb-2" style={{ color: "#444" }} />
                      Click to upload .zip or .tar.gz
                      <br />
                      <span style={{ color: "#555" }}>Max 50 MB</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-mono-gmi text-xs text-gray-500 uppercase tracking-widest mb-2">
                    OpenClaw Runtime Version
                  </label>
                  <div className="space-y-2">
                    {RUNTIME_VERSIONS.map((rv) => (
                      <RadioCard
                        key={rv.id}
                        selected={config.runtime === rv.id}
                        onClick={() => setConfig((c) => ({ ...c, runtime: rv.id }))}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span
                              className="font-mono-gmi text-sm font-bold"
                              style={{ color: config.runtime === rv.id ? "#DDEA4D" : "#888" }}
                            >
                              {rv.label}
                            </span>
                            <span className="text-xs text-gray-600 font-mono-gmi ml-3">{rv.note}</span>
                          </div>
                          <RadioDot selected={config.runtime === rv.id} />
                        </div>
                      </RadioCard>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: Compute Config ────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu size={16} style={{ color: "#DDEA4D" }} />
                  <h2 className="font-display text-lg text-white">Compute Configuration</h2>
                </div>

                <div>
                  <SectionLabel>Compute Preset</SectionLabel>
                  <p className="text-xs text-gray-600 font-mono-gmi mb-3">
                    You can change this after deployment from the Developer Console.
                  </p>
                  <div className="space-y-3">
                    {COMPUTE_PRESETS.map((preset) => (
                      <RadioCard
                        key={preset.id}
                        selected={config.computePreset === preset.id}
                        onClick={() => setConfig((c) => ({ ...c, computePreset: preset.id }))}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span
                              className="font-mono-gmi text-sm font-bold"
                              style={{ color: config.computePreset === preset.id ? "#DDEA4D" : "#888" }}
                            >
                              {preset.label}
                            </span>
                            {preset.recommended && (
                              <span
                                className="text-xs font-mono-gmi px-2 py-0.5"
                                style={{ background: "rgba(221,234,77,0.15)", color: "#DDEA4D" }}
                              >
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span
                              className="font-mono-gmi text-sm font-bold"
                              style={{ color: config.computePreset === preset.id ? "#DDEA4D" : "#555" }}
                            >
                              {preset.price}
                            </span>
                            <RadioDot selected={config.computePreset === preset.id} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 font-mono-gmi text-xs text-gray-500">
                          <div><span className="text-gray-700">CPU</span> {preset.cpu}</div>
                          <div><span className="text-gray-700">RAM</span> {preset.ram}</div>
                          <div><span className="text-gray-700">GPU</span> {preset.gpu}</div>
                        </div>
                        <div className="text-xs text-gray-700 font-mono-gmi mt-2">{preset.note}</div>
                      </RadioCard>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionLabel>Base Model (GMI MaaS)</SectionLabel>
                  <p className="text-xs text-gray-600 font-mono-gmi mb-3">
                    The model your Claw calls via the GMI MaaS API. Billed per token.
                  </p>
                  <div className="space-y-2">
                    {MAAS_MODELS.map((model) => (
                      <RadioCard
                        key={model.id}
                        selected={config.model === model.id}
                        onClick={() => setConfig((c) => ({ ...c, model: model.id }))}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <RadioDot selected={config.model === model.id} />
                            <span
                              className="font-mono-gmi text-sm"
                              style={{ color: config.model === model.id ? "#fff" : "#888" }}
                            >
                              {model.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono-gmi text-xs text-gray-600">
                            <span>{model.context} ctx</span>
                            <span
                              className="px-2 py-0.5"
                              style={{ background: "#111", border: "1px solid #2a2a2a" }}
                            >
                              {model.category}
                            </span>
                          </div>
                        </div>
                      </RadioCard>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Pricing ───────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign size={16} style={{ color: "#DDEA4D" }} />
                  <h2 className="font-display text-lg text-white">Pricing</h2>
                </div>

                <div>
                  <SectionLabel>Pricing Model</SectionLabel>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {[
                      { id: "per-call" as const, label: "Per-Call Pricing", desc: "Charge consumers per API call" },
                      { id: "free" as const, label: "Free", desc: "No charge — open access" },
                    ].map((opt) => (
                      <RadioCard
                        key={opt.id}
                        selected={config.pricingModel === opt.id}
                        onClick={() => setConfig((c) => ({ ...c, pricingModel: opt.id }))}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className="font-mono-gmi text-sm font-bold"
                            style={{ color: config.pricingModel === opt.id ? "#DDEA4D" : "#888" }}
                          >
                            {opt.label}
                          </span>
                          <RadioDot selected={config.pricingModel === opt.id} />
                        </div>
                        <p className="text-xs text-gray-600 font-mono-gmi">{opt.desc}</p>
                      </RadioCard>
                    ))}
                  </div>
                </div>

                {config.pricingModel === "per-call" && (
                  <>
                    <div>
                      <label className="block font-mono-gmi text-xs text-gray-500 uppercase tracking-widest mb-1.5">
                        Price per Call (USD) *
                      </label>
                      <div className="flex items-center gap-0">
                        <div
                          className="px-4 py-3 font-mono-gmi text-sm text-gray-500"
                          style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRight: "none" }}
                        >
                          $
                        </div>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          placeholder="0.010"
                          value={config.pricePerCall}
                          onChange={(e) => setConfig((c) => ({ ...c, pricePerCall: e.target.value }))}
                          className="flex-1 px-4 py-3 text-sm text-white bg-transparent outline-none font-mono-gmi"
                          style={{ border: "1px solid #2a2a2a" }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                        />
                      </div>
                    </div>

                    {/* Revenue share preview */}
                    <div
                      className="p-5 space-y-3"
                      style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
                    >
                      <p className="font-mono-gmi text-xs text-gray-500 uppercase tracking-widest">
                        Revenue Share Preview
                      </p>
                      <div className="grid grid-cols-3 gap-4 font-mono-gmi text-sm">
                        <div className="text-center">
                          <div className="text-gray-600 text-xs mb-1">Per-Call Price</div>
                          <div className="text-white font-bold">${parseFloat(config.pricePerCall || "0").toFixed(3)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-600 text-xs mb-1">Your Share (80%)</div>
                          <div style={{ color: "#DDEA4D" }} className="font-bold">
                            ${revenueShare.toFixed(3)}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-600 text-xs mb-1">GMI Fee (20%)</div>
                          <div className="text-gray-500 font-bold">
                            ${(parseFloat(config.pricePerCall || "0") * 0.2).toFixed(3)}
                          </div>
                        </div>
                      </div>
                      <div
                        className="h-2 w-full"
                        style={{ background: "#1a1a1a" }}
                      >
                        <div className="h-full" style={{ width: "80%", background: "#DDEA4D" }} />
                      </div>
                      <p className="text-xs text-gray-600 font-mono-gmi">
                        GMI charges a 20% platform fee on all revenue. Payouts are processed monthly.
                      </p>
                    </div>
                  </>
                )}

                <TextInput
                  label="Free Tier Calls (per user)"
                  placeholder="100"
                  value={config.freeTierCalls}
                  onChange={(v) => setConfig((c) => ({ ...c, freeTierCalls: v }))}
                  mono
                  hint="Number of free calls each consumer gets before being charged. Set 0 to disable."
                />
              </div>
            )}

            {/* ── STEP 4: Review & Deploy ───────────────────────────────── */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Zap size={16} style={{ color: "#DDEA4D" }} />
                  <h2 className="font-display text-lg text-white">Review & Deploy</h2>
                </div>

                <div
                  className="p-5 space-y-4"
                  style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
                >
                  <p className="font-mono-gmi text-xs text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-3">
                    Deployment Summary
                  </p>

                  {[
                    { label: "Claw Name", value: config.name || "—" },
                    { label: "Version", value: config.version },
                    { label: "Category", value: config.category },
                    { label: "Visibility", value: config.visibility === "public" ? "Public (listed on Marketplace)" : "Private" },
                    {
                      label: "Source",
                      value:
                        config.sourceType === "github"
                          ? config.repoUrl || "GitHub (URL not set)"
                          : "Uploaded package",
                    },
                    { label: "Runtime", value: config.runtime },
                    {
                      label: "Compute",
                      value: `${selectedPreset.label} — ${selectedPreset.cpu} · ${selectedPreset.ram} · GPU: ${selectedPreset.gpu} · ${selectedPreset.price}`,
                    },
                    { label: "Model", value: selectedModel.name },
                    {
                      label: "Pricing",
                      value:
                        config.pricingModel === "free"
                          ? "Free"
                          : `$${config.pricePerCall} / call · Free tier: ${config.freeTierCalls} calls`,
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="grid grid-cols-3 gap-4">
                      <div className="gmi-label text-gray-600">{label}</div>
                      <div className="col-span-2 font-mono-gmi text-sm text-gray-300 break-all">{value}</div>
                    </div>
                  ))}
                </div>

                <div
                  className="flex items-start gap-3 p-4 font-mono-gmi text-xs"
                  style={{
                    background: "rgba(221,234,77,0.04)",
                    border: "1px solid rgba(221,234,77,0.2)",
                    color: "#DDEA4D",
                  }}
                >
                  <CheckCircle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    Compute billing begins on the first request to your Claw. Container and model usage are billed
                    separately. You can upgrade to a Reserved Plan from the Developer Console for discounted rates.
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-10">
              <button
                onClick={() => (step === 0 ? setLocation("/list-claw") : setStep(step - 1))}
                className="btn-outline-dashed px-6 py-2.5 text-sm flex items-center gap-2"
              >
                <ArrowLeft size={14} />
                {step === 0 ? "Back to Listing" : "Back"}
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  className="btn-primary-lime px-8 py-2.5 text-sm font-bold flex items-center gap-2"
                >
                  Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  onClick={handleDeploy}
                  className="px-8 py-2.5 text-sm font-bold flex items-center gap-2 transition-all"
                  style={{ background: "#DDEA4D", color: "#000" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#e8f060")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#DDEA4D")}
                >
                  Deploy Now <Zap size={14} />
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
