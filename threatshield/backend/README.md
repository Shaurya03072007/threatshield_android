# ThreatShield Backend

Free, local-only Node service for a ThreatShield phone. It writes its data to `data/threatshield.json`; no hosted database, paid API, or cloud AI account is used.

## Run it

Open PowerShell in this folder, set a strong random token, then start the service:

```powershell
$env:THREATSHIELD_TOKEN = 'replace-this-with-a-long-random-value'
$env:HOST = '0.0.0.0' # only if the phone connects over your trusted home Wi-Fi
npm install
npm run dev
```

Keep `HOST=127.0.0.1` when testing the dashboard only on the computer. Never expose port 8787 directly to the public internet. The phone and laptop should be on a trusted private network.

The dashboard and phone use the same token as the `X-Device-Token` header. Treat it like a password.

## Insight engine

The backend deliberately uses local, explainable statistical rules: fixed CPU/temperature thresholds and a network z-score against the latest 30 samples. It does not pretend to be a paid large-language model or a malware guarantee. This is the useful free option on a normal laptop.
