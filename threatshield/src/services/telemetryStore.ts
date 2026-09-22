import {
  AppNetworkUsage,
  AppUsage,
  DashboardData,
  DeviceInfo,
  LocalInsight,
  ResourceSample,
  ScanReport,
} from '../types';
import { formatBytes } from './resourceMonitor';

function mean(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

export function generateLocalInsights(samples: ResourceSample[]): LocalInsight[] {
  if (!samples.length) return [];
  const latest = samples[samples.length - 1];
  const baseline = samples.slice(-31, -1);
  const insights: LocalInsight[] = [];

  const add = (
    severity: 'critical' | 'high' | 'normal',
    title: string,
    explanation: string,
    action: string
  ) => {
    insights.push({
      severity,
      title,
      explanation,
      action,
      timestamp: latest.timestamp,
    });
  };

  // CPU Rules
  if (latest.cpuPercent >= 95) {
    add(
      'critical',
      'Critical CPU pressure',
      `Device CPU reached ${latest.cpuPercent}%.`,
      'Open Android battery settings and inspect the most active apps.'
    );
  } else if (latest.cpuPercent >= 85) {
    add(
      'high',
      'Sustained CPU use',
      `Device CPU reached ${latest.cpuPercent}%.`,
      'Review the active app and repeat the scan if it is unfamiliar.'
    );
  }

  // Temperature Rules
  if (latest.temperatureC >= 47) {
    add(
      'critical',
      'Critical device temperature',
      `Battery temperature is ${latest.temperatureC.toFixed(1)}°C.`,
      'Stop charging and allow the device to cool before further diagnosis.'
    );
  } else if (latest.temperatureC >= 43) {
    add(
      'high',
      'High device temperature',
      `Battery temperature is ${latest.temperatureC.toFixed(1)}°C.`,
      'Check for resource-heavy apps, weak signal, or charging heat.'
    );
  }

  // Network spike against rolling baseline
  const traffic = baseline.map((sample) => sample.networkBytesPerMinute);
  if (traffic.length >= 8) {
    const average = mean(traffic);
    const deviation = standardDeviation(traffic);
    if (
      latest.networkBytesPerMinute > average + 3 * deviation &&
      latest.networkBytesPerMinute > 5 * 1024 * 1024
    ) {
      add(
        'high',
        'Unusual network spike',
        `${formatBytes(latest.networkBytesPerMinute)}/min is well above this device's recent baseline (${formatBytes(average)}/min).`,
        'Check the foreground app and the per-app network chart; investigate unfamiliar apps first.'
      );
    }
  }

  // Default normal insight if no flags
  if (!insights.length) {
    add(
      'normal',
      'No immediate anomaly',
      'Latest sampled values are within the configured rule thresholds and recent local baseline.',
      'Keep monitoring; this is not proof that the device is malware-free.'
    );
  }

  return insights;
}

export function buildDashboardState(
  samples: ResourceSample[],
  scanReport: ScanReport | null,
  appUsage: AppUsage[],
  networkUsage: AppNetworkUsage[],
  deviceName = 'Pixel 8 Pro (Simulated)'
): DashboardData {
  const dateFmt = (value: number) =>
    new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);

  const timeline = samples.map((item) => ({
    ...item,
    label: dateFmt(item.timestamp),
  }));

  const latestSample = samples[samples.length - 1] ?? null;

  const devices: DeviceInfo[] = [
    {
      deviceId: 'android-e94f83b1',
      name: deviceName,
      lastSeenAt: latestSample ? latestSample.timestamp : Date.now(),
      latest: latestSample,
    },
  ];

  return {
    generatedAt: Date.now(),
    periodHours: 24,
    devices,
    timeline,
    insights: generateLocalInsights(samples),
    scan: scanReport,
    appUsage,
    networkUsage,
  };
}
