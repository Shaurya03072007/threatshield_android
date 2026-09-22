import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { GoogleGenAI } from "@google/genai";

// Auto-load .env file if available
const envPaths = [
  path.join(process.cwd(), ".env"),
  path.join(process.cwd(), "..", ".env"),
  path.join(process.cwd(), "threatshield", ".env"),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    try {
      const content = fs.readFileSync(p, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key] && val) {
            process.env[key] = val;
          }
        }
      }
    } catch {}
  }
}

const app = express();
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
let token = process.env.THREATSHIELD_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;
const dataFile = path.join(process.cwd(), "data", "threatshield.json");

if (!token || token === "replace-with-a-long-random-value") {
  token = "threatshield-secret-token";
  console.warn("[ThreatShield] THREATSHIELD_TOKEN not specified or default placeholder used. Falling back to default token: 'threatshield-secret-token'");
}

// Gemini client — gracefully degrades if no key is set
const genai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
if (!genai) {
  console.warn("[ThreatShield] GEMINI_API_KEY not set — AI analysis will be disabled.");
} else {
  console.log("[ThreatShield] Gemini AI engine active (gemma-4-31b).");
}

app.use(express.json({ limit: "2mb" }));
app.use((_, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-Token");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});
app.options("/{*splat}", (_, response) => response.sendStatus(204));

// ─── Storage helpers ──────────────────────────────────────────────────────────

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return {
      devices: parsed.devices || {},
      events: parsed.events || [],
      aiSummaries: parsed.aiSummaries || [],
    };
  } catch {
    return { devices: {}, events: [], aiSummaries: [] };
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const temp = `${dataFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store), "utf8");
  fs.renameSync(temp, dataFile);
}

function authorised(request, response, next) {
  const supplied = request.get("X-Device-Token") || "";
  const expected = Buffer.from(token);
  const received = Buffer.from(supplied);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return response.status(401).json({ error: "Unauthorised" });
  }
  next();
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

function number(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function cleanSnapshot(raw = {}) {
  return {
    timestamp: number(raw.timestamp, Date.now()),
    cpuPercent: Math.max(0, Math.min(100, number(raw.cpuPercent))),
    batteryPercent: Math.max(0, Math.min(100, number(raw.batteryPercent))),
    temperatureC: Math.max(0, number(raw.temperatureC)),
    networkBytesPerMinute: Math.max(0, number(raw.networkBytesPerMinute)),
    foregroundApp: typeof raw.foregroundApp === "string" ? raw.foregroundApp.slice(0, 160) : null,
    activeSensors: Array.isArray(raw.activeSensors) ? raw.activeSensors.slice(0, 10).map(String) : [],
    suspiciousBackgroundApp: typeof raw.suspiciousBackgroundApp === "string" ? raw.suspiciousBackgroundApp.slice(0, 160) : null,
  };
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function formatBytes(value) {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

// ─── Rule-based local insights ────────────────────────────────────────────────

function localInsights(samples) {
  if (!samples.length) return [];
  const latest = samples.at(-1);
  const baseline = samples.slice(-31, -1);
  const insights = [];
  const add = (severity, title, explanation, action) =>
    insights.push({ severity, title, explanation, action, timestamp: latest.timestamp });

  if (latest.cpuPercent >= 95) add("critical", "Critical CPU pressure", `Device CPU reached ${latest.cpuPercent}%.`, "Open Android battery settings and inspect the most active apps.");
  else if (latest.cpuPercent >= 85) add("high", "Sustained CPU use", `Device CPU reached ${latest.cpuPercent}%.`, "Review the active app and repeat the scan if it is unfamiliar.");
  if (latest.temperatureC >= 47) add("critical", "Critical device temperature", `Battery temperature is ${latest.temperatureC.toFixed(1)}°C.`, "Stop charging and allow the device to cool before further diagnosis.");
  else if (latest.temperatureC >= 43) add("high", "High device temperature", `Battery temperature is ${latest.temperatureC.toFixed(1)}°C.`, "Check for resource-heavy apps, weak signal, or charging heat.");

  const traffic = baseline.map((s) => s.networkBytesPerMinute);
  if (traffic.length >= 8) {
    const average = mean(traffic);
    const deviation = standardDeviation(traffic);
    if (latest.networkBytesPerMinute > average + 3 * deviation && latest.networkBytesPerMinute > 5 * 1024 * 1024) {
      add("high", "Unusual network spike", `${formatBytes(latest.networkBytesPerMinute)}/min is well above this device's recent baseline (${formatBytes(average)}/min).`, "Check the foreground app and the per-app network chart; investigate unfamiliar apps first.");
    }
  }
  if (!insights.length) add("normal", "No immediate anomaly", "Latest sampled values are within the configured rule thresholds and recent local baseline.", "Keep monitoring; this is not proof that the device is malware-free.");
  return insights;
}

/** Returns true when any insight is critical or high — triggers auto-scan on device */
function shouldAutoScan(insights) {
  return insights.some((i) => i.severity === "critical" || i.severity === "high");
}

// ─── Gemini AI helpers ────────────────────────────────────────────────────────

function buildDiagnosticContext(snapshot, recentSamples, appUsage, networkUsage, scan) {
  const lines = [];
  if (snapshot) {
    lines.push(`=== Current Device Snapshot ===`);
    lines.push(`CPU: ${snapshot.cpuPercent}%`);
    lines.push(`Battery: ${snapshot.batteryPercent}% at ${snapshot.temperatureC.toFixed(1)}°C`);
    lines.push(`Network: ${formatBytes(snapshot.networkBytesPerMinute)}/min`);
    if (snapshot.foregroundApp) lines.push(`Foreground app: ${snapshot.foregroundApp}`);
    if (snapshot.activeSensors && snapshot.activeSensors.length > 0) {
      lines.push(`WARNING: Active background sensors: ${snapshot.activeSensors.join(", ")}`);
    }
    if (snapshot.suspiciousBackgroundApp) {
      lines.push(`WARNING: User-marked suspicious app running in background: ${snapshot.suspiciousBackgroundApp}`);
    }
  }
  if (recentSamples.length > 1) {
    const avgCpu = mean(recentSamples.map((s) => s.cpuPercent)).toFixed(1);
    const avgTemp = mean(recentSamples.map((s) => s.temperatureC)).toFixed(1);
    lines.push(`\n=== 30-minute Trend (${recentSamples.length} samples) ===`);
    lines.push(`Average CPU: ${avgCpu}%, Average temperature: ${avgTemp}°C`);
  }
  if (appUsage && appUsage.length) {
    lines.push(`\n=== Top Apps by Foreground Time ===`);
    appUsage.slice(0, 8).forEach((a) => lines.push(`  ${a.label || a.packageName}: ${a.foregroundMinutes} min`));
  }
  if (networkUsage && networkUsage.length) {
    lines.push(`\n=== Top Apps by Network Usage ===`);
    networkUsage.slice(0, 8).forEach((n) => lines.push(`  ${n.label || n.packageName}: ${formatBytes(n.bytes || 0)}`));
  }
  if (scan && scan.findings && scan.findings.length) {
    lines.push(`\n=== Security Scan Findings ===`);
    scan.findings.slice(0, 5).forEach((f) => {
      lines.push(`  [${f.severity}] ${f.appName} (${f.packageName}) — Score: ${f.score}/100`);
      if (f.reasons) f.reasons.forEach((r) => lines.push(`    • ${r}`));
    });
  }
  return lines.join("\n");
}

async function runGeminiAnalysis(diagnosticContext) {
  if (!genai) return null;
  try {
    const prompt = `You are ThreatShield AI, an expert mobile security and performance analyst.
Analyze this Android phone diagnostic data and provide a concise, actionable summary in 2-3 sentences.
Focus on the most important issue. Be specific — mention app names and numbers where relevant.
Use plain language the user can act on immediately.

CRITICAL: If you notice any "Active background sensors" (like Camera, Mic, or Screen Share) happening without a valid foreground app context, OR if a "User-marked suspicious app" is active, you MUST explicitly start your response with "SUSPICIOUS:" and warn the user.

${diagnosticContext}

Respond with ONLY your analysis. No headers, no bullet points, no preamble.`;

    const response = await genai.models.generateContent({
      model: "gemma-4-31b",
      contents: prompt,
    });
    return response.text?.trim() || null;
  } catch (error) {
    console.error("[Gemini] Analysis error:", error.message);
    return null;
  }
}

async function runGeminiChat(userMessage, diagnosticContext, chatHistory = []) {
  if (!genai) return "AI analysis is not configured. Please add GEMINI_API_KEY to the backend environment.";
  try {
    const systemContext = `You are ThreatShield AI, an expert mobile security and performance analyst embedded in a phone monitoring app.
You have real-time access to the user's phone diagnostic data. Be conversational, specific, and helpful.
Always reference actual numbers from the data when relevant. Keep answers concise (2-4 sentences).
If asked about a specific app, reference its actual usage stats if available.

Current Phone Diagnostics:
${diagnosticContext}`;

    // Build conversation contents
    const contents = [];

    // Include recent chat history for context
    for (const msg of chatHistory.slice(-10)) {
      contents.push({
        role: msg.role,
        parts: [{ text: msg.text }],
      });
    }

    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    const response = await genai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents,
      config: {
        systemInstruction: systemContext,
      },
    });
    return response.text?.trim() || "I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("[Gemini] Chat error:", error.message);
    return `AI error: ${error.message}`;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (_, response) =>
  response.json({ status: "ok", service: "ThreatShield Backend", ai: genai ? "enabled" : "disabled" })
);

app.post("/api/v1/ingest", authorised, async (request, response) => {
  const body = request.body || {};
  const deviceId = typeof body.deviceId === "string" && body.deviceId.length <= 100 ? body.deviceId : null;
  if (!deviceId) return response.status(400).json({ error: "deviceId is required" });

  const store = readStore();
  const snapshot = body.snapshot ? cleanSnapshot(body.snapshot) : null;
  const appUsage = Array.isArray(body.appUsage) ? body.appUsage.slice(0, 50) : [];
  const networkUsage = Array.isArray(body.networkUsage) ? body.networkUsage.slice(0, 50) : [];

  const event = {
    id: crypto.randomUUID(),
    deviceId,
    receivedAt: Date.now(),
    snapshot,
    scan: body.scan && typeof body.scan === "object" ? body.scan : null,
    appUsage,
    networkUsage,
  };

  store.devices[deviceId] = {
    deviceId,
    name: String(body.deviceName || deviceId).slice(0, 100),
    lastSeenAt: event.receivedAt,
  };
  store.events.push(event);
  store.events = store.events.slice(-10_000);

  // Build device sample history for rule analysis
  const deviceSnapshots = store.events
    .filter((e) => e.deviceId === deviceId && e.snapshot)
    .map((e) => e.snapshot)
    .slice(-32);

  const insights = snapshot ? localInsights(deviceSnapshots) : [];
  const autoScan = shouldAutoScan(insights);

  // Run Gemini analysis asynchronously — don't block the ingest response
  let aiInsight = null;
  if (snapshot && genai) {
    const diagnosticContext = buildDiagnosticContext(snapshot, deviceSnapshots.slice(-30), appUsage, networkUsage, event.scan);
    aiInsight = await runGeminiAnalysis(diagnosticContext);

    if (aiInsight) {
      store.aiSummaries.push({
        id: crypto.randomUUID(),
        deviceId,
        timestamp: Date.now(),
        summary: aiInsight,
        autoScanTriggered: autoScan,
        cpuPercent: snapshot.cpuPercent,
        temperatureC: snapshot.temperatureC,
      });
      store.aiSummaries = store.aiSummaries.slice(-500);
    }
  }

  writeStore(store);

  response.status(202).json({
    accepted: true,
    eventId: event.id,
    insights,
    autoScan,
    aiInsight,
  });
});

app.get("/api/v1/dashboard", authorised, (request, response) => {
  const store = readStore();
  const hours = Math.max(1, Math.min(168, number(request.query.hours, 24)));
  const since = Date.now() - hours * 60 * 60 * 1000;
  const events = store.events.filter((event) => event.receivedAt >= since);
  const snapshots = events.filter((e) => e.snapshot).map((e) => ({ ...e.snapshot, deviceId: e.deviceId }));
  const latestByDevice = Object.values(store.devices).map((device) => ({
    ...device,
    latest: snapshots.filter((s) => s.deviceId === device.deviceId).at(-1) || null,
  }));
  const latestEvent = events.at(-1);
  const mostRecentDevice = latestByDevice.sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0];
  const recent = snapshots.filter((s) => s.deviceId === mostRecentDevice?.deviceId).slice(-120);

  // Get the latest AI summary for the most recent device
  const latestAiSummary = store.aiSummaries
    .filter((s) => s.deviceId === mostRecentDevice?.deviceId)
    .at(-1) || null;

  response.json({
    generatedAt: Date.now(),
    periodHours: hours,
    devices: latestByDevice,
    timeline: recent,
    insights: localInsights(recent),
    scan: latestEvent?.scan || null,
    appUsage: latestEvent?.appUsage || [],
    networkUsage: latestEvent?.networkUsage || [],
    aiInsight: latestAiSummary?.summary || null,
    aiEnabled: genai !== null,
  });
});

app.get("/api/v1/ai-history", authorised, (request, response) => {
  const store = readStore();
  const limit = Math.max(1, Math.min(100, number(request.query.limit, 20)));
  const deviceId = request.query.deviceId;
  const summaries = store.aiSummaries
    .filter((s) => !deviceId || s.deviceId === deviceId)
    .slice(-limit)
    .reverse();
  response.json({ summaries, total: store.aiSummaries.length });
});

app.post("/api/v1/chat", authorised, async (request, response) => {
  const body = request.body || {};
  const userMessage = typeof body.message === "string" ? body.message.slice(0, 2000) : null;
  if (!userMessage) return response.status(400).json({ error: "message is required" });

  const chatHistory = Array.isArray(body.history) ? body.history.slice(-20) : [];

  // Build live diagnostic context from the backend store
  const store = readStore();
  const deviceId = typeof body.deviceId === "string" ? body.deviceId : null;

  const deviceSnapshots = store.events
    .filter((e) => (!deviceId || e.deviceId === deviceId) && e.snapshot)
    .map((e) => e.snapshot)
    .slice(-30);

  const latestEvent = store.events
    .filter((e) => !deviceId || e.deviceId === deviceId)
    .at(-1);

  const diagnosticContext = buildDiagnosticContext(
    deviceSnapshots.at(-1) || null,
    deviceSnapshots,
    latestEvent?.appUsage || [],
    latestEvent?.networkUsage || [],
    latestEvent?.scan || null,
  );

  const aiResponse = await runGeminiChat(userMessage, diagnosticContext, chatHistory);

  response.json({
    response: aiResponse,
    timestamp: Date.now(),
  });
});

app.listen(port, host, () => console.log(`ThreatShield Backend listening on http://${host}:${port} — AI: ${genai ? "on" : "off"}`));
