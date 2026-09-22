import { PackageManifest, ScanReport, Severity, ThreatFinding } from '../types';

export const SENSITIVE_PERMISSIONS = new Set([
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
]);

export const KNOWN_THREAT_PACKAGES: Record<string, string> = {
  'com.flexispy.android': 'Documented stalkerware package identifier',
  'com.hoverwatch.rem': 'Documented stalkerware package identifier',
  'com.mobile.spy': 'Documented stalkerware package identifier',
  'com.mspyagent': 'Documented stalkerware package identifier',
};

export class ThreatScannerService {
  static scan(
    packages: PackageManifest[],
    accessibilityServices: string[],
    deviceAdministrators: string[]
  ): ScanReport {
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    const activeAccessibilityPackages = new Set(
      accessibilityServices.map((service) => service.split('/')[0].trim()).filter(Boolean)
    );

    const findings: ThreatFinding[] = [];

    for (const pkg of packages) {
      const reasons: string[] = [];
      let score = 0;

      // 1. Known threat check (+90)
      if (KNOWN_THREAT_PACKAGES[pkg.packageName]) {
        score += 90;
        reasons.push(KNOWN_THREAT_PACKAGES[pkg.packageName]);
      }

      // 2. Sensitive permissions check (min 35, count * 7)
      const sensitiveFound = pkg.requestedPermissions.filter((p) =>
        SENSITIVE_PERMISSIONS.has(p)
      );
      if (sensitiveFound.length > 0) {
        score += Math.min(35, sensitiveFound.length * 7);
        const shortNames = sensitiveFound.map((p) => p.replace('android.permission.', ''));
        reasons.push(`Sensitive permissions: ${shortNames.join(', ')}`);
      }

      // 3. Hidden from launcher (+25)
      if (!pkg.isSystem && !pkg.hasLauncherIcon) {
        score += 25;
        reasons.push('No launcher icon (hidden from app drawer)');
      }

      // 4. Accessibility service enabled (+25)
      if (activeAccessibilityPackages.has(pkg.packageName) || pkg.isAccessibilityEnabled) {
        score += 25;
        reasons.push(
          'Enabled accessibility service: can read screen content and act for the user'
        );
      }

      // 5. Battery optimization exclusion (+10)
      if (pkg.isIgnoringBatteryOptimizations) {
        score += 10;
        reasons.push('Excluded from battery optimisation');
      }

      // 6. Recently installed with broad sensitive access (+10)
      const recentlyInstalled = now - pkg.firstInstallTime < SEVEN_DAYS;
      if (!pkg.isSystem && recentlyInstalled && sensitiveFound.length >= 3) {
        score += 10;
        reasons.push('Recently installed with broad sensitive access');
      }

      // Filter threshold
      if (score < 25) {
        continue;
      }

      let severity: Severity;
      if (score >= 90) {
        severity = Severity.CRITICAL;
      } else if (score >= 60) {
        severity = Severity.HIGH;
      } else if (score >= 35) {
        severity = Severity.MEDIUM;
      } else {
        severity = Severity.REVIEW;
      }

      findings.push({
        severity,
        appName: pkg.appName,
        packageName: pkg.packageName,
        score: Math.min(100, score),
        reasons,
      });
    }

    // Sort descending by score, then ascending by appName
    findings.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.appName.localeCompare(b.appName);
    });

    return {
      inspected: packages.length,
      findings,
      accessibilityServices: [...accessibilityServices].sort(),
      deviceAdministrators: [...deviceAdministrators].sort(),
    };
  }
}
