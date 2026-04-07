import { useState } from "react";
import { Activity, Zap, DollarSign, Clock, MoreVertical, Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";

const DEPLOYMENTS = [
  {
    id: "dep-001",
    name: "DeFi Arbitrage Scout",
    status: "running",
    env: "production",
    region: "us-west-2",
    uptime: "99.98%",
    calls: "48,291",
    latency: "118ms",
    cost: "$12.40",
    model: "Llama 3.1 70B",
  },
  {
    id: "dep-002",
    name: "Code Review Agent",
    status: "running",
    env: "production",
    region: "us-east-1",
    uptime: "99.91%",
    calls: "7,832",
    latency: "812ms",
    cost: "$49.00",
    model: "DeepSeek-Coder V2",
  },
  {
    id: "dep-003",
    name: "Enterprise RAG Pipeline",
    status: "idle",
    env: "staging",
    region: "eu-central-1",
    uptime: "100%",
    calls: "203",
    latency: "342ms",
    cost: "$0.80",
    model: "Qwen2.5 72B",
  },
];

const METRICS = [
  { label: "Active Deployments", value: "3", icon: <Activity size={18} />, change: "+1 this week" },
  { label: "Total API Calls", value: "56,326", icon: <Zap size={18} />, change: "+12% vs last month" },
  { label: "Avg Latency", value: "424ms", icon: <Clock size={18} />, change: "-8ms vs last week" },
  { label: "Monthly Spend", value: "$62.20", icon: <DollarSign size={18} />, change: "On track for $80 cap" },
];

const LOG_LINES = [
  { time: "23:14:02", level: "INFO", msg: "dep-001 | Arbitrage opportunity detected: ETH/USDC +0.34% on Uniswap v3" },
  { time: "23:14:01", level: "INFO", msg: "dep-001 | Scanning 12 DEX pairs..." },
  { time: "23:13:58", level: "INFO", msg: "dep-002 | Code review complete: PR #847 — 3 issues found" },
  { time: "23:13:55", level: "WARN", msg: "dep-002 | High memory usage detected (78% of limit)" },
  { time: "23:13:50", level: "INFO", msg: "dep-001 | Health check passed" },
  { time: "23:13:45", level: "INFO", msg: "dep-003 | Idle — no requests in last 5 minutes" },
  { time: "23:13:40", level: "INFO", msg: "dep-001 | Arbitrage executed: +$0.0023 net gain" },
  { time: "23:13:38", level: "INFO", msg: "dep-002 | Processing PR #846 diff (1,240 lines)" },
];

export default function Dashboard() {
  const [showApiKey, setShowApiKey] = useState(false);
  const apiKey = "gmi_sk_live_••••••••••••••••••••••••••••••••";
  const realApiKey = "gmi_sk_live_xK9mP2qR7nL4vW8jT3hY6cB1dF5eA0sN";

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="pt-24 pb-16">
        <div className="container">
          {/* Page header */}
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="gmi-label mb-2">Developer Dashboard</div>
              <h1 className="font-display text-4xl text-white">My Deployments</h1>
            </div>
            <div className="hidden md:flex items-center gap-2 font-mono-gmi text-xs text-gray-500">
              <div className="w-2 h-2 rounded-full bg-lime animate-pulse" />
              All systems operational
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-800 mb-10">
            {METRICS.map((m) => (
              <div key={m.label} className="bg-black p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-500">{m.icon}</div>
                  <div className="gmi-label text-gray-700">{m.label}</div>
                </div>
                <div className="font-mono-gmi text-3xl text-white mb-1">{m.value}</div>
                <div className="text-xs text-gray-600 font-mono-gmi">{m.change}</div>
              </div>
            ))}
          </div>

          {/* Deployments table */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl text-white">Active Claws</h2>
              <button className="btn-outline-dashed text-xs px-4 py-2 flex items-center gap-2">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            <div className="border border-gray-800 overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-6 gap-4 px-6 py-3 bg-gray-900 border-b border-gray-800">
                {["Claw", "Status", "Region", "Calls", "Latency", "Cost"].map((h) => (
                  <div key={h} className="gmi-label text-gray-600">{h}</div>
                ))}
              </div>
              {/* Rows */}
              {DEPLOYMENTS.map((dep) => (
                <div
                  key={dep.id}
                  className="grid grid-cols-6 gap-4 px-6 py-4 border-b border-gray-800 hover:bg-gray-950 transition-colors items-center"
                >
                  <div>
                    <div className="font-medium text-white text-sm">{dep.name}</div>
                    <div className="text-xs text-gray-600 font-mono-gmi mt-0.5">{dep.model}</div>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-mono-gmi px-2 py-1 ${
                        dep.status === "running"
                          ? "text-lime bg-lime/10"
                          : "text-gray-400 bg-gray-800"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          dep.status === "running" ? "bg-lime animate-pulse" : "bg-gray-500"
                        }`}
                      />
                      {dep.status}
                    </span>
                  </div>
                  <div className="font-mono-gmi text-xs text-gray-400">{dep.region}</div>
                  <div className="font-mono-gmi text-xs text-gray-300">{dep.calls}</div>
                  <div className="font-mono-gmi text-xs text-gray-300">{dep.latency}</div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono-gmi text-xs text-lime">{dep.cost}</span>
                    <button className="text-gray-600 hover:text-white transition-colors">
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom row: Logs + API Key */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Live logs */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl text-white">Live Logs</h2>
                <div className="flex items-center gap-2 font-mono-gmi text-xs text-lime">
                  <div className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
                  LIVE
                </div>
              </div>
              <div className="bg-black border border-gray-800 p-5 h-64 overflow-y-auto">
                <div className="space-y-1.5">
                  {LOG_LINES.map((line, i) => (
                    <div key={i} className="flex gap-3 font-mono-gmi text-xs">
                      <span className="text-gray-600 shrink-0">{line.time}</span>
                      <span
                        className={`shrink-0 ${
                          line.level === "WARN" ? "text-yellow-400" : "text-lime"
                        }`}
                      >
                        [{line.level}]
                      </span>
                      <span className="text-gray-400">{line.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* API Key */}
            <div>
              <div className="mb-4">
                <h2 className="font-display text-xl text-white">API Access</h2>
              </div>
              <div className="bg-black border border-gray-800 p-6 space-y-5">
                <div>
                  <div className="gmi-label mb-2">API Key</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-900 border border-gray-700 px-3 py-2.5 font-mono-gmi text-xs text-gray-300 overflow-hidden">
                      {showApiKey ? realApiKey : apiKey}
                    </div>
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-gray-500 hover:text-white transition-colors p-2.5 border border-gray-700"
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(realApiKey);
                        toast.success("API key copied");
                      }}
                      className="text-gray-500 hover:text-white transition-colors p-2.5 border border-gray-700"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="gmi-label mb-2">Quick Start</div>
                  <div className="bg-gray-900 p-4 font-mono-gmi text-xs text-gray-300 space-y-1">
                    <div className="text-gray-600"># Install the GMI SDK</div>
                    <div className="text-lime">pip install gmi-sdk</div>
                    <div className="mt-3 text-gray-600"># Deploy a Claw</div>
                    <div>from gmi import ClawClient</div>
                    <div>client = ClawClient(api_key=<span className="text-lime">"YOUR_KEY"</span>)</div>
                    <div>result = client.deploy(<span className="text-lime">"defi-arb-scout"</span>)</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="btn-outline-dashed flex-1 text-xs py-2.5">
                    View Docs
                  </button>
                  <button
                    className="btn-primary-lime flex-1 text-xs py-2.5 font-bold"
                    onClick={() => toast.info("API Playground coming soon!")}
                  >
                    API Playground
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
