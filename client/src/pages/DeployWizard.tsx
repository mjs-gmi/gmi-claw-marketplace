import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, CheckCircle, Server, Cpu, Github,
  Upload, Terminal, Zap, Plus, Trash2, Eye, EyeOff, Info,
  ToggleLeft, ToggleRight, Lock,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";

// ─── Constants ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 0, label: "Basic Info" },
  { id: 1, label: "Infrastructure" },
  { id: 2, label: "Env Variables" },
  { id: 3, label: "Review & Deploy" },
];

const COMPUTE_TIERS = [
  { id: "A", cpu: "4 cores", ram: "32 GiB", storage: "1 TiB NVMe", priceHr: 0.72, label: "Tier A", note: "High-memory workloads" },
  { id: "B", cpu: "2 cores", ram: "16 GiB", storage: "200 GiB NVMe", priceHr: 0.36, label: "Tier B", note: "Medium workloads" },
  { id: "C", cpu: "1 core", ram: "8 GiB", storage: "100 GiB NVMe", priceHr: 0.18, label: "Tier C", note: "Recommended for most Claws", recommended: true },
  { id: "D", cpu: "1 core", ram: "4 GiB", storage: "50 GiB NVMe", priceHr: 0.08, label: "Tier D", note: "Lightweight tasks" },
];

const MAAS_MODELS = [
  { id: "llama-3-1-70b", name: "Llama 3.1 70B", context: "128K", tokensPerDollar: "1M" },
  { id: "llama-3-1-8b", name: "Llama 3.1 8B", context: "128K", tokensPerDollar: "5M" },
  { id: "deepseek-coder-v2", name: "DeepSeek-Coder V2", context: "128K", tokensPerDollar: "2M" },
  { id: "deepseek-r1-32b", name: "DeepSeek-R1 32B", context: "64K", tokensPerDollar: "1.5M" },
  { id: "qwen2-5-72b", name: "Qwen2.5 72B", context: "128K", tokensPerDollar: "1.2M" },
  { id: "qwen2-5-7b", name: "Qwen2.5 7B", context: "128K", tokensPerDollar: "8M" },
  { id: "mixtral-8x7b", name: "Mixtral 8x7B", context: "32K", tokensPerDollar: "2.5M" },
  { id: "gemma-2-27b", name: "Gemma 2 27B", context: "8K", tokensPerDollar: "3M" },
];

// ─── Shared primitives ──────────────────────────────────────────────────────
function RadioCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="w-full text-left p-4 transition-all"
      style={{ background: selected ? "rgba(221,234,77,0.06)" : "#0a0a0a", border: `1px solid ${selected ? "#DDEA4D" : "#2a2a2a"}` }}>
      {children}
    </button>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
      style={{ borderColor: selected ? "#DDEA4D" : "#444", background: selected ? "#DDEA4D" : "transparent" }}>
      {selected && <div className="w-2 h-2 rounded-full bg-black" />}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block font-mono-gmi text-xs text-gray-500 uppercase tracking-widest mb-1.5">{children}</label>;
}

function TextInput({ label, placeholder, value, onChange, mono = false, hint }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; mono?: boolean; hint?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 text-sm text-white bg-transparent outline-none transition-all"
        style={{ border: "1px solid #2a2a2a", fontFamily: mono ? "var(--font-mono-gmi)" : undefined }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
      {hint && <p className="text-xs text-gray-600 font-mono-gmi mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ on, onToggle, label, desc }: { on: boolean; onToggle: () => void; label: string; desc: string }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between p-4 transition-all text-left"
      style={{ background: on ? "rgba(221,234,77,0.04)" : "#0a0a0a", border: `1px solid ${on ? "rgba(221,234,77,0.3)" : "#2a2a2a"}` }}>
      <div>
        <div className="font-mono-gmi text-sm font-bold" style={{ color: on ? "#DDEA4D" : "#888" }}>{label}</div>
        <div className="font-mono-gmi text-xs text-gray-600 mt-0.5">{desc}</div>
      </div>
      <div className="shrink-0 ml-4">
        {on
          ? <ToggleRight size={24} style={{ color: "#DDEA4D" }} />
          : <ToggleLeft size={24} style={{ color: "#444" }} />}
      </div>
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function DeployWizard() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [deployed, setDeployed] = useState(false);

  // Step 0 — Basic Info
  const [projectName, setProjectName] = useState("");

  // Step 1 — Infrastructure
  const [useCompute, setUseCompute] = useState(true);
  const [dockerSource, setDockerSource] = useState<"registry" | "upload">("registry");
  const [dockerUrl, setDockerUrl] = useState("");
  const [computeTier, setComputeTier] = useState("C");
  const [storageMode, setStorageMode] = useState<"shared" | "dedicated">("shared");
  const [minContainers, setMinContainers] = useState("1");
  const [maxContainers, setMaxContainers] = useState("5");

  const [useMaaS, setUseMaaS] = useState(true);
  const [selectedModels, setSelectedModels] = useState<string[]>(["llama-3-1-70b"]);

  // Step 2 — Env Vars
  const [envVars, setEnvVars] = useState<{ key: string; value: string; secret: boolean }[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});

  // Cost calc
  const tier = COMPUTE_TIERS.find((t) => t.id === computeTier)!;
  const minCost = useCompute ? (parseInt(minContainers) || 1) * tier.priceHr : 0;
  const maxCost = useCompute ? (parseInt(maxContainers) || 1) * tier.priceHr : 0;

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const addEnvVar = () => setEnvVars((v) => [...v, { key: "", value: "", secret: false }]);
  const removeEnvVar = (i: number) => setEnvVars((v) => v.filter((_, idx) => idx !== i));
  const updateEnvVar = (i: number, field: "key" | "value" | "secret", val: string | boolean) =>
    setEnvVars((v) => v.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const handleDeploy = () => {
    setDeployed(true);
    toast.success("Private deployment initiated", {
      description: "Your Claw is being provisioned. Billing has started.",
    });
  };

  // ── Deployed success screen ────────────────────────────────────────────
  if (deployed) {
    const privateUrl = `https://${projectName.toLowerCase().replace(/\s+/g, "-") || "my-claw"}.private.gmi.ai`;
    const maasKey = "gmi_maas_sk_" + Math.random().toString(36).slice(2, 18);

    return (
      <div className="min-h-screen flex bg-black text-white">
        <Navbar />
        <div className="flex-1" style={{ marginLeft: "220px" }}>
          <div className="pt-12 pb-20 px-8 max-w-2xl">
            {/* Status header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#DDEA4D" }} />
              <span className="font-mono-gmi text-xs uppercase tracking-widest" style={{ color: "#DDEA4D" }}>
                Running Privately
              </span>
            </div>

            <h1 className="font-display text-3xl text-white mb-1" style={{ letterSpacing: "-0.03em" }}>
              {projectName || "Your Claw"} is deployed
            </h1>
            <p className="text-gray-500 text-sm font-mono-gmi mb-8">
              Private deployment active. Test your Claw before submitting for Marketplace review.
            </p>

            {/* Endpoints */}
            <div className="space-y-3 mb-8">
              {useCompute && (
                <div className="p-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <div className="font-mono-gmi text-xs text-gray-600 uppercase tracking-widest mb-2">Private Endpoint</div>
                  <div className="flex items-center justify-between gap-4">
                    <code className="font-mono-gmi text-sm text-white break-all">{privateUrl}</code>
                    <button onClick={() => { navigator.clipboard.writeText(privateUrl); toast.success("Copied"); }}
                      className="shrink-0 font-mono-gmi text-xs px-3 py-1.5 transition-all"
                      style={{ border: "1px solid #2a2a2a", color: "#888" }}>
                      Copy
                    </button>
                  </div>
                </div>
              )}
              {useMaaS && (
                <div className="p-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <div className="font-mono-gmi text-xs text-gray-600 uppercase tracking-widest mb-2">GMI MaaS API Key</div>
                  <div className="flex items-center justify-between gap-4">
                    <code className="font-mono-gmi text-sm text-white break-all">{maasKey}</code>
                    <button onClick={() => { navigator.clipboard.writeText(maasKey); toast.success("Copied"); }}
                      className="shrink-0 font-mono-gmi text-xs px-3 py-1.5 transition-all"
                      style={{ border: "1px solid #2a2a2a", color: "#888" }}>
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: "Infrastructure State", value: "Running (Private)", color: "#DDEA4D" },
                { label: "Marketplace State", value: "Not Listed", color: "#888" },
                { label: "Billing", value: "Active", color: "#DDEA4D" },
                { label: "Est. Daily Cost", value: `$${(minCost * 24).toFixed(2)} – $${(maxCost * 24).toFixed(2)}`, color: "#fff" },
              ].map((item) => (
                <div key={item.label} className="p-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <div className="font-mono-gmi text-xs text-gray-600 mb-1">{item.label}</div>
                  <div className="font-mono-gmi text-sm font-bold" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Next step banner */}
            <div className="p-5 mb-6" style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.2)" }}>
              <div className="font-mono-gmi text-xs uppercase tracking-widest mb-2" style={{ color: "#DDEA4D" }}>
                Next Step
              </div>
              <p className="text-sm text-gray-400 font-mono-gmi leading-relaxed">
                Test your Claw using the private endpoint above. When you're ready to go public,
                create a Marketplace Listing from your Project Dashboard.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setLocation("/dashboard")}
                className="btn-primary-lime px-6 py-2.5 text-sm font-bold flex items-center gap-2">
                Go to Dashboard <ArrowRight size={14} />
              </button>
              <button onClick={() => setLocation("/marketplace")}
                className="btn-outline-dashed px-6 py-2.5 text-sm">
                Marketplace
              </button>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // ── Wizard ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-black text-white">
      <Navbar />
      <div className="flex-1" style={{ marginLeft: "220px" }}>
        <div className="pt-8 pb-20">
          <div className="px-8 max-w-3xl">

            {/* Back */}
            <button onClick={() => setLocation("/dashboard")}
              className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-mono-gmi text-xs mb-10">
              <ArrowLeft size={13} /> Back to Console
            </button>

            {/* Header */}
            <div className="mb-10">
              <div className="gmi-label mb-2">Developer Console · New Claw Project</div>
              <h1 className="font-display text-4xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
                Deploy a Claw
              </h1>
              <p className="text-gray-500 text-sm font-mono-gmi">
                Configure infrastructure and deploy privately. Publish to the Marketplace after testing.
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-0 mb-10">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 flex items-center justify-center text-xs font-mono-gmi font-bold shrink-0"
                      style={{ background: i <= step ? "#DDEA4D" : "#111", color: i <= step ? "#000" : "#555", border: i <= step ? "none" : "1px solid #2a2a2a" }}>
                      {i < step ? "✓" : i + 1}
                    </div>
                    <span className="text-xs font-mono-gmi hidden sm:inline whitespace-nowrap"
                      style={{ color: i === step ? "#fff" : "#555" }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-8 h-px mx-3 shrink-0" style={{ background: i < step ? "#DDEA4D" : "#2a2a2a" }} />
                  )}
                </div>
              ))}
            </div>

            {/* ── STEP 0: Basic Info ──────────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Server size={15} style={{ color: "#DDEA4D" }} />
                  <h2 className="font-display text-lg text-white">Basic Info</h2>
                </div>
                <TextInput
                  label="Internal Project Name *"
                  placeholder="e.g. contract-review-v2"
                  value={projectName}
                  onChange={setProjectName}
                  mono
                  hint="This is your internal identifier — not shown publicly on the Marketplace."
                />
                <div className="flex items-start gap-3 p-4 font-mono-gmi text-xs"
                  style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.15)", color: "#DDEA4D" }}>
                  <Info size={13} className="shrink-0 mt-0.5" />
                  <span>
                    Your Marketplace listing name and description are configured separately after deployment.
                    This keeps your internal project name private.
                  </span>
                </div>
              </div>
            )}

            {/* ── STEP 1: Infrastructure ──────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-8">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu size={15} style={{ color: "#DDEA4D" }} />
                  <h2 className="font-display text-lg text-white">Infrastructure Selection</h2>
                </div>
                <p className="text-xs text-gray-600 font-mono-gmi -mt-4">
                  Select Compute, MaaS, or both. At least one GMI component is required.
                </p>

                {/* 2A: Compute */}
                <div>
                  <Toggle
                    on={useCompute}
                    onToggle={() => setUseCompute((v) => !v)}
                    label="GMI Compute — Host my Claw on GMI infrastructure"
                    desc="Provision a VM to run your Claw's Docker container"
                  />

                  {useCompute && (
                    <div className="mt-4 space-y-5 pl-4" style={{ borderLeft: "2px solid rgba(221,234,77,0.2)" }}>

                      {/* Docker image */}
                      <div>
                        <FieldLabel>Docker Image Source</FieldLabel>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {[
                            { id: "registry" as const, icon: Github, label: "Registry URL" },
                            { id: "upload" as const, icon: Upload, label: "Upload Image" },
                          ].map((opt) => (
                            <RadioCard key={opt.id} selected={dockerSource === opt.id} onClick={() => setDockerSource(opt.id)}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <opt.icon size={13} style={{ color: dockerSource === opt.id ? "#DDEA4D" : "#555" }} />
                                  <span className="font-mono-gmi text-xs font-bold" style={{ color: dockerSource === opt.id ? "#DDEA4D" : "#888" }}>
                                    {opt.label}
                                  </span>
                                </div>
                                <RadioDot selected={dockerSource === opt.id} />
                              </div>
                            </RadioCard>
                          ))}
                        </div>
                        {dockerSource === "registry" ? (
                          <TextInput
                            label="Registry URL"
                            placeholder="registry.hub.docker.com/your-org/your-claw:latest"
                            value={dockerUrl}
                            onChange={setDockerUrl}
                            mono
                          />
                        ) : (
                          <div className="p-6 text-center font-mono-gmi text-xs text-gray-600 cursor-pointer transition-all"
                            style={{ border: "1px dashed #2a2a2a" }}
                            onClick={() => toast.info("File upload coming soon — use Registry URL for now.")}>
                            <Upload size={18} className="mx-auto mb-2" style={{ color: "#444" }} />
                            Click to upload Docker image (.tar.gz)
                            <br /><span style={{ color: "#555" }}>Max 2 GB</span>
                          </div>
                        )}
                      </div>

                      {/* Compute tier */}
                      <div>
                        <FieldLabel>Compute Tier</FieldLabel>
                        <div className="space-y-2">
                          {COMPUTE_TIERS.map((t) => (
                            <RadioCard key={t.id} selected={computeTier === t.id} onClick={() => setComputeTier(t.id)}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono-gmi text-sm font-bold" style={{ color: computeTier === t.id ? "#DDEA4D" : "#888" }}>
                                    {t.label}
                                  </span>
                                  {t.recommended && (
                                    <span className="text-xs font-mono-gmi px-2 py-0.5" style={{ background: "rgba(221,234,77,0.15)", color: "#DDEA4D" }}>
                                      Recommended
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono-gmi text-xs" style={{ color: computeTier === t.id ? "#DDEA4D" : "#555" }}>
                                    ${t.priceHr.toFixed(2)}/hr
                                  </span>
                                  <RadioDot selected={computeTier === t.id} />
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-3 font-mono-gmi text-xs text-gray-500">
                                <span><span className="text-gray-700">CPU</span> {t.cpu}</span>
                                <span><span className="text-gray-700">RAM</span> {t.ram}</span>
                                <span><span className="text-gray-700">Storage</span> {t.storage}</span>
                              </div>
                            </RadioCard>
                          ))}
                        </div>
                      </div>

                      {/* Storage mode */}
                      <div>
                        <FieldLabel>Storage Mode</FieldLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "shared" as const, label: "Shared", desc: "Data-isolated between containers" },
                            { id: "dedicated" as const, label: "Dedicated", desc: "Fully isolated per container" },
                          ].map((opt) => (
                            <RadioCard key={opt.id} selected={storageMode === opt.id} onClick={() => setStorageMode(opt.id)}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-mono-gmi text-sm font-bold" style={{ color: storageMode === opt.id ? "#DDEA4D" : "#888" }}>
                                  {opt.label}
                                </span>
                                <RadioDot selected={storageMode === opt.id} />
                              </div>
                              <p className="text-xs text-gray-600 font-mono-gmi">{opt.desc}</p>
                            </RadioCard>
                          ))}
                        </div>
                      </div>

                      {/* Auto-scaling */}
                      <div>
                        <FieldLabel>Auto-Scaling Configuration</FieldLabel>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block font-mono-gmi text-xs text-gray-600 mb-1.5">
                              Min Containers <span className="text-gray-700">(≥ 1, no cold starts)</span>
                            </label>
                            <input type="number" min="1" value={minContainers}
                              onChange={(e) => setMinContainers(e.target.value)}
                              className="w-full px-4 py-3 text-sm text-white bg-transparent outline-none font-mono-gmi"
                              style={{ border: "1px solid #2a2a2a" }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = "#2a2a2a";
                                if (parseInt(e.target.value) < 1) setMinContainers("1");
                              }} />
                          </div>
                          <div>
                            <label className="block font-mono-gmi text-xs text-gray-600 mb-1.5">Max Containers</label>
                            <input type="number" min={minContainers} value={maxContainers}
                              onChange={(e) => setMaxContainers(e.target.value)}
                              className="w-full px-4 py-3 text-sm text-white bg-transparent outline-none font-mono-gmi"
                              style={{ border: "1px solid #2a2a2a" }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                          </div>
                        </div>
                        <p className="text-xs text-gray-700 font-mono-gmi mt-2">
                          Billing is based on active containers × tier price. Min containers are always running.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2B: MaaS */}
                <div>
                  <Toggle
                    on={useMaaS}
                    onToggle={() => setUseMaaS((v) => !v)}
                    label="GMI MaaS — Access 200+ frontier models"
                    desc="Get a GMI MaaS API key injected into your container automatically"
                  />

                  {useMaaS && (
                    <div className="mt-4 space-y-3 pl-4" style={{ borderLeft: "2px solid rgba(221,234,77,0.2)" }}>
                      <FieldLabel>Select Models</FieldLabel>
                      <p className="text-xs text-gray-600 font-mono-gmi -mt-1">
                        Select all models your Claw may call. You can change this later.
                      </p>
                      <div className="space-y-2">
                        {MAAS_MODELS.map((model) => {
                          const sel = selectedModels.includes(model.id);
                          return (
                            <button key={model.id} onClick={() => toggleModel(model.id)}
                              className="w-full text-left px-4 py-3 transition-all flex items-center justify-between"
                              style={{ background: sel ? "rgba(221,234,77,0.06)" : "#0a0a0a", border: `1px solid ${sel ? "#DDEA4D" : "#2a2a2a"}` }}>
                              <div className="flex items-center gap-3">
                                <div className="w-4 h-4 flex items-center justify-center shrink-0"
                                  style={{ border: `1px solid ${sel ? "#DDEA4D" : "#444"}`, background: sel ? "#DDEA4D" : "transparent" }}>
                                  {sel && <div className="w-2 h-2 bg-black" />}
                                </div>
                                <span className="font-mono-gmi text-sm" style={{ color: sel ? "#fff" : "#888" }}>
                                  {model.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 font-mono-gmi text-xs text-gray-600">
                                <span>{model.context} ctx</span>
                                <span>{model.tokensPerDollar} tok/$</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Prerequisite warning */}
                {!useCompute && !useMaaS && (
                  <div className="flex items-start gap-3 p-4 font-mono-gmi text-xs"
                    style={{ background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.3)", color: "#ff8080" }}>
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <span>
                      At least one GMI infrastructure component (Compute or MaaS) is required to list on the Marketplace.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Environment Variables ──────────────────────── */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal size={15} style={{ color: "#DDEA4D" }} />
                  <h2 className="font-display text-lg text-white">Environment Variables</h2>
                </div>

                {/* Auto-injected vars */}
                <div>
                  <FieldLabel>Auto-Injected by GMI</FieldLabel>
                  <div className="space-y-2">
                    {useMaaS && (
                      <>
                        <div className="flex items-center gap-3 px-4 py-3 font-mono-gmi text-xs"
                          style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                          <Lock size={12} style={{ color: "#DDEA4D" }} />
                          <span style={{ color: "#DDEA4D" }}>GMI_MAAS_API_KEY</span>
                          <span className="text-gray-700 ml-auto">Auto-generated on deploy</span>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3 font-mono-gmi text-xs"
                          style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                          <Lock size={12} style={{ color: "#DDEA4D" }} />
                          <span style={{ color: "#DDEA4D" }}>GMI_MAAS_BASE_URL</span>
                          <span className="text-gray-700 ml-auto">https://api.gmi.ai/v1</span>
                        </div>
                      </>
                    )}
                    {!useMaaS && (
                      <p className="text-xs text-gray-600 font-mono-gmi px-1">
                        No auto-injected variables — MaaS is disabled.
                      </p>
                    )}
                  </div>
                </div>

                {/* Custom env vars */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <FieldLabel>Custom Variables</FieldLabel>
                    <button onClick={addEnvVar}
                      className="flex items-center gap-1.5 font-mono-gmi text-xs px-3 py-1.5 transition-all"
                      style={{ border: "1px solid #2a2a2a", color: "#888" }}>
                      <Plus size={12} /> Add Variable
                    </button>
                  </div>

                  {envVars.length === 0 ? (
                    <p className="text-xs text-gray-700 font-mono-gmi px-1">
                      No custom variables. Click "Add Variable" to add database URIs, API keys, or other config.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {envVars.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input placeholder="KEY_NAME" value={v.key}
                            onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                            className="w-40 px-3 py-2.5 text-xs text-white bg-transparent outline-none font-mono-gmi shrink-0"
                            style={{ border: "1px solid #2a2a2a" }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                            onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                          <div className="flex-1 flex items-center gap-0">
                            <input
                              type={v.secret && !showSecrets[i] ? "password" : "text"}
                              placeholder="value"
                              value={v.value}
                              onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                              className="flex-1 px-3 py-2.5 text-xs text-white bg-transparent outline-none font-mono-gmi"
                              style={{ border: "1px solid #2a2a2a", borderRight: "none" }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                            <button onClick={() => setShowSecrets((s) => ({ ...s, [i]: !s[i] }))}
                              className="px-3 py-2.5 transition-all"
                              style={{ border: "1px solid #2a2a2a", borderLeft: "none", color: "#555" }}>
                              {showSecrets[i] ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                          <button onClick={() => updateEnvVar(i, "secret", !v.secret)}
                            className="shrink-0 px-3 py-2.5 font-mono-gmi text-xs transition-all"
                            style={{
                              border: `1px solid ${v.secret ? "rgba(221,234,77,0.3)" : "#2a2a2a"}`,
                              color: v.secret ? "#DDEA4D" : "#555",
                              background: v.secret ? "rgba(221,234,77,0.06)" : "transparent",
                            }}>
                            Secret
                          </button>
                          <button onClick={() => removeEnvVar(i)}
                            className="shrink-0 p-2.5 transition-all"
                            style={{ border: "1px solid #2a2a2a", color: "#555" }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 3: Review & Deploy ──────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={15} style={{ color: "#DDEA4D" }} />
                  <h2 className="font-display text-lg text-white">Review & Deploy Privately</h2>
                </div>

                {/* Config summary */}
                <div className="p-5 space-y-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <p className="font-mono-gmi text-xs text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-3">
                    Configuration Summary
                  </p>
                  {[
                    { label: "Project Name", value: projectName || "—" },
                    ...(useCompute ? [
                      { label: "Docker Image", value: dockerSource === "registry" ? (dockerUrl || "Not set") : "Uploaded file" },
                      { label: "Compute Tier", value: `${tier.label} — ${tier.cpu} · ${tier.ram} · $${tier.priceHr.toFixed(2)}/hr` },
                      { label: "Storage", value: storageMode === "shared" ? "Shared (data-isolated)" : "Dedicated" },
                      { label: "Auto-Scaling", value: `Min ${minContainers} → Max ${maxContainers} containers` },
                    ] : [{ label: "Compute", value: "Not used" }]),
                    { label: "MaaS", value: useMaaS ? `${selectedModels.length} model(s) selected` : "Not used" },
                    { label: "Custom Env Vars", value: envVars.length > 0 ? `${envVars.length} variable(s)` : "None" },
                  ].map(({ label, value }) => (
                    <div key={label} className="grid grid-cols-3 gap-4">
                      <div className="gmi-label text-gray-600">{label}</div>
                      <div className="col-span-2 font-mono-gmi text-sm text-gray-300 break-all">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Cost estimate */}
                {useCompute && (
                  <div className="p-5 space-y-3" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                    <p className="font-mono-gmi text-xs text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-3">
                      Cost Estimate
                    </p>
                    <div className="grid grid-cols-3 gap-4 font-mono-gmi text-sm">
                      <div>
                        <div className="text-gray-600 text-xs mb-1">Base (Min containers)</div>
                        <div className="text-white font-bold">${minCost.toFixed(2)}/hr</div>
                        <div className="text-gray-600 text-xs mt-0.5">${(minCost * 24).toFixed(2)}/day</div>
                      </div>
                      <div>
                        <div className="text-gray-600 text-xs mb-1">Max (Max containers)</div>
                        <div className="text-white font-bold">${maxCost.toFixed(2)}/hr</div>
                        <div className="text-gray-600 text-xs mt-0.5">${(maxCost * 24).toFixed(2)}/day</div>
                      </div>
                      <div>
                        <div className="text-gray-600 text-xs mb-1">MaaS Tokens</div>
                        <div className="text-gray-500 font-bold text-xs mt-1">Billed per token used</div>
                      </div>
                    </div>
                    <div className="h-1.5 w-full" style={{ background: "#1a1a1a" }}>
                      <div className="h-full" style={{ width: `${Math.min((minCost / maxCost) * 100, 100)}%`, background: "#DDEA4D" }} />
                    </div>
                    <p className="text-xs text-gray-700 font-mono-gmi">
                      Billing begins immediately upon clicking "Deploy Privately". You can stop containers from the Developer Console.
                    </p>
                  </div>
                )}

                {/* Decoupled flow notice */}
                <div className="p-4 font-mono-gmi text-xs" style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.2)" }}>
                  <div className="font-bold mb-1" style={{ color: "#DDEA4D" }}>Deployment ≠ Publishing</div>
                  <p className="text-gray-400 leading-relaxed">
                    Clicking "Deploy Privately" provisions your infrastructure and starts billing, but does <strong>not</strong> publish
                    your Claw to the public Marketplace. After testing, you can create a Marketplace Listing from your Project Dashboard.
                    GMI reviews listings within 3 business days.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-10">
              <button
                onClick={() => (step === 0 ? setLocation("/dashboard") : setStep(step - 1))}
                className="btn-outline-dashed px-6 py-2.5 text-sm flex items-center gap-2">
                <ArrowLeft size={14} />
                {step === 0 ? "Back to Console" : "Back"}
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => {
                    if (step === 1 && !useCompute && !useMaaS) {
                      toast.error("Select at least one GMI infrastructure component.");
                      return;
                    }
                    setStep(step + 1);
                  }}
                  className="btn-primary-lime px-8 py-2.5 text-sm font-bold flex items-center gap-2">
                  Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button onClick={handleDeploy}
                  className="px-8 py-2.5 text-sm font-bold flex items-center gap-2 transition-all"
                  style={{ background: "#DDEA4D", color: "#000" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#e8f060")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#DDEA4D")}>
                  Deploy Privately <Zap size={14} />
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
