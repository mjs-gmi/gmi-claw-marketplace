import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle, Info } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { TypeLabel, TYPE_LABELS } from "@/lib/clawData";
import { toast } from "sonner";

const STEPS = ["Claw Info", "Review & Submit"];

export default function ListClaw() {
  const [, setLocation] = useLocation();
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
    model: "",
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
    toast.success("Claw listing submitted for review", {
      description: "GMI will review your listing within 3 business days.",
    });
  };

  const TYPE_DESCRIPTIONS: Record<TypeLabel, string> = {
    Workflow: "Multi-step task orchestration (e.g., code review, document processing)",
    Integration: "Third-party service connector (e.g., Zendesk, Slack, Salesforce)",
    Model: "Model wrapper or fine-tuned model endpoint",
    Enterprise: "Enterprise-grade Claw with SLA backing",
  };

  if (submitted) {
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
            <h1 className="font-display text-3xl text-white mb-3">Listing Submitted</h1>
            <p className="text-gray-500 text-sm font-mono-gmi leading-relaxed mb-8">
              Your Claw listing is under review. GMI will verify the code safety and description
              accuracy within <span className="text-white">3 business days</span>. You'll receive a
              confirmation at <span className="text-white">{form.contact}</span>.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setLocation("/deploy")}
                className="btn-primary-lime px-6 py-2.5 text-sm font-bold flex items-center gap-2"
              >
                Configure Deployment <ArrowRight size={14} />
              </button>
              <button
                onClick={() => setLocation("/marketplace")}
                className="btn-outline-dashed px-6 py-2.5 text-sm"
              >
                Back to Marketplace
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
            onClick={() => setLocation("/marketplace")}
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-mono-gmi text-xs mb-10"
          >
            <ArrowLeft size={13} /> Back to Marketplace
          </button>

          {/* Header */}
          <div className="mb-10">
            <div className="gmi-label mb-2">Claw Builder</div>
            <h1 className="font-display text-4xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
              List a Claw
            </h1>
            <p className="text-gray-500 text-sm font-mono-gmi">
              Listing is free. GMI reviews all submissions before they appear in the Marketplace.
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
                    className="text-xs font-mono-gmi"
                    style={{ color: i === step ? "#fff" : "#555" }}
                  >
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="w-12 h-px mx-3"
                    style={{ background: i < step ? "#DDEA4D" : "#2a2a2a" }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 0: Claw Info */}
          {step === 0 && (
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="gmi-label block mb-2">Claw Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Contract Review Agent"
                  className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none transition-colors"
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
                    className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none transition-colors"
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
                    className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none transition-colors"
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
                      <div className="text-xs text-gray-600 leading-relaxed">
                        {TYPE_DESCRIPTIONS[type]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Short description */}
              <div>
                <label className="gmi-label block mb-2">Short Description * <span className="text-gray-700 normal-case">(shown on Marketplace card)</span></label>
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
                <div className="text-xs text-gray-700 font-mono-gmi mt-1 text-right">
                  {form.description.length}/120
                </div>
              </div>

              {/* Full description */}
              <div>
                <label className="gmi-label block mb-2">Full Description * <span className="text-gray-700 normal-case">(shown on detail page)</span></label>
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

              {/* Tags + Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="gmi-label block mb-2">Tags <span className="text-gray-700 normal-case">(comma-separated)</span></label>
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
                <div>
                  <label className="gmi-label block mb-2">Primary Model</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => update("model", e.target.value)}
                    placeholder="e.g. Llama 3.1 70B"
                    className="w-full bg-transparent px-4 py-3 text-sm text-white font-mono-gmi outline-none"
                    style={{ border: "1px solid #2a2a2a" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                  />
                </div>
              </div>

              {/* Info note */}
              <div
                className="flex items-start gap-3 p-4 font-mono-gmi text-xs text-gray-500"
                style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
              >
                <Info size={14} className="shrink-0 mt-0.5 text-gray-600" />
                <div>
                  Listing is free and does not expose any running service to users. To make your Claw
                  accessible, you'll need to configure a deployment after listing is approved.
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Review */}
          {step === 1 && (
            <div className="space-y-6">
              <div
                className="p-6 space-y-5"
                style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
              >
                <h2 className="font-display text-lg text-white">Review Listing</h2>

                {[
                  { label: "Claw Name", value: form.name },
                  { label: "Publisher", value: form.publisher },
                  { label: "Contact", value: form.contact },
                  { label: "Type", value: form.typeLabel },
                  { label: "Short Description", value: form.description },
                  { label: "Tags", value: form.tags || "—" },
                  { label: "Model", value: form.model || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="grid grid-cols-3 gap-4">
                    <div className="gmi-label text-gray-600">{label}</div>
                    <div className="col-span-2 font-mono-gmi text-sm text-gray-300">{value}</div>
                  </div>
                ))}

                <div style={{ borderTop: "1px solid #1e1e1e" }} />
                <div>
                  <div className="gmi-label text-gray-600 mb-2">Full Description</div>
                  <div className="font-mono-gmi text-sm text-gray-400 leading-relaxed">
                    {form.fullDescription}
                  </div>
                </div>
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
                  By submitting, you confirm this Claw complies with{" "}
                  <span className="underline cursor-pointer">GMI Marketplace Guidelines</span>. GMI
                  will review within 3 business days and notify you at {form.contact}.
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            <button
              onClick={() => (step === 0 ? setLocation("/marketplace") : setStep(step - 1))}
              className="btn-outline-dashed px-6 py-2.5 text-sm flex items-center gap-2"
            >
              <ArrowLeft size={14} />
              {step === 0 ? "Cancel" : "Back"}
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
                Submit for Review <CheckCircle size={14} />
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
