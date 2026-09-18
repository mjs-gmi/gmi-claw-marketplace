import React, { useState } from "react";
import { C, FONT } from "@/lib/tokens";
import NoApiBadge from "@/components/NoApiBadge";
import V2Badge from "@/components/V2Badge";

// ─── Billing surfaces shared by Register Template and My Agents (v1.3 §B, §D) ─
//
// NOTE: the bs-api swagger has no balance, deposit or coupon endpoint. These
// screens are drawn in the v1.3 set and built here for the prototype; they
// carry NoApiBadge so nobody mistakes them for wired-up flows.
// Both flows gate on the same three things: an up-front cost Notice the user
// acknowledges once, an "insufficient credits" prompt, and the two ways to fix
// it (deposit or redeem a coupon). Keeping them here means the copy and the
// acknowledgement key can't drift between the two pages.

const ACK_KEY = "gmi:cost-notice-ack";

/** Has the user already acknowledged the cost notice for this surface? */
export function hasAcknowledged(surface: string): boolean {
  try {
    return localStorage.getItem(`${ACK_KEY}:${surface}`) === "1";
  } catch {
    return false;
  }
}

export function acknowledge(surface: string) {
  try {
    localStorage.setItem(`${ACK_KEY}:${surface}`, "1");
  } catch {
    /* storage unavailable — the notice simply shows again next visit */
  }
}

// ─── Icons ──────────────────────────────────────────────────────────────────
const IconX = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconAlert = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
  </svg>
);
const IconCard = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
  </svg>
);
const IconPayPal = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 21 8.5 4h5.5a4 4 0 0 1 0 8H9.5" /><path d="M10 21h2.5a4 4 0 0 0 0-8" />
  </svg>
);

// ─── Modal shell ────────────────────────────────────────────────────────────
function Modal({
  children, onClose, width = 512, zIndex = 130,
}: {
  children: React.ReactNode;
  onClose?: () => void;
  width?: number;
  zIndex?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex,
        background: "rgba(0,0,0,0.62)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        style={{
          width: "100%", maxWidth: width,
          background: "#0d0d0d",
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "22px 24px",
          fontFamily: FONT,
          position: "relative",
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const btnGhost: React.CSSProperties = {
  fontFamily: FONT, fontSize: 14, fontWeight: 500,
  background: "#1f1f1f", color: C.fg,
  border: `1px solid ${C.border}`, borderRadius: 6,
  padding: "9px 16px", cursor: "pointer",
};
const btnLime: React.CSSProperties = {
  fontFamily: FONT, fontSize: 14, fontWeight: 600,
  background: C.lime, color: C.limeText,
  border: "none", borderRadius: 6,
  padding: "9px 16px", cursor: "pointer",
};

// ─── Cost notice — shown once per surface before the user can spend ─────────
export function CostNotice({
  body, onAcknowledge, onPricing,
}: {
  body: React.ReactNode;
  onAcknowledge: () => void;
  onPricing?: () => void;
}) {
  return (
    <Modal onClose={onAcknowledge} width={512}>
      <button
        onClick={onAcknowledge}
        aria-label="Close"
        style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", color: C.fg, cursor: "pointer", display: "flex" }}
      >
        <IconX />
      </button>
      <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 17, fontWeight: 600, color: C.fg, margin: "0 0 12px" }}>
        Notice <V2Badge title="New in Agentbox v1.3 — cost notice" />
      </h3>
      <div style={{ fontFamily: FONT, fontSize: 14, lineHeight: "24px", color: "#d4d4d4" }}>{body}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <button style={btnGhost} onClick={() => (onPricing ? onPricing() : window.open("https://www.gmicloud.ai/pricing", "_blank"))}>
          View pricing details
        </button>
        <button style={btnLime} onClick={onAcknowledge}>I understand and acknowledge.</button>
      </div>
    </Modal>
  );
}

// ─── Insufficient credits — bottom-centered banner, not a blocking modal ────
export function InsufficientCredits({
  onDeposit, onCoupon, onClose,
}: {
  onDeposit: () => void;
  onCoupon: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 140,
        display: "flex", alignItems: "center", gap: 16,
        background: "#1c1c1c", border: `1px solid ${C.border}`, borderRadius: 8,
        padding: "14px 16px", minWidth: 440,
        boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
        fontFamily: FONT,
      }}
    >
      <span style={{ color: C.err, display: "flex", flexShrink: 0 }}><IconAlert /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg }}>
          Insufficient credits <V2Badge title="New in Agentbox v1.3" /> <NoApiBadge title="No balance endpoint in the Sandbox swagger — drawn in the v1.3 set, not wired." />
        </div>
        <div style={{ fontFamily: FONT, fontSize: 13, color: C.muted, marginTop: 2 }}>
          Deposit to continue or{" "}
          <button
            onClick={onCoupon}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: FONT, fontSize: 13, color: C.fg, textDecoration: "underline" }}
          >
            Redeem a coupon
          </button>
          .
        </div>
      </div>
      <button style={{ ...btnLime, padding: "7px 14px", fontSize: 13 }} onClick={onDeposit}>Deposit</button>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", display: "flex", flexShrink: 0 }}
      >
        <IconX />
      </button>
    </div>
  );
}

// ─── Top-up credits ─────────────────────────────────────────────────────────
const PRESETS = [10, 50, 200, 1000];
type PayMethod = "default" | "paypal" | "stripe";

export function TopUpCredits({ onClose, onContinue }: { onClose: () => void; onContinue: (amount: number) => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("default");

  const methodCard = (id: PayMethod, icon: React.ReactNode, label: string) => (
    <button
      key={id}
      onClick={() => setMethod(id)}
      style={{
        flex: 1,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
        background: "#171717",
        border: `1px solid ${method === id ? C.fg : C.border}`,
        borderRadius: 6, padding: "14px 8px", cursor: "pointer",
        fontFamily: FONT, fontSize: 14, fontWeight: 500, color: C.fg,
      }}
    >
      <span style={{ color: C.fg, display: "flex" }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <Modal onClose={onClose} width={420}>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", color: C.fg, cursor: "pointer", display: "flex" }}
      >
        <IconX />
      </button>
      <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 17, fontWeight: 600, color: C.fg, margin: "0 0 16px" }}>
        Top-up Credits <V2Badge title="New in Agentbox v1.3" /> <NoApiBadge title="No deposit endpoint in the Sandbox swagger — drawn in the v1.3 set, not wired." />
      </h3>

      <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: C.fg, marginBottom: 8 }}>Deposit Amount</div>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.muted, fontFamily: FONT, fontSize: 14 }}>$</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.00"
          style={{
            width: "100%", boxSizing: "border-box",
            background: C.pillBg, border: `1px solid ${C.border}`, color: C.fg,
            fontFamily: FONT, fontSize: 14, padding: "10px 14px 10px 28px",
            borderRadius: 6, outline: "none",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setAmount(String(p))}
            style={{
              flex: 1,
              background: amount === String(p) ? "#2e2e2e" : "#1f1f1f",
              border: `1px solid ${amount === String(p) ? C.fg : C.border}`,
              color: C.fg, fontFamily: FONT, fontSize: 14, fontWeight: 500,
              padding: "8px 0", borderRadius: 5, cursor: "pointer",
            }}
          >
            ${p.toLocaleString()}
          </button>
        ))}
      </div>

      <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: C.fg, marginBottom: 8 }}>Payment Method</div>
      <div style={{ display: "flex", gap: 8 }}>
        {methodCard("default", <IconCard />, "Default")}
        {methodCard("paypal", <IconPayPal />, "PayPal")}
        {methodCard("stripe", <span style={{ fontSize: 15, fontWeight: 700 }}>S</span>, "Stripe")}
      </div>

      {method === "default" && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, marginTop: 10,
            background: C.pillBg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px",
          }}
        >
          <span style={{ background: "#1a1f71", color: "#fff", fontFamily: FONT, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", padding: "3px 6px", borderRadius: 3 }}>
            VISA
          </span>
          <span style={{ fontFamily: FONT, fontSize: 14, color: C.fg, letterSpacing: "0.08em" }}>**** **** **** 1234</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnLime} onClick={() => onContinue(parseFloat(amount) || 0)}>Continue</button>
      </div>
    </Modal>
  );
}

// ─── Redeem coupon ──────────────────────────────────────────────────────────
export function RedeemCoupon({ onClose, onApply }: { onClose: () => void; onApply: (code: string) => void }) {
  const [code, setCode] = useState("");

  return (
    <Modal onClose={onClose} width={400}>
      {/* Gift-card artwork — matches the "Gifted Credits" card in the design. */}
      <div
        style={{
          background: "linear-gradient(145deg, #202020 0%, #141414 100%)",
          border: `1px solid ${C.borderSoft}`,
          borderRadius: 6,
          padding: "34px 30px",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            position: "relative",
            background: "linear-gradient(135deg, #3a3a3a 0%, #1e1e1e 100%)",
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            height: 128,
            padding: 14,
            display: "flex", alignItems: "flex-end",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={C.fg} style={{ position: "absolute", top: 14, right: 14, opacity: 0.9 }}>
            <path d="M3 8h4V4H3zM9 4h4v4H9zM15 4h6v4h-6zM3 10h6v4H3zM11 10h4v4h-4zM17 10h4v4h-4zM3 16h4v4H3zM9 16h6v4H9zM17 16h4v4h-4z" />
          </svg>
          <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: C.fg }}>Gifted Credits</span>
        </div>
      </div>

      <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 17, fontWeight: 600, color: C.fg, margin: "0 0 8px" }}>
        Redeem Coupon Code <V2Badge title="New in Agentbox v1.3" /> <NoApiBadge title="No coupon endpoint in the Sandbox swagger — drawn in the v1.3 set, not wired." />
      </h3>
      <p style={{ fontFamily: FONT, fontSize: 14, lineHeight: "20px", color: C.muted, margin: "0 0 16px" }}>
        If you have a Code for GMI cloud, you can enter it here to add credits to your account.
      </p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter a code"
        style={{
          width: "100%", boxSizing: "border-box",
          background: C.pillBg, border: `1px solid ${C.border}`, color: C.fg,
          fontFamily: FONT, fontSize: 14, padding: "10px 14px",
          borderRadius: 6, outline: "none",
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnLime} onClick={() => onApply(code.trim())}>Apply</button>
      </div>
    </Modal>
  );
}

// ─── Leave-registration guard ───────────────────────────────────────────────
export function LeaveRegistration({ onLeave, onContinue }: { onLeave: () => void; onContinue: () => void }) {
  return (
    <Modal onClose={onContinue} width={520}>
      <h3 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 600, color: C.fg, margin: "0 0 10px" }}>
        Do you want to leave registration?
      </h3>
      <p style={{ fontFamily: FONT, fontSize: 14, lineHeight: "20px", color: C.muted, margin: 0 }}>
        If you leave the registration process, the information you have entered will not be saved.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <button style={btnGhost} onClick={onLeave}>Leave</button>
        <button style={btnLime} onClick={onContinue}>Continue</button>
      </div>
    </Modal>
  );
}
