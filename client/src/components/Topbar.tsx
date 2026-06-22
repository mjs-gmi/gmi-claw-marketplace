import React from "react";
import { useLocation } from "wouter";

// Breadcrumb segments based on current route
function useBreadcrumb(): string[] {
  const [location] = useLocation();
  if (location.startsWith("/marketplace/")) return ["Home", "Agentbox", "Agent Detail"];
  if (location.startsWith("/marketplace")) return ["Home", "Agentbox"];
  if (location.startsWith("/dashboard")) return ["Home", "My Agents"];
  if (location.startsWith("/deploy")) return ["Home", "Register & List"];
  if (location.startsWith("/list-claw")) return ["Home", "Register & List", "List Agent"];
  return ["Home"];
}

const IcoCredits = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#DDEA4D" }}>
    <path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 3.21-1.81 6-4.72 7.28L13 17v5l5-3-1.22-1.22C19.91 16.26 22 13.27 22 10c0-5.18-3.94-9.45-9-9.95zM11 2.05C5.95 2.55 2 6.82 2 12c0 3.27 2.09 6.26 5.22 7.78L6 21l5 3v-5l-2.28 2.28C6.81 20 5 17.21 5 14c0-4.08 3.05-7.44 7-7.93V2.05z"/>
  </svg>
);

const IcoBack = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#bbb" }}>
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
  </svg>
);

const IcoChevron = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#888" }}>
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z"/>
  </svg>
);

export default function Topbar() {
  const crumbs = useBreadcrumb();

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 210,
        right: 0,
        height: 40,
        background: "#0a0a0a",
        borderBottom: "1px solid #404040",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 16,
        paddingRight: 16,
        zIndex: 60,
        fontFamily: "'Geist', system-ui, sans-serif",
      }}
    >
      {/* Left: back arrow + breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: "2px 6px", borderRadius: 6, color: "#a3a3a3" }}
          onClick={() => window.history.back()}
        >
          <IcoBack />
        </button>
        <div style={{ width: 1, height: 14, background: "#404040" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {crumbs.map((crumb, i) => (
            <React.Fragment key={crumb}>
              {i > 0 && <IcoChevron />}
              <span style={{
                fontFamily: "'Geist', system-ui, sans-serif",
                fontSize: 13,
                fontWeight: i === crumbs.length - 1 ? 500 : 400,
                lineHeight: "20px",
                color: i === crumbs.length - 1 ? "#fafafa" : "#a3a3a3",
              }}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right: Credits + Avatar + status dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Credits chip */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          border: "1px solid #404040",
          background: "rgba(82,82,82,0.3)",
          borderRadius: 8,
          cursor: "pointer",
        }}
        >
          <IcoCredits />
          <span style={{ fontFamily: "'Geist', system-ui, sans-serif", fontSize: 13, fontWeight: 500, lineHeight: "20px", color: "#fafafa" }}>
            $0.00
          </span>
        </div>

        {/* Avatar */}
        <div style={{
          width: 26,
          height: 26,
          background: "rgba(199,167,255,0.18)",
          border: "1px solid rgba(199,167,255,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Geist', system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 600,
          color: "#c7a7ff",
          cursor: "pointer",
          borderRadius: 999,
        }}
        >
          M
        </div>
      </div>
    </div>
  );
}
