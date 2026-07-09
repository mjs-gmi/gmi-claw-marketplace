import React from "react";
import { Link, useLocation } from "wouter";

// ─── Icons (pixel-style SVGs matching GMI Console) ───────────────────────────

const IcoHome = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>
);
const IcoStorage = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
  </svg>
);
const IcoHistory = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 2"/>
  </svg>
);
const IcoModelsHub = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
  </svg>
);
const IcoPlayground = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 3h20v18H2V3zm2 2v14h16V5H4zm2 3l4 2.5L6 13V8zm5 5h6v2h-6v-2z"/>
  </svg>
);
const IcoMyModels = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
  </svg>
);
const IcoDeployments = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8 2 4 6 4 10c0 2 .7 3.8 1.8 5.2L3 22l6-2c.9.5 1.9.8 3 .8 4.4 0 8-3.6 8-8S16.4 2 12 2zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6zm-1-9v4l3 1.5-.8 1.4L10 12V7h1z"/>
  </svg>
);
const IcoFineTuning = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
  </svg>
);
const IcoWorkflowGallery = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
  </svg>
);
const IcoMyWorkflows = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
  </svg>
);
const IcoTeamSpace = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
  </svg>
);
const IcoMyMedia = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
  </svg>
);
const IcoClawMarketplace = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7 9c-1.93 0-3.5-1.57-3.5-3.5S10.07 8 12 8s3.5 1.57 3.5 3.5S13.93 15 12 15zm0-5c-.83 0-1.5.67-1.5 1.5S11.17 13 12 13s1.5-.67 1.5-1.5S12.83 10 12 10zM3 4h18v2H3z"/>
  </svg>
);
const IcoDashboard = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
  </svg>
);
const IcoDeployList = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3l5 3-5 3V6zm-4 9h10v2H8v-2z"/>
  </svg>
);
const IcoSetting = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
  </svg>
);
const IcoDocs = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-9-4h6v2H9v-2zm0-4h6v2H9v-2zm0-4h4v2H9V8z"/>
  </svg>
);

// ─── Section label (per Figma: Geist 12 / 500 / 16, rgba(250,250,250,0.7)) ──
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "14px 16px 4px",
      fontFamily: "'Geist', system-ui, sans-serif",
      fontSize: 12,
      fontWeight: 500,
      lineHeight: "16px",
      color: "rgba(250,250,250,0.7)",
    }}>
      {children}
    </div>
  );
}

// ─── Nav item ─────────────────────────────────────────────────────────────────
function NavItem({
  href,
  label,
  icon: Icon,
  active,
  external,
}: {
  href: string;
  label: string;
  icon: () => React.ReactElement;
  active?: boolean;
  external?: boolean;
}) {
  const content = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 16px",
        fontFamily: "'Geist', system-ui, sans-serif",
        fontSize: 14,
        fontWeight: active ? 500 : 400,
        lineHeight: "20px",
        color: active ? "#DDEA4D" : "#fafafa",
        cursor: "pointer",
        transition: "color 0.12s, background 0.12s",
        background: active ? "rgba(221,234,77,0.06)" : "transparent",
        borderLeft: active ? "2px solid #DDEA4D" : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      <Icon />
      <span>{label}</span>
    </div>
  );

  if (external) {
    return <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{content}</a>;
  }
  return <Link href={href}>{content}</Link>;
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────
export default function Navbar() {
  const [location] = useLocation();

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href));

  return (
    <aside
      style={{
        position: "fixed",
        top: 40,
        left: 0,
        height: "calc(100vh - 40px)",
        width: 210,
        background: "#0a0a0a",
        borderRight: "1px solid #404040",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* Nav body */}
      <nav style={{ flex: 1, paddingTop: "0.5rem" }}>

        {/* Top-level */}
        <NavItem href="https://console.gmicloud.ai" label="Home" icon={IcoHome} external />
        <NavItem href="https://console.gmicloud.ai/storage" label="Storage" icon={IcoStorage} external />

        {/* Explore */}
        <SectionLabel>Explore</SectionLabel>
        <NavItem href="https://console.gmicloud.ai/models" label="Model Hub" icon={IcoModelsHub} external />
        <NavItem href="https://console.gmicloud.ai/playground" label="Playground" icon={IcoPlayground} external />
        <NavItem href="https://console.gmicloud.ai/history" label="History" icon={IcoHistory} external />

        {/* Model Management */}
        <SectionLabel>Model Management</SectionLabel>
        <NavItem href="https://console.gmicloud.ai/my-models" label="My Models" icon={IcoMyModels} external />
        <NavItem href="https://console.gmicloud.ai/deployments" label="Deployments" icon={IcoDeployments} external />
        <NavItem href="https://console.gmicloud.ai/fine-tuning" label="Fine-Tuning" icon={IcoFineTuning} external />

        {/* Studio */}
        <SectionLabel>Studio</SectionLabel>
        <NavItem href="https://console.gmicloud.ai/workflows" label="Gallery" icon={IcoWorkflowGallery} external />
        <NavItem href="https://console.gmicloud.ai/my-workflows" label="My Workflows" icon={IcoMyWorkflows} external />
        <NavItem href="https://console.gmicloud.ai/team" label="Team Space" icon={IcoTeamSpace} external />
        <NavItem href="https://console.gmicloud.ai/media" label="My Media" icon={IcoMyMedia} external />

        {/* Agentbox */}
        <SectionLabel>Agentbox</SectionLabel>
        <NavItem href="/marketplace" label="Browse Agents" icon={IcoClawMarketplace} active={isActive("/marketplace")} />
        <NavItem href="/dashboard" label="My Agents" icon={IcoDashboard} active={isActive("/dashboard")} />
        <NavItem href="/deploy" label="Register & List" icon={IcoDeployList} active={isActive("/deploy")} />

      </nav>

      {/* Bottom: Settings + Docs */}
      <div style={{ borderTop: "1px solid #1a1a1a", paddingBottom: "0.5rem", marginTop: "auto" }}>
        <NavItem href="https://console.gmicloud.ai/settings" label="Settings" icon={IcoSetting} external />
        <NavItem href="https://docs.gmicloud.ai" label="Docs" icon={IcoDocs} external />
      </div>
    </aside>
  );
}
