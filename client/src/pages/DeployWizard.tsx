import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, ArrowRight, CheckCircle, Server, Cpu, Github,
  Upload, Terminal, Zap, Plus, Trash2, Eye, EyeOff, Info,
  ToggleLeft, ToggleRight, Lock, Search, X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
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
  {
    id: "performance",
    label: "Performance",
    cpu: "32 vCPU",
    ram: "128 GB",
    net: "25 Gbps",
    priceHr: 1.20,
    note: "High-concurrency agents, heavy orchestration workloads",
    recommended: false,
  },
  {
    id: "standard",
    label: "Standard",
    cpu: "16 vCPU",
    ram: "64 GB",
    net: "10 Gbps",
    priceHr: 0.60,
    note: "Most agent workloads — API orchestration, RAG, tool-use",
    recommended: true,
  },
  {
    id: "economy",
    label: "Economy",
    cpu: "4 vCPU",
    ram: "16 GB",
    net: "1 Gbps",
    priceHr: 0.15,
    note: "Lightweight agents, low-traffic or dev/test deployments",
    recommended: false,
  },
];

const IDC_REGIONS = [
  { id: "us-west", label: "US West", flag: "🇺🇸" },
  { id: "us-east", label: "US East", flag: "🇺🇸" },
  { id: "asia-sg", label: "Asia (Singapore)", flag: "🇸🇬" },
  { id: "eu-de", label: "Europe (Germany)", flag: "🇩🇪" },
];

const MAAS_MODELS = [
  { id: "claude-opus-4", name: "Claude Opus 4", context: "200K", tokensPerDollar: "" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", context: "200K", tokensPerDollar: "" },
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
      style={{ borderColor: selected ? "#DDEA4D" : "#888", background: selected ? "#DDEA4D" : "transparent" }}>
      {selected && <div className="w-2 h-2 rounded-full bg-black" />}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block font-mono-gmi text-xs text-gray-300 uppercase tracking-widest mb-1.5">{children}</label>;
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
      {hint && <p className="text-xs text-gray-400 font-mono-gmi mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ on, onToggle, label, desc }: { on: boolean; onToggle: () => void; label: string; desc: string }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between p-4 transition-all text-left"
      style={{ background: on ? "rgba(221,234,77,0.04)" : "#0a0a0a", border: `1px solid ${on ? "rgba(221,234,77,0.3)" : "#2a2a2a"}` }}>
      <div>
        <div className="font-mono-gmi text-sm font-bold" style={{ color: on ? "#DDEA4D" : "#888" }}>{label}</div>
        <div className="font-mono-gmi text-xs text-gray-400 mt-0.5">{desc}</div>
      </div>
      <div className="shrink-0 ml-4">
        {on
          ? <ToggleRight size={24} style={{ color: "#DDEA4D" }} />
          : <ToggleLeft size={24} style={{ color: "#888" }} />}
      </div>
    </button>
  );
}

// ─── Tab 2 steps ────────────────────────────────────────────────────────────
const STEPS_TAB2 = [
  { id: 0, label: "MaaS Key" },
  { id: 1, label: "Endpoint" },
  { id: 2, label: "Review & Submit" },
];

// ─── Main component ─────────────────────────────────────────────────────────
export default function DeployWizard() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [deployed, setDeployed] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState(0);

  // Tab state
  const [activeTab, setActiveTab] = useState<"ce" | "selfhosted">("ce");
  const [nudgeShownThisSession, setNudgeShownThisSession] = useState(false);
  const [showNudge, setShowNudge] = useState(false);

  // Tab 2 state
  const [tab2Step, setTab2Step] = useState(0);
  const [tab2MaasKey, setTab2MaasKey] = useState("");
  const [tab2Endpoint, setTab2Endpoint] = useState("");
  const [tab2Submitted, setTab2Submitted] = useState(false);
  const [tab2Submitting, setTab2Submitting] = useState(false);

  const switchToSelfHosted = () => {
    if (!nudgeShownThisSession) {
      setShowNudge(true);
    } else {
      setActiveTab("selfhosted");
      setTab2Step(0);
    }
  };

  // Step 0 — Basic Info
  const [projectName, setProjectName] = useState("");

  // Step 1 — Infrastructure
  const [useCompute] = useState(true); // always true in Tab 1
  const [dockerSource, setDockerSource] = useState<"registry" | "upload">("registry");
  const [dockerUrl, setDockerUrl] = useState("");
  const [computeTier, setComputeTier] = useState("standard");
  const [idcRegion, setIdcRegion] = useState("us-west");
  const [storageMode, setStorageMode] = useState<"shared" | "dedicated">("shared");
  const [minContainers, setMinContainers] = useState("1");
  const [maxContainers, setMaxContainers] = useState("5");

  const [useMaaS, setUseMaaS] = useState(true);
  const [selectedModels, setSelectedModels] = useState<string[]>(["llama-3-1-70b"]);
  const [modelSearch, setModelSearch] = useState("");

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

  const DEPLOY_STEPS = [
    { label: "Validating image URL", duration: 1200 },
    { label: "Inspecting container environment", duration: 1800 },
    { label: "Registering template in CE", duration: 1400 },
    { label: "Storing infrastructure configuration", duration: 1000 },
    { label: "Running pre-publish checks", duration: 1200 },
    { label: "Publishing template", duration: 900 },
  ];

  const handleDeploy = () => {
    setDeploying(true);
    setDeployStep(0);
    let current = 0;
    const advance = () => {
      current += 1;
      if (current < DEPLOY_STEPS.length) {
        setDeployStep(current);
        setTimeout(advance, DEPLOY_STEPS[current].duration);
      } else {
        // All steps done — show success
        setTimeout(() => {
          setDeploying(false);
          setDeployed(true);
          toast.success("Claw registered and deployed", {
            description: "Your Claw is live on GMI infrastructure.",
          });
        }, 600);
      }
    };
    setTimeout(advance, DEPLOY_STEPS[0].duration);
  };

  // ── Deploying loading screen ──────────────────────────────────────────
  if (deploying) {
    const totalSteps = DEPLOY_STEPS.length;
    const progress = Math.round(((deployStep + 1) / totalSteps) * 100);
    return (
      <div className="min-h-screen flex bg-black text-white">
        <Topbar />
      <Navbar />
        <div className="flex-1 flex items-center justify-center" style={{ marginLeft: "210px", paddingTop: "40px" }}>
          <div className="w-full max-w-lg px-8">
            {/* Animated GMI logo pulse */}
            <div className="flex items-center gap-3 mb-10">
              <div className="relative w-8 h-8">
                <div
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ background: "rgba(221,234,77,0.25)" }}
                />
                <div
                  className="relative w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(221,234,77,0.15)", border: "1px solid rgba(221,234,77,0.4)" }}
                >
                  <Zap size={14} style={{ color: "#DDEA4D" }} />
                </div>
              </div>
              <span className="font-mono-gmi text-xs uppercase tracking-widest" style={{ color: "#DDEA4D" }}>
                Registering Claw
              </span>
            </div>

            <h2 className="font-display text-2xl text-white mb-1" style={{ letterSpacing: "-0.03em" }}>
              {projectName || "Your Claw"}
            </h2>
            <p className="text-gray-400 text-xs font-mono-gmi mb-8">
              GMI Cluster Engine is provisioning your Claw infrastructure...
            </p>

            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex justify-between font-mono-gmi text-xs text-gray-400 mb-2">
                <span>Progress</span>
                <span style={{ color: "#DDEA4D" }}>{progress}%</span>
              </div>
              <div className="w-full h-1" style={{ background: "#1a1a1a" }}>
                <div
                  className="h-1 transition-all duration-500"
                  style={{ width: `${progress}%`, background: "#DDEA4D" }}
                />
              </div>
            </div>

            {/* Step list */}
            <div className="space-y-3">
              {DEPLOY_STEPS.map((s, i) => {
                const done = i < deployStep;
                const active = i === deployStep;
                return (
                  <div key={i} className="flex items-center gap-3">
                    {/* Status icon */}
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      {done ? (
                        <CheckCircle size={14} style={{ color: "#DDEA4D" }} />
                      ) : active ? (
                        <div
                          className="w-3 h-3 rounded-full animate-pulse"
                          style={{ background: "#DDEA4D" }}
                        />
                      ) : (
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ background: "#2a2a2a" }}
                        />
                      )}
                    </div>
                    <span
                      className="font-mono-gmi text-sm"
                      style={{
                        color: done ? "#888" : active ? "#fff" : "#777",
                        textDecoration: done ? "line-through" : "none",
                      }}
                    >
                      {s.label}
                      {active && (
                        <span style={{ color: "#DDEA4D" }}>
                          {" "}...
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer note */}
            <p className="font-mono-gmi text-xs text-gray-300 mt-10">
              Do not close this window. You will be redirected automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Published success screen ────────────────────────────────────────────
  if (deployed) {
    const templateId = "tpl_" + Math.random().toString(36).slice(2, 14);
    const slug = projectName.toLowerCase().replace(/\s+/g, "-") || "my-claw";
    const listUrl = `/list-claw?from=deploy&templateId=${encodeURIComponent(templateId)}&projectName=${encodeURIComponent(projectName || slug)}&useMaaS=${useMaaS}`;

    const codeSnippet = `# Step 1: Provision a container
curl -X POST https://console.gmicloud.ai/api/v1/containers \\
  -H "Authorization: Bearer {your_api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "${slug}-instance",
    "templateId": "${templateId}",
    "product": "{cpu_tier}",
    "idc": "{data_center}",
    "count": 1
  }'

# Step 2: Poll for running status + endpoint
curl https://console.gmicloud.ai/api/v1/containers/{container_id} \\
  -H "Authorization: Bearer {your_api_key}"
# Wait until status = "running", then use publicIP + port

# Step 3: Terminate when done
curl -X DELETE https://console.gmicloud.ai/api/v1/containers/{container_id} \\
  -H "Authorization: Bearer {your_api_key}"`;

    return (
      <div className="min-h-screen flex bg-black text-white">
        <Topbar />
      <Navbar />
        <div className="flex-1" style={{ marginLeft: "210px", paddingTop: "40px" }}>
          <div className="pt-12 pb-20 px-8 max-w-2xl">
            {/* Status header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#DDEA4D" }} />
              <span className="font-mono-gmi text-xs uppercase tracking-widest" style={{ color: "#DDEA4D" }}>
                Template Published ✓
              </span>
            </div>

            <h1 className="font-display text-3xl text-white mb-1" style={{ letterSpacing: "-0.03em" }}>
              {projectName || "Your Claw"} is ready to provision
            </h1>
            <p className="text-gray-300 text-sm font-mono-gmi mb-8">
              Your template is published on GMI Cluster Engine. Enterprise callers can now provision user instances via the API.
              No containers are running yet — they are provisioned on demand.
            </p>

            {/* Template ID */}
            <div className="p-4 mb-4" style={{ background: "#0a0a0a", border: "1px solid rgba(221,234,77,0.3)" }}>
              <div className="font-mono-gmi text-xs uppercase tracking-widest mb-2" style={{ color: "#DDEA4D" }}>Template ID</div>
              <div className="flex items-center justify-between gap-4">
                <code className="font-mono-gmi text-sm text-white break-all">{templateId}</code>
                <button onClick={() => { navigator.clipboard.writeText(templateId); toast.success("Copied"); }}
                  className="shrink-0 font-mono-gmi text-xs px-3 py-1.5 transition-all"
                  style={{ border: "1px solid #DDEA4D", color: "#DDEA4D" }}>
                  Copy
                </button>
              </div>
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: "Template State", value: "Active", color: "#DDEA4D" },
                { label: "Marketplace State", value: "Not Listed", color: "#888" },
                { label: "Containers Running", value: "0 (on demand)", color: "#fff" },
                { label: "Billing", value: "Pay per provisioning", color: "#fff" },
              ].map((item) => (
                <div key={item.label} className="p-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <div className="font-mono-gmi text-xs text-gray-400 mb-1">{item.label}</div>
                  <div className="font-mono-gmi text-sm font-bold" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Provisioning code */}
            <div className="mb-6">
              <div className="font-mono-gmi text-xs text-gray-400 uppercase tracking-widest mb-2">
                How to provision user instances via API
              </div>
              <div className="relative" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                <button
                  onClick={() => { navigator.clipboard.writeText(codeSnippet); toast.success("Code copied"); }}
                  className="absolute top-3 right-3 font-mono-gmi text-xs px-2.5 py-1 transition-all"
                  style={{ border: "1px solid #2a2a2a", color: "#999", background: "#0a0a0a" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#999"; }}
                >
                  Copy
                </button>
                <pre className="p-4 font-mono-gmi text-xs text-gray-400 overflow-x-auto" style={{ lineHeight: 1.7, whiteSpace: "pre" }}>
                  {codeSnippet}
                </pre>
              </div>
            </div>

            {/* Next step banner */}
            <div className="p-5 mb-6" style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.2)" }}>
              <div className="font-mono-gmi text-xs uppercase tracking-widest mb-2" style={{ color: "#DDEA4D" }}>
                Next Step
              </div>
              <p className="text-sm text-gray-400 font-mono-gmi leading-relaxed">
                Integrate the provisioning API into your own system using the template_id above.
                When you're ready for broader distribution, list this Claw on the Marketplace.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setLocation(listUrl)}
                className="btn-primary-lime px-6 py-2.5 text-sm font-bold flex items-center gap-2">
                List this Claw <ArrowRight size={14} />
              </button>
              <button onClick={() => setLocation("/dashboard")}
                className="btn-outline-dashed px-6 py-2.5 text-sm">
                Go to Dashboard
              </button>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    );
  }



  // ── Tab 2 submitted screen ────────────────────────────────────────────────
  if (tab2Submitted) {
    return (
      <div className="min-h-screen flex bg-black text-white">
        <Topbar />
        <Navbar />
        <div className="flex-1" style={{ marginLeft: "210px", paddingTop: "40px" }}>
          <div className="pt-12 pb-20 px-8 max-w-2xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-2 rounded-full" style={{ background: "#DDEA4D" }} />
              <span className="font-mono-gmi text-xs uppercase tracking-widest" style={{ color: "#DDEA4D" }}>Listing Submitted ✓</span>
            </div>
            <h1 className="font-display text-3xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>Your Claw is under review</h1>
            <p className="text-gray-300 text-sm font-mono-gmi mb-8">
              We’ve received your self-hosted Claw submission. GMI will verify your MaaS key and endpoint before listing goes live.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: "Deployment Type", value: "Self-hosted + GMI MaaS", color: "#fff" },
                { label: "Badge", value: "Powered by GMI MaaS", color: "#60a5fa" },
                { label: "Marketplace State", value: "Pending Review", color: "#f59e0b" },
                { label: "Endpoint", value: tab2Endpoint || "—", color: "#fff" },
              ].map((item) => (
                <div key={item.label} className="p-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <div className="font-mono-gmi text-xs text-gray-400 mb-1">{item.label}</div>
                  <div className="font-mono-gmi text-sm font-bold break-all" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setLocation("/dashboard")}
                className="btn-primary-lime px-6 py-2.5 text-sm font-bold flex items-center gap-2">
                Go to My Claws <ArrowRight size={14} />
              </button>
              <button onClick={() => setLocation("/marketplace")}
                className="btn-outline-dashed px-6 py-2.5 text-sm">Browse Marketplace</button>
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
      <Topbar />
      <Navbar />

      {/* Nudge modal */}
      {showNudge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="w-full max-w-md p-8" style={{ background: "#111", border: "1px solid #2a2a2a" }}>
            <div className="font-mono-gmi text-xs uppercase tracking-widest mb-3" style={{ color: "#f59e0b" }}>⚠ Before you switch</div>
            <h3 className="font-display text-xl text-white mb-3" style={{ letterSpacing: "-0.02em" }}>You’ll miss out on bundle pricing</h3>
            <p className="text-sm text-gray-300 font-mono-gmi leading-relaxed mb-6">
              By switching to self-hosted, you lose access to GMI’s CE + MaaS bundle pricing and the <span style={{ color: "#DDEA4D" }}>Verified</span> badge.
              Self-hosted Claws receive the <span style={{ color: "#60a5fa" }}>Powered by GMI MaaS</span> badge only.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowNudge(false)}
                className="flex-1 btn-primary-lime py-2.5 text-sm font-bold">
                Stay on GMI Full Stack
              </button>
              <button
                onClick={() => { setShowNudge(false); setNudgeShownThisSession(true); setActiveTab("selfhosted"); setTab2Step(0); }}
                className="flex-1 py-2.5 text-sm font-mono-gmi transition-all"
                style={{ border: "1px solid #2a2a2a", color: "#888" }}>
                Continue to self-hosted
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1" style={{ marginLeft: "210px", paddingTop: "40px" }}>
        <div className="pt-8 pb-20">
          <div className="px-8 max-w-3xl">

            {/* Back */}
            <button onClick={() => setLocation("/dashboard")}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors font-mono-gmi text-xs mb-10">
              <ArrowLeft size={13} /> Back to Console
            </button>

            {/* Header */}
            <div className="mb-8">
              <div className="gmi-label mb-2">Developer Console · New Claw Project</div>
              <h1 className="font-display text-4xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
                Register a Claw
              </h1>
              <p className="text-gray-300 text-sm font-mono-gmi">
                Configure infrastructure and register your Claw. List it on the Marketplace after testing.
              </p>
            </div>



            {/* ── Tab switcher ─────────────────────────────────────────── */}
            <div className="flex mb-8" style={{ borderBottom: "1px solid #1e1e1e" }}>
              <button
                onClick={() => { setActiveTab("ce"); setStep(0); }}
                className="px-5 py-3 font-mono-gmi text-sm font-bold transition-all"
                style={{
                  borderBottom: activeTab === "ce" ? "2px solid #DDEA4D" : "2px solid transparent",
                  color: activeTab === "ce" ? "#DDEA4D" : "#888",
                  marginBottom: "-1px",
                }}>
                GMI CE Deployment
              </button>
              <button
                onClick={switchToSelfHosted}
                className="px-5 py-3 font-mono-gmi text-sm font-bold transition-all"
                style={{
                  borderBottom: activeTab === "selfhosted" ? "2px solid #60a5fa" : "2px solid transparent",
                  color: activeTab === "selfhosted" ? "#60a5fa" : "#888",
                  marginBottom: "-1px",
                }}>
                Self-hosted + MaaS
              </button>
            </div>

            {/* ── SELF-HOSTED CONTENT ────────────────────────────────────── */}
            {activeTab === "selfhosted" && (
              <div>
                <div className="flex items-center gap-0 mb-10">
                  {STEPS_TAB2.map((s, i) => (
                    <div key={s.id} className="flex items-center shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 flex items-center justify-center text-xs font-mono-gmi font-bold shrink-0"
                          style={{ background: i <= tab2Step ? "#60a5fa" : "#111", color: i <= tab2Step ? "#000" : "#999", border: i <= tab2Step ? "none" : "1px solid #2a2a2a" }}>
                          {i < tab2Step ? "✓" : i + 1}
                        </div>
                        <span className="text-xs font-mono-gmi hidden sm:inline whitespace-nowrap"
                          style={{ color: i === tab2Step ? "#fff" : "#999" }}>
                          {s.label}
                        </span>
                      </div>
                      {i < STEPS_TAB2.length - 1 && (
                        <div className="w-8 h-px mx-3 shrink-0" style={{ background: i < tab2Step ? "#60a5fa" : "#2a2a2a" }} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Badge notice */}
                <div className="flex items-start gap-3 p-4 mb-6 font-mono-gmi text-xs"
                  style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.25)" }}>
                  <Info size={13} className="shrink-0 mt-0.5" style={{ color: "#60a5fa" }} />
                  <span style={{ color: "#93c5fd" }}>
                    Self-hosted Claws receive the <strong>Powered by GMI MaaS</strong> badge. You host the compute; GMI provides the model layer only.
                  </span>
                </div>

                {/* Step 0: MaaS Key */}
                {tab2Step === 0 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={15} style={{ color: "#60a5fa" }} />
                      <h2 className="font-display text-lg text-white">GMI MaaS API Key</h2>
                    </div>
                    <p className="text-xs text-gray-300 font-mono-gmi -mt-2">
                      Provide a project-scoped MaaS API key. GMI will validate it before your listing goes live.
                    </p>
                    <TextInput
                      label="MaaS API Key *"
                      placeholder="gmi_sk_..."
                      value={tab2MaasKey}
                      onChange={setTab2MaasKey}
                      mono
                      hint="Create a project-scoped key in Console → Settings → API Keys."
                    />
                    <div className="flex items-start gap-3 p-4 font-mono-gmi text-xs"
                      style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.15)", color: "#DDEA4D" }}>
                      <Info size={13} className="shrink-0 mt-0.5" />
                      <span>
                        Your Claw must reference <code className="bg-black px-1">GMI_MAAS_API_KEY</code> in its code to call models.
                        GMI validates this key is active and project-scoped before approving your listing.
                      </span>
                    </div>
                  </div>
                )}

                {/* Step 1: External Endpoint */}
                {tab2Step === 1 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Server size={15} style={{ color: "#60a5fa" }} />
                      <h2 className="font-display text-lg text-white">External Endpoint URL</h2>
                    </div>
                    <p className="text-xs text-gray-300 font-mono-gmi -mt-2">
                      Provide the public URL where your Claw is hosted. This is what Enterprise callers will use to access your Claw.
                    </p>
                    <TextInput
                      label="Endpoint URL *"
                      placeholder="https://your-claw.yourdomain.com"
                      value={tab2Endpoint}
                      onChange={setTab2Endpoint}
                      mono
                      hint="Must be publicly reachable over HTTPS. GMI will run a health check before approving."
                    />
                    <div className="flex items-start gap-3 p-4 font-mono-gmi text-xs"
                      style={{ background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.2)", color: "#ff8080" }}>
                      <Info size={13} className="shrink-0 mt-0.5" />
                      <span>
                        You are solely responsible for uptime and availability of this endpoint.
                        If your endpoint goes down, your Marketplace listing will be marked Unavailable automatically.
                      </span>
                    </div>
                  </div>
                )}

                {/* Step 2: Review & Submit */}
                {tab2Step === 2 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={15} style={{ color: "#60a5fa" }} />
                      <h2 className="font-display text-lg text-white">Review & Submit</h2>
                    </div>
                    <div className="p-5 space-y-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                      <p className="font-mono-gmi text-xs text-gray-300 uppercase tracking-widest border-b border-gray-800 pb-3">Configuration Summary</p>
                      {[
                        { label: "Deployment Type", value: "Self-hosted + GMI MaaS" },
                        { label: "MaaS API Key", value: tab2MaasKey ? tab2MaasKey.slice(0, 12) + "..." : "Not set" },
                        { label: "Endpoint URL", value: tab2Endpoint || "Not set" },
                        { label: "Badge", value: "Powered by GMI MaaS" },
                      ].map(({ label, value }) => (
                        <div key={label} className="grid grid-cols-3 gap-4">
                          <div className="gmi-label text-gray-400">{label}</div>
                          <div className="col-span-2 font-mono-gmi text-sm text-gray-300 break-all">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 font-mono-gmi text-xs" style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.2)" }}>
                      <div className="font-bold mb-1" style={{ color: "#DDEA4D" }}>Submission ≠ Listing</div>
                      <p className="text-gray-400 leading-relaxed">
                        Submitting does <strong>not</strong> immediately publish your Claw. GMI will verify your MaaS key and endpoint health before the listing goes live.
                      </p>
                    </div>
                  </div>
                )}

                {/* Tab 2 navigation */}
                <div className="flex items-center justify-between mt-10">
                  <button
                    onClick={() => (tab2Step === 0 ? setActiveTab("ce") : setTab2Step(tab2Step - 1))}
                    className="btn-outline-dashed px-6 py-2.5 text-sm flex items-center gap-2">
                    <ArrowLeft size={14} />
                    {tab2Step === 0 ? "Switch to CE" : "Back"}
                  </button>
                  {tab2Step < STEPS_TAB2.length - 1 ? (
                    <button
                      onClick={() => {
                        if (tab2Step === 0 && !tab2MaasKey.trim()) { toast.error("Please enter your MaaS API key."); return; }
                        if (tab2Step === 1 && !tab2Endpoint.trim()) { toast.error("Please enter your endpoint URL."); return; }
                        setTab2Step(tab2Step + 1);
                      }}
                      className="px-8 py-2.5 text-sm font-bold flex items-center gap-2 transition-all"
                      style={{ background: "#60a5fa", color: "#000" }}>
                      Continue <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (!tab2MaasKey.trim() || !tab2Endpoint.trim()) { toast.error("MaaS key and endpoint are required."); return; }
                        setTab2Submitting(true);
                        setTimeout(() => { setTab2Submitting(false); setTab2Submitted(true); toast.success("Submission received"); }, 2000);
                      }}
                      disabled={tab2Submitting}
                      className="px-8 py-2.5 text-sm font-bold flex items-center gap-2 transition-all"
                      style={{ background: tab2Submitting ? "#2a2a2a" : "#60a5fa", color: tab2Submitting ? "#888" : "#000" }}>
                      {tab2Submitting ? "Submitting..." : "Submit"} {!tab2Submitting && <Zap size={14} />}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── CE WIZARD CONTENT ─────────────────────────────────── */}
            {activeTab === "ce" && (
            <div>
            {/* Step indicator */}
            <div className="flex items-center gap-0 mb-10">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 flex items-center justify-center text-xs font-mono-gmi font-bold shrink-0"
                      style={{ background: i <= step ? "#DDEA4D" : "#111", color: i <= step ? "#000" : "#999", border: i <= step ? "none" : "1px solid #2a2a2a" }}>
                      {i < step ? "✓" : i + 1}
                    </div>
                    <span className="text-xs font-mono-gmi hidden sm:inline whitespace-nowrap"
                      style={{ color: i === step ? "#fff" : "#999" }}>
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
                  <h2 className="font-display text-lg text-white">Infrastructure</h2>
                </div>
                <p className="text-xs font-mono-gmi -mt-4" style={{ color: "#aaa" }}>
                  Configure compute resources for your Claw. GMI CE will provision containers on demand.
                </p>

                {/* 2A: Compute — always shown, no toggle */}
                <div className="space-y-5">
                  {/* Docker image — kept here */}
                    <div className="space-y-5">

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
                                  <opt.icon size={13} style={{ color: dockerSource === opt.id ? "#DDEA4D" : "#999" }} />
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
                          <div className="p-6 text-center font-mono-gmi text-xs text-gray-400 cursor-pointer transition-all"
                            style={{ border: "1px dashed #2a2a2a" }}
                            onClick={() => toast.info("File upload coming soon — use Registry URL for now.")}>
                            <Upload size={18} className="mx-auto mb-2" style={{ color: "#888" }} />
                            Click to upload Docker image (.tar.gz)
                            <br /><span style={{ color: "#999" }}>Max 2 GB</span>
                          </div>
                        )}
                      </div>

                      {/* Compute tier — CPU-based */}
                      <div>
                        <FieldLabel>Compute Tier</FieldLabel>
                        <div className="space-y-2">
                          {COMPUTE_TIERS.map((t) => (
                            <RadioCard key={t.id} selected={computeTier === t.id} onClick={() => setComputeTier(t.id)}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono-gmi text-sm font-bold" style={{ color: computeTier === t.id ? "#DDEA4D" : "#ddd" }}>
                                    {t.label}
                                  </span>
                                  {t.recommended && (
                                    <span className="text-xs font-mono-gmi px-2 py-0.5" style={{ background: "rgba(221,234,77,0.15)", color: "#DDEA4D" }}>
                                      Recommended
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono-gmi text-sm font-bold" style={{ color: computeTier === t.id ? "#DDEA4D" : "#aaa" }}>
                                    ${t.priceHr.toFixed(2)}/hr
                                  </span>
                                  <RadioDot selected={computeTier === t.id} />
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-3 font-mono-gmi text-xs" style={{ color: "#bbb" }}>
                                <span><span style={{ color: "#888" }}>CPU </span>{t.cpu}</span>
                                <span><span style={{ color: "#888" }}>RAM </span>{t.ram}</span>
                                <span><span style={{ color: "#888" }}>NET </span>{t.net}</span>
                              </div>
                              <p className="font-mono-gmi text-xs mt-1.5" style={{ color: "#888" }}>{t.note}</p>
                            </RadioCard>
                          ))}
                        </div>
                      </div>

                      {/* IDC Region */}
                      <div>
                        <FieldLabel>Data Center Region</FieldLabel>
                        <div className="grid grid-cols-2 gap-2">
                          {IDC_REGIONS.map((r) => (
                            <RadioCard key={r.id} selected={idcRegion === r.id} onClick={() => setIdcRegion(r.id)}>
                              <div className="flex items-center justify-between">
                                <span className="font-mono-gmi text-sm" style={{ color: idcRegion === r.id ? "#DDEA4D" : "#ddd" }}>
                                  {r.flag} {r.label}
                                </span>
                                <RadioDot selected={idcRegion === r.id} />
                              </div>
                            </RadioCard>
                          ))}
                        </div>
                      </div>

                      {/* Scaling */}
                      <div>
                        <FieldLabel>Scaling</FieldLabel>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block font-mono-gmi text-xs mb-1.5" style={{ color: "#aaa" }}>
                              Min Instances <span style={{ color: "#888" }}>— 0 = serverless (cold start)</span>
                            </label>
                            <input type="number" min="0" value={minContainers}
                              onChange={(e) => setMinContainers(e.target.value)}
                              className="w-full px-4 py-3 text-sm text-white bg-transparent outline-none font-mono-gmi"
                              style={{ border: "1px solid #2a2a2a" }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                          </div>
                          <div>
                            <label className="block font-mono-gmi text-xs mb-1.5" style={{ color: "#aaa" }}>Max Instances</label>
                            <input type="number" min={minContainers} value={maxContainers}
                              onChange={(e) => setMaxContainers(e.target.value)}
                              className="w-full px-4 py-3 text-sm text-white bg-transparent outline-none font-mono-gmi"
                              style={{ border: "1px solid #2a2a2a" }}
                              onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")} />
                          </div>
                        </div>
                        <p className="font-mono-gmi text-xs mt-2" style={{ color: "#888" }}>
                          Billed per instance·hr. Min instances are always running and always billed.
                        </p>
                      </div>
                    </div>
                  </div>

                          {/* 2B: MaaS — optional add-on */}
                <div>
                  <Toggle
                    on={useMaaS}
                    onToggle={() => setUseMaaS((v) => !v)}
                    label="Add GMI MaaS — Access 200+ frontier models"
                    desc="Optional: GMI injects a MaaS API key into your container at startup. Enables Verified badge."
                  />

                  {useMaaS && (
                    <div className="mt-4 space-y-3 pl-4" style={{ borderLeft: "2px solid rgba(221,234,77,0.2)" }}>
                      <FieldLabel>Select Models</FieldLabel>
                      <p className="text-xs text-gray-400 font-mono-gmi -mt-1">
                        Select all models your Claw may call. You can change this later.
                      </p>

                      {/* Search box */}
                      <div className="relative">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#999" }} />
                        <input
                          type="text"
                          placeholder="Search models..."
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}
                          className="w-full pl-8 pr-8 py-2 text-xs text-white bg-transparent outline-none font-mono-gmi"
                          style={{ border: "1px solid #2a2a2a" }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                        />
                        {modelSearch && (
                          <button
                            onClick={() => setModelSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                            style={{ color: "#999" }}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>

                      {/* Selected chips */}
                      {selectedModels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedModels.map((id) => {
                            const m = MAAS_MODELS.find((x) => x.id === id);
                            if (!m) return null;
                            return (
                              <span key={id}
                                className="inline-flex items-center gap-1.5 px-2 py-1 font-mono-gmi text-xs"
                                style={{ background: "rgba(221,234,77,0.1)", border: "1px solid rgba(221,234,77,0.3)", color: "#DDEA4D" }}
                              >
                                {m.name}
                                <button onClick={() => toggleModel(id)} style={{ color: "#DDEA4D", opacity: 0.7 }}>
                                  <X size={10} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Horizontal scroll cards */}
                      <div
                        className="flex gap-3 pb-2"
                        style={{ overflowX: "auto", scrollbarWidth: "thin", scrollbarColor: "#2a2a2a #0a0a0a" }}
                      >
                        {MAAS_MODELS.filter((m) =>
                          !modelSearch ||
                          m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                          m.id.toLowerCase().includes(modelSearch.toLowerCase())
                        ).map((model) => {
                          const sel = selectedModels.includes(model.id);
                          return (
                            <button
                              key={model.id}
                              onClick={() => toggleModel(model.id)}
                              className="shrink-0 flex flex-col gap-2 p-3 transition-all text-left"
                              style={{
                                width: "140px",
                                background: sel ? "rgba(221,234,77,0.08)" : "#0a0a0a",
                                border: `1px solid ${sel ? "#DDEA4D" : "#2a2a2a"}`,
                              }}
                            >
                              {/* Checkbox */}
                              <div className="flex items-center justify-between">
                                <div
                                  className="w-3.5 h-3.5 flex items-center justify-center"
                                  style={{
                                    border: `1px solid ${sel ? "#DDEA4D" : "#888"}`,
                                    background: sel ? "#DDEA4D" : "transparent",
                                  }}
                                >
                                  {sel && <div className="w-2 h-2 bg-black" />}
                                </div>
                                <span
                                  className="font-mono-gmi text-xs px-1.5 py-0.5"
                                  style={{ background: "rgba(255,255,255,0.04)", color: "#999" }}
                                >
                                  {model.context}
                                </span>
                              </div>
                              {/* Model name */}
                              <div
                                className="font-mono-gmi text-xs font-bold leading-tight"
                                style={{ color: sel ? "#fff" : "#888" }}
                              >
                                {model.name}
                              </div>
                              {/* Tokens per dollar */}
                              {model.tokensPerDollar && (
                                <div className="font-mono-gmi text-xs" style={{ color: "#999" }}>
                                  {model.tokensPerDollar} tok/$
                                </div>
                              )}
                            </button>
                          );
                        })}
                        {MAAS_MODELS.filter((m) =>
                          !modelSearch ||
                          m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
                          m.id.toLowerCase().includes(modelSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="font-mono-gmi text-xs text-gray-300 py-4 px-2">
                            No models match "{modelSearch}"
                          </div>
                        )}
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
                          <span className="text-gray-300 ml-auto">Auto-generated on deploy</span>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3 font-mono-gmi text-xs"
                          style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                          <Lock size={12} style={{ color: "#DDEA4D" }} />
                          <span style={{ color: "#DDEA4D" }}>GMI_MAAS_BASE_URL</span>
                          <span className="text-gray-300 ml-auto">https://api.gmi.ai/v1</span>
                        </div>
                      </>
                    )}
                    {!useMaaS && (
                      <p className="text-xs text-gray-400 font-mono-gmi px-1">
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
                    <p className="text-xs text-gray-300 font-mono-gmi px-1">
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
                              style={{ border: "1px solid #2a2a2a", borderLeft: "none", color: "#999" }}>
                              {showSecrets[i] ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                          <button onClick={() => updateEnvVar(i, "secret", !v.secret)}
                            className="shrink-0 px-3 py-2.5 font-mono-gmi text-xs transition-all"
                            style={{
                              border: `1px solid ${v.secret ? "rgba(221,234,77,0.3)" : "#2a2a2a"}`,
                              color: v.secret ? "#DDEA4D" : "#999",
                              background: v.secret ? "rgba(221,234,77,0.06)" : "transparent",
                            }}>
                            Secret
                          </button>
                          <button onClick={() => removeEnvVar(i)}
                            className="shrink-0 p-2.5 transition-all"
                            style={{ border: "1px solid #2a2a2a", color: "#999" }}>
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
                  <h2 className="font-display text-lg text-white">Review & Publish Template</h2>
                </div>

                {/* Config summary */}
                <div className="p-5 space-y-4" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <p className="font-mono-gmi text-xs text-gray-300 uppercase tracking-widest border-b border-gray-800 pb-3">
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
                      <div className="gmi-label text-gray-400">{label}</div>
                      <div className="col-span-2 font-mono-gmi text-sm text-gray-300 break-all">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Cost estimate */}
                {useCompute && (
                  <div className="p-5 space-y-3" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                    <p className="font-mono-gmi text-xs text-gray-300 uppercase tracking-widest border-b border-gray-800 pb-3">
                      Cost Estimate
                    </p>
                    <div className="grid grid-cols-3 gap-4 font-mono-gmi text-sm">
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Base (Min containers)</div>
                        <div className="text-white font-bold">${minCost.toFixed(2)}/hr</div>
                        <div className="text-gray-400 text-xs mt-0.5">${(minCost * 24).toFixed(2)}/day</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Max (Max containers)</div>
                        <div className="text-white font-bold">${maxCost.toFixed(2)}/hr</div>
                        <div className="text-gray-400 text-xs mt-0.5">${(maxCost * 24).toFixed(2)}/day</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">MaaS Tokens</div>
                        <div className="text-gray-300 font-bold text-xs mt-1">Billed per token used</div>
                      </div>
                    </div>
                    <div className="h-1.5 w-full" style={{ background: "#1a1a1a" }}>
                      <div className="h-full" style={{ width: `${Math.min((minCost / maxCost) * 100, 100)}%`, background: "#DDEA4D" }} />
                    </div>
                    <p className="text-xs text-gray-300 font-mono-gmi">
                      Billing begins immediately upon clicking "Deploy Privately". You can stop containers from the Developer Console.
                    </p>
                  </div>
                )}

                {/* Decoupled flow notice */}
                <div className="p-4 font-mono-gmi text-xs" style={{ background: "rgba(221,234,77,0.04)", border: "1px solid rgba(221,234,77,0.2)" }}>
                  <div className="font-bold mb-1" style={{ color: "#DDEA4D" }}>Registration ≠ Listing</div>
                  <p className="text-gray-400 leading-relaxed">
                    Clicking "Register &amp; Deploy" provisions your infrastructure and starts billing, but does <strong>not</strong> publish
                    your Claw to the public Marketplace. After testing, list it from your Dashboard — listings go live instantly.
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
                  Publish Template <Zap size={14} />
                </button>
              )}
            </div>

          </div>
            )}

          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
