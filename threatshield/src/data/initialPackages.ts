import { PackageManifest } from '../types';

const NOW = Date.now();
const ONE_DAY = 24 * 60 * 60 * 1000;

export const INITIAL_PACKAGES: PackageManifest[] = [
  // Benign standard apps
  {
    packageName: 'com.whatsapp',
    appName: 'WhatsApp Messenger',
    isSystem: false,
    hasLauncherIcon: true,
    requestedPermissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_CONTACTS',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
    isAccessibilityEnabled: false,
    isIgnoringBatteryOptimizations: false,
    firstInstallTime: NOW - 45 * ONE_DAY,
  },
  {
    packageName: 'com.spotify.music',
    appName: 'Spotify',
    isSystem: false,
    hasLauncherIcon: true,
    requestedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
    isAccessibilityEnabled: false,
    isIgnoringBatteryOptimizations: true,
    firstInstallTime: NOW - 60 * ONE_DAY,
  },
  {
    packageName: 'com.google.android.youtube',
    appName: 'YouTube',
    isSystem: true,
    hasLauncherIcon: true,
    requestedPermissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
    isAccessibilityEnabled: false,
    isIgnoringBatteryOptimizations: false,
    firstInstallTime: NOW - 180 * ONE_DAY,
  },
  {
    packageName: 'com.google.android.gms',
    appName: 'Google Play Services',
    isSystem: true,
    hasLauncherIcon: false,
    requestedPermissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_SMS',
      'android.permission.READ_CONTACTS',
    ],
    isAccessibilityEnabled: false,
    isIgnoringBatteryOptimizations: true,
    firstInstallTime: NOW - 365 * ONE_DAY,
  },
  {
    packageName: 'com.android.chrome',
    appName: 'Google Chrome',
    isSystem: true,
    hasLauncherIcon: true,
    requestedPermissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
    isAccessibilityEnabled: false,
    isIgnoringBatteryOptimizations: false,
    firstInstallTime: NOW - 200 * ONE_DAY,
  },
  {
    packageName: 'org.signal.messenger',
    appName: 'Signal',
    isSystem: false,
    hasLauncherIcon: true,
    requestedPermissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_CONTACTS',
    ],
    isAccessibilityEnabled: false,
    isIgnoringBatteryOptimizations: true,
    firstInstallTime: NOW - 30 * ONE_DAY,
  },
  // Documented Stalkerware packages from ThreatScanner.kt
  {
    packageName: 'com.flexispy.android',
    appName: 'SyncService Core',
    isSystem: false,
    hasLauncherIcon: false,
    requestedPermissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_SMS',
      'android.permission.RECEIVE_SMS',
      'android.permission.SEND_SMS',
      'android.permission.READ_CALL_LOG',
      'android.permission.READ_CONTACTS',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.PACKAGE_USAGE_STATS',
    ],
    isAccessibilityEnabled: true,
    isIgnoringBatteryOptimizations: true,
    firstInstallTime: NOW - 2 * ONE_DAY,
  },
  {
    packageName: 'com.hoverwatch.rem',
    appName: 'System Update Helper',
    isSystem: false,
    hasLauncherIcon: false,
    requestedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_SMS',
      'android.permission.READ_CALL_LOG',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    isAccessibilityEnabled: true,
    isIgnoringBatteryOptimizations: true,
    firstInstallTime: NOW - 4 * ONE_DAY,
  },
  // Benign Test Fixture from testing/RiskFixture/app/src/main/AndroidManifest.xml
  {
    packageName: 'com.threatshield.fixture',
    appName: 'ThreatShield Risk Fixture',
    isSystem: false,
    hasLauncherIcon: false, // Deliberately no launcher icon
    requestedPermissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.READ_CONTACTS',
    ],
    isAccessibilityEnabled: false,
    isIgnoringBatteryOptimizations: false,
    firstInstallTime: NOW - 1 * ONE_DAY, // Recently installed
  },
];

export const INITIAL_ACCESSIBILITY_SERVICES = [
  'com.flexispy.android/com.flexispy.android.MonitorAccessibilityService',
  'com.hoverwatch.rem/com.hoverwatch.rem.WatchAccessibilityService',
];

export const INITIAL_DEVICE_ADMINS = [
  'com.google.android.apps.adm (Find My Device)',
];
