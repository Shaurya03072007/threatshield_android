# ThreatShield Android MVP

ThreatShield is an Android security-monitoring prototype that combines the practical goals of the three supplied projects without incorporating their source code.

## Included now

- Explainable installed-app risk scan: known package identifiers, hidden launcher state, sensitive permissions, enabled accessibility services, battery-optimisation exclusion, and recent installation patterns.
- Visible real-time monitoring service: device CPU, battery percentage/temperature, total network rate, and recent foreground app.
- Automatic local alerts for high/critical CPU, device temperature, network spikes, and network anomalies against a rolling on-device baseline.
- Per-app 24-hour foreground time and Wi-Fi/mobile network totals after the user grants Android's **Usage access** setting.
- Notifications when an app is installed or updated, prompting the owner to rescan.
- Optional local Node backend and React Command Center, with phone-to-laptop telemetry encrypted only by the trusted-network/token model described in their READMEs.

## Important Android boundaries

- This is an explainable signal-based scanner, not an antivirus verdict. A normal Android app cannot inspect every process, file, certificate, or another app's private storage.
- CPU is device-wide. Android does not provide reliable per-app CPU consumption to regular third-party apps.
- The monitor runs as a visible foreground service; Android deliberately requires this persistent notification.
- `QUERY_ALL_PACKAGES` enables the full installed-app inventory. It needs a policy review before a Google Play release.

## Build

Open this folder in Android Studio and run the `app` configuration, or use Gradle with Android SDK 36 and JDK 17:

```powershell
./gradlew :app:assembleDebug
```

For a production release, add a signed threat-intelligence feed, data-retention controls, test coverage, and a privacy policy before distribution.

## Local dashboard

The free local backend and React dashboard live in `backend/` and `dashboard/`. They use Node, a JSON data file, and browser-session authentication—no cloud database or paid AI service. Start the backend before configuring the phone's **Connect local dashboard** screen. Read their individual READMEs for the private-network safety requirements.

## Safe testing

Use the harmless test fixture and test plan at [`testing/TESTING.md`](testing/TESTING.md). Never test with real spyware or malware.

## Source-project licensing note

HackCheck is MIT, Hypatia is AGPL-3.0, and PCAPdroid is GPL-3.0. Directly merging source from all three would require an AGPL-compatible release and full corresponding-source obligations. This independent MVP uses no code from those projects.
