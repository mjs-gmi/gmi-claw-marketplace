import { useState, useEffect } from "react";
import { X, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Claw {
  id: string;
  name: string;
  model: string;
  category: string;
  price: string;
}

interface DeployModalProps {
  claw: Claw;
  onClose: () => void;
}

type DeployStep = {
  text: string;
  delay: number;
};

const DEPLOY_STEPS: DeployStep[] = [
  { text: "Resolving Claw manifest...", delay: 400 },
  { text: "Validating credentials...", delay: 800 },
  { text: "Allocating compute (H100 × 2)...", delay: 1400 },
  { text: "Pulling model weights...", delay: 2200 },
  { text: "Configuring runtime environment...", delay: 3000 },
  { text: "Running health checks...", delay: 3800 },
  { text: "Registering endpoint...", delay: 4400 },
];

export default function DeployModal({ claw, onClose }: DeployModalProps) {
  const [stage, setStage] = useState<"config" | "deploying" | "done">("config");
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [env, setEnv] = useState("production");
  const [region, setRegion] = useState("us-west-2");

  const endpoint = `https://api.gmi.ai/claws/${claw.id}`;

  function startDeploy() {
    setStage("deploying");
    setCompletedSteps([]);

    DEPLOY_STEPS.forEach((step, i) => {
      setTimeout(() => {
        setCompletedSteps((prev) => [...prev, i]);
        if (i === DEPLOY_STEPS.length - 1) {
          setTimeout(() => {
            setStage("done");
            toast.success(`${claw.name} deployed successfully!`);
          }, 500);
        }
      }, step.delay);
    });
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={stage === "deploying" ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-black border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <div className="gmi-label mb-0.5">Deploy Claw</div>
            <div className="font-display text-white text-lg">{claw.name}</div>
          </div>
          {stage !== "deploying" && (
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Config stage */}
        {stage === "config" && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4 text-xs font-mono-gmi border border-gray-800 p-4">
              {[
                { label: "CLAW ID", value: claw.id },
                { label: "MODEL", value: claw.model },
                { label: "CATEGORY", value: claw.category },
              ].map((item) => (
                <div key={item.label}>
                  <div className="text-gray-600 mb-0.5">{item.label}</div>
                  <div className="text-lime">{item.value}</div>
                </div>
              ))}
            </div>

            <div>
              <label className="gmi-label block mb-2">Environment</label>
              <select
                value={env}
                onChange={(e) => setEnv(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2.5 font-mono-gmi focus:outline-none focus:border-lime"
              >
                <option value="production">production</option>
                <option value="staging">staging</option>
                <option value="development">development</option>
              </select>
            </div>

            <div>
              <label className="gmi-label block mb-2">Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-white text-sm px-3 py-2.5 font-mono-gmi focus:outline-none focus:border-lime"
              >
                <option value="us-west-2">us-west-2 (Oregon)</option>
                <option value="us-east-1">us-east-1 (Virginia)</option>
                <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-outline-dashed flex-1 text-sm py-3">
                Cancel
              </button>
              <button onClick={startDeploy} className="btn-primary-lime flex-1 text-sm py-3 font-bold">
                Deploy Now →
              </button>
            </div>
          </div>
        )}

        {/* Deploying stage */}
        {stage === "deploying" && (
          <div className="p-6">
            <div className="bg-black border border-gray-800 p-5 mb-4">
              <div className="font-mono-gmi text-xs text-gray-500 mb-4">
                $ gmi claw deploy {claw.id} --env {env} --region {region}
              </div>
              <div className="space-y-2">
                {DEPLOY_STEPS.map((step, i) => {
                  const done = completedSteps.includes(i);
                  const active = !done && completedSteps.length === i;
                  return (
                    <div key={i} className={`flex items-center gap-3 terminal-line ${done ? "" : "dim"}`}>
                      {done ? (
                        <CheckCircle size={12} className="text-lime shrink-0" />
                      ) : active ? (
                        <Loader2 size={12} className="animate-spin text-lime shrink-0" />
                      ) : (
                        <span className="w-3 h-3 shrink-0" />
                      )}
                      <span>{step.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-center text-xs text-gray-600 font-mono-gmi">
              Deploying to {region} · {env}
            </div>
          </div>
        )}

        {/* Done stage */}
        {stage === "done" && (
          <div className="p-6 space-y-5">
            <div className="text-center py-4">
              <CheckCircle size={40} className="text-lime mx-auto mb-3" />
              <div className="font-display text-xl text-white mb-1">Deployment Complete</div>
              <div className="text-gray-400 text-sm">Your Claw is live and running</div>
            </div>

            <div className="bg-gray-900 border border-gray-800 p-4 space-y-2">
              {[
                { label: "ENDPOINT", value: endpoint },
                { label: "STATUS", value: "RUNNING" },
                { label: "REGION", value: region },
                { label: "ENVIRONMENT", value: env },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4">
                  <span className="font-mono-gmi text-xs text-gray-600 shrink-0">{item.label}</span>
                  <span
                    className={`font-mono-gmi text-xs text-right break-all ${
                      item.label === "STATUS" ? "text-lime" : "text-gray-300"
                    }`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-outline-dashed flex-1 text-sm py-3">
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(endpoint);
                  toast.success("Endpoint copied to clipboard");
                }}
                className="btn-primary-lime flex-1 text-sm py-3 font-bold"
              >
                Copy Endpoint
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
