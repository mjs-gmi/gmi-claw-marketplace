import React from "react";
import { Link, useLocation } from "wouter";

// ─── Icons ───────────────────────────────────────────────────────────────────

const IcoHome = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
  </svg>
);
const IcoStorage = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6zm0 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2zm4-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm0-8a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
  </svg>
);
const IcoModelsHub = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);
const IcoPlayground = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 3h20v18H2V3zm2 2v14h16V5H4zm2 2l4 3-4 3V7zm5 6h6v2h-6v-2z"/>
  </svg>
);
const IcoMyModels = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
  </svg>
);
const IcoDeployments = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8 2 4 6 4 10c0 2 1 4 2 5l-2 5 5-2c1 1 3 2 3 2s2-1 3-2l5 2-2-5c1-1 2-3 2-5 0-4-4-8-8-8zm0 2c3 0 6 3 6 6 0 1.5-.5 3-1.5 4L12 16l-4.5-2C6.5 13 6 11.5 6 10c0-3 3-6 6-6zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
  </svg>
);
const IcoFineTuning = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
  </svg>
);
const IcoWorkflowGallery = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/>
  </svg>
);
const IcoMyWorkflows = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
  </svg>
);
const IcoTeamSpace = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
  </svg>
);
const IcoMyMedia = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
  </svg>
);
const IcoClawMarketplace = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7 9c-1.93 0-3.5-1.57-3.5-3.5S10.07 8 12 8s3.5 1.57 3.5 3.5S13.93 15 12 15zm0-5c-.83 0-1.5.67-1.5 1.5S11.17 13 12 13s1.5-.67 1.5-1.5S12.83 10 12 10zM3 4h18v2H3z"/>
  </svg>
);
const IcoDashboard = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 3h20v18H2V3zm2 2v14h16V5H4zm2 2l4 3-4 3V7zm5 6h6v2h-6v-2z"/>
  </svg>
);
const IcoList2 = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 5h2v2H3V5zm4 0h14v2H7V5zM3 11h2v2H3v-2zm4 0h14v2H7v-2zM3 17h2v2H3v-2zm4 0h14v2H7v-2z"/>
  </svg>
);

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "1.125rem 1rem 0.375rem",
      fontFamily: "'GeistMono', monospace",
      fontSize: "0.5625rem",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#999999",
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
        gap: "0.5rem",
        padding: "0.35rem 1rem",
        fontFamily: "'GeistMono', monospace",
        fontSize: "0.6875rem",
        letterSpacing: "0.02em",
        color: active ? "#DDEA4D" : "#cccccc",
        cursor: "pointer",
        transition: "color 0.1s",
        background: "transparent",
        borderLeft: active ? "2px solid #DDEA4D" : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.color = "#ffffff";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.color = "#cccccc";
      }}
    >
      <Icon />
      <span>{label}</span>
    </div>
  );

  if (external) {
    return <a href={href} style={{ textDecoration: "none" }}>{content}</a>;
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
        top: 0,
        left: 0,
        height: "100vh",
        width: "220px",
        background: "#000000",
        borderRight: "1px solid #1a1a1a",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* Logo */}
      <Link href="/marketplace">
        <div style={{ padding: "1rem 1rem 0.875rem", borderBottom: "1px solid #1a1a1a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 200 56" aria-label="GMI" style={{ width: "88px", height: "auto" }}>
            <path fill="#fff" d="M54.98 22.138a17.4 17.4 0 0 0-6.377-1.237 17.04 17.04 0 0 0-15.304 9.54c-.91 1.858-1.37 3.899-2.203 5.793-1.226 2.804-2.848 5.213-4.73 7.04a16 16 0 0 1-1.852 1.536c-1.862 1.292-4.223 2.206-6.515 2.206-4.89 0-9.041-4.103-9.041-9.05a9.03 9.03 0 0 1 4.072-7.551c2.424-1.594 5.793-1.92 8.456-.796a13.57 13.57 0 0 1-1.875-6.91c0-.585.036-1.153.118-1.715.706-5.727 4.97-10.365 10.5-11.638a13.3 13.3 0 0 1 3.07-.351c2.204 0 4.276.519 6.122 1.453a13.6 13.6 0 0 1 5.24 4.625l6.635-4.454A21.7 21.7 0 0 0 45.9 5.053 21.4 21.4 0 0 0 34.3 1.03c-.328-.023-.663-.03-.998-.03-3.027 0-5.917.621-8.538 1.752-7.56 3.251-12.916 10.694-13.136 19.386a17.07 17.07 0 0 0-8.66 7.8A16.94 16.94 0 0 0 .96 37.966c0 8.81 6.67 16.055 15.222 16.96.059.006.124.012.183.012q.34.036.68.053c.043.007.08.007.119.007q.412.021.84.023c.286 0 .562-.007.84-.023.037 0 .073 0 .12-.007a10 10 0 0 0 .679-.053q.097-.001.184-.013c2.89-.286 5.632-1.262 8.134-2.81 2.227-1.368 4.253-3.186 6.043-5.355a25 25 0 0 0 1.823-2.482c2.584-4.07 2.959-5.852 4.174-9.093 1.556-4.155 4.818-6.266 8.61-6.266 1.731 0 3.538.543 4.976 1.5a9.06 9.06 0 0 1 4.066 7.55c0 4.99-4.056 9.05-9.041 9.05-1.6 0-3.1-.417-4.408-1.154a39 39 0 0 1-3.1 4.813c-.466.621-.955 1.22-1.451 1.798a16.9 16.9 0 0 0 8.962 2.548c9.406 0 17.038-7.633 17.038-17.055 0-7.166-4.414-13.3-10.66-15.828zM139.205 5.535h-8.4v44.958h8.4zM199.487 5.535h-8.401v44.958h8.401z" />
            <path fill="#fff" d="M145.533 5.535h-8.4l10.318 44.958h8.404zM180.776 5.535h-8.401v44.958h8.401z" />
            <path fill="#fff" d="M164.252 50.493h-8.4L166.17 5.535h8.401zM122.107 27.21v7.93l-.059.076h-24.22V27.21h24.282z" />
            <path fill="#fff" d="M122.113 35.218V45.67c-5.097 3.61-11.609 5.796-18.355 5.796-17.398 0-28.531-10.55-28.531-23.564S85.296 4.34 103.758 4.34c6.572 0 13.16 2.255 18.355 5.97v10.466c-3.816-4.809-11.038-8.431-18.355-8.431-12.843 0-20.614 6.11-20.614 15.558s8.362 15.56 20.614 15.56c7.386 0 14.5-3.495 18.293-8.245h.062" />
          </svg>
          <div style={{ width: "6px", height: "6px", background: "#DDEA4D" }} />
        </div>
      </Link>

      {/* Nav body */}
      <nav style={{ flex: 1 }}>

        {/* Top-level links */}
        <div style={{ paddingTop: "0.5rem" }}>
          <NavItem href="https://console.gmicloud.ai" label="Home" icon={IcoHome} external />
          <NavItem href="https://console.gmicloud.ai/storage" label="Storage" icon={IcoStorage} external />
        </div>

        {/* Explore */}
        <SectionLabel>Explore</SectionLabel>
        <NavItem href="https://console.gmicloud.ai/models" label="Models Hub" icon={IcoModelsHub} external />
        <NavItem href="https://console.gmicloud.ai/playground" label="Playground" icon={IcoPlayground} external />

        {/* Model Management */}
        <SectionLabel>Model Management</SectionLabel>
        <NavItem href="https://console.gmicloud.ai/my-models" label="My Models" icon={IcoMyModels} external />
        <NavItem href="https://console.gmicloud.ai/deployments" label="Deployments" icon={IcoDeployments} external />
        <NavItem href="https://console.gmicloud.ai/fine-tuning" label="Fine-Tuning" icon={IcoFineTuning} external />

        {/* Studio */}
        <SectionLabel>Studio</SectionLabel>
        <NavItem href="https://console.gmicloud.ai/workflows" label="Workflow Gallery" icon={IcoWorkflowGallery} external />
        <NavItem href="https://console.gmicloud.ai/my-workflows" label="My Workflows" icon={IcoMyWorkflows} external />
        <NavItem href="https://console.gmicloud.ai/team" label="Team Space" icon={IcoTeamSpace} external />
        <NavItem href="https://console.gmicloud.ai/media" label="My Media" icon={IcoMyMedia} external />

        {/* Claw Marketplace — same level as Explore / Model Management / Studio */}
        <SectionLabel>Claw Marketplace</SectionLabel>
        <NavItem
          href="/marketplace"
          label="Browse Agents"
          icon={IcoClawMarketplace}
          active={isActive("/marketplace")}
        />
        <NavItem
          href="/dashboard"
          label="My Claws"
          icon={IcoDashboard}
          active={isActive("/dashboard")}
        />
        <NavItem
          href="/deploy"
          label="Deploy"
          icon={IcoDeployments}
          active={isActive("/deploy")}
        />
        <NavItem
          href="/list-claw"
          label="List"
          icon={IcoList2}
          active={isActive("/list-claw")}
        />

      </nav>

      {/* Bottom */}
      <div style={{ borderTop: "1px solid #1a1a1a", padding: "0.75rem" }}>
        <button
          style={{ width: "100%", padding: "0.4375rem 0", textAlign: "center", border: "1px solid #2a2a2a", color: "#999999", background: "transparent", fontSize: "0.5625rem", letterSpacing: "0.1em", fontFamily: "'GeistMono', monospace", textTransform: "uppercase", cursor: "pointer", marginBottom: "0.375rem" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#555555"; (e.currentTarget as HTMLButtonElement).style.color = "#ffffff"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a"; (e.currentTarget as HTMLButtonElement).style.color = "#999999"; }}
        >
          Sign In
        </button>
        <div style={{ fontFamily: "'GeistMono', monospace", fontSize: "0.4375rem", letterSpacing: "0.12em", color: "#222222", textAlign: "center", paddingTop: "0.25rem" }}>
          GMI CLAW v0.1.0-pre
        </div>
      </div>
    </aside>
  );
}
