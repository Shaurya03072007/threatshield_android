import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw, Settings, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { DashboardData, Severity } from '../types';
import { formatBytes } from '../services/resourceMonitor';

interface CommandCenterProps {
  data: DashboardData;
  onRefresh: () => void;
  isLoading?: boolean;
  endpoint: string;
  token: string;
  onSaveConnection: (url: string, token: string) => void;
}

const PALETTE = ['#42d7b0', '#6d8eff', '#ffb454', '#ee6c75', '#b98cff', '#39b6ff'];

const tooltipStyle = {
  background: '#101b2d',
  border: '1px solid #31425c',
  borderRadius: 10,
  color: '#e9f1ff',
  fontSize: '12px',
};

export const CommandCenter: React.FC<CommandCenterProps> = ({
  data,
  onRefresh,
  isLoading = false,
  endpoint,
  token,
  onSaveConnection,
}) => {
  const [editing, setEditing] = useState(false);
  const [tempEndpoint, setTempEndpoint] = useState(endpoint);
  const [tempToken, setTempToken] = useState(token);

  const timeline = useMemo(() => data.timeline || [], [data]);
  const latest = timeline.length > 0 ? timeline[timeline.length - 1] : null;

  const appNetwork = useMemo(() => {
    return (data.networkUsage || []).slice(0, 6).map((item) => ({
      name: item.label || item.packageName,
      bytes: Number(item.bytes || 0),
    }));
  }, [data.networkUsage]);

  const risk = useMemo(() => data.scan?.findings || [], [data.scan]);

  const isRiskElevated =
    latest && (latest.cpuPercent >= 85 || latest.temperatureC >= 43);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConnection(tempEndpoint, tempToken);
    setEditing(false);
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(ts);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-9 pb-11">
      {/* Topbar */}
      <header className="h-[86px] flex items-center justify-between border-b border-[#1c2b41]">
        <div className="flex items-center gap-3">
          <div className="brand-mark font-bold">◈</div>
          <div>
            <strong className="block text-[17px] tracking-tight text-[#e9f1ff]">
              ThreatShield
            </strong>
            <span className="block text-[#7f92ad] text-[10px] mono tracking-[1.3px] uppercase">
              Command Center
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-[#8fa1b9] hidden sm:flex items-center">
            <span className="status-dot-live"></span> Live local telemetry
          </span>
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#bdcce0] bg-[#132238] border border-[#2a3b55] rounded-[9px] hover:bg-[#1a2d48] transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            Connection
          </button>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#06141b] bg-[#42d7b0] rounded-[9px] hover:bg-[#38bfa0] transition-colors disabled:opacity-55 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Connection Drawer / Setup Panel */}
      {editing && (
        <section className="mt-5 p-6 rounded-[14px] bg-gradient-to-r from-[#112743] to-[#101a2d] border border-[#315078]">
          <form
            onSubmit={handleSaveConfig}
            className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_auto] gap-4 items-end"
          >
            <div>
              <p className="text-[#7f92ad] text-[10px] mono tracking-[1.3px] uppercase mb-1">
                LOCAL CONNECTION
              </p>
              <h2 className="text-[17px] font-bold text-white mb-1">
                Connect your private dashboard
              </h2>
              <p className="text-xs text-[#a6b7cd] leading-relaxed">
                The token stays in this browser session. You can use your laptop&apos;s
                local Wi-Fi IP for phone telemetry, for example{' '}
                <code className="mono bg-[#07111f] px-1.5 py-0.5 rounded text-[#42d7b0]">
                  http://192.168.1.20:8787
                </code>
                .
              </p>
            </div>
            <div>
              <label className="text-[11px] text-[#a6b7cd] block mb-1">
                Backend URL
              </label>
              <input
                value={tempEndpoint}
                onChange={(e) => setTempEndpoint(e.target.value)}
                required
                className="w-full bg-[#07111f] border border-[#334a69] rounded-[7px] p-2.5 text-[#edf5ff] text-xs focus:outline-none focus:border-[#42d7b0]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#a6b7cd] block mb-1">
                Dashboard token
              </label>
              <input
                value={tempToken}
                onChange={(e) => setTempToken(e.target.value)}
                type="password"
                required
                className="w-full bg-[#07111f] border border-[#334a69] rounded-[7px] p-2.5 text-[#edf5ff] text-xs focus:outline-none focus:border-[#42d7b0]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-3.5 py-2.5 text-xs font-bold text-[#06141b] bg-[#42d7b0] rounded-[7px] hover:bg-[#38bfa0] transition-colors cursor-pointer"
              >
                Connect securely
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-2.5 text-xs font-bold text-[#bdcce0] bg-[#132238] border border-[#2a3b55] rounded-[7px] hover:bg-[#1a2d48] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Intro Header */}
      <section className="flex flex-col sm:flex-row justify-between sm:items-end pt-8 pb-6 gap-4">
        <div>
          <p className="text-[#7f92ad] text-[10px] mono tracking-[1.3px] uppercase">
            24-HOUR SECURITY POSTURE
          </p>
          <h1 className="text-2xl sm:text-[30px] font-extrabold my-1 text-white tracking-tight">
            {data.devices.length
              ? `${data.devices.length} device${data.devices.length === 1 ? '' : 's'} connected`
              : 'No connected devices'}
          </h1>
          <p className="text-[#8fa1b9] text-[13px] m-0">
            Last server update {formatDate(data.generatedAt)}. Local-only analysis
            with transparent rules.
          </p>
        </div>
        <div className="border border-[#2a3b55] bg-[#0e1a2b] p-3 sm:px-4 rounded-[11px] min-w-[140px]">
          <span className="block text-[#7f92ad] text-[10px] mono tracking-[1.3px] uppercase">
            RESOURCE RISK
          </span>
          <strong
            className={`text-sm ${isRiskElevated ? 'text-[#ffb454]' : 'text-[#42d7b0]'}`}
          >
            {isRiskElevated ? 'ELEVATED' : 'NORMAL'}
          </strong>
        </div>
      </section>

      {/* 4 Core Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-3.5">
        <article
          className={`metric-card p-[17px] ${latest && latest.cpuPercent >= 85 ? 'border-amber-500/40' : ''}`}
        >
          <span className="text-[#8fa1b9] text-xs block">Device CPU</span>
          <strong
            className={`text-[28px] font-bold block my-1.5 tracking-tight ${
              latest && latest.cpuPercent >= 85 ? 'text-[#ffb454]' : 'text-[#42d7b0]'
            }`}
          >
            {latest ? `${latest.cpuPercent}%` : '—'}
          </strong>
          <p className="text-[11px] text-[#aebbd0] m-0 leading-relaxed truncate">
            {latest?.foregroundApp
              ? `Recent app: ${latest.foregroundApp}`
              : 'No recent foreground app'}
          </p>
        </article>

        <article
          className={`metric-card p-[17px] ${latest && latest.temperatureC >= 43 ? 'border-amber-500/40' : ''}`}
        >
          <span className="text-[#8fa1b9] text-xs block">Battery health</span>
          <strong
            className={`text-[28px] font-bold block my-1.5 tracking-tight ${
              latest && latest.temperatureC >= 43 ? 'text-[#ffb454]' : 'text-[#42d7b0]'
            }`}
          >
            {latest ? `${latest.batteryPercent}%` : '—'}
          </strong>
          <p className="text-[11px] text-[#aebbd0] m-0 leading-relaxed">
            {latest
              ? `${latest.temperatureC.toFixed(1)}°C current temperature`
              : 'No telemetry yet'}
          </p>
        </article>

        <article className="metric-card p-[17px]">
          <span className="text-[#8fa1b9] text-xs block">Network rate</span>
          <strong className="text-[28px] font-bold block my-1.5 tracking-tight text-[#83a4ff]">
            {latest ? `${formatBytes(latest.networkBytesPerMinute)}/m` : '—'}
          </strong>
          <p className="text-[11px] text-[#aebbd0] m-0 leading-relaxed">
            Device-wide traffic at latest sample
          </p>
        </article>

        <article
          className={`metric-card p-[17px] ${risk.length ? 'border-amber-500/40' : ''}`}
        >
          <span className="text-[#8fa1b9] text-xs block">Apps for review</span>
          <strong
            className={`text-[28px] font-bold block my-1.5 tracking-tight ${
              risk.length ? 'text-[#ffb454]' : 'text-[#42d7b0]'
            }`}
          >
            {risk.length || '0'}
          </strong>
          <p className="text-[11px] text-[#aebbd0] m-0 leading-relaxed truncate">
            {risk.length
              ? `${
                  risk.filter(
                    (i) =>
                      i.severity === Severity.CRITICAL ||
                      i.severity === Severity.HIGH
                  ).length
                } high-priority findings`
              : 'Latest scan has no flags'}
          </p>
        </article>
      </section>

      {/* Main Grid: Resource Timeline & Local Analysis */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-3.5 mb-3.5">
        {/* Timeline Panel */}
        <article className="panel-card overflow-hidden">
          <header className="p-4 sm:px-[18px] sm:pt-[17px] flex justify-between items-start">
            <div>
              <h2 className="text-sm font-bold text-white m-0">Resource timeline</h2>
              <p className="text-[11px] text-[#8fa1b9] my-1">
                CPU, battery temperature, and network-rate trends
              </p>
            </div>
            <span className="panel-dot mt-1"></span>
          </header>
          <div className="h-[280px] p-3 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="#42d7b0" stopOpacity={0.38} />
                    <stop offset="1" stopColor="#42d7b0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#253348" vertical={false} />
                <XAxis
                  dataKey="label"
                  minTickGap={28}
                  tick={{ fill: '#8394aa', fontSize: 11 }}
                />
                <YAxis tick={{ fill: '#8394aa', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="cpuPercent"
                  name="CPU %"
                  stroke="#42d7b0"
                  fill="url(#cpuGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="temperatureC"
                  name="Battery °C"
                  stroke="#ffb454"
                  fill="transparent"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Local Analysis Insights */}
        <article className="panel-card overflow-hidden flex flex-col">
          <header className="p-4 sm:px-[18px] sm:pt-[17px] flex justify-between items-start">
            <div>
              <h2 className="text-sm font-bold text-white m-0">Local analysis</h2>
              <p className="text-[11px] text-[#8fa1b9] my-1">
                Why ThreatShield raised its current assessment
              </p>
            </div>
            <span className="panel-dot mt-1"></span>
          </header>
          <div className="p-4 flex-1 overflow-y-auto max-h-[320px]">
            {data.insights && data.insights.length > 0 ? (
              data.insights.map((insight, index) => (
                <div
                  key={`${insight.title}-${index}`}
                  className={`insight-card ${insight.severity}`}
                >
                  <span className="text-[9px] mono uppercase text-[#9eb0c7] block mb-0.5">
                    {insight.severity}
                  </span>
                  <h3 className="text-xs font-bold text-white m-0 mb-1">
                    {insight.title}
                  </h3>
                  <p className="text-[11px] text-[#a7b6c9] m-0 leading-relaxed">
                    {insight.explanation}
                  </p>
                  <small className="block text-[11px] text-[#e3ecfa] mt-1.5 font-medium">
                    {insight.action}
                  </small>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 p-3 text-xs text-[#8fa1b9]">
                <CheckCircle2 className="w-4 h-4 text-[#42d7b0]" />
                No anomalies detected in recent telemetry.
              </div>
            )}
          </div>
        </article>
      </section>

      {/* Secondary Grid: Per-App Network & Risk Review */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-3.5">
        {/* Per-App Network */}
        <article className="panel-card overflow-hidden">
          <header className="p-4 sm:px-[18px] sm:pt-[17px] flex justify-between items-start">
            <div>
              <h2 className="text-sm font-bold text-white m-0">Per-app network use</h2>
              <p className="text-[11px] text-[#8fa1b9] my-1">
                Latest 24-hour device report
              </p>
            </div>
            <span className="panel-dot mt-1"></span>
          </header>
          <div className="h-[245px] p-3">
            {appNetwork.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appNetwork} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid stroke="#253348" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={formatBytes}
                    tick={{ fill: '#8394aa', fontSize: 10 }}
                  />
                  <YAxis
                    type="category"
                    width={110}
                    dataKey="name"
                    tick={{ fill: '#c6d1e3', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val) => formatBytes(Number(val))}
                  />
                  <Bar dataKey="bytes" radius={[0, 5, 5, 0]} fill="#6d8eff" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#8fa1b9]">
                No network usage data reported.
              </div>
            )}
          </div>
        </article>

        {/* App Risk Review */}
        <article className="panel-card overflow-hidden">
          <header className="p-4 sm:px-[18px] sm:pt-[17px] flex justify-between items-start">
            <div>
              <h2 className="text-sm font-bold text-white m-0">App risk review</h2>
              <p className="text-[11px] text-[#8fa1b9] my-1">
                Latest on-device scanner output
              </p>
            </div>
            <span className="panel-dot mt-1"></span>
          </header>
          <div className="p-4">
            {risk.length === 0 ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-xs text-[#8fa1b9] text-center p-4">
                <CheckCircle2 className="w-6 h-6 text-[#42d7b0] mb-2" />
                No scanner findings need review at this time.
              </div>
            ) : (
              <div className="divide-y divide-[#1e2f47]">
                {risk.slice(0, 6).map((item) => (
                  <div
                    key={item.packageName}
                    className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span
                      className={`badge-risk uppercase ${item.severity.toLowerCase()}`}
                    >
                      {item.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block text-xs text-white truncate">
                        {item.appName}
                      </strong>
                      <small className="block mono text-[10px] text-[#899ab1] truncate">
                        {item.packageName}
                      </small>
                    </div>
                    <b className="mono text-[11px] text-[#dce8fa]">
                      {item.score}/100
                    </b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>
      </section>

      {/* Tertiary Grid: Most-Used Apps & Traffic Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-6">
        {/* Most-Used Apps */}
        <article className="panel-card overflow-hidden">
          <header className="p-4 sm:px-[18px] sm:pt-[17px] flex justify-between items-start">
            <div>
              <h2 className="text-sm font-bold text-white m-0">Most-used apps</h2>
              <p className="text-[11px] text-[#8fa1b9] my-1">
                Foreground minutes in the latest 24-hour report
              </p>
            </div>
            <span className="panel-dot mt-1"></span>
          </header>
          <div className="p-4">
            {data.appUsage && data.appUsage.length > 0 ? (
              <div className="divide-y divide-[#1e2f47]">
                {data.appUsage.slice(0, 6).map((item) => (
                  <div
                    key={item.packageName}
                    className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <strong className="block text-xs text-white truncate">
                        {item.label}
                      </strong>
                      <small className="block mono text-[10px] text-[#899ab1] truncate">
                        {item.packageName}
                      </small>
                    </div>
                    <b className="mono text-[11px] text-[#dce8fa]">
                      {item.foregroundMinutes} min
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-xs text-[#8fa1b9]">
                No app usage data available.
              </div>
            )}
          </div>
        </article>

        {/* Traffic Distribution Donut */}
        <article className="panel-card overflow-hidden">
          <header className="p-4 sm:px-[18px] sm:pt-[17px] flex justify-between items-start">
            <div>
              <h2 className="text-sm font-bold text-white m-0">Traffic distribution</h2>
              <p className="text-[11px] text-[#8fa1b9] my-1">Top reported apps</p>
            </div>
            <span className="panel-dot mt-1"></span>
          </header>
          <div className="h-[220px] p-2 flex items-center justify-center">
            {appNetwork.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={appNetwork}
                    dataKey="bytes"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {appNetwork.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={PALETTE[index % PALETTE.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val) => formatBytes(Number(val))}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-[#8fa1b9]">No traffic distribution data.</div>
            )}
          </div>
        </article>
      </section>

      {/* Footer */}
      <footer className="text-[#71839c] text-center text-[10px] pt-4 pb-2 border-t border-[#1c2b41]/60">
        ThreatShield uses on-device and local statistical analysis. It reports risk signals,
        not a malware guarantee. Do not make safety decisions based on a single reading.
      </footer>
    </div>
  );
};
