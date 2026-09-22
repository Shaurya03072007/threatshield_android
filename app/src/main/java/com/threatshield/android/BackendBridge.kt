package com.threatshield.android

import android.content.Context
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Hardcoded connection settings from strings.xml. */
object BackendConfig {
    fun url(context: Context) = context.getString(R.string.backend_url).trim().trimEnd('/')
    fun token(context: Context) = context.getString(R.string.backend_token).trim()
    fun isConfigured(context: Context) = url(context).isNotBlank() && token(context).isNotBlank()
}

/** Response from the backend /api/v1/ingest endpoint. */
data class IngestResponse(
    val accepted: Boolean,
    val eventId: String?,
    val insights: List<Map<String, String>>,
    val autoScan: Boolean,
    val aiInsight: String?,
)

object BackendUploader {
    private const val UPLOAD_PREFS = "backend_upload_state"
    private const val LAST_UPLOAD = "last_upload"
    private const val MIN_UPLOAD_GAP_MS = 60_000L

    fun uploadSample(context: Context, sample: ResourceSample): IngestResponse? {
        if (!BackendConfig.isConfigured(context)) return null
        val prefs = context.getSharedPreferences(UPLOAD_PREFS, Context.MODE_PRIVATE)
        if (System.currentTimeMillis() - prefs.getLong(LAST_UPLOAD, 0) < MIN_UPLOAD_GAP_MS) return null
        val payload = JSONObject().apply {
            put("deviceId", deviceId())
            put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("snapshot", sample.toJson())
            put("appUsage", UsageInsights.topUsedApps(context).appUsageJson())
            put("networkUsage", UsageInsights.networkUsage(context).networkUsageJson())
        }
        return post(context, payload)?.also {
            if (it.accepted) prefs.edit().putLong(LAST_UPLOAD, System.currentTimeMillis()).apply()
        }
    }

    fun uploadScan(context: Context, report: ScanReport): IngestResponse? {
        if (!BackendConfig.isConfigured(context)) return null
        val payload = JSONObject().apply {
            put("deviceId", deviceId())
            put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("scan", JSONObject().apply {
                put("inspected", report.inspected)
                put("findings", JSONArray(report.findings.map { it.toJson() }))
            })
            put("appUsage", UsageInsights.topUsedApps(context).appUsageJson())
            put("networkUsage", UsageInsights.networkUsage(context).networkUsageJson())
        }
        return post(context, payload)
    }

    fun healthCheck(context: Context): Boolean {
        if (BackendConfig.url(context).isBlank()) return false
        return try {
            (URL("${BackendConfig.url(context)}/health").openConnection() as HttpURLConnection).run {
                connectTimeout = 5_000; readTimeout = 5_000; requestMethod = "GET"
                responseCode == HttpURLConnection.HTTP_OK
            }
        } catch (_: Exception) { false }
    }

    /**
     * Sends a chat message to the backend Gemini chat endpoint.
     * Returns the AI response string, or null on failure.
     */
    fun chat(context: Context, message: String, history: List<ChatMessage>): String? {
        if (!BackendConfig.isConfigured(context)) return "Connect to a backend first to use AI chat."
        return try {
            val historyArray = JSONArray(history.takeLast(20).map { msg ->
                JSONObject().apply {
                    put("role", msg.role)
                    put("text", msg.text)
                }
            })
            val payload = JSONObject().apply {
                put("deviceId", deviceId())
                put("message", message)
                put("history", historyArray)
            }
            val responseJson = postRaw(context, "/api/v1/chat", payload)
            responseJson?.optString("response")?.takeIf { it.isNotBlank() }
        } catch (_: Exception) { null }
    }

    private fun post(context: Context, payload: JSONObject): IngestResponse? = try {
        val responseJson = postRaw(context, "/api/v1/ingest", payload)
        if (responseJson != null) {
            val insightsArray = responseJson.optJSONArray("insights")
            val insights = mutableListOf<Map<String, String>>()
            if (insightsArray != null) {
                for (i in 0 until insightsArray.length()) {
                    val obj = insightsArray.optJSONObject(i) ?: continue
                    insights.add(mapOf(
                        "severity" to (obj.optString("severity")),
                        "title" to (obj.optString("title")),
                        "explanation" to (obj.optString("explanation")),
                        "action" to (obj.optString("action")),
                    ))
                }
            }
            IngestResponse(
                accepted = responseJson.optBoolean("accepted", false),
                eventId = responseJson.optString("eventId").takeIf { it.isNotBlank() },
                insights = insights,
                autoScan = responseJson.optBoolean("autoScan", false),
                aiInsight = responseJson.optString("aiInsight").takeIf { it.isNotBlank() },
            )
        } else null
    } catch (_: Exception) { null }

    private fun postRaw(context: Context, path: String, payload: JSONObject): JSONObject? = try {
        (URL("${BackendConfig.url(context)}$path").openConnection() as HttpURLConnection).run {
            connectTimeout = 10_000; readTimeout = 15_000; requestMethod = "POST"; doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("X-Device-Token", BackendConfig.token(context))
            outputStream.bufferedWriter().use { it.write(payload.toString()) }
            if (responseCode in 200..299) {
                JSONObject(inputStream.bufferedReader().readText())
            } else null
        }
    } catch (_: Exception) { null }

    fun deviceId() = "android-${Build.FINGERPRINT.hashCode().toUInt().toString(16)}"
}

private fun ResourceSample.toJson() = JSONObject().apply {
    put("timestamp", timestamp); put("cpuPercent", cpuPercent); put("batteryPercent", batteryPercent)
    put("temperatureC", temperatureC); put("networkBytesPerMinute", networkBytesPerMinute); put("foregroundApp", foregroundApp)
}
private fun ThreatFinding.toJson() = JSONObject().apply {
    put("severity", severity.name); put("appName", appName); put("packageName", packageName); put("score", score); put("reasons", JSONArray(reasons))
}
private fun List<AppUsage>.appUsageJson() = JSONArray(map { JSONObject().apply { put("label", it.label); put("packageName", it.packageName); put("foregroundMinutes", it.foregroundMinutes) } })
private fun List<AppNetworkUsage>.networkUsageJson() = JSONArray(map { JSONObject().apply { put("label", it.label); put("packageName", it.packageName); put("bytes", it.bytes) } })
