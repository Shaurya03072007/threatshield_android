import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Smartphone,
  LayoutDashboard,
  Columns,
  FlaskConical,
  Activity,
} from 'lucide-react';
import {
  AnomalyAlert,
  BackendConnectionConfig,
  PackageManifest,
  ResourceSample,
  ScanReport,
} from './types';
import {
  INITIAL_ACCESSIBILITY_SERVICES,
  INITIAL_DEVICE_ADMINS,
  INITIAL_PACKAGES,
} from './data/initialPackages';
import { ThreatScannerService } from './services/threatScanner';
import {
  createSample,
  detectAnomaly,
  formatBytes,
  generateInitialSamples,
  MAX_SAMPLES,
} from './services/resourceMonitor';
import { INITIAL_APP_USAGE, INITIAL_NETWORK_USAGE } from './services/usageInsights';
import { buildDashboardState } from './services/telemetryStore';
import { CommandCenter } from './components/CommandCenter';
import { DeviceShield } from './components/DeviceShield';
import { TestLabModal } from './components/TestLabModal';
import { AlertsBanner } from './components/AlertsBanner';

type ViewMode = 'command_center' | 'device_shield' | 'dual';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('dual');

  // Packages & Scanner State
  const [packages, setPackages] = useState<PackageManifest[]>(INITIAL_PACKAGES);
  const [accessibilityServices, setAccessibilityServices] = useState<string[]>(
    INITIAL_ACCESSIBILITY_SERVICES
  );
  const [deviceAdmins] = useState<string[]>(INITIAL_DEVICE_ADMINS);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Resource Monitor State
  const [samples, setSamples] = useState<ResourceSample[]>(() =>
    generateInitialSamples(25)
  );
  const [monitorActive, setMonitorActive] = useState(true);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);

  // Usage Insights State
  const [hasUsageAccess, setHasUsageAccess] = useState(true);
  const [appUsage, setAppUsage] = useState(INITIAL_APP_USAGE);
  const [networkUsage, setNetworkUsage] = useState(INITIAL_NETWORK_USAGE);

  // Connection Config
  const [connectionConfig, setConnectionConfig] = useState<BackendConnectionConfig>({
    url: 'http://127.0.0.1:8787',
    token: 'threatshield-local-token',
  });

  // Test Lab Modal
  const [isTestLabOpen, setIsTestLabOpen] = useState(false);

  // Initial Scan Run on Mount
  useEffect(() => {
    const initialReport = ThreatScannerService.scan(
      packages,
      accessibilityServices,
      deviceAdmins
    );
    setReport(initialReport);
  }, []);

  // Monitor Timer: Samples device every 8 seconds when active
  useEffect(() => {
    if (!monitorActive) return;

    const interval = setInterval(() => {
      setSamples((prev) => {
        const last = prev[prev.length - 1];
        const next = createSample(last);
        const updated = [...prev, next].slice(-MAX_SAMPLES);

        // Check for anomalies
        const anomaly = detectAnomaly(updated, next);
        if (anomaly) {
          const newAlert: AnomalyAlert = {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: next.timestamp,
            level: anomaly,
            detail: `CPU ${next.cpuPercent}% • Battery ${next.batteryPercent}% • ${next.temperatureC}°C • Net ${formatBytes(next.networkBytesPerMinute)}/min`,
            sample: next,
          };
          setAlerts((a) => [...a.slice(-5), newAlert]);
        }

        return updated;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [monitorActive]);

  // Run On-Device Scan
  const handleRunScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const scanResult = ThreatScannerService.scan(
        packages,
        accessibilityServices,
        deviceAdmins
      );
      setReport(scanResult);
      setIsScanning(false);
    }, 600);
  };

  // Build telemetry dashboard data from current state
  const dashboardData = useMemo(() => {
    return buildDashboardState(
      samples,
      report,
      hasUsageAccess ? appUsage : [],
      hasUsageAccess ? networkUsage : []
    );
  }, [samples, report, hasUsageAccess, appUsage, networkUsage]);

  // Test Fixture Handlers (from testing/TESTING.md)
  const hasFixtureInstalled = packages.some(
    (p) => p.packageName === 'com.threatshield.fixture'
  );

  const toggleFixture = () => {
    if (hasFixtureInstalled) {
      setPackages((prev) =>
        prev.filter((p) => p.packageName !== 'com.threatshield.fixture')
      );
    } else {
      const fixturePkg: PackageManifest = {
        packageName: 'com.threatshield.fixture',
        appName: 'ThreatShield Risk Fixture',
        isSystem: false,
        hasLauncherIcon: false,
        requestedPermissions: [
          'android.permission.CAMERA',
          'android.permission.RECORD_AUDIO',
          'android.permission.ACCESS_FINE_LOCATION',
          'android.permission.READ_CONTACTS',
        ],
        isAccessibilityEnabled: false,
        isIgnoringBatteryOptimizations: false,
        firstInstallTime: Date.now() - 2 * 3600 * 1000,
      };
      setPackages((prev) => [...prev, fixturePkg]);
    }
    // Re-run scan to reflect changes
    setTimeout(handleRunScan, 100);
  };

  const hasStalkerwareInstalled = packages.some(
    (p) =>
      p.packageName === 'com.flexispy.android' ||
      p.packageName === 'com.hoverwatch.rem'
  );

  const toggleStalkerware = () => {
    if (hasStalkerwareInstalled) {
      setPackages((prev) =>
        prev.filter(
          (p) =>
            p.packageName !== 'com.flexispy.android' &&
            p.packageName !== 'com.hoverwatch.rem'
        )
      );
      setAccessibilityServices([]);
    } else {
      const stalkerware: PackageManifest[] = [
        {
          packageName: 'com.flexispy.android',
          appName: 'SyncService Core',
          isSystem: false,
          hasLauncherIcon: false,
          requestedPermissions: [
            'android.permission.CAMERA',
            'android.permission.RECORD_AUDIO',
            'android.permission.READ_SMS',
            'android.permission.READ_CONTACTS',
            'android.permission.ACCESS_FINE_LOCATION',
            'android.permission.SYSTEM_ALERT_WINDOW',
          ],
          isAccessibilityEnabled: true,
          isIgnoringBatteryOptimizations: true,
          firstInstallTime: Date.now() - 24 * 3600 * 1000,
        },
      ];
      setPackages((prev) => [...prev, ...stalkerware]);
      setAccessibilityServices(INITIAL_ACCESSIBILITY_SERVICES);
    }
    setTimeout(handleRunScan, 100);
  };

  const handleSimulateCpuSpike = () => {
    setSamples((prev) => {
      const last = prev[prev.length - 1];
      const spiked = createSample(last, {
        cpuPercent: 96,
        foregroundApp: 'Unknown Background Worker',
      });
      const updated = [...prev, spiked].slice(-MAX_SAMPLES);
      const anomaly = detectAnomaly(updated, spiked);
      if (anomaly) {
        setAlerts((a) => [
          ...a,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: spiked.timestamp,
            level: anomaly,
            detail: `CPU ${spiked.cpuPercent}% • High system processor pressure detected`,
            sample: spiked,
          },
        ]);
      }
      return updated;
    });
  };

  const handleSimulateTempSpike = () => {
    setSamples((prev) => {
      const last = prev[prev.length - 1];
      const spiked = createSample(last, {
        temperatureC: 48.2,
      });
      const updated = [...prev, spiked].slice(-MAX_SAMPLES);
      const anomaly = detectAnomaly(updated, spiked);
      if (anomaly) {
        setAlerts((a) => [
          ...a,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: spiked.timestamp,
            level: anomaly,
            detail: `Battery temperature reached ${spiked.temperatureC}°C (Critical heat)`,
            sample: spiked,
          },
        ]);
      }
      return updated;
    });
  };

  const handleSimulateNetworkSpike = () => {
    setSamples((prev) => {
      const last = prev[prev.length - 1];
      const spiked = createSample(last, {
        networkBytesPerMinute: 14.8 * 1024 * 1024, // ~15 MB/min
        foregroundApp: 'com.flexispy.android',
      });
      const updated = [...prev, spiked].slice(-MAX_SAMPLES);
      const anomaly = detectAnomaly(updated, spiked);
      if (anomaly) {
        setAlerts((a) => [
          ...a,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: spiked.timestamp,
            level: anomaly,
            detail: `Unusual network burst: ${formatBytes(spiked.networkBytesPerMinute)}/min exceeds 20-sample baseline`,
            sample: spiked,
          },
        ]);
      }
      return updated;
    });
  };

  const handleResetResources = () => {
    setSamples((prev) => {
      const last = prev[prev.length - 1];
      const normal = createSample(last, {
        cpuPercent: 14,
        temperatureC: 33.2,
        networkBytesPerMinute: 240 * 1024,
      });
      return [...prev, normal].slice(-MAX_SAMPLES);
    });
  };

  const handleAddCustomPackage = (pkg: PackageManifest) => {
    setPackages((prev) => [...prev, pkg]);
    setTimeout(handleRunScan, 100);
  };

  const handleSimulateAppChangeNotification = () => {
    setAlerts((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        level: 'High',
        detail:
          'PackageChangeReceiver: An app was installed or updated. Run ThreatShield scan to review it.',
        sample: samples[samples.length - 1],
      },
    ]);
  };

  const latestSample = samples[samples.length - 1] ?? null;

  return (
    <div className="min-h-screen bg-[#07111f] text-[#e9f1ff] flex flex-col selection:bg-[#42d7b0] selection:text-[#07111f]">
      {/* Top Application Switcher Bar */}
      <nav className="border-b border-[#1c2b41] bg-[#091424]/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-8 py-2.5">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#42d7b0]" />
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
              ThreatShield
            </span>
            <span className="text-[10px] mono text-[#7f92ad] hidden sm:inline px-2 py-0.5 bg-[#122137] rounded border border-[#213550]">
              Cross-Platform Security Suite
            </span>
          </div>

          {/* View Mode Controls */}
          <div className="flex items-center gap-1 bg-[#0d1c30] p-1 rounded-xl border border-[#223856]">
            <button
              onClick={() => setViewMode('dual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'dual'
                  ? 'bg-[#42d7b0] text-[#07111f] shadow-sm font-bold'
                  : 'text-[#8fa1b9] hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dual View</span>
            </button>

            <button
              onClick={() => setViewMode('command_center')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'command_center'
                  ? 'bg-[#42d7b0] text-[#07111f] shadow-sm font-bold'
                  : 'text-[#8fa1b9] hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Command Center</span>
            </button>

            <button
              onClick={() => setViewMode('device_shield')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'device_shield'
                  ? 'bg-[#42d7b0] text-[#07111f] shadow-sm font-bold'
                  : 'text-[#8fa1b9] hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Device Shield</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTestLabOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#e9f1ff] bg-[#142640] border border-[#27446d] hover:bg-[#1a3356] hover:border-[#42d7b0]/50 transition-colors cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5 text-[#42d7b0]" />
              <span>Test Lab & Signals</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-[1500px] mx-auto w-full">
        {viewMode === 'command_center' && (
          <CommandCenter
            data={dashboardData}
            onRefresh={() => {}}
            endpoint={connectionConfig.url}
            token={connectionConfig.token}
            onSaveConnection={(url, token) =>
              setConnectionConfig({ url, token })
            }
          />
        )}

        {viewMode === 'device_shield' && (
          <div className="py-6 flex justify-center">
            <DeviceShield
              monitorActive={monitorActive}
              onToggleMonitor={() => setMonitorActive(!monitorActive)}
              latestSample={latestSample}
              report={report}
              onRunScan={handleRunScan}
              isScanning={isScanning}
              appUsage={appUsage}
              networkUsage={networkUsage}
              hasUsageAccess={hasUsageAccess}
              onToggleUsageAccess={() => setHasUsageAccess(!hasUsageAccess)}
              connectionConfig={connectionConfig}
              onSaveConnection={(url, token) =>
                setConnectionConfig({ url, token })
              }
            />
          </div>
        )}

        {viewMode === 'dual' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-8 items-start">
            {/* Left: Command Center */}
            <div className="order-2 xl:order-1">
              <CommandCenter
                data={dashboardData}
                onRefresh={() => {}}
                endpoint={connectionConfig.url}
                token={connectionConfig.token}
                onSaveConnection={(url, token) =>
                  setConnectionConfig({ url, token })
                }
              />
            </div>

            {/* Right: Simulated Mobile Device with Sticky Alignment */}
            <div className="order-1 xl:order-2 xl:sticky xl:top-20">
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="text-[11px] mono text-[#8fa1b9] uppercase tracking-wider">
                  Mobile Device Interface
                </span>
                <span className="text-[10px] mono text-[#42d7b0] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#42d7b0] animate-pulse"></span>
                  Telemetry Linked
                </span>
              </div>
              <DeviceShield
                monitorActive={monitorActive}
                onToggleMonitor={() => setMonitorActive(!monitorActive)}
                latestSample={latestSample}
                report={report}
                onRunScan={handleRunScan}
                isScanning={isScanning}
                appUsage={appUsage}
                networkUsage={networkUsage}
                hasUsageAccess={hasUsageAccess}
                onToggleUsageAccess={() => setHasUsageAccess(!hasUsageAccess)}
                connectionConfig={connectionConfig}
                onSaveConnection={(url, token) =>
                  setConnectionConfig({ url, token })
                }
              />
            </div>
          </div>
        )}
      </main>

      {/* Test Lab Modal */}
      <TestLabModal
        isOpen={isTestLabOpen}
        onClose={() => setIsTestLabOpen(false)}
        packages={packages}
        onToggleFixture={toggleFixture}
        onToggleStalkerware={toggleStalkerware}
        hasFixtureInstalled={hasFixtureInstalled}
        hasStalkerwareInstalled={hasStalkerwareInstalled}
        onSimulateCpuSpike={handleSimulateCpuSpike}
        onSimulateTempSpike={handleSimulateTempSpike}
        onSimulateNetworkSpike={handleSimulateNetworkSpike}
        onResetResources={handleResetResources}
        onAddCustomPackage={handleAddCustomPackage}
        onSimulateAppChangeNotification={handleSimulateAppChangeNotification}
      />

      {/* Device Alerts Floating Tray */}
      <AlertsBanner
        alerts={alerts}
        onDismiss={(id) => setAlerts((a) => a.filter((item) => item.id !== id))}
        onScanPrompt={() => {
          setViewMode('device_shield');
          handleRunScan();
        }}
      />
    </div>
  );
}
