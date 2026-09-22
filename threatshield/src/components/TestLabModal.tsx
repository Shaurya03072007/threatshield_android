import React, { useState } from 'react';
import { X, FlaskConical, AlertTriangle, Check, Plus, Trash2, Cpu, Flame, Wifi } from 'lucide-react';
import { PackageManifest } from '../types';
import { SENSITIVE_PERMISSIONS } from '../services/threatScanner';

interface TestLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  packages: PackageManifest[];
  onToggleFixture: () => void;
  onToggleStalkerware: () => void;
  hasFixtureInstalled: boolean;
  hasStalkerwareInstalled: boolean;
  onSimulateCpuSpike: () => void;
  onSimulateTempSpike: () => void;
  onSimulateNetworkSpike: () => void;
  onResetResources: () => void;
  onAddCustomPackage: (pkg: PackageManifest) => void;
  onSimulateAppChangeNotification: () => void;
}

export const TestLabModal: React.FC<TestLabModalProps> = ({
  isOpen,
  onClose,
  packages,
  onToggleFixture,
  onToggleStalkerware,
  hasFixtureInstalled,
  hasStalkerwareInstalled,
  onSimulateCpuSpike,
  onSimulateTempSpike,
  onSimulateNetworkSpike,
  onResetResources,
  onAddCustomPackage,
  onSimulateAppChangeNotification,
}) => {
  const [customName, setCustomName] = useState('');
  const [customPackage, setCustomPackage] = useState('');
  const [isSystem, setIsSystem] = useState(false);
  const [hasLauncher, setHasLauncher] = useState(true);
  const [hasAccessibility, setHasAccessibility] = useState(false);
  const [ignoreBattery, setIgnoreBattery] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  if (!isOpen) return null;

  const togglePerm = (perm: string) => {
    if (selectedPerms.includes(perm)) {
      setSelectedPerms(selectedPerms.filter((p) => p !== perm));
    } else {
      setSelectedPerms([...selectedPerms, perm]);
    }
  };

  const handleCreatePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPackage.trim() || !customName.trim()) return;

    onAddCustomPackage({
      appName: customName.trim(),
      packageName: customPackage.trim(),
      isSystem,
      hasLauncherIcon: hasLauncher,
      isAccessibilityEnabled: hasAccessibility,
      isIgnoringBatteryOptimizations: ignoreBattery,
      requestedPermissions: selectedPerms,
      firstInstallTime: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
    });

    setCustomName('');
    setCustomPackage('');
    setSelectedPerms([]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0b1626] border border-[#233b5c] rounded-2xl max-w-2xl w-full p-6 text-[#e9f1ff] shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-[#1c2e47]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#42d7b0]/15 text-[#42d7b0]">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                ThreatShield Test Lab & Verification
              </h2>
              <p className="text-xs text-[#8fa1b9]">
                Based on <code className="text-[#42d7b0]">testing/TESTING.md</code> safe
                signals test plan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8fa1b9] hover:text-white hover:bg-[#162740] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Section 1: Safe App-Risk Scanner Fixtures */}
          <div className="bg-[#0f1d32] border border-[#1e3352] rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <span>1. Benign Risk Fixture & Stalkerware Test Sets</span>
            </h3>
            <p className="text-xs text-[#8fa1b9] mb-3 leading-relaxed">
              Never test with real malware. The supplied harmless fixture app (
              <code className="text-[#cbd5e1]">com.threatshield.fixture</code>) has 4
              sensitive permissions, no launcher icon, and recent install date.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={onToggleFixture}
                className={`p-3 rounded-lg border text-left flex items-start justify-between transition-colors cursor-pointer ${
                  hasFixtureInstalled
                    ? 'bg-[#42d7b0]/10 border-[#42d7b0]/40 text-[#e9f1ff]'
                    : 'bg-[#142339] border-[#223858] text-[#8fa1b9] hover:text-white'
                }`}
              >
                <div>
                  <strong className="block text-xs font-semibold text-white">
                    RiskFixture (benign)
                  </strong>
                  <span className="text-[10px] mono">com.threatshield.fixture</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    hasFixtureInstalled
                      ? 'bg-[#42d7b0] text-[#06141b]'
                      : 'bg-[#223858] text-[#cbd5e1]'
                  }`}
                >
                  {hasFixtureInstalled ? 'Installed' : 'Uninstalled'}
                </span>
              </button>

              <button
                onClick={onToggleStalkerware}
                className={`p-3 rounded-lg border text-left flex items-start justify-between transition-colors cursor-pointer ${
                  hasStalkerwareInstalled
                    ? 'bg-amber-950/30 border-amber-500/40 text-[#e9f1ff]'
                    : 'bg-[#142339] border-[#223858] text-[#8fa1b9] hover:text-white'
                }`}
              >
                <div>
                  <strong className="block text-xs font-semibold text-white">
                    Known Stalkerware IDs
                  </strong>
                  <span className="text-[10px] mono">FlexiSPY, HoverWatch</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    hasStalkerwareInstalled
                      ? 'bg-amber-500 text-[#06141b]'
                      : 'bg-[#223858] text-[#cbd5e1]'
                  }`}
                >
                  {hasStalkerwareInstalled ? 'Simulated' : 'None'}
                </span>
              </button>
            </div>
          </div>

          {/* Section 2: Resource Monitor & Anomaly Spikes */}
          <div className="bg-[#0f1d32] border border-[#1e3352] rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-1">
              2. Live Resource Anomaly Injections
            </h3>
            <p className="text-xs text-[#8fa1b9] mb-3 leading-relaxed">
              Verify that ThreatShield flags critical CPU (&ge;85/95%), high battery
              temperature (&ge;43/47&deg;C), or unusual network baseline spikes (&gt;3&times;
              std dev + 5MB/min).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={onSimulateCpuSpike}
                className="p-2.5 bg-[#142339] border border-[#223858] hover:border-amber-500/50 rounded-lg text-center transition-colors cursor-pointer"
              >
                <Cpu className="w-4 h-4 mx-auto mb-1 text-[#ffb454]" />
                <span className="block text-xs font-bold text-white">CPU Spike</span>
                <span className="text-[10px] mono text-[#ffb454]">96% Critical</span>
              </button>

              <button
                onClick={onSimulateTempSpike}
                className="p-2.5 bg-[#142339] border border-[#223858] hover:border-red-500/50 rounded-lg text-center transition-colors cursor-pointer"
              >
                <Flame className="w-4 h-4 mx-auto mb-1 text-[#ee6c75]" />
                <span className="block text-xs font-bold text-white">Temp Surge</span>
                <span className="text-[10px] mono text-[#ee6c75]">48.2°C Hot</span>
              </button>

              <button
                onClick={onSimulateNetworkSpike}
                className="p-2.5 bg-[#142339] border border-[#223858] hover:border-blue-500/50 rounded-lg text-center transition-colors cursor-pointer"
              >
                <Wifi className="w-4 h-4 mx-auto mb-1 text-[#83a4ff]" />
                <span className="block text-xs font-bold text-white">Net Anomaly</span>
                <span className="text-[10px] mono text-[#83a4ff]">14 MB/min</span>
              </button>

              <button
                onClick={onResetResources}
                className="p-2.5 bg-[#142339] border border-[#223858] hover:border-[#42d7b0]/50 rounded-lg text-center transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4 mx-auto mb-1 text-[#42d7b0]" />
                <span className="block text-xs font-bold text-white">Normal Baseline</span>
                <span className="text-[10px] mono text-[#42d7b0]">Healthy</span>
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-[#1c2e47] flex justify-between items-center">
              <span className="text-xs text-[#8fa1b9]">
                Package change notification check:
              </span>
              <button
                onClick={onSimulateAppChangeNotification}
                className="text-xs font-semibold px-2.5 py-1.5 bg-[#142339] hover:bg-[#1a2e4c] border border-[#223858] rounded-lg transition-colors cursor-pointer text-[#cbd5e1]"
              >
                Simulate App Install Event
              </button>
            </div>
          </div>

          {/* Section 3: Add Custom Package to Test Scanner */}
          <div className="bg-[#0f1d32] border border-[#1e3352] rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#42d7b0]" />
              <span>3. Add Custom Package to Inventory</span>
            </h3>
            <p className="text-xs text-[#8fa1b9] mb-3">
              Test scanner rules by injecting an arbitrary app manifest.
            </p>

            <form onSubmit={handleCreatePackage} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-[#8fa1b9] mb-1">
                    App Display Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Secret Recorder"
                    required
                    className="w-full bg-[#081220] border border-[#223858] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#42d7b0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#8fa1b9] mb-1">
                    Package Name
                  </label>
                  <input
                    type="text"
                    value={customPackage}
                    onChange={(e) => setCustomPackage(e.target.value)}
                    placeholder="e.g. com.example.secret"
                    required
                    className="w-full bg-[#081220] border border-[#223858] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#42d7b0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-[#a5b8cf]">
                  <input
                    type="checkbox"
                    checked={isSystem}
                    onChange={(e) => setIsSystem(e.target.checked)}
                    className="accent-[#42d7b0]"
                  />
                  System App
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[#a5b8cf]">
                  <input
                    type="checkbox"
                    checked={hasLauncher}
                    onChange={(e) => setHasLauncher(e.target.checked)}
                    className="accent-[#42d7b0]"
                  />
                  Has Launcher Icon
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[#a5b8cf]">
                  <input
                    type="checkbox"
                    checked={hasAccessibility}
                    onChange={(e) => setHasAccessibility(e.target.checked)}
                    className="accent-[#42d7b0]"
                  />
                  Accessibility Svc
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[#a5b8cf]">
                  <input
                    type="checkbox"
                    checked={ignoreBattery}
                    onChange={(e) => setIgnoreBattery(e.target.checked)}
                    className="accent-[#42d7b0]"
                  />
                  Ignore Battery Opt
                </label>
              </div>

              <div>
                <label className="block text-[11px] text-[#8fa1b9] mb-1.5">
                  Select Sensitive Permissions:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(SENSITIVE_PERMISSIONS).map((perm) => {
                    const short = perm.replace('android.permission.', '');
                    const selected = selectedPerms.includes(perm);
                    return (
                      <button
                        type="button"
                        key={perm}
                        onClick={() => togglePerm(perm)}
                        className={`text-[10px] mono px-2 py-1 rounded transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#42d7b0] text-[#06141b] font-bold'
                            : 'bg-[#142339] text-[#8fa1b9] hover:text-white border border-[#223858]'
                        }`}
                      >
                        {short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={!customName.trim() || !customPackage.trim()}
                className="w-full py-2 bg-[#075e54] hover:bg-[#09776b] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                Add to Package Inventory
              </button>
            </form>
          </div>
        </div>

        <div className="pt-4 border-t border-[#1c2e47] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#132238] border border-[#2a3b55] hover:bg-[#1a2d48] text-xs font-bold text-white rounded-lg transition-colors cursor-pointer"
          >
            Close Lab
          </button>
        </div>
      </div>
    </div>
  );
};
