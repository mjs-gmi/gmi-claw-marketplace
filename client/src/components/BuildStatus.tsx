import React, { useEffect, useRef, useState } from "react";
import { C, FONT, MONO } from "@/lib/tokens";

// ─── Build status + log ─────────────────────────────────────────────────────
// Design record: docs/frontend/build-status-design-record.md
//
// Two things this exists to fix on the Agent header, which already has a build
// badge but nothing behind it:
//
//   1. `error` and `failed` are DIFFERENT states. `error` = a build step failed
//      (fix your template). `failed` = the build system broke (retry, or
//      escalate). Collapsing both into "Build failed" tells the user to do the
//      wrong thing half the time.
//   2. There is no log anywhere. A failed build with no output is a dead end.
//
// The component takes a minimal view object, NOT the Templates page's data
// model — it must not care whether it is rendered on an agent header, a
// template page, or anywhere else.

export type BuildState = "waiting" | "building" | "ready" | "error" | "failed";

export interface BuildView {
  state: BuildState;
  /** Full log text so far. Fetched incrementally by the caller's read function. */
  log: string;
  durationSec?: number;
  /** What to do next. Required for error/failed — a bare ERROR helps nobody. */
  hint?: string;
}

export const BUILD_STATE_LABEL: Record<BuildState, string> = {
  waiting: "Waiting",
  building: "Building",
  ready: "Ready",
  error: "Build error",
  failed: "Build system failure",
};

function stateColor(s: BuildState): string {
  switch (s) {
    case "ready": return C.ok;
    case "error": return C.err;
    case "failed": return "#fb923c";
    case "building": return C.lime;
    case "waiting": return C.muted;
  }
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const STEPS: { key: BuildState; label: string }[] = [
  { key: "waiting", label: "Pulling image" },
  { key: "building", label: "Building" },
  { key: "ready", label: "Ready" },
];

function Dot({ filled, color }: { filled: boolean; color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 10, height: 10, borderRadius: 999, flexShrink: 0,
        background: filled ? color : "transparent",
        border: `1.6px solid ${filled ? color : "#5a5a5a"}`,
        display: "inline-block",
      }}
    />
  );
}

/** Cap so a runaway build cannot grow the DOM without bound. */
const MAX_LOG_CHARS = 200_000;

export default function BuildStatus({
  build, onRetry, readLogSince,
}: {
  build: BuildView;
  onRetry?: () => void;
  /**
   * GET /templates/{id}/builds/{buildID}/status?logsOffset=
   * Returns only what is new past `offset`; the caller appends. Re-fetching the
   * whole log every poll is the thing to avoid.
   */
  readLogSince?: (offset: number) => { chunk: string; offset: number };
}) {
  const [text, setText] = useState("");
  const offset = useRef(0);
  const bodyRef = useRef<HTMLPreElement | null>(null);
  // Auto-follow the tail only while the reader is already at the bottom. Yanking
  // someone back down while they are reading is the classic log-viewer bug.
  const following = useRef(true);
  const [elapsed, setElapsed] = useState(build.durationSec ?? 0);

  const live = build.state === "building" || build.state === "waiting";
  const bad = build.state === "error" || build.state === "failed";

  useEffect(() => {
    offset.current = 0;
    following.current = true;
    setText("");
    setElapsed(build.durationSec ?? 0);
  }, [build.durationSec, build.state]);

  useEffect(() => {
    const read = readLogSince ?? ((o: number) => ({
      chunk: build.log.slice(o),
      offset: build.log.length,
    }));
    let cancelled = false;
    const pull = () => {
      const { chunk, offset: next } = read(offset.current);
      // A stale response can report an offset behind what we already have.
      if (cancelled || !chunk || next <= offset.current) return;
      offset.current = next;
      setText((t) => {
        const merged = t + chunk;
        return merged.length > MAX_LOG_CHARS ? merged.slice(-MAX_LOG_CHARS) : merged;
      });
    };
    pull();
    if (!live) return;                      // stop polling the moment it settles
    const t = window.setInterval(pull, 900);
    return () => { cancelled = true; clearInterval(t); };
  }, [build.log, live, readLogSince]);

  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [live]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [text]);

  const onScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  const reached = (k: BuildState): boolean => {
    if (build.state === "ready") return true;
    if (k === "waiting") return true;
    if (k === "building") return build.state === "building" || bad;
    return false;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: FONT }}>
      {/* Reduced motion: the pulse is decoration, not information — the label
          already carries the state. Nothing in the app respected this before. */}
      <style>{`
        @keyframes gmiBuildPulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        .gmi-build-pulse { animation: gmiBuildPulse 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .gmi-build-pulse { animation: none; }
        }
      `}</style>

      {/* Stepper — three happy-path stages; a bad build replaces the last one. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {STEPS.map((step, i) => {
          const isLast = i === STEPS.length - 1;
          const showBadEnd = isLast && bad;
          const on = showBadEnd || reached(step.key);
          const color = showBadEnd ? stateColor(build.state) : reached(step.key) ? C.lime : C.muted;
          return (
            <React.Fragment key={step.key}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Dot filled={on} color={color} />
                {/* State is carried by the label too, not colour alone. */}
                <span style={{ fontSize: 12.5, color: on ? C.fg : C.muted }}>
                  {showBadEnd ? BUILD_STATE_LABEL[build.state] : step.label}
                </span>
                {step.key === "building" && build.state === "building" && (
                  <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>{mmss(elapsed)}</span>
                )}
              </span>
              {!isLast && <span aria-hidden="true" style={{ width: 22, height: 1, background: C.border, flexShrink: 0 }} />}
            </React.Fragment>
          );
        })}
        {bad && onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginLeft: "auto", flexShrink: 0,
              fontFamily: FONT, fontSize: 12, fontWeight: 600,
              background: "transparent", color: C.fg,
              border: `1px solid ${C.border}`, borderRadius: 6,
              padding: "5px 12px", cursor: "pointer",
            }}
          >
            Retry build
          </button>
        )}
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: "7px 11px", background: "rgba(255,255,255,0.02)",
            borderBottom: `1px solid ${C.borderSoft}`,
          }}
        >
          <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>
            Build log
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT, fontSize: 11, color: live ? C.ok : C.muted }}>
            {live && <span className="gmi-build-pulse" aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: C.ok }} />}
            {live ? "Live" : BUILD_STATE_LABEL[build.state]}
          </span>
        </div>
        {/* A log that updates on its own is a live region. `polite` so it never
            interrupts, `aria-busy` while the build is still producing output. */}
        <pre
          ref={bodyRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-busy={live}
          aria-label="Build log"
          tabIndex={0}
          style={{
            margin: 0, background: "#000", color: "#d4d4d4",
            fontFamily: MONO, fontSize: 11.5, lineHeight: "19px",
            padding: "9px 11px", maxHeight: 220, overflowY: "auto",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}
        >
          {text
            ? text.split("\n").map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: /^ERROR|error:/i.test(line) ? "#fca5a5"
                      : /^WARNING/i.test(line) ? "#fdba74"
                      : /DONE/.test(line) ? "#86efac"
                      : "#d4d4d4",
                  }}
                >
                  {line}
                </div>
              ))
            : <div style={{ color: C.muted }}>Waiting for the builder to start…</div>}
        </pre>

        {/* A failure ends with what to do about it, not just the last ERROR. */}
        {bad && build.hint && (
          <div
            style={{
              padding: "9px 11px",
              background: build.state === "error" ? "rgba(248,113,113,0.06)" : "rgba(251,146,60,0.06)",
              borderTop: `1px solid ${stateColor(build.state)}44`,
              fontFamily: FONT, fontSize: 12, lineHeight: "17px", color: C.fg,
            }}
          >
            <span style={{ fontWeight: 600, color: stateColor(build.state) }}>
              {build.state === "error" ? "Build error — " : "Build system failure — "}
            </span>
            {build.hint}
          </div>
        )}
      </div>
    </div>
  );
}
