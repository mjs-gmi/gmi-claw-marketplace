import { useState } from "react";

// Single shared copy-to-clipboard control used across Dashboard / Marketplace /
// DeployWizard. Replaces the old per-page CopyChip / CopyButton / CopyInline.
// `label` toggles the "Copy"/"Copied" text (off = icon-only, matches the old
// inline usage next to URLs / keys).

const LIME = "#DDEA4D";
const MUTED = "#a3a3a3";
const FONT = "'Geist', system-ui, sans-serif";

const CopyIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const CheckIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default function CopyButton({
  value, label = true, size = 11,
}: {
  value: string;
  label?: boolean;
  size?: number;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label={copied ? "Copied" : "Copy"}
      style={{
        display: "inline-flex", alignItems: "center", gap: label ? 6 : 4,
        background: "transparent", border: "none",
        color: copied ? LIME : MUTED,
        fontFamily: FONT, fontSize: 12, fontWeight: 500, lineHeight: "16px",
        cursor: "pointer", padding: label ? "2px 6px" : 2, borderRadius: 6,
      }}
    >
      {copied ? <CheckIcon size={size} /> : <CopyIcon size={size} />}
      {label && (copied ? "Copied" : "Copy")}
    </button>
  );
}
