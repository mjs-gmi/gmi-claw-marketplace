import { useState } from "react";
import { Search, X, ArrowRight, CheckCircle, Plus } from "lucide-react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ALL_CLAWS, TYPE_LABELS, type Claw, type TypeLabel } from "@/lib/clawData";

const ALL_TYPES: (TypeLabel | "All")[] = ["All", ...TYPE_LABELS];

function TrustBadge({ tier }: { tier: Claw["trustTier"] }) {
  if (tier === "Verified") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-mono-gmi px-2 py-0.5"
        style={{
          background: "rgba(221,234,77,0.12)",
          color: "#DDEA4D",
          border: "1px solid rgba(221,234,77,0.25)",
        }}
      >
        <CheckCircle size={9} /> Verified
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-mono-gmi px-2 py-0.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        color: "#666",
        border: "1px solid #2a2a2a",
      }}
    >
      Community
    </span>
  );
}

function TypeTag({ type }: { type: TypeLabel }) {
  const colors: Record<TypeLabel, string> = {
    Workflow: "#7ec8ff",
    Integration: "#c084fc",
    Model: "#fb923c",
    Enterprise: "#34d399",
  };
  return (
    <span
      className="text-xs font-mono-gmi px-2 py-0.5"
      style={{ color: colors[type], border: `1px solid ${colors[type]}33`, background: `${colors[type]}0d` }}
    >
      {type}
    </span>
  );
}

function ClawCard({ claw }: { claw: Claw }) {
  const [, setLocation] = useLocation();
  return (
    <div
      className="group flex flex-col cursor-pointer"
      style={{
        background: "#000",
        border: "1px solid #1e1e1e",
        padding: "1.25rem",
        transition: "border-color 0.15s ease",
      }}
      onClick={() => setLocation(`/marketplace/${claw.id}`)}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e1e1e")}
    >
      {/* Trust + Type badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <TrustBadge tier={claw.trustTier} />
        <TypeTag type={claw.typeLabel} />
      </div>

      {/* Title */}
      <h3
        className="font-display text-base text-white mb-2 leading-snug group-hover:text-[#DDEA4D] transition-colors"
        style={{ letterSpacing: "-0.01em" }}
      >
        {claw.name}
      </h3>

      {/* Description */}
      <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-1 line-clamp-3">
        {claw.description}
      </p>

      {/* Footer */}
      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: "1px solid #1a1a1a" }}
      >
        <div className="font-mono-gmi text-xs text-gray-600">
          by <span style={{ color: "#888" }}>@{claw.publisher}</span>
        </div>
        <div className="flex items-center gap-2">
          {claw.deployed ? (
            <span className="font-mono-gmi text-xs" style={{ color: "#DDEA4D" }}>
              {claw.pricing}
            </span>
          ) : (
            <span className="font-mono-gmi text-xs text-gray-700">Unavailable</span>
          )}
        </div>
      </div>

      {/* View detail — appears on hover */}
      <div
        className="mt-3 w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "#DDEA4D", color: "#000" }}
      >
        View Claw <ArrowRight size={12} />
      </div>
    </div>
  );
}

export default function Marketplace() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<TypeLabel | "All">("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const filtered = ALL_CLAWS.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesType = activeType === "All" || c.typeLabel === activeType;
    const matchesTrust = !verifiedOnly || c.trustTier === "Verified";
    return matchesSearch && matchesType && matchesTrust;
  });

  return (
    <div className="min-h-screen" style={{ background: "#000", color: "#fff" }}>
      <Navbar />

      {/* Page header */}
      <div className="pt-20 pb-8" style={{ borderBottom: "1px solid #1a1a1a" }}>
        <div className="container">
          <div
            className="inline-block text-xs font-mono-gmi px-3 py-1 mb-4"
            style={{
              background: "rgba(221,234,77,0.08)",
              color: "#DDEA4D",
              border: "1px solid rgba(221,234,77,0.2)",
            }}
          >
            The Marketplace
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-4xl text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
                Claw Catalog
              </h1>
              <p className="text-gray-500 text-sm font-mono-gmi">
                {ALL_CLAWS.length} Claws available · Powered by GMI Cluster Engine
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  placeholder="Search Claws..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64 text-white text-sm pl-9 pr-9 py-2.5 focus:outline-none font-mono-gmi placeholder-gray-700"
                  style={{ background: "#0d0d0d", border: "1px solid #2a2a2a" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#DDEA4D")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
                    <X size={12} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setLocation("/list-claw")}
                className="btn-primary-lime px-4 py-2.5 text-xs font-bold flex items-center gap-1.5"
              >
                <Plus size={12} /> List a Claw
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main layout: left sidebar + grid */}
      <div className="container py-10">
        <div className="flex gap-10">

          {/* Left sidebar */}
          <aside className="w-48 shrink-0">
            {/* Type filter */}
            <div className="mb-8">
              <div className="gmi-label mb-3">Type</div>
              <div className="space-y-0.5">
                {ALL_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveType(type)}
                    className="w-full text-left px-3 py-2 text-sm font-mono-gmi transition-colors"
                    style={{
                      background: activeType === type ? "rgba(221,234,77,0.08)" : "transparent",
                      color: activeType === type ? "#DDEA4D" : "#666",
                      borderLeft: `2px solid ${activeType === type ? "#DDEA4D" : "transparent"}`,
                    }}
                    onMouseEnter={(e) => { if (activeType !== type) (e.currentTarget as HTMLButtonElement).style.color = "#aaa"; }}
                    onMouseLeave={(e) => { if (activeType !== type) (e.currentTarget as HTMLButtonElement).style.color = "#666"; }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Trust filter */}
            <div className="mb-8">
              <div className="gmi-label mb-3">Trust</div>
              <div className="space-y-0.5">
                {[
                  { label: "All Claws", value: false },
                  { label: "Verified Only", value: true },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setVerifiedOnly(opt.value)}
                    className="w-full text-left px-3 py-2 text-sm font-mono-gmi transition-colors"
                    style={{
                      background: verifiedOnly === opt.value ? "rgba(221,234,77,0.08)" : "transparent",
                      color: verifiedOnly === opt.value ? "#DDEA4D" : "#666",
                      borderLeft: `2px solid ${verifiedOnly === opt.value ? "#DDEA4D" : "transparent"}`,
                    }}
                    onMouseEnter={(e) => { if (verifiedOnly !== opt.value) (e.currentTarget as HTMLButtonElement).style.color = "#aaa"; }}
                    onMouseLeave={(e) => { if (verifiedOnly !== opt.value) (e.currentTarget as HTMLButtonElement).style.color = "#666"; }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Builder CTA */}
            <div
              className="p-4 space-y-3"
              style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}
            >
              <div className="font-display text-sm text-white">Build on GMI</div>
              <p className="text-xs text-gray-600 font-mono-gmi leading-relaxed">
                List your Claw for free. Deploy on GMI infrastructure.
              </p>
              <button
                onClick={() => setLocation("/list-claw")}
                className="w-full text-xs font-bold py-2 flex items-center justify-center gap-1"
                style={{ background: "#DDEA4D", color: "#000" }}
              >
                List a Claw <ArrowRight size={11} />
              </button>
            </div>
          </aside>

          {/* Grid */}
          <div className="flex-1">
            {filtered.length === 0 ? (
              <div className="text-center py-24">
                <div className="font-mono-gmi text-sm text-gray-600 mb-2">// No Claws found</div>
                <div className="text-xs text-gray-700">Try adjusting your search or filter</div>
              </div>
            ) : (
              <>
                <div className="font-mono-gmi text-xs text-gray-600 mb-6">
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map((claw) => (
                    <ClawCard key={claw.id} claw={claw} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
