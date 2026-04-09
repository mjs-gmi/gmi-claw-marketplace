import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle, Server, Database, Cpu, Layers } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";

const STEPS = ["Compute Tier", "Storage", "Containers", "Model"];

const COMPUTE_TIERS = [
  {
    id: "A",
    cpu: "4 cores",
    ram: "32 GiB",
    storage: "1 TiB NVMe",
    label: "Option A",
    note: "High-memory workloads",
  },
  {
    id: "B",
    cpu: "2 cores",
    ram: "16 GiB",
    storage: "200 GiB NVMe",
    label: "Option B",
    note: "Medium workloads",
  },
  {
    id: "C",
    cpu: "1 core",
    ram: "8 GiB",
    storage: "100 GiB NVMe",
    label: "Option C",
    note: "Recommended for most Claws",
    recommended: true,
  },
  {
    id: "D",
    cpu: "1 core",
    ram: "4 GiB",
    storage: "50 GiB NVMe",
    label: "Option D",
    note: "Lightweight tasks",
  },
];

const MAAS_MODELS = [
  { id: "llama-3-1-70b", name: "Llama 3.1 70B", category: "Open Source", context: "128K" },
  { id: "llama-3-1-8b", name: "Llama 3.1 8B", category: "Open Source", context: "128K" },
  { id: "deepseek-coder-v2", name: "DeepSeek-Coder V2", category: "Open Source", context: "128K" },
  { id: "deepseek-r1-32b", name: "DeepSeek-R1 32B", category: "Open Source", context: "64K" },
  { id: "qwen2-5-72b", name: "Qwen2.5 72B", category: "Open Source", context: "128K" },
  { id: "qwen2-5-7b", name: "Qwen2.5 7B", category: "Open Source", context: "128K" },
  { id: "mixtral-8x7b", name: "Mixtral 8x7B", category: "Open Source", context: "32K" },
  { id: "gemma-2-27b", name: "Gemma 2 27B", category: "Open Source", context: "8K" },
];

export default function DeployWizard() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [deployed, setDeployed] = useState(false);

  const [config, setConfig] = useState({
    computeTier: "C",
    storageMode: "shared" as "shared" | "isolated",
    containerCount: "1-10",
    model: "llama-3-1-70b",
  });

  const selectedTier = COMPUTE_TIERS.find((t) => t.id === config.computeTier)!;
  const selectedModel = MAAS_MODELS.find((m) => m.id === config.model)!;

  const handleDeploy = () => {
    setDeployed(true);
    toast.success("Deployment initiated", {
      description: "Your Claw is being provisioned. Billing has started.",
    });
  };

  if (deployed) {
    return (
      <div className="min-h-screen flex bg-black text-white">
        <Navbar />
        <div className="flex-1" style={{ marginLeft: "220px" }}>
        <div className="pt-8 pb-20 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(221,234,77,0.1)", border: "1px solid rgba(221,234,77,0.3)" }}
            >
              <CheckCircle size={28} style={{ color: "#DDEA4D" }} />
            </div>
            <h1 className="font-display text-3xl text-white mb-3">Deployment Initiated</h1>
            <p className="text-gray-500 text-sm font-mono-gmi leading-relaxed mb-2">
              Your Claw is being provisioned on GMI infrastructure.
            </p>
            <p className="text-gray-600 text-xs font-mono-gmi mb-8">
              Compute: Option {config.computeTier} · Storage: {config.storageMode} ·{" "}
              Model: {selectedModel.name}
            </p>
            <div
              className="text-xs font-mono-gmi px-4 py-3 mb-8 text-left"
              style={{
                background: "rgba(221,234,77,0.04)",
                border: "1px solid rgba(221,234,77,0.2)",
                color: "#DDEA4D",
              }}
            >
              ⚡ Billing has started. Monitor usage and costs in your Developer Console.
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
            <ArrowLeft size={13} /> Back
          </button>

          {/* Header */}
          <div className="mb-10">
            <div className="gmi-label mb-2">Claw Builder</div>
            <h1 className="font-display text-4xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
              Configure Deployment
            </h1>
            <p className="text-gray-500 text-sm font-mono-gmi">
              Billing begins when you click Deploy Now.
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
                      color: i <= step ? "#000" : "#555",
                      border: i <= step ? "none" : "1px solid #2a2a2a",
                    }}
                  >
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span
                    className="text-xs font-mono-gmi hidden sm:inline"
                    style={{ color: i === step ? "#fff" : "#555" }}
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

          {/* Step 0: Compute Tier */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-6">
                <Cpu size={16} style={{ color: "#DDEA4D" }} />
                <h2 className="font-display text-lg text-white">Select Compute Tier</h2>
              </div>
              {COMPUTE_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setConfig((c) => ({ ...c, computeTier: tier.id }))}
                  className="w-full text-left p-5 transition-all"
                  style={{
                    background: config.computeTier === tier.id ? "rgba(221,234,77,0.06)" : "#0a0a0a",
                    border: `1px solid ${config.computeTier === tier.id ? "#DDEA4D" : "#2a2a2a"}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span
                        className="font-mono-gmi text-sm font-bold"
                        style={{ color: config.computeTier === tier.id ? "#DDEA4D" : "#888" }}
                      >
                        {tier.label}
                      </span>
                      {tier.recommended && (
                        <span
                          className="text-xs font-mono-gmi px-2 py-0.5"
                          style={{ background: "rgba(221,234,77,0.15)", color: "#DDEA4D" }}
                        >
                          Recommended
                        </span>
                      )}
                    </div>
                    <div
                      className="w-4 h-4 rounded-full border flex items-center justify-center"
                      style={{
                        borderColor: config.computeTier === tier.id ? "#DDEA4D" : "#444",
                        background: config.computeTier === tier.id ? "#DDEA4D" : "transparent",
                      }}
                    >
                      {config.computeTier === tier.id && (
                        <div className="w-2 h-2 rounded-full bg-black" />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 font-mono-gmi text-xs text-gray-500">
                    <div><span className="text-gray-700">CPU</span> {tier.cpu}</div>
                    <div><span className="text-gray-700">RAM</span> {tier.ram}</div>
                    <div><span className="text-gray-700">Storage</span> {tier.storage}</div>
                  </div>
                  <div className="text-xs text-gray-700 font-mono-gmi mt-2">{tier.note}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 1: Storage */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-6">
                <Database size={16} style={{ color: "#DDEA4D" }} />
                <h2 className="font-display text-lg text-white">Storage Mode</h2>
              </div>

              {[
                {
                  id: "shared" as const,
                  label: "Shared Storage",
                  description:
                    "All containers share a storage pool with data isolation between containers. Files from one container are not accessible to others.",
                  note: "Default. Recommended for most use cases.",
                },
                {
                  id: "isolated" as const,
                  label: "Isolated Storage",
                  description:
                    "Each container gets a fully independent storage environment. No shared filesystem at any level.",
                  note: "Required for strict compliance or multi-tenant scenarios.",
                },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setConfig((c) => ({ ...c, storageMode: option.id }))}
                  className="w-full text-left p-5 transition-all"
                  style={{
                    background: config.storageMode === option.id ? "rgba(221,234,77,0.06)" : "#0a0a0a",
                    border: `1px solid ${config.storageMode === option.id ? "#DDEA4D" : "#2a2a2a"}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="font-mono-gmi text-sm font-bold"
                      style={{ color: config.storageMode === option.id ? "#DDEA4D" : "#888" }}
                    >
                      {option.label}
                    </span>
                    <div
                      className="w-4 h-4 rounded-full border flex items-center justify-center"
                      style={{
                        borderColor: config.storageMode === option.id ? "#DDEA4D" : "#444",
                        background: config.storageMode === option.id ? "#DDEA4D" : "transparent",
                      }}
                    >
                      {config.storageMode === option.id && (
                        <div className="w-2 h-2 rounded-full bg-black" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 font-mono-gmi leading-relaxed mb-2">
                    {option.description}
                  </p>
                  <p className="text-xs text-gray-700 font-mono-gmi">{option.note}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Container Count */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-6">
                <Layers size={16} style={{ color: "#DDEA4D" }} />
                <h2 className="font-display text-lg text-white">Estimated Container Count</h2>
              </div>
              <p className="text-sm text-gray-500 font-mono-gmi mb-6">
                How many containers do you expect to run concurrently? This helps GMI plan capacity.
                You can adjust this later.
              </p>

              {[
                { id: "1-10", label: "1 – 10", note: "Early-stage or low-traffic Claws" },
                { id: "10-50", label: "10 – 50", note: "Growing usage, moderate concurrency" },
                { id: "50-200", label: "50 – 200", note: "High-traffic production workloads" },
                { id: "200+", label: "200+", note: "Enterprise scale — contact GMI for dedicated capacity" },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setConfig((c) => ({ ...c, containerCount: option.id }))}
                  className="w-full text-left p-5 transition-all"
                  style={{
                    background: config.containerCount === option.id ? "rgba(221,234,77,0.06)" : "#0a0a0a",
                    border: `1px solid ${config.containerCount === option.id ? "#DDEA4D" : "#2a2a2a"}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div
                        className="font-mono-gmi text-sm font-bold mb-1"
                        style={{ color: config.containerCount === option.id ? "#DDEA4D" : "#888" }}
                      >
                        {option.label} containers
                      </div>
                      <div className="text-xs text-gray-600 font-mono-gmi">{option.note}</div>
                    </div>
                    <div
                      className="w-4 h-4 rounded-full border flex items-center justify-center"
                      style={{
                        borderColor: config.containerCount === option.id ? "#DDEA4D" : "#444",
                        background: config.containerCount === option.id ? "#DDEA4D" : "transparent",
                      }}
                    >
                      {config.containerCount === option.id && (
                        <div className="w-2 h-2 rounded-full bg-black" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Model + Review */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Server size={16} style={{ color: "#DDEA4D" }} />
                <h2 className="font-display text-lg text-white">Select Model</h2>
              </div>
              <p className="text-sm text-gray-500 font-mono-gmi mb-4">
                Choose a model from the GMI MaaS library. Billed per token used.
              </p>

              <div className="space-y-2">
                {MAAS_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setConfig((c) => ({ ...c, model: model.id }))}
                    className="w-full text-left px-4 py-3 transition-all flex items-center justify-between"
                    style={{
                      background: config.model === model.id ? "rgba(221,234,77,0.06)" : "#0a0a0a",
                      border: `1px solid ${config.model === model.id ? "#DDEA4D" : "#2a2a2a"}`,
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-4 h-4 rounded-full border flex items-center justify-center"
                        style={{
                          borderColor: config.model === model.id ? "#DDEA4D" : "#444",
                          background: config.model === model.id ? "#DDEA4D" : "transparent",
                        }}
                      >
                        {config.model === model.id && (
                          <div className="w-2 h-2 rounded-full bg-black" />
                        )}
                      </div>
                      <span
                        className="font-mono-gmi text-sm"
                        style={{ color: config.model === model.id ? "#fff" : "#888" }}
                      >
                        {model.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 font-mono-gmi text-xs text-gray-600">
                      <span>{model.context} ctx</span>
                      <span
                        className="px-2 py-0.5"
                        style={{ background: "#111", border: "1px solid #2a2a2a" }}
                      >
                        {model.category}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Summary */}
              <div
                className="p-5 space-y-4 mt-6"
                style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
              >
                <h3 className="font-display text-sm text-white">Deployment Summary</h3>
                {[
                  { label: "Compute", value: `Option ${config.computeTier} — ${selectedTier.cpu} CPU · ${selectedTier.ram} RAM · ${selectedTier.storage}` },
                  { label: "Storage", value: config.storageMode === "shared" ? "Shared (data-isolated)" : "Fully isolated" },
                  { label: "Containers", value: `~${config.containerCount} concurrent` },
                  { label: "Model", value: selectedModel.name },
                ].map(({ label, value }) => (
                  <div key={label} className="grid grid-cols-3 gap-4">
                    <div className="gmi-label text-gray-600">{label}</div>
                    <div className="col-span-2 font-mono-gmi text-sm text-gray-300">{value}</div>
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
                  Billing begins immediately upon deployment. Container and model usage are billed
                  separately. You can upgrade to a Reserved Plan from the Developer Console for
                  discounted rates.
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
                Deploy Now <ArrowRight size={14} />
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
