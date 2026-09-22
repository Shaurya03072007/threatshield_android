# Safe test plan — never use real spyware

Do **not** download, install, or execute spyware, stalkerware, remote-access trojans, or leaked malware samples. Those can compromise the test phone, expose private data, spread to other devices, and may be illegal to possess or use. A security app should be tested with harmless signals and an isolated test device.

## 1. App-risk scanner fixture

`RiskFixture` is a benign Android app supplied with this project. It does not use the camera, microphone, location, or contacts after the permission dialog. It has no network permission, no background service, no receiver, no file access, and no launcher icon.

From `testing/RiskFixture`, build it with the wrapper in the parent ThreatShield folder:

```powershell
..\..\gradlew.bat -p . :app:assembleDebug
adb install app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.threatshield.fixture/.FixtureActivity
```

Approve its permission dialogs. Then run **App scan** in ThreatShield. It should flag the fixture as a non-system app with no launcher icon and several sensitive permissions. Uninstall it when finished:

```powershell
adb uninstall com.threatshield.fixture
```

## 2. Notification and resource-monitor checks

- Enable ThreatShield monitoring and check that Android shows its persistent notification.
- In the phone's normal workload, use a trusted video app/game for a few minutes while watching battery temperature, CPU, and traffic trend. Do not deliberately overheat or stress the device.
- Turn on airplane mode then off, install/update a harmless test app, and confirm ThreatShield prompts you to scan it.
- Verify the dashboard receives samples only after you deliberately configure the backend URL and token.

## 3. Isolated advanced testing

If you need independent third-party test data, use an Android emulator or a spare factory-reset device with no personal account/data. Obtain benign test samples only from a reputable security research lab, read its licence, keep the device offline, and destroy the environment afterward. Do not use real spyware as a test fixture.

## Expected limits

A normal Android app cannot prove that a phone is clean, see another app's private files, accurately attribute CPU to every app, or detect kernel/root-level compromise. Treat results as prioritised review signals, not a forensic verdict.
