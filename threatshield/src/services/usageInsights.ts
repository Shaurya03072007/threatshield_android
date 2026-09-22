import { AppNetworkUsage, AppUsage } from '../types';

export const INITIAL_APP_USAGE: AppUsage[] = [
  { label: 'Chrome', packageName: 'com.android.chrome', foregroundMinutes: 142 },
  { label: 'WhatsApp', packageName: 'com.whatsapp', foregroundMinutes: 87 },
  { label: 'YouTube', packageName: 'com.google.android.youtube', foregroundMinutes: 65 },
  { label: 'Spotify', packageName: 'com.spotify.music', foregroundMinutes: 44 },
  { label: 'Signal', packageName: 'org.signal.messenger', foregroundMinutes: 28 },
  { label: 'ThreatShield', packageName: 'com.threatshield.android', foregroundMinutes: 19 },
];

export const INITIAL_NETWORK_USAGE: AppNetworkUsage[] = [
  {
    label: 'YouTube',
    packageName: 'com.google.android.youtube',
    bytes: 1840 * 1024 * 1024, // 1.8 GB
  },
  {
    label: 'Chrome',
    packageName: 'com.android.chrome',
    bytes: 490 * 1024 * 1024, // 490 MB
  },
  {
    label: 'Spotify',
    packageName: 'com.spotify.music',
    bytes: 310 * 1024 * 1024, // 310 MB
  },
  {
    label: 'Google Play Services',
    packageName: 'com.google.android.gms',
    bytes: 145 * 1024 * 1024, // 145 MB
  },
  {
    label: 'WhatsApp',
    packageName: 'com.whatsapp',
    bytes: 98 * 1024 * 1024, // 98 MB
  },
  {
    label: 'Signal',
    packageName: 'org.signal.messenger',
    bytes: 24 * 1024 * 1024, // 24 MB
  },
];
