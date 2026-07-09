import React, { useState } from "react";
import { useLocation } from "wouter";

// Single page label based on current route (matches GMI Console top bar — a
// single title next to the sidebar-toggle, not a full breadcrumb trail).
function usePageLabel(): string {
  const [location] = useLocation();
  if (location.startsWith("/marketplace/")) return "Agent Detail";
  if (location.startsWith("/marketplace")) return "Agent Marketplace";
  if (location.startsWith("/dashboard")) return "My Agents";
  if (location.startsWith("/deploy")) return "Register & List";
  if (location.startsWith("/list-claw")) return "List Agent";
  return "Home";
}

// ─── Icons ───────────────────────────────────────────────────────────────
const IcoInference = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);
const IcoCompute = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 4h16v12H4V4zm2 2v8h12V6H6zm-2 10h16v2H4v-2zM9 18h6v2H9v-2z" />
  </svg>
);
const IcoGift = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#c7a7ff" }}>
    <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    <path d="M12 8C12 8 11 3 8 3a2.5 2.5 0 0 0 0 5h4zM12 8c0 0 1-5 4-5a2.5 2.5 0 0 1 0 5h-4z" />
  </svg>
);
const IcoSpark = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#DDEA4D" }}>
    <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" />
  </svg>
);

export default function Topbar() {
  const label = usePageLabel();
  const [tab, setTab] = useState<"inference" | "compute">("inference");

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 40,
        background: "#0a0a0a",
        borderBottom: "1px solid #404040",
        display: "flex",
        alignItems: "stretch",
        zIndex: 60,
        fontFamily: "'Geist', system-ui, sans-serif",
      }}
    >
      {/* Left corner (over the sidebar) — Inference / Compute product switcher */}
      <div style={{ width: 210, display: "flex", alignItems: "center", gap: 4, padding: "0 10px", borderRight: "1px solid #404040", flexShrink: 0 }}>
        {(["inference", "compute"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: "'Geist', system-ui, sans-serif",
                fontSize: 13, fontWeight: active ? 600 : 500, lineHeight: "20px",
                background: active ? "rgba(221,234,77,0.08)" : "transparent",
                color: active ? "#DDEA4D" : "#a3a3a3",
                border: active ? "1px solid rgba(221,234,77,0.30)" : "1px solid transparent",
                padding: "3px 10px", borderRadius: 7, cursor: "pointer",
              }}
            >
              {t === "inference" ? <IcoInference /> : <IcoCompute />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Page label */}
      <div style={{ display: "flex", alignItems: "center", paddingLeft: 16 }}>
        <span style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 13, fontWeight: 500, lineHeight: "20px", color: "#fafafa" }}>
          {label}
        </span>
      </div>

      {/* Right: credit chips + avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", paddingRight: 16 }}>
        {/* Free / promo credits */}
        <div style={chipStyle}>
          <IcoGift />
          <span style={chipText}>$0</span>
        </div>
        {/* Paid credits */}
        <div style={chipStyle}>
          <IcoSpark />
          <span style={chipText}>$52.36M</span>
        </div>
        {/* Avatar */}
        <div style={{
          width: 26, height: 26,
          background: "rgba(199,167,255,0.18)",
          border: "1px solid rgba(199,167,255,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Geist', system-ui, sans-serif",
          fontSize: 12, fontWeight: 600, color: "#c7a7ff",
          cursor: "pointer", borderRadius: 999,
        }}>
          M
        </div>
      </div>
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  padding: "3px 10px",
  border: "1px solid #404040",
  background: "rgba(82,82,82,0.3)",
  borderRadius: 8,
  cursor: "pointer",
};
const chipText: React.CSSProperties = {
  fontFamily: "'Geist', system-ui, sans-serif",
  fontSize: 13, fontWeight: 500, lineHeight: "20px", color: "#fafafa",
};
