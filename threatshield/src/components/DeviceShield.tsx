import React, { useState } from 'react';
import {
  Shield,
  Activity,
  Scan,
  Radio,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Smartphone,
  ChevronLeft,
  Settings2,
  RefreshCw,
} from 'lucide-react';
import {
  AppNetworkUsage,
  AppUsage,
  BackendConnectionConfig,
  ResourceSample,
  ScanReport,
  Severity,
  ThreatFinding,
} from '../types';
import { formatBytes } from '../services/resourceMonitor';

interface DeviceShieldProps {
  monitorActive: boolean;
  onToggleMonitor: () => void;
  latestSample: ResourceSample | null;
  report: ScanReport | null;
  onRunScan: () => void;
  isScanning: boolean;
  appUsage: AppUsage[];
  networkUsage: AppNetworkUsage[];
  hasUsageAccess: boolean;
  onToggleUsageAccess: () => void;
  connectionConfig: BackendConnectionConfig;
  onSaveConnection: (url: string, token: string) => void;
}

type DevicePage = 'DASHBOARD' | 'SCAN' | 'ACTIVITY' | 'CONNECT';

export const DeviceShield: React.FC<DeviceShieldProps> = ({
  monitorActive,
  onToggleMonitor,
  latestSample,
  report,
  onRunScan,
  isScanning,
  appUsage,
  networkUsage,
  hasUsageAccess,
  onToggleUsageAccess,
  connectionConfig,
  onSaveConnection,
}) => {
  const [currentPage, setCurrentPage] = useState<DevicePage>('DASHBOARD');
  const [url, setUrl] = useState(connectionConfig.url);
  const [token, setToken] = useState(connectionConfig.token);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const isConfigured = Boolean(connectionConfig.url && connectionConfig.token);

  const getPageTitle = () => {
    switch (currentPage) {
      case 'DASHBOARD':
        return 'ThreatShield';
      case 'SCAN':
        return 'App scan';
      case 'ACTIVITY':
        return 'Activity';
      case 'CONNECT':
        return 'Dashboard connection';
    }
  };

  const handleTestConnection = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      if (url.trim()) {
        setTestStatus('Backend is reachable (Local Mock Bridge simulated)');
      } else {
        setTestStatus('Could not reach backend. Confirm its Wi-Fi address, server status, and firewall.');
      }
    }, 600);
  };

  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConnection(url, token);
    setTestStatus('Saved. Start monitoring or run a scan to upload local summaries.');
  };

  const getSeverityStyle = (severity: Severity) => {
    switch (severity) {
      case Severity.CRITICAL:
        return {
          border: 'border-red-500/50',
          bg: 'bg-red-950/20',
          text: 'text-red-400',
          badge: 'bg-red-900/60 text-red-200 border-red-700/50',
        };
      case Severity.HIGH:
        return {
          border: 'border-orange-500/50',
          bg: 'bg-orange-950/20',
          text: 'text-orange-400',
          badge: 'bg-orange-900/60 text-orange-200 border-orange-700/50',
        };
      case Severity.MEDIUM:
        return {
          border: 'border-amber-500/50',
          bg: 'bg-amber-950/20',
          text: 'text-amber-400',
          badge: 'bg-amber-900/60 text-amber-200 border-amber-700/50',
        };
      case Severity.REVIEW:
        return {
          border: 'border-blue-500/50',
          bg: 'bg-blue-950/20',
          text: 'text-blue-400',
          badge: 'bg-blue-900/60 text-blue-200 border-blue-700/50',
        };
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#0d1829] border border-[#1e2f47] rounded-[24px] shadow-2xl overflow-hidden flex flex-col min-h-[700px]">
      {/* Phone Status Bar Simulation */}
      <div className="bg-[#091220] px-5 py-2 flex items-center justify-between text-[11px] text-[#7f92ad] mono border-b border-[#16253b]">
        <span>9:41</span>
        <div className="flex items-center gap-2">
          <span>5G</span>
          <span>100%</span>
        </div>
      </div>

      {/* TopAppBar */}
      <header className="bg-[#0b1627] px-4 py-3 border-b border-[#1c2e47] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {currentPage !== 'DASHBOARD' && (
            <button
              onClick={() => setCurrentPage('DASHBOARD')}
              className="p-1 -ml-1 text-[#a5b7ce] hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="font-bold text-base text-white tracking-wide">
            {getPageTitle()}
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          {monitorActive && (
            <span className="flex items-center gap-1 text-[10px] mono text-[#42d7b0] bg-[#42d7b0]/15 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#42d7b0] animate-pulse"></span>
              ACTIVE
            </span>
          )}
        </div>
      </header>

      {/* Device Page Content */}
      <div className="p-4 flex-1 overflow-y-auto space-y-3">
        {/* PAGE 1: DASHBOARD */}
        {currentPage === 'DASHBOARD' && (
          <>
            {/* Protection Monitor Status Card */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                monitorActive
                  ? 'bg-[#087f23]/10 border-[#087f23]/40'
                  : 'bg-[#8a4b00]/10 border-[#8a4b00]/40'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <Radio
                  className={`w-5 h-5 mt-0.5 ${
                    monitorActive ? 'text-[#42d7b0]' : 'text-amber-500'
                  }`}
                />
                <div>
                  <h2
                    className={`text-xs font-bold ${
                      monitorActive ? 'text-[#42d7b0]' : 'text-amber-400'
                    }`}
                  >
                    Protection monitor
                  </h2>
                  <p className="text-[11px] text-[#a7b9ce] mt-0.5 leading-relaxed">
                    {monitorActive
                      ? 'Active — samples device health every minute and raises local alerts'
                      : 'Off — start to monitor live resource anomalies and baseline spikes'}
                  </p>
                </div>
              </div>
            </div>

            {/* Monitor Toggle & Scan App Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onToggleMonitor}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  monitorActive
                    ? 'bg-[#1a2d47] text-white hover:bg-[#233b5c] border border-[#2f496d]'
                    : 'bg-[#075e54] hover:bg-[#09776b] text-white'
                }`}
              >
                {monitorActive ? 'Stop monitor' : 'Start monitor'}
              </button>
              <button
                onClick={() => {
                  setCurrentPage('SCAN');
                  onRunScan();
                }}
                className="py-2.5 px-3 rounded-lg text-xs font-bold text-[#bdcce0] bg-[#101e33] border border-[#253956] hover:bg-[#162740] transition-colors cursor-pointer"
              >
                Scan apps
              </button>
            </div>

            {/* Latest Device Snapshot Card */}
            {latestSample && (
              <div className="bg-[#101f34] border border-[#223552] rounded-xl p-3.5 shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-[#42d7b0]" />
                    Latest device snapshot
                  </span>
                  <span className="text-[10px] mono text-[#7f92ad]">
                    {new Intl.DateTimeFormat(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    }).format(latestSample.timestamp)}
                  </span>
                </div>
                <div className="text-xs font-semibold text-[#e1ecfa] space-x-2">
                  <span>CPU {latestSample.cpuPercent}%</span>
                  <span>•</span>
                  <span>Battery {latestSample.batteryPercent}%</span>
                  <span>•</span>
                  <span>{latestSample.temperatureC}°C</span>
                </div>
                <p className="text-[11px] text-[#8fa1b9] mt-1">
                  Network {formatBytes(latestSample.networkBytesPerMinute)}/min
                  {latestSample.foregroundApp && ` • Recent: ${latestSample.foregroundApp}`}
                </p>
              </div>
            )}

            {/* Scan Summary Card */}
            {report && (
              <div
                onClick={() => setCurrentPage('SCAN')}
                className="bg-[#101f34] border border-[#223552] hover:border-[#38557d] transition-colors rounded-xl p-3.5 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white">
                      {report.inspected} installed apps inspected
                    </h3>
                    <p className="text-[11px] text-[#8fa1b9] mt-0.5">
                      {report.findings.length} app(s) need review
                    </p>
                  </div>
                  <Scan className="w-4 h-4 text-[#42d7b0]" />
                </div>
              </div>
            )}

            {/* Activity & Connection Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => setCurrentPage('ACTIVITY')}
                className="w-full py-2.5 px-3 text-xs font-medium text-[#bdcce0] bg-[#101e33] border border-[#253956] hover:bg-[#162740] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                View app & network activity
              </button>

              <button
                onClick={() => setCurrentPage('CONNECT')}
                className="w-full py-2.5 px-3 text-xs font-medium text-[#bdcce0] bg-[#101e33] border border-[#253956] hover:bg-[#162740] rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                {isConfigured
                  ? 'Dashboard connection configured'
                  : 'Connect local dashboard'}
              </button>
            </div>

            {/* Usage Access Prompt Card */}
            {!hasUsageAccess && (
              <div className="bg-[#382b13] border border-[#6b501f] rounded-xl p-3.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-200">
                      Optional permission: Usage access
                    </h4>
                    <p className="text-[11px] text-amber-300/80 mt-1 leading-relaxed">
                      Needed for per-app network totals and recent app usage.
                      ThreatShield never reads the content inside other apps.
                    </p>
                    <button
                      onClick={onToggleUsageAccess}
                      className="mt-2 text-xs font-semibold px-2.5 py-1.5 bg-[#4f3b17] hover:bg-[#634a1d] text-amber-200 border border-amber-700/50 rounded-lg transition-colors cursor-pointer"
                    >
                      Grant Usage access
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[10px] text-[#71839c] text-center pt-2 leading-relaxed">
              ThreatShield identifies risk signals, not certain malware. Review each
              result before removing an app.
            </p>
          </>
        )}

        {/* PAGE 2: SCANNER */}
        {currentPage === 'SCAN' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={onRunScan}
                disabled={isScanning}
                className="flex-1 py-2.5 px-3 rounded-lg text-xs font-bold bg-[#075e54] hover:bg-[#09776b] text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`}
                />
                {isScanning ? 'Scanning…' : 'Run full scan'}
              </button>
              <button
                onClick={() => setCurrentPage('DASHBOARD')}
                className="py-2.5 px-3 rounded-lg text-xs font-bold text-[#bdcce0] bg-[#101e33] border border-[#253956] hover:bg-[#162740] transition-colors cursor-pointer"
              >
                Dashboard
              </button>
            </div>

            {report && (
              <div className="space-y-3">
                <div className="bg-[#101f34] border border-[#223552] rounded-xl p-3">
                  <h3 className="text-xs font-bold text-white">
                    {report.inspected} installed apps inspected
                  </h3>
                  <p className="text-[11px] text-[#8fa1b9]">
                    {report.findings.length} app(s) need review
                  </p>
                </div>

                {report.findings.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#8fa1b9] bg-[#101f34]/40 rounded-xl">
                    No risk signals were found by the current rules.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {report.findings.map((finding) => {
                      const style = getSeverityStyle(finding.severity);
                      return (
                        <div
                          key={finding.packageName}
                          className={`border rounded-xl p-3 ${style.border} ${style.bg}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-[9px] mono font-bold px-1.5 py-0.5 rounded border ${style.badge}`}
                            >
                              {finding.severity} • score {finding.score}/100
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-white">
                            {finding.appName}
                          </h4>
                          <small className="block mono text-[10px] text-[#8fa1b9] truncate mb-1.5">
                            {finding.packageName}
                          </small>
                          <ul className="space-y-1">
                            {finding.reasons.map((r, idx) => (
                              <li
                                key={idx}
                                className="text-[11px] text-[#cbd5e1] leading-relaxed flex items-start gap-1"
                              >
                                <span className="text-[#8fa1b9]">•</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Enabled accessibility services review list */}
                {report.accessibilityServices.length > 0 && (
                  <div className="bg-[#101f34] border border-[#223552] rounded-xl p-3">
                    <h4 className="text-xs font-bold text-white mb-1.5">
                      Enabled accessibility services
                    </h4>
                    <ul className="space-y-1">
                      {report.accessibilityServices.map((svc, idx) => (
                        <li
                          key={idx}
                          className="text-[11px] text-[#8fa1b9] mono flex items-start gap-1"
                        >
                          <span>•</span>
                          <span className="break-all">{svc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Active device administrators review list */}
                {report.deviceAdministrators.length > 0 && (
                  <div className="bg-[#101f34] border border-[#223552] rounded-xl p-3">
                    <h4 className="text-xs font-bold text-white mb-1.5">
                      Active device administrators
                    </h4>
                    <ul className="space-y-1">
                      {report.deviceAdministrators.map((admin, idx) => (
                        <li
                          key={idx}
                          className="text-[11px] text-[#8fa1b9] mono flex items-start gap-1"
                        >
                          <span>•</span>
                          <span className="break-all">{admin}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[10px] text-[#71839c] pt-1">
                  A clean result is not proof that a device is malware-free. Android
                  limits what a normal app can inspect.
                </p>
              </div>
            )}
          </div>
        )}

        {/* PAGE 3: ACTIVITY */}
        {currentPage === 'ACTIVITY' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={hasUsageAccess ? () => {} : onToggleUsageAccess}
                className="flex-1 py-2.5 px-3 rounded-lg text-xs font-bold bg-[#075e54] hover:bg-[#09776b] text-white transition-colors cursor-pointer"
              >
                {hasUsageAccess ? 'Refresh' : 'Grant usage access'}
              </button>
              <button
                onClick={() => setCurrentPage('DASHBOARD')}
                className="py-2.5 px-3 rounded-lg text-xs font-bold text-[#bdcce0] bg-[#101e33] border border-[#253956] hover:bg-[#162740] transition-colors cursor-pointer"
              >
                Dashboard
              </button>
            </div>

            {!hasUsageAccess && (
              <div className="p-3 bg-[#382b13] border border-[#6b501f] rounded-xl text-xs text-amber-200">
                Android requires the Usage access setting for this screen. This is
                separate from normal runtime permissions.
              </div>
            )}

            {hasUsageAccess && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-white mb-2">
                    Most-used apps — last 24 hours
                  </h3>
                  <div className="space-y-1.5">
                    {appUsage.map((app) => (
                      <div
                        key={app.packageName}
                        className="bg-[#101f34] border border-[#223552] rounded-lg p-2.5 flex items-center justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <strong className="text-xs text-white block truncate">
                            {app.label}
                          </strong>
                          <small className="mono text-[10px] text-[#8fa1b9] block truncate">
                            {app.packageName}
                          </small>
                        </div>
                        <span className="mono text-xs text-[#cbd5e1] ml-2">
                          {app.foregroundMinutes} min foreground
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <h3 className="text-xs font-bold text-white mb-2">
                    Network use — last 24 hours
                  </h3>
                  <div className="space-y-1.5">
                    {networkUsage.map((item) => (
                      <div
                        key={item.packageName}
                        className="bg-[#101f34] border border-[#223552] rounded-lg p-2.5 flex items-center justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <strong className="text-xs text-white block truncate">
                            {item.label}
                          </strong>
                          <small className="mono text-[10px] text-[#8fa1b9] block truncate">
                            {item.packageName}
                          </small>
                        </div>
                        <span className="mono text-xs text-[#83a4ff] ml-2">
                          {formatBytes(item.bytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAGE 4: CONNECTION */}
        {currentPage === 'CONNECT' && (
          <form onSubmit={handleSaveConnection} className="space-y-3">
            <div>
              <h3 className="text-xs font-bold text-white mb-1">
                Optional private dashboard
              </h3>
              <p className="text-[11px] text-[#8fa1b9] leading-relaxed">
                ThreatShield sends summaries only after you save a backend address
                and token. For a laptop on your Wi-Fi, use its private address, such
                as <code className="mono text-[#42d7b0]">http://192.168.1.20:8787</code>
                — never use localhost.
              </p>
            </div>

            <div>
              <label className="text-[11px] text-[#8fa1b9] block mb-1">
                Backend URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://192.168.1.20:8787"
                className="w-full bg-[#081220] border border-[#223552] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#42d7b0]"
              />
            </div>

            <div>
              <label className="text-[11px] text-[#8fa1b9] block mb-1">
                Shared dashboard token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Device secret token"
                className="w-full bg-[#081220] border border-[#223552] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#42d7b0]"
              />
            </div>

            <button
              type="submit"
              disabled={!url.trim() || !token.trim()}
              className="w-full py-2.5 px-3 rounded-lg text-xs font-bold bg-[#075e54] hover:bg-[#09776b] text-white disabled:opacity-50 transition-colors cursor-pointer"
            >
              Save connection
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full py-2.5 px-3 rounded-lg text-xs font-medium text-[#bdcce0] bg-[#101e33] border border-[#253956] hover:bg-[#162740] transition-colors cursor-pointer"
            >
              {isTesting ? 'Testing connection…' : 'Test backend connection'}
            </button>

            {testStatus && (
              <p className="text-[11px] text-[#42d7b0] bg-[#42d7b0]/10 p-2.5 rounded-lg border border-[#42d7b0]/30 leading-relaxed">
                {testStatus}
              </p>
            )}

            <button
              type="button"
              onClick={() => setCurrentPage('DASHBOARD')}
              className="w-full py-2 px-3 rounded-lg text-xs font-medium text-[#8fa1b9] hover:text-white transition-colors cursor-pointer"
            >
              Back to dashboard
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
