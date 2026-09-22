import React, { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const defaultEndpoint = import.meta.env.VITE_API_URL || "http://127.0.0.1:8787";
const palette = ["#00C896", "#7C5CFC", "#FFB454", "#FF5252", "#39B6FF", "#FF8A65"];
const bytes = (v = 0) => v >= 1024 ** 3 ? `${(v / 1024 ** 3).toFixed(1)} GB` : v >= 1024 ** 2 ? `${(v / 1024 ** 2).toFixed(1)} MB` : `${Math.round(v / 1024)} KB`;
const timeLabel = (v) => v ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(v) : "—";
const tsLabel = (v) => v ? new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(v) : "";

export default function App() {
  const [endpoint, setEndpoint] = useState(sessionStorage.getItem("ts_endpoint") || defaultEndpoint);
  const [token, setToken] = useState(sessionStorage.getItem("ts_token") || "");
  const [editing, setEditing] = useState(!sessionStorage.getItem("ts_token"));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const load = async () => {
    if (!token) { setEditing(true); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/v1/dashboard?hours=24`, { headers: { "X-Device-Token": token } });
      if (!response.ok) throw new Error(response.status === 401 ? "Token was rejected." : `Server returned ${response.status}`);
      setData(await response.json());
    } catch (cause) { setError(cause.message || "Unable to reach backend"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!editing && token) load(); }, []);
  useEffect(() => {
    if (!editing && token) {
      const interval = window.setInterval(load, 30_000);
      return () => window.clearInterval(interval);
    }
  }, [editing, token, endpoint]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  const timeline = useMemo(() => (data?.timeline || []).map((item) => ({ ...item, label: timeLabel(item.timestamp) })), [data]);
  const latest = timeline.at(-1);
  const appNetwork = useMemo(() => (data?.networkUsage || []).slice(0, 6).map((item) => ({ name: item.label || item.packageName, bytes: Number(item.bytes || 0) })), [data]);
  const risk = data?.scan?.findings || [];

  function connect(event) {
    event.preventDefault();
    sessionStorage.setItem("ts_endpoint", endpoint); sessionStorage.setItem("ts_token", token);
    setEditing(false); load();
  }

  async function sendChat(event) {
    event.preventDefault();
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    setChatLoading(true);
    const userMsg = { role: "user", text: msg, ts: Date.now() };
    setChatHistory((prev) => [...prev, userMsg]);
    try {
      const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Token": token },
        body: JSON.stringify({
          message: msg,
          history: chatHistory.slice(-10).map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const json = await response.json();
      setChatHistory((prev) => [...prev, { role: "model", text: json.response || "No response.", ts: Date.now() }]);
    } catch (e) {
      setChatHistory((prev) => [...prev, { role: "model", text: `Error: ${e.message}`, ts: Date.now(), isError: true }]);
    } finally {
      setChatLoading(false);
    }
  }

  const riskLevel = latest && (latest.cpuPercent >= 85 || latest.temperatureC >= 43) ? "ELEVATED" : "NORMAL";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">◈</div>
          <div>
            <strong>ThreatShield</strong>
            <span>COMMAND CENTER</span>
          </div>
        </div>
        <div className="header-actions">
          {data?.aiEnabled && <span className="ai-badge">🤖 AI Active</span>}
          <span className={data ? "status live" : "status"}>{data ? "Live telemetry" : "Awaiting data"}</span>
          <button className="ghost" id="btn-chat" onClick={() => setChatOpen((v) => !v)}>💬 AI Chat</button>
          <button className="ghost" id="btn-connection" onClick={() => setEditing(true)}>Connection</button>
          <button className="primary" id="btn-refresh" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
        </div>
      </header>

      {/* Connection Setup Modal */}
      {editing && (
        <section className="setup">
          <form onSubmit={connect}>
            <div>
              <p className="eyebrow">LOCAL CONNECTION</p>
              <h2>Connect your private dashboard</h2>
              <p>The token stays only in this browser session. Use your laptop's local Wi-Fi IP for phone telemetry, e.g. <code>http://192.168.1.20:8787</code>.</p>
            </div>
            <label>Backend URL<input id="input-endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} required /></label>
            <label>Dashboard token<input id="input-token" value={token} onChange={(e) => setToken(e.target.value)} type="password" required /></label>
            <div className="setup-actions">
              <button className="primary" type="submit" id="btn-connect">Connect securely</button>
              <button className="ghost" type="button" id="btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      {error && <section className="error"><strong>Connection issue</strong><span>{error}</span></section>}
      {!data && !error && !editing && (
        <section className="empty">
          <div className="empty-icon">◌</div>
          <h1>Waiting for your phone</h1>
          <p>Start the backend, connect ThreatShield on your phone, and enable AI monitoring. The first sample will appear here automatically.</p>
        </section>
      )}

      {/* AI Chat Panel */}
      {chatOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <span>🤖 ThreatShield AI</span>
            <button className="chat-close" onClick={() => setChatOpen(false)}>✕</button>
          </div>
          <div className="chat-messages">
            {chatHistory.length === 0 && (
              <div className="chat-empty">
                <p>Ask me anything about your phone diagnostics.</p>
                <div className="chat-suggestions">
                  {["Why is my CPU high?", "What app is using the most network?", "Is my phone safe?", "Why is the battery draining?"].map((s) => (
                    <button key={s} className="chat-suggestion" onClick={() => { setChatInput(s); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role} ${msg.isError ? "error" : ""}`}>
                <div className="chat-bubble-content">{msg.text}</div>
                <span className="chat-time">{tsLabel(msg.ts)}</span>
              </div>
            ))}
            {chatLoading && (
              <div className="chat-bubble model">
                <div className="chat-typing"><span /><span /><span /></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-input-row" onSubmit={sendChat}>
            <input
              id="chat-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about your phone…"
              disabled={chatLoading}
              autoComplete="off"
            />
            <button type="submit" className="primary" id="btn-send-chat" disabled={!chatInput.trim() || chatLoading}>Send</button>
          </form>
        </div>
      )}

      {data && (
        <>
          <section className="intro">
            <div>
              <p className="eyebrow">24-HOUR SECURITY POSTURE</p>
              <h1>{data.devices.length ? `${data.devices.length} device${data.devices.length === 1 ? "" : "s"} connected` : "No connected devices"}</h1>
              <p>Last server update {timeLabel(data.generatedAt)}. AI-powered local analysis.</p>
            </div>
            <div className={`score ${riskLevel === "ELEVATED" ? "elevated" : ""}`}>
              <span>RESOURCE RISK</span>
              <strong>{riskLevel}</strong>
            </div>
          </section>

          <section className="metrics">
            <Metric title="Device CPU" value={latest ? `${latest.cpuPercent}%` : "—"} caption={latest?.foregroundApp ? `App: ${latest.foregroundApp}` : "No foreground app"} tone={latest?.cpuPercent >= 85 ? "warn" : "good"} />
            <Metric title="Battery" value={latest ? `${latest.batteryPercent}%` : "—"} caption={latest ? `${latest.temperatureC.toFixed(1)}°C temperature` : "No telemetry"} tone={latest?.temperatureC >= 43 ? "warn" : "good"} />
            <Metric title="Network" value={latest ? `${bytes(latest.networkBytesPerMinute)}/m` : "—"} caption="Device-wide traffic at latest sample" tone="blue" />
            <Metric title="Apps for review" value={risk.length || "0"} caption={risk.length ? `${risk.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH").length} high-priority` : "Latest scan clean"} tone={risk.length ? "warn" : "good"} />
          </section>

          {/* AI Analysis Banner */}
          {data.aiInsight && (
            <section className="ai-insight-banner">
              <div className="ai-insight-icon">🤖</div>
              <div className="ai-insight-body">
                <p className="eyebrow">AI ANALYSIS</p>
                <p>{data.aiInsight}</p>
              </div>
              <button className="ghost" onClick={() => setChatOpen(true)}>Ask AI →</button>
            </section>
          )}

          <section className="grid main-grid">
            <Panel title="Resource timeline" subtitle="CPU, battery temperature, and network trends">
              <div className="chart tall">
                <ResponsiveContainer>
                  <AreaChart data={timeline}>
                    <defs>
                      <linearGradient id="cpu" x1="0" y1="0" x2="0" y2="1">
                        <stop stopColor="#00C896" stopOpacity=".38" />
                        <stop offset="1" stopColor="#00C896" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1A2D45" vertical={false} />
                    <XAxis dataKey="label" minTickGap={34} stroke="#4A6580" tick={{ fill: "#6B8BAA" }} />
                    <YAxis stroke="#4A6580" tick={{ fill: "#6B8BAA" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="cpuPercent" name="CPU %" stroke="#00C896" fill="url(#cpu)" strokeWidth={2} />
                    <Area type="monotone" dataKey="temperatureC" name="Battery °C" stroke="#FFB454" fill="transparent" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Insights insights={data.insights || []} />
          </section>

          <section className="grid">
            <Panel title="Per-app network use" subtitle="Latest 24-hour device report">
              <div className="chart">
                <ResponsiveContainer>
                  <BarChart data={appNetwork} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid stroke="#1A2D45" horizontal={false} />
                    <XAxis type="number" tickFormatter={bytes} stroke="#4A6580" tick={{ fill: "#6B8BAA" }} />
                    <YAxis type="category" width={110} dataKey="name" tick={{ fill: "#9EB5D0", fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => bytes(v)} />
                    <Bar dataKey="bytes" radius={[0, 5, 5, 0]} fill="#7C5CFC" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="App risk review" subtitle="Latest on-device scanner output">
              <RiskTable risk={risk} />
            </Panel>
          </section>

          <section className="grid">
            <Panel title="Most-used apps" subtitle="Foreground minutes — last 24 hours">
              <UsageTable values={data.appUsage || []} />
            </Panel>
            <Panel title="Traffic distribution" subtitle="Top reported apps">
              <div className="chart donut">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={appNetwork} dataKey="bytes" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3}>
                      {appNetwork.map((item, index) => <Cell key={item.name} fill={palette[index % palette.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => bytes(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </section>

          <footer>ThreatShield uses on-device and AI-powered analysis. It reports risk signals, not a malware guarantee. Do not make safety decisions based on a single reading.</footer>
        </>
      )}
    </main>
  );
}

const tooltipStyle = { background: "#111F35", border: "1px solid #1A2D45", borderRadius: 10, color: "#E2ECF9" };

function Metric({ title, value, caption, tone }) {
  return (
    <article className={`metric ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{caption}</p>
    </article>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <article className="panel">
      <header>
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        <span className="panel-dot" />
      </header>
      {children}
    </article>
  );
}

function Insights({ insights }) {
  return (
    <article className="panel insights">
      <header>
        <div><h2>Local + AI analysis</h2><p>Why ThreatShield raised its current assessment</p></div>
        <span className="panel-dot" />
      </header>
      <div className="insight-list">
        {insights.map((insight, index) => (
          <div className={`insight ${insight.severity}`} key={`${insight.title}-${index}`}>
            <span>{insight.severity}</span>
            <h3>{insight.title}</h3>
            <p>{insight.explanation}</p>
            <small>{insight.action}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function RiskTable({ risk }) {
  if (!risk.length) return <div className="no-data">No scanner findings uploaded yet.</div>;
  return (
    <div className="table">
      {risk.slice(0, 7).map((item) => (
        <div className="risk-row" key={item.packageName}>
          <span className={`badge ${item.severity?.toLowerCase()}`}>{item.severity}</span>
          <div><strong>{item.appName}</strong><small>{item.packageName}</small></div>
          <b>{item.score}/100</b>
        </div>
      ))}
    </div>
  );
}

function UsageTable({ values }) {
  if (!values.length) return <div className="no-data">No app-usage report yet. Grant Usage access on the phone, then refresh Activity.</div>;
  return (
    <div className="table">
      {values.slice(0, 8).map((item) => (
        <div className="risk-row" key={item.packageName}>
          <div><strong>{item.label}</strong><small>{item.packageName}</small></div>
          <b>{item.foregroundMinutes} min</b>
        </div>
      ))}
    </div>
  );
}
