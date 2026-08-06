import { useState } from "react";
import Navbar from "@/components/Navbar";
import Topbar from "@/components/Topbar";
import { C, FONT, MONO } from "@/lib/tokens";
import {
  PLANS, LAUNCH_PROMO, PREMIUM_MODELS, STANDARD_MODELS,
  loadSubscription, saveSubscription, isSubscribed, type PlanId,
} from "@/lib/pricingModel";

export default function Plans() {
  const [sub, setSub] = useState(() => loadSubscription());
  const [annual, setAnnual] = useState(false);
  const current = sub.plan;
  const subscribed = isSubscribed(sub);

  const choose = (id: PlanId) => {
    const plan = PLANS.find((p) => p.id === id)!;
    const next = { plan: id, creditsRemaining: plan.premiumCredits };
    saveSubscription(next); setSub(next);
  };
  const goPayg = () => { const next = { plan: "payg" as const, creditsRemaining: 0 }; saveSubscription(next); setSub(next); };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.fg, fontFamily: FONT }}>
      <Topbar /><Navbar />
      <div style={{ marginLeft: 210, paddingTop: 40 }}>
        <div style={{ padding: "28px 32px 48px", maxWidth: 1100, margin: "0 auto" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: C.fg, margin: 0 }}>Plans</h1>
              <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: "6px 0 0", maxWidth: 640, lineHeight: "19px" }}>
                Every plan includes a monthly <span style={{ color: C.fg }}>Premium Credits</span> pool plus nearly-unlimited use of the curated <span style={{ color: C.fg }}>Standard</span> models. 100 credits = $1.00 of list-price usage.
              </p>
            </div>
            {/* Monthly / Annual toggle */}
            <div style={{ display: "inline-flex", border: `1px solid ${C.border}`, borderRadius: 999, padding: 3, background: C.cardSolid }}>
              {([["monthly", "Monthly"], ["annual", "Annual · 2 months free"]] as const).map(([k, label]) => {
                const on = (k === "annual") === annual;
                return (
                  <button key={k} onClick={() => setAnnual(k === "annual")} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: on ? C.limeText : C.muted, background: on ? C.lime : "transparent", border: "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer" }}>{label}</button>
                );
              })}
            </div>
          </div>

          {/* Current status — PAYG default, or the active plan */}
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: C.cardSolid, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
            <span style={{ fontFamily: FONT, fontSize: 12, color: C.muted }}>Current billing:</span>
            <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: subscribed ? C.lime : C.fg }}>
              {subscribed ? `${current.charAt(0).toUpperCase() + current.slice(1)} plan · ${sub.creditsRemaining.toLocaleString()} credits left` : "Pay-as-you-go — billed per token at list price"}
            </span>
            {subscribed
              ? <button onClick={goPayg} style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>Switch to pay-as-you-go</button>
              : <span style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 12, color: C.muted }}>Pick a plan below to save on Premium models.</span>}
          </div>

          {/* Plan cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 18 }}>
            {PLANS.map((p) => {
              const isCurrent = p.id === current;
              const promo = LAUNCH_PROMO[p.id];
              const price = annual ? p.priceAnnual : p.priceMonthly;
              return (
                <div key={p.id} style={{ border: `1px solid ${isCurrent ? C.lime : C.border}`, borderRadius: 14, padding: "18px 18px 16px", background: C.card, display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
                  {isCurrent && <span style={{ position: "absolute", top: -10, left: 16, fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: C.limeText, background: C.lime, padding: "2px 8px", borderRadius: 5 }}>CURRENT PLAN</span>}
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: C.fg }}>{p.name}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                      <span style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: C.fg }}>${price}</span>
                      <span style={{ fontFamily: FONT, fontSize: 12, color: C.muted }}>/{annual ? "yr" : "mo"}</span>
                    </div>
                    {!annual && promo && (
                      <div style={{ marginTop: 4, fontFamily: FONT, fontSize: 11, color: "#fbbf24" }}>First month ${promo.firstMonth} · 20% off</div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 7, fontFamily: FONT, fontSize: 12.5, color: C.fg }}>
                    <Row label="Premium Credits / mo" value={<span style={{ fontWeight: 600 }}>{p.premiumCredits.toLocaleString()}</span>} />
                    <Row label="≈ list-price value" value={`$${p.faceValueUsd}`} muted />
                    <Row label="Standard models" value="Included" />
                    <Row label="Standard soft cap" value={`${p.stdSoftCapTokens} tok/mo`} muted />
                    <Row label="Priority" value={p.concurrency} muted />
                  </div>

                  <button
                    onClick={() => choose(p.id)}
                    disabled={isCurrent}
                    style={{ marginTop: 4, fontFamily: FONT, fontSize: 13, fontWeight: 700, background: isCurrent ? "transparent" : C.lime, color: isCurrent ? C.muted : C.limeText, border: `1px solid ${isCurrent ? C.border : C.lime}`, borderRadius: 9, padding: "9px 12px", cursor: isCurrent ? "default" : "pointer" }}
                  >
                    {isCurrent ? "Current plan" : "Choose " + p.name}
                  </button>
                </div>
              );
            })}
          </div>

          {/* How it works */}
          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Standard lane */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
              <h3 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.fg, margin: "0 0 4px" }}>Standard models · nearly unlimited</h3>
              <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "0 0 10px", lineHeight: "17px" }}>Included on every plan under a fair-use soft cap — they don't burn credits.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {STANDARD_MODELS.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12.5 }}>
                    <span style={{ color: C.fg }}>{m.name}</span>
                    <span style={{ color: C.muted, fontFamily: MONO, fontSize: 11 }}>{m.listPrice}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Premium lane */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px" }}>
              <h3 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.fg, margin: "0 0 4px" }}>Premium models · burn credits</h3>
              <p style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: "0 0 10px", lineHeight: "17px" }}>Debit the pool at each model's published rate (blended 80/20). Expensive models simply drain credits faster.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 210, overflowY: "auto" }}>
                {PREMIUM_MODELS.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 12.5 }}>
                    <span style={{ color: C.fg }}>{m.name}</span>
                    <span style={{ color: C.muted, fontFamily: MONO, fontSize: 11 }}>{m.burnBlended} cr / 1M</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: muted ? C.muted : C.fg, textAlign: "right" }}>{value}</span>
    </div>
  );
}
