import React, { useEffect, useState } from "react";
import { C, FONT } from "@/lib/tokens";
import {
  aboutFor,
  chipsFor,
  isVerified,
  modelFor,
  taglineFor,
  type Claw,
} from "@/lib/clawData";
import { isPlanEligibleAgent, CODING_AGENT_PLAN } from "@/lib/modelsPlan";
import V2Badge from "@/components/V2Badge";

// ─── Browse Agents → card detail (v1.3 §A) ──────────────────────────────────
// Clicking a marketplace card slides this panel in from the right instead of
// navigating away, so the catalog stays behind it and closing returns you to
// the exact scroll position. The v1.2 set never drew this — a card click still
// went to /marketplace/{id} — so the whole surface is new and carries V2.
// Two modes:
//   "browse"  — public catalog view, footer CTA continues into My Agents
//   "listing" — "View public listing" from My Agents; same body, no CTA
export type DrawerMode = "browse" | "listing";

// ─── Icons ──────────────────────────────────────────────────────────────────
const IconX = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconVerified = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#3b9eff" aria-hidden="true">
    <path d="M12 1.5 14.6 4l3.5-.3.6 3.5 3 1.9-1.6 3.2 1.6 3.2-3 1.9-.6 3.5-3.5-.3L12 22.5 9.4 20l-3.5.3-.6-3.5-3-1.9L3.9 12 2.3 8.8l3-1.9.6-3.5 3.5.3z" />
    <path d="m10.8 15.3-2.9-2.9 1.2-1.2 1.7 1.7 4-4 1.2 1.2z" fill="#0a0a0a" />
  </svg>
);
const IconUnverified = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
  </svg>
);
const IconExternal = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);
const IconPlay = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const IconDoc = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);
const IconEye = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconImages = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="14" height="14" rx="2" /><path d="M21 7v12a2 2 0 0 1-2 2H7" />
    <circle cx="8" cy="10" r="1.4" /><path d="m4 17 4-4 5 5" />
  </svg>
);
const IconArrowRight = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);
// Lightbox toolbar
const IconZoomOut = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6" />
  </svg>
);
const IconZoomIn = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6M11 8v6" />
  </svg>
);
const IconRotateLeft = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5v5h5" /><path d="M3.5 14a8.5 8.5 0 1 0 2-7.5L3 10" />
  </svg>
);
const IconRotateRight = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 5v5h-5" /><path d="M20.5 14a8.5 8.5 0 1 1-2-7.5L21 10" />
  </svg>
);
const IconDownload = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
  </svg>
);

// ─── Square publisher avatar ────────────────────────────────────────────────
function Avatar({ claw, size = 56 }: { claw: Claw; size?: number }) {
  const initials = claw.name.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 2) || "Ag";
  return claw.logoUrl ? (
    <img
      src={claw.logoUrl}
      alt=""
      style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
    />
  ) : (
    <span
      style={{
        width: size, height: size, borderRadius: 8, flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "#fafafa", color: "#0a0a0a",
        fontFamily: FONT, fontSize: size * 0.34, fontWeight: 700, letterSpacing: "-0.02em",
      }}
    >
      {initials}
    </span>
  );
}

// ─── Meta strip cell ────────────────────────────────────────────────────────
function MetaCell({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        flex: 1, minWidth: 0, padding: "14px 20px",
        borderRight: last ? "none" : `1px solid ${C.border}`,
      }}
    >
      <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontFamily: FONT, fontSize: 14, color: C.fg,
          display: "flex", alignItems: "center", gap: 6,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Lightbox — sample-output viewer with zoom / rotate / download ──────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const btn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: 6,
    background: "transparent", border: "none", color: C.fg, cursor: "pointer",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 120,
        background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 48,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: 20, right: 24,
          display: "flex", alignItems: "center", gap: 2,
          background: "#171717", border: `1px solid ${C.border}`, borderRadius: 8, padding: 4,
        }}
      >
        <button style={btn} onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))} title="Zoom out"><IconZoomOut /></button>
        <button style={btn} onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} title="Zoom in"><IconZoomIn /></button>
        <button style={btn} onClick={() => setRot((r) => r - 90)} title="Rotate left"><IconRotateLeft /></button>
        <button style={btn} onClick={() => setRot((r) => r + 90)} title="Rotate right"><IconRotateRight /></button>
        <a style={{ ...btn, textDecoration: "none" }} href={src} download title="Download"><IconDownload /></a>
        <button style={btn} onClick={onClose} title="Close"><IconX size={17} /></button>
      </div>
      <img
        onClick={(e) => e.stopPropagation()}
        src={src}
        alt=""
        style={{
          maxWidth: "100%", maxHeight: "100%",
          transform: `scale(${zoom}) rotate(${rot}deg)`,
          transition: "transform .18s ease",
          background: "#fff", borderRadius: 4,
        }}
      />
    </div>
  );
}

// ─── Media & Links tab ──────────────────────────────────────────────────────
function MediaTab({ claw, onPreview }: { claw: Claw; onPreview: (src: string) => void }) {
  const links = [
    claw.demoVideoUrl && { icon: <IconPlay />, title: "Watch demo", sub: "Video · Opens in new tab", href: claw.demoVideoUrl },
    claw.docsUrl && { icon: <IconDoc />, title: "View documentation", sub: "Guide · Opens in new tab", href: claw.docsUrl },
  ].filter(Boolean) as { icon: React.ReactNode; title: string; sub: string; href: string }[];
  const samples = claw.sampleImages ?? [];

  if (links.length === 0 && samples.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "120px 0", textAlign: "center" }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 44, height: 44, borderRadius: 8,
            background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, color: C.fg,
          }}
        >
          <IconImages />
        </span>
        <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 500, color: C.fg }}>No media yet</div>
        <div style={{ fontFamily: FONT, fontSize: 14, color: C.muted }}>
          The user has not yet uploaded any media files.
        </div>
      </div>
    );
  }

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.02)",
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 16,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {links.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg }}>Related resources</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 2 }}>Links supplied by the publisher</div>
          <div style={{ height: 1, background: C.border, margin: "14px 0" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
            {links.map((l) => (
              <a
                key={l.title}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: "rgba(255,255,255,0.03)", border: `1px solid ${C.borderSoft}`,
                  borderRadius: 8, padding: "12px 14px", textDecoration: "none",
                }}
              >
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                    background: "rgba(221,234,77,0.12)", color: C.lime,
                  }}
                >
                  {l.icon}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FONT, fontSize: 14, fontWeight: 500, color: C.fg }}>{l.title}</span>
                  <span style={{ display: "block", fontFamily: FONT, fontSize: 12, color: C.muted }}>{l.sub}</span>
                </span>
                <span style={{ color: C.muted, display: "flex" }}><IconExternal /></span>
              </a>
            ))}
          </div>
        </div>
      )}

      {samples.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.fg }}>Sample outputs</div>
          <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, marginTop: 2 }}>Images uploaded by the publisher</div>
          <div style={{ height: 1, background: C.border, margin: "14px 0" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
            {samples.map((src, i) => (
              <button
                key={i}
                onClick={() => onPreview(src)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: "rgba(255,255,255,0.03)", border: `1px solid ${C.borderSoft}`,
                  borderRadius: 8, padding: "10px 14px", cursor: "pointer", textAlign: "left",
                }}
              >
                <img src={src} alt="" style={{ width: 34, height: 34, borderRadius: 4, objectFit: "cover", background: "#fff", flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: FONT, fontSize: 14, color: C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {claw.name} output {i + 1}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT, fontSize: 12, color: C.muted, flexShrink: 0 }}>
                  <IconEye /> Preview
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Drawer ─────────────────────────────────────────────────────────────────
export default function AgentDrawer({
  claw,
  mode = "browse",
  onClose,
  onSetUp,
}: {
  claw: Claw | null;
  mode?: DrawerMode;
  onClose: () => void;
  onSetUp?: (claw: Claw) => void;
}) {
  const [tab, setTab] = useState<"overview" | "media">("overview");
  const [preview, setPreview] = useState<string | null>(null);

  // Reset per-agent view state whenever a different card opens the drawer.
  useEffect(() => {
    setTab("overview");
    setPreview(null);
  }, [claw?.id]);

  useEffect(() => {
    if (!claw) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !preview) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [claw, preview, onClose]);

  if (!claw) return null;

  const verified = isVerified(claw);
  const planEligible = isPlanEligibleAgent(claw.typeLabel);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 90 }}
      />
      <aside
        role="dialog"
        aria-label={`${claw.name} details`}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 100,
          width: "min(720px, 100vw)",
          background: "#0d0d0d",
          borderLeft: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column",
          fontFamily: FONT,
          animation: "gmiDrawerIn .22s cubic-bezier(.22,.61,.36,1)",
        }}
      >
        <style>{`@keyframes gmiDrawerIn{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}}`}</style>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ padding: "22px 24px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <Avatar claw={claw} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: FONT, fontSize: 24, fontWeight: 600, lineHeight: "30px", color: C.fg, margin: 0, letterSpacing: "-0.01em" }}>
                {claw.name}
                <V2Badge title="New in Agentbox v1.3 — card detail" />
              </h2>
              <div style={{ fontFamily: FONT, fontSize: 14, color: C.muted, marginTop: 4 }}>
                {chipsFor(claw).join(" · ")}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: "none", border: "none", color: C.fg, cursor: "pointer", display: "flex", padding: 4, flexShrink: 0 }}
            >
              <IconX />
            </button>
          </div>
          <p style={{ fontFamily: FONT, fontSize: 14, lineHeight: "20px", color: C.fg, margin: "16px 0 0" }}>
            {mode === "listing"
              ? "This is how your Agent currently appears in Browse Agents"
              : taglineFor(claw)}
          </p>
        </div>

        {/* ── Meta strip ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex", flexShrink: 0,
            borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
          }}
        >
          <MetaCell label="Publisher">{claw.publisher}</MetaCell>
          <MetaCell label="Hosting">
            {verified ? <IconVerified /> : <IconUnverified />}
            {verified ? "Verified" : "Not Verified"}
          </MetaCell>
          <MetaCell label="Category">{claw.typeLabel}</MetaCell>
          <MetaCell label="Model" last>{modelFor(claw)}</MetaCell>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, padding: "0 24px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {([["overview", "Overview"], ["media", "Media & Links"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                fontFamily: FONT, fontSize: 14, fontWeight: 500,
                color: tab === key ? C.fg : C.muted,
                background: "none", border: "none", cursor: "pointer",
                padding: "14px 8px",
                borderBottom: `2px solid ${tab === key ? C.fg : "transparent"}`,
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px" }}>
          {tab === "overview" ? (
            <>
              {planEligible && (
                <div
                  style={{
                    background: "rgba(221,234,77,0.06)", border: "1px solid rgba(221,234,77,0.30)",
                    borderRadius: 8, padding: "10px 14px", marginBottom: 18,
                    fontFamily: FONT, fontSize: 13, color: C.fg,
                  }}
                >
                  This Agent's model is <span style={{ color: C.lime, fontWeight: 600 }}>{CODING_AGENT_PLAN.name}</span> eligible.
                  Benefits vary by account.
                </div>
              )}
              <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: "0 0 14px" }}>
                About this Agent
              </h3>
              <div style={{ fontFamily: FONT, fontSize: 14, lineHeight: "22px", color: "#d4d4d4", whiteSpace: "pre-wrap" }}>
                {aboutFor(claw)}
              </div>
            </>
          ) : (
            <>
              <h3 style={{ fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: "0 0 4px" }}>
                Publisher media
              </h3>
              <p style={{ fontFamily: FONT, fontSize: 13, color: C.muted, margin: "0 0 16px" }}>
                Preview the publisher's sample outputs, then open supporting resources when needed.
              </p>
              <MediaTab claw={claw} onPreview={setPreview} />
            </>
          )}
        </div>

        {/* ── Footer CTA — browse mode only ──────────────────────────────── */}
        {mode === "browse" && (
          <div
            style={{
              flexShrink: 0, borderTop: `1px solid ${C.border}`,
              padding: "16px 24px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
            }}
          >
            <span style={{ fontFamily: FONT, fontSize: 13, color: C.muted }}>
              Continue in My Agents to configure settings and deploy.
            </span>
            <button
              onClick={() => onSetUp?.(claw)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0,
                fontFamily: FONT, fontSize: 14, fontWeight: 600,
                background: C.lime, color: C.limeText,
                border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer",
              }}
            >
              Set up this Agent <IconArrowRight />
            </button>
          </div>
        )}
      </aside>

      {preview && <Lightbox src={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
