// ─── SDK playground ────────────────────────────────────────────────────────
// Replaces the static curl dump on the Agent's API tab.
//
// Daytona's dashboard has a Playground: operations grouped in a left panel
// (management, filesystem, git, process & code execution), the parameters for
// the selected one in the middle, and an auto-generated SDK snippet on the
// right that updates as you edit — with a Run that actually executes.
//
// Two things that shape follows here:
//
//   1. Exec stops being invisible. It is a named operation in a list, not a
//      mode you find after opening something else. That was the complaint.
//   2. A copyable SDK call is what people actually paste, not curl. The curl
//      is still one toggle away, because the contract is the swagger.
//
// Every operation says which plane it is on and whether the swagger covers it,
// so nobody copies a snippet for an endpoint that does not exist.
import { useMemo, useState } from "react";
import { C, FONT, MONO } from "@/lib/tokens";
import V2Badge from "@/components/V2Badge";
import NoApiBadge from "@/components/NoApiBadge";
import CopyButton from "@/components/CopyButton";

type Lang = "python" | "typescript" | "curl";
type Plane = "control" | "data";

interface Param {
  key: string;
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
}

interface Op {
  id: string;
  group: string;
  name: string;
  /** The endpoint, so the snippet is traceable to the contract. */
  endpoint: string;
  plane: Plane;
  /** False when the swagger does not cover it. */
  inSwagger: boolean;
  blurb: string;
  params: Param[];
  snippet: (v: Record<string, string>, lang: Lang) => string;
  /** What a successful call returns, so the pane can show a result. */
  result: (v: Record<string, string>) => string;
}

const LANGS: { key: Lang; label: string }[] = [
  { key: "python",     label: "Python" },
  { key: "typescript", label: "TypeScript" },
  { key: "curl",       label: "curl" },
];

function ops(templateId: string): Op[] {
  return [
    {
      id: "create",
      group: "Lifecycle",
      name: "Create a Sandbox",
      endpoint: "POST /sandboxes",
      plane: "control",
      inSwagger: true,
      blurb: "Takes five fields and no more. Spec is not one of them — it comes from the Template's resources.",
      params: [
        { key: "template_id", label: "template_id", value: templateId },
        { key: "idc_name",    label: "idc_name",    value: "sandbox-runloop-us" },
        { key: "timeout",     label: "timeout",     value: "1800", hint: "seconds of wall-clock from creation" },
        { key: "env_vars",    label: "env_vars",    value: '{"LOG_LEVEL": "debug"}' },
        { key: "metadata",    label: "metadata",    value: '{"tenant": "acme-corp"}' },
      ],
      result: () => 'id · sandbox_key · domain · sandbox_access_token · state = "pending"',
      snippet: (v, lang) =>
        lang === "python"
          ? `from gmi_agentbox import Agentbox\n\ngmi = Agentbox()  # reads GMI_API_KEY\n\nsandbox = gmi.sandboxes.create(\n    template_id="${v.template_id}",\n    idc_name="${v.idc_name}",\n    timeout=${v.timeout},\n    env_vars=${v.env_vars.replace(/"/g, '"')},\n    metadata=${v.metadata},\n)\nsandbox.wait_until_running()\nprint(sandbox.id, sandbox.state)`
        : lang === "typescript"
          ? `import { Agentbox } from "@gmi-cloud/agentbox";\n\nconst gmi = new Agentbox(); // reads GMI_API_KEY\n\nconst sandbox = await gmi.sandboxes.create({\n  templateId: "${v.template_id}",\n  idcName: "${v.idc_name}",\n  timeout: ${v.timeout},\n  envVars: ${v.env_vars},\n  metadata: ${v.metadata},\n});\nawait sandbox.waitUntilRunning();\nconsole.log(sandbox.id, sandbox.state);`
          : `curl -sS -X POST "$API_BASE/sandboxes" \\\n  -H "Authorization: Bearer $ACCESS_TOKEN" \\\n  -H 'Content-Type: application/json' \\\n  -d '{"template_id":"${v.template_id}","idc_name":"${v.idc_name}",\n       "timeout":${v.timeout},"env_vars":${v.env_vars},"metadata":${v.metadata}}'`,
    },
    {
      id: "exec",
      group: "Process & execution",
      name: "Run a command",
      endpoint: "POST /executions",
      plane: "data",
      inSwagger: true,
      blurb: "One command, one result. wait=false returns an execution_id to poll instead of blocking.",
      params: [
        { key: "command", label: "command", value: "python main.py --input /home/user/in.json" },
        { key: "cwd",     label: "cwd",     value: "/home/user" },
        { key: "timeout", label: "execution_timeout_seconds", value: "300" },
        { key: "wait",    label: "wait",    value: "true", hint: "true blocks up to wait_timeout_seconds" },
      ],
      result: () => "execution_id · exit_code = 0 · stdout · stderr · 2.6s",
      snippet: (v, lang) =>
        lang === "python"
          ? `run = sandbox.exec(\n    "${v.command}",\n    cwd="${v.cwd}",\n    timeout=${v.timeout},\n    wait=${v.wait === "true" ? "True" : "False"},\n)\nprint(run.exit_code, run.stdout)`
        : lang === "typescript"
          ? `const run = await sandbox.exec("${v.command}", {\n  cwd: "${v.cwd}",\n  timeout: ${v.timeout},\n  wait: ${v.wait},\n});\nconsole.log(run.exitCode, run.stdout);`
          : `curl -sS -X POST "$DP_BASE/executions?wait=${v.wait}&wait_timeout_seconds=25" \\\n  -H "X-Access-Token: $SAT" -H 'Content-Type: application/json' \\\n  -d '{"action":"exec","parameters":{"command":"${v.command}",\n       "cwd":"${v.cwd}","execution_timeout_seconds":${v.timeout}}}'`,
    },
    {
      id: "cancel",
      group: "Process & execution",
      name: "Cancel a running command",
      endpoint: "POST /executions/{id}/cancel",
      plane: "data",
      inSwagger: true,
      blurb: "Empty body. Accepted, not instant — a command that already finished reports its real result.",
      params: [{ key: "execution_id", label: "execution_id", value: "exec_2c0c8c5b4e0e" }],
      result: () => 'status = "cancelled" · the Sandbox is unaffected',
      snippet: (v, lang) =>
        lang === "python"
          ? `sandbox.executions.cancel("${v.execution_id}")`
        : lang === "typescript"
          ? `await sandbox.executions.cancel("${v.execution_id}");`
          : `curl -sS -X POST "$DP_BASE/executions/${v.execution_id}/cancel" \\\n  -H "X-Access-Token: $SAT"`,
    },
    {
      id: "upload",
      group: "Files",
      name: "Upload a file",
      endpoint: "POST /files?path=",
      plane: "data",
      inSwagger: true,
      blurb: "One file, by absolute path. A failed or oversize upload writes nothing — there is no partial file.",
      params: [
        { key: "path",  label: "path",  value: "/home/user/in.json" },
        { key: "local", label: "local file", value: "./in.json" },
      ],
      result: (v) => `written to ${v.path}`,
      snippet: (v, lang) =>
        lang === "python"
          ? `with open("${v.local}", "rb") as f:\n    sandbox.files.upload("${v.path}", f)`
        : lang === "typescript"
          ? `await sandbox.files.upload("${v.path}", await readFile("${v.local}"));`
          : `curl -sS -X POST "$DP_BASE/files?path=${v.path}" \\\n  -H "X-Access-Token: $SAT" -F 'file=@${v.local}'`,
    },
    {
      id: "download",
      group: "Files",
      name: "Download a file",
      endpoint: "GET /files?path=",
      plane: "data",
      inSwagger: true,
      blurb: "By absolute path. There is no listing endpoint, so name the file — run ls to see what is there.",
      params: [
        { key: "path",  label: "path",  value: "/home/user/result.json" },
        { key: "local", label: "save as", value: "./result.json" },
      ],
      result: (v) => `saved ${v.local}`,
      snippet: (v, lang) =>
        lang === "python"
          ? `data = sandbox.files.download("${v.path}")\nopen("${v.local}", "wb").write(data)`
        : lang === "typescript"
          ? `const data = await sandbox.files.download("${v.path}");\nawait writeFile("${v.local}", data);`
          : `curl -sS "$DP_BASE/files?path=${v.path}" \\\n  -H "X-Access-Token: $SAT" -o ${v.local}`,
    },
    {
      id: "shell",
      group: "Process & execution",
      name: "Open an interactive shell",
      endpoint: "wss://{sandbox_key}.{domain}/shell/connect",
      plane: "data",
      inSwagger: false,
      blurb: "A real TTY: stdin, Ctrl-C, retained cd. Outside the swagger, but implemented and tested.",
      params: [{ key: "cols_rows", label: "size", value: "120x40", hint: "sent as a resize control message" }],
      result: () => "a bidirectional stream · resize and close over /shell/control",
      snippet: (v, lang) => {
        const [cols, rows] = v.cols_rows.split("x");
        return lang === "python"
          ? `with sandbox.shell() as sh:\n    sh.resize(cols=${cols || 120}, rows=${rows || 40})\n    sh.send("ls -la\\n")\n    for chunk in sh:\n        print(chunk, end="")`
        : lang === "typescript"
          ? `const sh = await sandbox.shell();\nawait sh.resize({ cols: ${cols || 120}, rows: ${rows || 40} });\nsh.write("ls -la\\n");\nsh.onData((d) => process.stdout.write(d));`
          : `# WebSocket, not curl — dial:\n#   wss://$SANDBOX_KEY.$DOMAIN/shell/connect\ncurl -sS -X POST "$DP_BASE/shell/control" -H "X-Access-Token: $SAT" \\\n  -H 'Content-Type: application/json' \\\n  -d '{"action":"resize","cols":${cols || 120},"rows":${rows || 40}}'`;
      },
    },
    {
      id: "extend",
      group: "Lifecycle",
      name: "Extend the timeout",
      endpoint: "PATCH /sandboxes/{id}",
      plane: "control",
      inSwagger: true,
      blurb: "Pushes the expiry out. Never pulls it in — a smaller value cannot cut a Sandbox short.",
      params: [{ key: "timeout", label: "timeout", value: "5400", hint: "new total, seconds from creation" }],
      result: () => "the new expiry, if later than the current one",
      snippet: (v, lang) =>
        lang === "python"
          ? `sandbox.set_timeout(${v.timeout})`
        : lang === "typescript"
          ? `await sandbox.setTimeout(${v.timeout});`
          : `curl -sS -X PATCH "$API_BASE/sandboxes/$SANDBOX_ID" \\\n  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \\\n  -d '{"timeout":${v.timeout}}'`,
    },
    {
      id: "delete",
      group: "Lifecycle",
      name: "Delete the Sandbox",
      endpoint: "DELETE /sandboxes/{id}",
      plane: "control",
      inSwagger: true,
      blurb: "Releases compute and disk. Anything not taken out through Files is gone.",
      params: [],
      result: () => "HTTP 204 · the row leaves the list",
      snippet: (_v, lang) =>
        lang === "python"
          ? `sandbox.delete()`
        : lang === "typescript"
          ? `await sandbox.delete();`
          : `curl -sS -X DELETE "$API_BASE/sandboxes/$SANDBOX_ID" \\\n  -H "Authorization: Bearer $ACCESS_TOKEN"`,
    },
  ];
}

export default function SdkPlaygroundV2({ templateId }: { templateId: string }) {
  const all = useMemo(() => ops(templateId), [templateId]);
  const [opId, setOpId] = useState(all[0].id);
  const [lang, setLang] = useState<Lang>("python");
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(all.map((o) => [o.id, Object.fromEntries(o.params.map((p) => [p.key, p.value]))])),
  );
  const [ran, setRan] = useState<string | null>(null);

  const op = all.find((o) => o.id === opId) ?? all[0];
  const v = values[op.id] ?? {};
  const code = op.snippet(v, lang);

  const groups = useMemo(() => {
    const out: { group: string; items: Op[] }[] = [];
    for (const o of all) {
      const g = out.find((x) => x.group === o.group);
      if (g) g.items.push(o);
      else out.push({ group: o.group, items: [o] });
    }
    return out;
  }, [all]);

  const setVal = (key: string, val: string) =>
    setValues((m) => ({ ...m, [op.id]: { ...m[op.id], [key]: val } }));

  const inputStyle: React.CSSProperties = {
    width: "100%", minWidth: 0,
    background: C.pillBg, border: `1px solid ${C.border}`, color: C.fg,
    fontFamily: MONO, fontSize: 11.5, padding: "6px 9px", borderRadius: 7, outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.fg, margin: 0 }}>
            SDK <V2Badge />
          </h3>
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, margin: "4px 0 0", lineHeight: "18px", maxWidth: 640 }}>
            Every operation this Agent's Sandboxes support, with the call you would paste.
            Edit the parameters and the snippet follows. The endpoint is on each one, because
            the swagger is the contract.
          </p>
        </div>
        <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 2 }}>
          {LANGS.map((l) => {
            const on = lang === l.key;
            return (
              <button
                key={l.key}
                onClick={() => setLang(l.key)}
                style={{
                  fontFamily: FONT, fontSize: 12, fontWeight: on ? 600 : 500,
                  color: on ? C.limeText : C.muted, background: on ? C.lime : "transparent",
                  border: "none", borderRadius: 6, padding: "4px 11px", cursor: "pointer",
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(190px, 230px) minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
        {/* Operations — named, visible, not behind a menu */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 12, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 10px", background: C.cardSolid }}>
          {groups.map((g) => (
            <div key={g.group} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: C.muted, padding: "0 6px 4px" }}>
                {g.group}
              </span>
              {g.items.map((o) => {
                const on = o.id === op.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => { setOpId(o.id); setRan(null); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, textAlign: "left",
                      fontFamily: FONT, fontSize: 12.5, fontWeight: on ? 600 : 500,
                      color: on ? C.fg : C.muted,
                      background: on ? "rgba(221,234,77,0.10)" : "transparent",
                      border: "none", borderLeft: `2px solid ${on ? C.lime : "transparent"}`,
                      padding: "6px 6px 6px 8px", borderRadius: 5, cursor: "pointer",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>{o.name}</span>
                    {!o.inSwagger && <NoApiBadge title="Outside the swagger — implemented and tested, but not in /api/v2/ec/openapi.yaml" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* What it is, and where it runs */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.cardSolid, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.lime }}>{op.endpoint}</span>
              <span
                title={op.plane === "control"
                  ? "Control plane — $API_BASE with a Bearer session token"
                  : "Data plane — https://{sandbox_key}.{domain} with the X-Access-Token that /connect returns"}
                style={{
                  fontFamily: FONT, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                  color: op.plane === "control" ? C.link : "#7dd3fc",
                  background: op.plane === "control" ? "rgba(91,148,240,0.12)" : "rgba(125,211,252,0.12)",
                  border: `1px solid ${op.plane === "control" ? "rgba(91,148,240,0.45)" : "rgba(125,211,252,0.45)"}`,
                  padding: "1px 6px", borderRadius: 4, cursor: "help",
                }}
              >
                {op.plane} plane
              </span>
            </div>
            <span style={{ fontFamily: FONT, fontSize: 12.5, color: C.muted, lineHeight: "18px" }}>{op.blurb}</span>

            {op.params.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 9, marginTop: 2 }}>
                {op.params.map((prm) => (
                  <label key={prm.key} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted }}>{prm.label}</span>
                    <input
                      value={v[prm.key] ?? ""}
                      onChange={(e) => setVal(prm.key, e.target.value)}
                      placeholder={prm.placeholder}
                      style={inputStyle}
                    />
                    {prm.hint && <span style={{ fontFamily: FONT, fontSize: 10.5, color: C.muted, opacity: 0.8, lineHeight: "14px" }}>{prm.hint}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* The snippet */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: "#000" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${C.borderSoft}`, background: C.cardSolid }}>
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>
                {LANGS.find((l) => l.key === lang)?.label}
              </span>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <CopyButton value={code} />
                <button
                  onClick={() => setRan(op.result(v))}
                  title="Runs against this prototype's mock — the snippet is what you would paste for real"
                  style={{
                    fontFamily: FONT, fontSize: 11.5, fontWeight: 600,
                    background: C.lime, color: C.limeText, border: "none",
                    borderRadius: 7, padding: "4px 12px", cursor: "pointer",
                  }}
                >
                  Run
                </button>
              </div>
            </div>
            <pre style={{ margin: 0, padding: "12px 14px", overflowX: "auto", fontFamily: MONO, fontSize: 12, lineHeight: "19px", color: C.fg }}>
              {code}
            </pre>
            {ran && (
              <div style={{ borderTop: `1px solid ${C.borderSoft}`, padding: "9px 14px", display: "flex", alignItems: "flex-start", gap: 7, background: "rgba(52,211,153,0.05)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.ok} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }}><path d="M20 6 9 17l-5-5" /></svg>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.ok, lineHeight: "19px" }}>{ran}</span>
              </div>
            )}
          </div>

          <span style={{ fontFamily: FONT, fontSize: 11, color: C.muted, lineHeight: "16px" }}>
            Two planes: the control plane creates and deletes Sandboxes with a Bearer session
            token; the data plane at <span style={{ fontFamily: MONO }}>{"{sandbox_key}.{domain}"}</span> does
            files, executions and the shell with the token <span style={{ fontFamily: MONO }}>/connect</span> returns.
            The SDK holds both, which is why one <span style={{ fontFamily: MONO }}>sandbox</span> object can do all of it.
          </span>
        </div>
      </div>
    </div>
  );
}
