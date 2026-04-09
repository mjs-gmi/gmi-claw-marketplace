import { useParams, Link } from "wouter";
import { ArrowLeft, CheckCircle, ExternalLink, Shield, Tag, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ALL_CLAWS } from "@/lib/clawData";
import { toast } from "sonner";

const TIER_CONFIG = {
  Verified: {
    color: "#DDEA4D",
    bg: "rgba(221,234,77,0.06)",
    border: "rgba(221,234,77,0.2)",
    label: "Verified",
    tooltip: "Published by GMI or an official partner. Passed full security and functional review.",
  },
  Community: {
    color: "#888",
    bg: "rgba(136,136,136,0.08)",
    border: "rgba(136,136,136,0.2)",
    label: "Community",
    tooltip: "Published by a third-party developer. Passed GMI baseline code safety and description review.",
  },
};

const TYPE_CONFIG: Record<string, { color: string; bg: string }> = {
  Workflow: { color: "#7ec8ff", bg: "rgba(126,200,255,0.08)" },
  Integration: { color: "#c084fc", bg: "rgba(192,132,252,0.08)" },
  Model: { color: "#fb923c", bg: "rgba(251,146,60,0.08)" },
  Enterprise: { color: "#DDEA4D", bg: "rgba(221,234,77,0.08)" },
};

export default function ClawDetail() {
  const { id } = useParams<{ id: string }>();
  const claw = ALL_CLAWS.find((c) => c.id === id);

  if (!claw) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono-gmi text-sm text-gray-600 mb-4">// Claw not found</div>
          <Link href="/marketplace">
            <button className="btn-primary-lime text-xs px-6 py-2.5 font-bold">
              Back to Marketplace
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const tier = TIER_CONFIG[claw.trustTier];
  const typeStyle = TYPE_CONFIG[claw.typeLabel] || { color: "#888", bg: "rgba(136,136,136,0.08)" };

  const handleAccess = () => {
    if (!claw.deployed) return;
    if (claw.id === "neoclaw") {
      window.open("https://ai.gendigital.com/", "_blank", "noopener,noreferrer");
      return;
    }
    toast.success(`Connecting to ${claw.name}...`, {
      description: "You will be redirected to the Claw interface.",
    });
  };

  return (
    <div className="min-h-screen flex bg-black text-white">
      <Navbar />

      <div className="flex-1" style={{ marginLeft: "220px" }}>
      <div className="pt-8 pb-20">
        <div className="px-8 max-w-6xl">

          {/* Back */}
          <Link href="/marketplace">
            <button className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-mono-gmi text-xs mb-10">
              <ArrowLeft size={13} /> Back to Marketplace
            </button>
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

            {/* Left: Main content */}
            <div className="lg:col-span-2 space-y-8">

              {/* Header */}
              <div>
                {/* Badges row */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {/* Trust tier */}
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-mono-gmi px-2.5 py-1"
                    style={{
                      background: tier.bg,
                      color: tier.color,
                      border: `1px solid ${tier.border}`,
                    }}
                    title={tier.tooltip}
                  >
                    <Shield size={10} />
                    {tier.label}
                  </span>
                  {/* Type label */}
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-mono-gmi px-2.5 py-1"
                    style={{
                      background: typeStyle.bg,
                      color: typeStyle.color,
                      border: `1px solid ${typeStyle.color}33`,
                    }}
                  >
                    <Tag size={10} />
                    {claw.typeLabel}
                  </span>
                </div>

                <h1
                  className="font-display text-4xl text-white mb-3"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  {claw.name}
                </h1>

                <div className="flex items-center gap-2 font-mono-gmi text-sm text-gray-500">
                  <span>by</span>
                  <span className="text-gray-300">{claw.publisher}</span>
                  <span className="text-gray-700">·</span>
                  <a
                    href={`mailto:${claw.publisherContact}`}
                    className="text-gray-600 hover:text-lime transition-colors flex items-center gap-1"
                  >
                    {claw.publisherContact} <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {claw.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-mono-gmi px-2.5 py-1 text-gray-500"
                    style={{ border: "1px solid #2a2a2a" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Description */}
              <div>
                <h2 className="font-display text-lg text-white mb-3">About this Claw</h2>
                <p className="text-gray-400 leading-relaxed text-sm">{claw.fullDescription}</p>
              </div>

              {/* Model */}
              <div>
                <h2 className="font-display text-lg text-white mb-3">Model</h2>
                <div className="flex flex-wrap gap-2">
                  {claw.supportedModels
                    ? claw.supportedModels.map((m) => (
                        <span
                          key={m}
                          className="text-xs font-mono-gmi px-3 py-1.5 text-gray-400"
                          style={{ background: "#0d0d0d", border: "1px solid #2a2a2a" }}
                        >
                          {m}
                        </span>
                      ))
                    : (
                        <span
                          className="text-xs font-mono-gmi px-3 py-1.5 text-gray-400"
                          style={{ background: "#0d0d0d", border: "1px solid #2a2a2a" }}
                        >
                          {claw.model}
                        </span>
                      )}
                </div>
              </div>

              {/* Sample outputs */}
              {claw.sampleOutputs && claw.sampleOutputs.length > 0 && (
                <div>
                  <h2 className="font-display text-lg text-white mb-3">Sample Output</h2>
                  <div
                    className="p-4 font-mono-gmi text-xs text-gray-400 space-y-2"
                    style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
                  >
                    {claw.sampleOutputs.map((output, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-lime shrink-0">›</span>
                        <span>{output}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Pricing + CTA panel */}
            <div className="lg:col-span-1">
              <div
                className="sticky top-24 p-6 space-y-6"
                style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
              >
                {/* Pricing — MUST be above CTA per PRD */}
                <div>
                  <div className="gmi-label text-gray-600 mb-2">Pricing</div>
                  <div
                    className="font-display text-2xl mb-1"
                    style={{ color: "#DDEA4D", letterSpacing: "-0.02em" }}
                  >
                    {claw.pricing}
                  </div>
                  <div className="text-xs text-gray-600 font-mono-gmi leading-relaxed">
                    {claw.pricingDetail}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #1e1e1e" }} />

                {/* Deployment status */}
                <div className="flex items-center gap-2 font-mono-gmi text-xs">
                  {claw.deployed ? (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
                      <span className="text-lime">Available</span>
                    </>
                  ) : (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                      <span className="text-gray-500">Unavailable</span>
                    </>
                  )}
                </div>

                {/* CTA */}
                {claw.deployed ? (
                  <button
                    onClick={handleAccess}
                    className="w-full py-3 font-bold text-sm flex items-center justify-center gap-2 transition-all"
                    style={{ background: "#DDEA4D", color: "#000000" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#e8f060")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#DDEA4D")}
                  >
                    Access Claw <ExternalLink size={14} />
                  </button>
                ) : (
                  <div>
                    <div
                      className="w-full py-3 text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                      style={{ background: "#111", color: "#555", border: "1px solid #2a2a2a" }}
                    >
                      <AlertCircle size={14} />
                      Unavailable
                    </div>
                    <p className="text-xs text-gray-700 font-mono-gmi mt-2 text-center">
                      This Claw is not currently deployed. You will not be charged.
                    </p>
                  </div>
                )}

                {/* Trust info */}
                <div style={{ borderTop: "1px solid #1e1e1e" }} />
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-xs text-gray-600 font-mono-gmi">
                    <CheckCircle size={12} className="shrink-0 mt-0.5" style={{ color: tier.color }} />
                    <span>{tier.tooltip}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-600 font-mono-gmi">
                    <CheckCircle size={12} className="shrink-0 mt-0.5 text-gray-700" />
                    <span>Browser-based. No SDK, API key, or installation required.</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-600 font-mono-gmi">
                    <CheckCircle size={12} className="shrink-0 mt-0.5 text-gray-700" />
                    <span>Pricing set by publisher. GMI provides the infrastructure.</span>
                  </div>
                </div>
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
