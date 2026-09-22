export enum Severity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  REVIEW = 'REVIEW',
}

export interface ThreatFinding {
  severity: Severity;
  appName: string;
  packageName: string;
  score: number;
  reasons: string[];
}

export interface ScanReport {
  inspected: number;
  findings: ThreatFinding[];
  accessibilityServices: string[];
  deviceAdministrators: string[];
}

export interface PackageManifest {
  packageName: string;
  appName: string;
  isSystem: boolean;
  hasLauncherIcon: boolean;
  requestedPermissions: string[];
  isAccessibilityEnabled: boolean;
  isIgnoringBatteryOptimizations: boolean;
  firstInstallTime: number; // timestamp
}

export interface ResourceSample {
  timestamp: number;
  cpuPercent: number;
  batteryPercent: number;
  temperatureC: number;
  networkBytesPerMinute: number;
  foregroundApp: string | null;
}

export interface AnomalyAlert {
  id: string;
  timestamp: number;
  level: 'Critical' | 'High' | 'Unusual network activity';
  detail: string;
  sample: ResourceSample;
}

export interface AppUsage {
  label: string;
  packageName: string;
  foregroundMinutes: number;
}

export interface AppNetworkUsage {
  label: string;
  packageName: string;
  bytes: number;
}

export interface LocalInsight {
  severity: 'critical' | 'high' | 'normal';
  title: string;
  explanation: string;
  action: string;
  timestamp: number;
}

export interface DeviceInfo {
  deviceId: string;
  name: string;
  lastSeenAt: number;
  latest?: ResourceSample | null;
}

export interface DashboardData {
  generatedAt: number;
  periodHours: number;
  devices: DeviceInfo[];
  timeline: (ResourceSample & { label: string })[];
  insights: LocalInsight[];
  scan: ScanReport | null;
  appUsage: AppUsage[];
  networkUsage: AppNetworkUsage[];
}

export interface BackendConnectionConfig {
  url: string;
  token: string;
}
