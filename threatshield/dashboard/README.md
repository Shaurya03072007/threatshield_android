# ThreatShield Command Center

Professional local React dashboard for the ThreatShield Node backend. It uses browser-session storage for the backend URL and token; no telemetry is sent to a third-party service.

```powershell
npm install
npm run dev
```

Open the local address Vite displays (normally `http://localhost:5173`), then enter the backend URL and the same token you set for the Node backend.

The dashboard refreshes every 30 seconds while open. For a phone on your Wi-Fi, point the Android app at the laptop's private LAN address—not `localhost`.
