package com.threatshield.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.sqrt

data class ResourceSample(
    val timestamp: Long,
    val cpuPercent: Int,
    val batteryPercent: Int,
    val temperatureC: Float,
    val networkBytesPerMinute: Long,
    val foregroundApp: String?,
    val activeSensors: List<String> = emptyList(),
    val suspiciousBackgroundApp: String? = null,
)

object MonitorStore {
    private const val PREFS = "resource_monitor"
    private const val ENABLED = "enabled"
    private const val SAMPLES = "samples"
    private const val AI_INSIGHT = "ai_insight"
    private const val ANOMALY_ACTIVE = "anomaly_active"

    fun isEnabled(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(ENABLED, false)
    fun setEnabled(context: Context, enabled: Boolean) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ENABLED, enabled).apply()

    fun samples(context: Context): List<ResourceSample> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(SAMPLES, "") ?: ""
        return raw.lineSequence().mapNotNull { line ->
            val p = line.split('|')
            if (p.size != 6) null else try {
                ResourceSample(p[0].toLong(), p[1].toInt(), p[2].toInt(), p[3].toFloat(), p[4].toLong(), p[5].ifBlank { null })
            } catch (_: Exception) { null }
        }.toList()
    }

    fun append(context: Context, sample: ResourceSample) {
        val updated = (samples(context) + sample).takeLast(60)
        val raw = updated.joinToString("\n") { "${it.timestamp}|${it.cpuPercent}|${it.batteryPercent}|${it.temperatureC}|${it.networkBytesPerMinute}|${it.foregroundApp.orEmpty()}" }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(SAMPLES, raw).apply()
    }

    /** Last AI-generated insight from the backend. */
    fun lastAiInsight(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(AI_INSIGHT, null)

    fun setAiInsight(context: Context, insight: String?) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .apply { if (insight != null) putString(AI_INSIGHT, insight) else remove(AI_INSIGHT) }.apply()

    fun isAnomalyActive(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(ANOMALY_ACTIVE, false)

    fun setAnomalyActive(context: Context, active: Boolean) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ANOMALY_ACTIVE, active).apply()
}

/** Foreground service: samples device health adaptively and raises AI-powered alerts. */
class ResourceMonitorService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var previousCpu: CpuTick? = null
    private var previousNetworkBytes = 0L
    private var previousNetworkAt = 0L
    private var consecutiveAnomalies = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannels()
        startForeground(ONGOING_ID, ongoingNotification())
        previousNetworkBytes = android.net.TrafficStats.getTotalRxBytes().coerceAtLeast(0) + android.net.TrafficStats.getTotalTxBytes().coerceAtLeast(0)
        previousNetworkAt = SystemClock.elapsedRealtime()
        scope.launch {
            while (isActive) {
                val sample = readSample()
                MonitorStore.append(applicationContext, sample)

                // Upload to backend and receive AI response
                val ingestResponse = withContext(Dispatchers.IO) {
                    BackendUploader.uploadSample(applicationContext, sample)
                }

                if (ingestResponse != null) {
                    // Store AI insight for display in UI
                    if (!ingestResponse.aiInsight.isNullOrBlank()) {
                        MonitorStore.setAiInsight(applicationContext, ingestResponse.aiInsight)
                    }

                    // Auto-scan triggered by backend AI analysis
                    if (ingestResponse.autoScan) {
                        consecutiveAnomalies++
                        MonitorStore.setAnomalyActive(applicationContext, true)
                        postAnomalyNotification(sample, ingestResponse.aiInsight)

                        // Run a full threat scan automatically
                        val scanReport = withContext(Dispatchers.Default) {
                            ThreatScanner.scan(applicationContext)
                        }
                        withContext(Dispatchers.IO) {
                            BackendUploader.uploadScan(applicationContext, scanReport)
                        }

                        // Notify if scan found something
                        if (scanReport.findings.isNotEmpty()) {
                            postScanAlert(scanReport)
                        }
                    } else {
                        // Local rule fallback
                        val localLevel = anomalyLevel(MonitorStore.samples(applicationContext), sample)
                        if (localLevel != null) {
                            consecutiveAnomalies++
                            MonitorStore.setAnomalyActive(applicationContext, true)
                            postAlert(localLevel, sample, null)
                        } else {
                            consecutiveAnomalies = 0
                            MonitorStore.setAnomalyActive(applicationContext, false)
                        }
                    }
                } else {
                    // No backend — still run local anomaly detection
                    val localLevel = anomalyLevel(MonitorStore.samples(applicationContext), sample)
                    if (localLevel != null) {
                        consecutiveAnomalies++
                        MonitorStore.setAnomalyActive(applicationContext, true)
                        postAlert(localLevel, sample, null)
                    } else {
                        consecutiveAnomalies = 0
                        MonitorStore.setAnomalyActive(applicationContext, false)
                    }
                }

                // Adaptive sampling interval:
                // - Low battery (< 20%): every 2 minutes to conserve power
                // - Active anomaly: every 30 seconds for fast response
                // - Normal: every 60 seconds
                val intervalMs = when {
                    sample.batteryPercent < 20 -> 120_000L
                    consecutiveAnomalies > 0 -> 30_000L
                    else -> SAMPLE_PERIOD_MS
                }
                delay(intervalMs)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun readSample(): ResourceSample {
        val battery = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val temp = (battery?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0) / 10f
        val now = SystemClock.elapsedRealtime()
        val total = android.net.TrafficStats.getTotalRxBytes().coerceAtLeast(0) + android.net.TrafficStats.getTotalTxBytes().coerceAtLeast(0)
        val elapsed = (now - previousNetworkAt).coerceAtLeast(1)
        val perMinute = ((total - previousNetworkBytes).coerceAtLeast(0) * 60_000L) / elapsed
        previousNetworkAt = now
        val foregroundApp = UsageInsights.foregroundApp(applicationContext)
        val suspiciousBackgroundApps = SuspiciousAppStore.getAllSuspiciousApps(applicationContext).filter { it != foregroundApp }
        val suspiciousApp = suspiciousBackgroundApps.firstOrNull() // Pick one for simplicity in the sample
        val sensors = SensorMonitor.getActiveBackgroundSensors(applicationContext, foregroundApp)

        if (sensors.isNotEmpty()) {
            postSensorAlert(sensors)
        }

        return ResourceSample(
            System.currentTimeMillis(), cpuPercent(), (level * 100 / scale).coerceIn(0, 100), temp, perMinute,
            foregroundApp, sensors, suspiciousApp
        )
    }

    private fun postSensorAlert(sensors: List<String>) {
        val detail = "Background app is accessing: ${sensors.joinToString(", ")}"
        val notification = NotificationCompat.Builder(this, ALERT_CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle("🚨 Stealth Sensor Usage Detected")
            .setContentText(detail)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent())
            .build()
        (getSystemService(NotificationManager::class.java)).notify(105, notification)
    }

    private fun cpuPercent(): Int {
        val line = try { java.io.File("/proc/stat").useLines { it.firstOrNull() } } catch (_: Exception) { null } ?: return 0
        val values = line.trim().split(Regex("\\s+")).drop(1).mapNotNull { it.toLongOrNull() }
        if (values.size < 4) return 0
        val total = values.sum()
        val idle = values[3] + values.getOrElse(4) { 0L }
        val previous = previousCpu
        previousCpu = CpuTick(total, idle)
        if (previous == null || total <= previous.total) return 0
        return (((total - previous.total - (idle - previous.idle)) * 100) / (total - previous.total)).toInt().coerceIn(0, 100)
    }

    private fun anomalyLevel(history: List<ResourceSample>, current: ResourceSample): String? {
        if (current.cpuPercent >= 95 || current.temperatureC >= 47f || current.networkBytesPerMinute >= 250L * 1024 * 1024) return "Critical"
        if (current.cpuPercent >= 85 || current.temperatureC >= 43f || current.networkBytesPerMinute >= 100L * 1024 * 1024) return "High"
        val baseline = history.dropLast(1).takeLast(20).map { it.networkBytesPerMinute.toDouble() }
        if (baseline.size >= 8) {
            val mean = baseline.average()
            val deviation = sqrt(baseline.sumOf { (it - mean) * (it - mean) } / baseline.size)
            if (current.networkBytesPerMinute > mean + 3 * deviation && current.networkBytesPerMinute > 5L * 1024 * 1024) return "Unusual network activity"
        }
        return null
    }

    private fun postAlert(level: String, sample: ResourceSample, aiInsight: String?) {
        val detail = "CPU ${sample.cpuPercent}% • Battery ${sample.batteryPercent}% • Network ${formatBytes(sample.networkBytesPerMinute)}/min"
        val bigText = if (aiInsight != null) "$detail\n\n🤖 AI: $aiInsight" else "$detail\nReview recent activity in ThreatShield."
        val notification = NotificationCompat.Builder(this, ALERT_CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle("$level resource activity detected")
            .setContentText(detail)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bigText))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent())
            .build()
        (getSystemService(NotificationManager::class.java)).notify(ALERT_ID, notification)
    }

    private fun postAnomalyNotification(sample: ResourceSample, aiInsight: String?) {
        val detail = "CPU ${sample.cpuPercent}% • ${sample.temperatureC.toInt()}°C • ${formatBytes(sample.networkBytesPerMinute)}/min"
        val bigText = buildString {
            append(detail)
            append("\n\n⚠️ Auto-scan triggered.")
            if (!aiInsight.isNullOrBlank()) append("\n\n🤖 AI Analysis: $aiInsight")
        }
        val notification = NotificationCompat.Builder(this, ALERT_CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle("🚨 ThreatShield: Anomaly Detected")
            .setContentText(if (aiInsight != null) aiInsight.take(80) else detail)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bigText))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent())
            .build()
        (getSystemService(NotificationManager::class.java)).notify(ALERT_ID, notification)
    }

    private fun postScanAlert(report: ScanReport) {
        val highCount = report.findings.count { it.severity == Severity.CRITICAL || it.severity == Severity.HIGH }
        val notification = NotificationCompat.Builder(this, ALERT_CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle("🔍 Auto-Scan Complete: ${report.findings.size} app(s) flagged")
            .setContentText("$highCount high/critical findings. Tap to review in ThreatShield.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent())
            .build()
        (getSystemService(NotificationManager::class.java)).notify(SCAN_ALERT_ID, notification)
    }

    private fun ongoingNotification(): Notification {
        val subtitle = if (MonitorStore.isAnomalyActive(applicationContext)) "⚠️ Anomaly active — scanning every 30s" else "Monitoring device health adaptively"
        return NotificationCompat.Builder(this, MONITOR_CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle("ThreatShield AI monitoring is active")
            .setContentText(subtitle)
            .setOngoing(true).setContentIntent(openAppIntent()).build()
    }

    private fun openAppIntent(): PendingIntent = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private fun createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(MONITOR_CHANNEL, "ThreatShield monitoring", NotificationManager.IMPORTANCE_LOW))
            nm.createNotificationChannel(NotificationChannel(ALERT_CHANNEL, "ThreatShield alerts", NotificationManager.IMPORTANCE_HIGH))
        }
    }

    private data class CpuTick(val total: Long, val idle: Long)
    companion object {
        private const val SAMPLE_PERIOD_MS = 60_000L
        private const val ONGOING_ID = 102
        private const val ALERT_ID = 103
        private const val SCAN_ALERT_ID = 104
        private const val MONITOR_CHANNEL = "threatshield_monitor"
        private const val ALERT_CHANNEL = "threatshield_alerts"
        fun start(context: Context) {
            MonitorStore.setEnabled(context, true)
            val intent = Intent(context, ResourceMonitorService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
        }
        fun stop(context: Context) {
            MonitorStore.setEnabled(context, false)
            MonitorStore.setAnomalyActive(context, false)
            context.stopService(Intent(context, ResourceMonitorService::class.java))
        }
    }
}

fun formatBytes(value: Long): String = when {
    value >= 1024L * 1024 * 1024 -> "%.1f GB".format(value / 1024.0 / 1024 / 1024)
    value >= 1024L * 1024 -> "%.1f MB".format(value / 1024.0 / 1024)
    else -> "%.0f KB".format(value / 1024.0)
}
