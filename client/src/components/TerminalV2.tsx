// ─── Terminal — Confluence §C ───────────────────────────────────────────────
// A persistent session, not a command submitter. The data plane backs it with a
// real TTY:
//
//   POST /shell                                open the session
//   wss://{sandbox_key}.{domain}/shell/connect the stream itself
//   POST /shell/control {action:"close"}       hang up
//
// §I — the session OUTLIVES this pane. Closing the drawer does not kill it, and
// reconnecting lands back in the same PTY, so the reconnect path must never warn
// that running work will be lost: it will not be. That is the opposite of what
// this component used to say.
//
// Whether the control channel carries cols/rows is unconfirmed, so there is no
// drag-to-resize here. A handle that silently failed to propagate would render
// every program inside at the wrong width while looking like it worked.
//
// This is a prototype: the transport is simulated, but every state the real
// stream produces has a rendering.
import { useEffect, useMemo, useRef, useState } from "react";
import { C, FONT, MONO } from "@/lib/tokens";
import V2Badge from "@/components/V2Badge";

type Conn = "connecting" | "connected" | "closed" | "dropped";

interface Line { text: string; kind: "out" | "in" | "sys" | "err" }

// The prompt carries the cwd, because a retained `cd` is the whole point of a
// session — showing a fixed `~$` after cd would hide it.
function promptFor(cwd: string): string {
  const short = cwd === "/home/user" ? "~" : cwd.replace(/^\/home\/user(?=\/|$)/, "~");
  return `user@sandbox:${short}$`;
}

/** Rows the pane can show at its current pixel height. */
function rowsFor(px: number): number {
  return Math.max(6, Math.floor((px - 16) / 18));
}
/** Cols at its current pixel width, at the mono font's advance width. */
function colsFor(px: number): number {
  return Math.max(20, Math.floor((px - 20) / 7.1));
}

// Canned responses. A real TTY would stream these back over the socket; what
// matters here is that state is retained between commands — that is the whole
// difference from Run.
type Responded = { lines: Line[]; control?: "clear" | "exit" };

function respond(cmd: string, cwdRef: { cwd: string }): Responded {
  const c = cmd.trim();
  if (!c) return { lines: [] };
  if (c === "clear") return { lines: [], control: "clear" };
  if (c === "pwd") return { lines: [{ text: cwdRef.cwd, kind: "out" }] };
  if (c.startsWith("cd")) {
    const arg = c.slice(2).trim() || "/home/user";
    // cd is retained — this is the point of a session
    cwdRef.cwd = arg.startsWith("/") ? arg : `${cwdRef.cwd.replace(/\/$/, "")}/${arg}`;
    return { lines: [] };
  }
  if (c === "ls") return { lines: [{ text: "in.json  main.py  output/  requirements.txt", kind: "out" }] };
  if (c === "whoami") return { lines: [{ text: "user", kind: "out" }] };
  if (c === "env") {
    return { lines: [
      { text: "GMI_MAAS_API_KEY=[redacted]", kind: "out" },
      { text: "GMI_MAAS_BASE_URL=https://api.gmi-serving.com", kind: "out" },
      { text: "HOME=/home/user", kind: "out" },
    ] };
  }
  if (c === "exit") return { lines: [], control: "exit" };
  if (c.startsWith("python") || c.startsWith("node") || c.startsWith("./")) {
    return { lines: [{ text: "wrote output/result.json (3 records)", kind: "out" }] };
  }
  return { lines: [{ text: `sh: command not found: ${c.split(" ")[0]}`, kind: "err" }] };
}

export default function TerminalV2({
  sandboxId, sandboxKey, domain, canConnect, blockedReason, onConnect,
}: {
  sandboxId: string;
  sandboxKey: string;
  domain: string;
  /** Running only — a pending or suspended Sandbox has no TTY to attach to. */
  canConnect: boolean;
  blockedReason?: string;
  /**
   * Attaching a TTY requires POST /sandboxes/{id}/connect to exchange data-plane
   * credentials, and that call carries a `timeout`. So opening this tab changes
   * the sandbox's expiry — a control-plane side effect of a thing that looks
   * purely local. Returns what it did so the notice below can state it, or null
   * when the expiry was already further out and nothing moved.
   */
  onConnect?: () => { extendedToMins: number } | null;
}) {
  const [conn, setConn] = useState<Conn>("connecting");
  // What the connect call did to the expiry, if anything. Shown once per attach.
  const [expiryNote, setExpiryNote] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [histIdx, setHistIdx] = useState(-1);
  const [paneH, setPaneH] = useState(300);
  const [lastResize, setLastResize] = useState<{ cols: number; rows: number } | null>(null);
  const [width, setWidth] = useState(520);

  const cwdRef = useRef({ cwd: "/home/user" });
  // Mirrored into state so the prompt re-renders after a cd.
  const [cwd, setCwd] = useState("/home/user");
  const sentRef = useRef<string[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);

  const size = useMemo(() => ({ cols: colsFor(width), rows: rowsFor(paneH) }), [width, paneH]);
  // `open()` runs on a timer, so it needs the size as of when it fires.
  const sizeRef = useRef(size);
  useEffect(() => { sizeRef.current = size; }, [size]);

  // ── connect ────────────────────────────────────────────────────────────
  const openTimer = useRef<number | null>(null);
  const open = () => {
    setConn("connecting");
    setLines([]);
    cwdRef.current.cwd = "/home/user";
    setCwd("/home/user");
    const t = window.setTimeout(() => {
      setConn("connected");
      // Announce the side effect at the moment it happens, not in a doc.
      const moved = onConnect?.();
      setExpiryNote(
        moved
          ? `Connecting extended this sandbox to ${moved.extendedToMins} minutes from now.`
          : null,
      );
      setLines([
        // Read the size at connect time, not at mount: on a full-width page the
        // ResizeObserver has already corrected it and printing the stale value
        // makes the resize story look decorative.
        { text: `Connected to ${sandboxKey}.${domain} — ${sizeRef.current.cols}×${sizeRef.current.rows}`, kind: "sys" },
        { text: "Interactive TTY. Ctrl-C interrupts, Ctrl-D or `exit` closes.", kind: "sys" },
      ]);
    }, 900);
    openTimer.current = t;
    timers.current.push(t);
  };

  useEffect(() => {
    if (!canConnect) {
      // A pause mid-connect used to leave the 900ms timer running, so `conn`
      // became "connected" behind the blocked banner and every later control
      // keyed off a lie.
      if (openTimer.current !== null) { window.clearTimeout(openTimer.current); openTimer.current = null; }
      setConn("closed");
      return;
    }
    open();
    return () => {
      if (openTimer.current !== null) { window.clearTimeout(openTimer.current); openTimer.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canConnect, sandboxId]);

  // Track the pane's real width so the reported size is the real size.
  useEffect(() => {
    const el = paneRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Every size change goes down the control channel. §C: if this is only a CSS
  // change, programs inside the sandbox lay out at the wrong width.
  // Only a real size *change* is a resize. Firing on the connect transition
  // printed a control message for a size the banner had just announced.
  const reportedRef = useRef<string | null>(null);
  useEffect(() => {
    if (conn !== "connected") { reportedRef.current = null; return; }
    const key = `${size.cols}x${size.rows}`;
    setLastResize(size);
    if (reportedRef.current === null) { reportedRef.current = key; return; }
    if (reportedRef.current === key) return;
    reportedRef.current = key;
    const t = window.setTimeout(() => {
      setLines((l) => [...l, { text: `[control] resize → ${size.cols}×${size.rows}`, kind: "sys" }]);
    }, 60);
    timers.current.push(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.cols, size.rows, conn]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // ── close — the real thing, not just hiding the pane ───────────────────
  const close = (why: "user" | "drop") => {
    setConn(why === "user" ? "closed" : "dropped");
    setLines((l) => [...l, {
      text: why === "user"
        ? "[control] close sent — session terminated on the Sandbox"
        : "[stream] connection lost",
      kind: why === "user" ? "sys" : "err",
    }]);
  };

  const submit = () => {
    if (conn !== "connected") return;
    const cmd = input;
    setInput("");
    setHistIdx(-1);
    if (cmd.trim()) sentRef.current = [cmd, ...sentRef.current].slice(0, 50);
    const prompt = promptFor(cwdRef.current.cwd);
    setLines((l) => [...l, { text: `${prompt} ${cmd}`, kind: "in" }]);
    const out = respond(cmd, cwdRef.current);
    setCwd(cwdRef.current.cwd);
    if (out.control === "clear") { setLines([]); return; }
    if (out.control === "exit") { close("user"); return; }
    if (out.lines.length) setLines((l) => [...l, ...out.lines]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { submit(); return; }
    // Ctrl-C interrupts the line, the way a TTY does — Run cannot do this.
    if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      setLines((l) => [...l, { text: `${promptFor(cwdRef.current.cwd)} ${input}^C`, kind: "in" }]);
      setInput("");
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "d") { e.preventDefault(); close("user"); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, sentRef.current.length - 1);
      if (next >= 0) { setHistIdx(next); setInput(sentRef.current[next]); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.max(-1, histIdx - 1);
      setHistIdx(next);
      setInput(next >= 0 ? sentRef.current[next] : "");
    }
  };

  const lineColor = (k: Line["kind"]) =>
    k === "in" ? C.lime : k === "err" ? "#fca5a5" : k === "sys" ? C.muted : C.fg;

  const statusChip = () => {
    const m: Record<Conn, { label: string; color: string }> = {
      connecting: { label: "Connecting…", color: C.warn },
      connected:  { label: "Connected",   color: C.ok },
      closed:     { label: "Closed",      color: C.muted },
      dropped:    { label: "Disconnected", color: C.err },
    };
    const v = m[conn];
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: FONT, fontSize: 11, fontWeight: 600,
        color: v.color, background: `${v.color}1f`, border: `1px solid ${v.color}55`,
        padding: "1px 8px", borderRadius: 6,
      }}>
        {conn === "connecting" && (
          <span style={{ width: 6, height: 6, borderRadius: 999, background: v.color, animation: "pulse 1.2s ease-in-out infinite" }} />
        )}
        {v.label}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FONT, fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Terminal <V2Badge /> · <span style={{ fontFamily: MONO, textTransform: "none", letterSpacing: "normal" }}>/shell/connect</span>
        </span>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          {statusChip()}
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted }}>
            {lastResize ? `${lastResize.cols}×${lastResize.rows}` : `${size.cols}×${size.rows}`}
          </span>
        </div>
      </div>

      <>

      {!canConnect ? (
        <span style={{ display: "flex", alignItems: "flex-start", gap: 7, fontFamily: FONT, fontSize: 11.5, color: C.warn, lineHeight: "16px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "9px 11px" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
          {blockedReason ?? "A Terminal needs a Running Sandbox — there is no TTY to attach to yet."}
        </span>
      ) : (
        <>
          {/* Attaching is not free: connect carries a `timeout`, so opening this
              tab moved the sandbox's expiry. Say it here, at the moment it
              happened — a countdown that changed while the user was looking at
              a terminal is otherwise unexplainable. */}
          {expiryNote && (
            <span
              role="status"
              style={{ display: "flex", alignItems: "flex-start", gap: 7, fontFamily: FONT, fontSize: 11.5, color: C.fg, lineHeight: "16px", background: "rgba(91,148,240,0.07)", border: "1px solid rgba(91,148,240,0.35)", borderRadius: 8, padding: "9px 11px" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.link} strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {expiryNote}
            </span>
          )}

          {/* §I — no drag handle. Whether /shell/control carries cols/rows is
              unconfirmed, and a resize that does not reach the PTY leaves every
              program inside laid out for the old width while the handle implies
              it worked. Put it back once the protocol is confirmed. */}
          <div
            ref={paneRef}
            onClick={() => inputRef.current?.focus()}
            style={{
              height: paneH, minHeight: 140, maxHeight: 620,
              overflow: "hidden",
              background: "#000",
              border: `1px solid ${conn === "connected" ? C.border : C.borderSoft}`,
              borderRadius: 8, padding: "8px 10px",
              display: "flex", flexDirection: "column",
              cursor: conn === "connected" ? "text" : "default",
            }}
            onMouseUp={(e) => {
              const h = (e.currentTarget as HTMLDivElement).getBoundingClientRect().height;
              if (Math.abs(h - paneH) > 2) setPaneH(h);
            }}
          >
            <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", fontFamily: MONO, fontSize: 12, lineHeight: "18px" }}>
              {conn === "connecting" && (
                <div style={{ color: C.muted }}>opening session on {sandboxKey}.{domain}…</div>
              )}
              {lines.map((l, i) => (
                <div key={i} style={{ color: lineColor(l.kind), whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{l.text}</div>
              ))}
              {conn === "connected" && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                  <span style={{ color: C.lime, flexShrink: 0 }}>{promptFor(cwd)}</span>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    autoFocus
                    spellCheck={false}
                    aria-label="Terminal input"
                    style={{
                      flex: 1, minWidth: 0,
                      background: "transparent", border: "none", outline: "none",
                      color: C.fg, fontFamily: MONO, fontSize: 12, lineHeight: "18px", padding: 0,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {conn === "connected" && (
              <button
                onClick={() => close("user")}
                style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 500,
                  background: "transparent", color: C.fg,
                  border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer",
                }}
              >
                Close session
              </button>
            )}
            {(conn === "closed" || conn === "dropped") && (
              <button
                onClick={open}
                style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: 600,
                  background: C.lime, color: C.limeText,
                  border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer",
                }}
              >
                Reconnect
              </button>
            )}
            {conn === "connected" && (
              <button
                onClick={() => close("drop")}
                title="Prototype only — simulate the stream dropping, to see the reconnect path"
                style={{
                  fontFamily: FONT, fontSize: 11, fontWeight: 500,
                  background: "transparent", color: C.muted,
                  border: `1px dashed ${C.border}`, borderRadius: 7, padding: "5px 10px", cursor: "pointer",
                }}
              >
                Simulate drop
              </button>
            )}
          </div>

          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
            A persistent session: <span style={{ fontFamily: MONO }}>cd</span> is retained, Ctrl-C interrupts.
            <span style={{ color: C.fg }}> Leaving this pane does not end the session</span> — come back and you
            land in the same shell, with whatever you started still running.
            <span style={{ color: C.fg }}> Close session</span> really hangs up; use it when you mean to.
          </span>
        </>
      )}
      </>
    </div>
  );
}
