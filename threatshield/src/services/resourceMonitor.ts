import { AnomalyAlert, ResourceSample } from '../types';

export const MAX_SAMPLES = 60;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function detectAnomaly(
  history: ResourceSample[],
  current: ResourceSample
): 'Critical' | 'High' | 'Unusual network activity' | null {
  if (
    current.cpuPercent >= 95 ||
    current.temperatureC >= 47 ||
    current.networkBytesPerMinute >= 250 * 1024 * 1024
  ) {
    return 'Critical';
  }

  if (
    current.cpuPercent >= 85 ||
    current.temperatureC >= 43 ||
    current.networkBytesPerMinute >= 100 * 1024 * 1024
  ) {
    return 'High';
  }

  // Rolling baseline of up to 20 previous samples
  const baseline = history
    .slice(0, -1)
    .slice(-20)
    .map((s) => s.networkBytesPerMinute);

  if (baseline.length >= 8) {
    const mean = baseline.reduce((sum, v) => sum + v, 0) / baseline.length;
    const variance =
      baseline.reduce((sum, v) => sum + (v - mean) ** 2, 0) / baseline.length;
    const deviation = Math.sqrt(variance);

    if (
      current.networkBytesPerMinute > mean + 3 * deviation &&
      current.networkBytesPerMinute > 5 * 1024 * 1024
    ) {
      return 'Unusual network activity';
    }
  }

  return null;
}

export function generateInitialSamples(count = 25): ResourceSample[] {
  const samples: ResourceSample[] = [];
  const now = Date.now();
  const step = 60 * 1000;

  const appPool = [
    'WhatsApp',
    'Chrome',
    'Spotify',
    'YouTube',
    'Signal',
    'ThreatShield',
    null,
  ];

  let battery = 88;
  let temp = 33.5;

  for (let i = count - 1; i >= 0; i--) {
    const time = now - i * step;
    // Normal baseline noise
    const cpu = Math.floor(12 + Math.sin(i * 0.3) * 8 + Math.random() * 8);
    battery = Math.max(15, battery - (Math.random() > 0.7 ? 1 : 0));
    temp = Math.max(28, Math.min(41, temp + (Math.random() - 0.5) * 0.4));
    const networkBytes = Math.floor(120 * 1024 + Math.random() * 800 * 1024);
    const fg = appPool[Math.floor(Math.random() * appPool.length)];

    samples.push({
      timestamp: time,
      cpuPercent: Math.max(2, Math.min(100, cpu)),
      batteryPercent: battery,
      temperatureC: Number(temp.toFixed(1)),
      networkBytesPerMinute: networkBytes,
      foregroundApp: fg,
    });
  }

  return samples;
}

export function createSample(
  previous?: ResourceSample,
  overrides?: Partial<ResourceSample>
): ResourceSample {
  const now = Date.now();
  const prevCpu = previous?.cpuPercent ?? 18;
  const prevTemp = previous?.temperatureC ?? 34.0;
  const prevBattery = previous?.batteryPercent ?? 85;

  // Realistic wander
  const cpuPercent = Math.max(
    5,
    Math.min(100, Math.round(prevCpu + (Math.random() - 0.48) * 8))
  );
  const batteryPercent = Math.max(
    1,
    Math.min(100, prevBattery - (Math.random() < 0.2 ? 1 : 0))
  );
  const temperatureC = Number(
    Math.max(26, Math.min(48, prevTemp + (Math.random() - 0.49) * 0.3)).toFixed(1)
  );
  const networkBytesPerMinute = Math.round(
    Math.max(45 * 1024, (200 + Math.random() * 600) * 1024)
  );

  const apps = ['ThreatShield', 'WhatsApp', 'Chrome', 'Spotify', 'YouTube', null];
  const foregroundApp = apps[Math.floor(Math.random() * apps.length)];

  return {
    timestamp: now,
    cpuPercent,
    batteryPercent,
    temperatureC,
    networkBytesPerMinute,
    foregroundApp,
    ...overrides,
  };
}
