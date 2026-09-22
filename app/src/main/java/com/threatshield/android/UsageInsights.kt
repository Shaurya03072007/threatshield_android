package com.threatshield.android

import android.app.AppOpsManager
import android.app.usage.NetworkStats
import android.app.usage.NetworkStatsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Process

data class AppNetworkUsage(val label: String, val packageName: String, val bytes: Long)
data class AppUsage(val label: String, val packageName: String, val foregroundMinutes: Long)

object UsageInsights {
    fun hasUsageAccess(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        return appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
    }

    fun foregroundApp(context: Context): String? {
        if (!hasUsageAccess(context)) return null
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val now = System.currentTimeMillis()
        val entry = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - 10 * 60 * 1000, now)
            .maxByOrNull { it.lastTimeUsed } ?: return null
        return label(context, entry.packageName)
    }

    fun topUsedApps(context: Context): List<AppUsage> {
        if (!hasUsageAccess(context)) return emptyList()
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val now = System.currentTimeMillis()
        return manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - 24 * 60 * 60 * 1000, now)
            .filter { it.totalTimeInForeground > 0 }
            .map { AppUsage(label(context, it.packageName), it.packageName, it.totalTimeInForeground / 60_000) }
            .sortedByDescending { it.foregroundMinutes }.take(10)
    }

    fun networkUsage(context: Context): List<AppNetworkUsage> {
        if (!hasUsageAccess(context)) return emptyList()
        val manager = context.getSystemService(Context.NETWORK_STATS_SERVICE) as NetworkStatsManager
        val from = System.currentTimeMillis() - 24 * 60 * 60 * 1000
        val result = mutableMapOf<Int, Long>()
        listOf(android.net.ConnectivityManager.TYPE_WIFI, android.net.ConnectivityManager.TYPE_MOBILE).forEach { type ->
            try {
                manager.querySummary(type, null, from, System.currentTimeMillis()).use { stats ->
                    val bucket = NetworkStats.Bucket()
                    while (stats.hasNextBucket()) {
                        stats.getNextBucket(bucket)
                        result[bucket.uid] = (result[bucket.uid] ?: 0) + bucket.rxBytes + bucket.txBytes
                    }
                }
            } catch (_: Exception) { /* Mobile stats can be restricted by carriers/Android builds. */ }
        }
        val pm = context.packageManager
        return result.mapNotNull { (uid, bytes) ->
            if (uid <= 0 || bytes <= 0) return@mapNotNull null
            val pkg = pm.getPackagesForUid(uid)?.firstOrNull() ?: return@mapNotNull null
            AppNetworkUsage(label(context, pkg), pkg, bytes)
        }.sortedByDescending { it.bytes }.take(12)
    }

    private fun label(context: Context, packageName: String): String = try {
        val info = context.packageManager.getApplicationInfo(packageName, 0)
        context.packageManager.getApplicationLabel(info).toString()
    } catch (_: Exception) { packageName }
}

class BootReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context, intent: android.content.Intent) {
        if (intent.action == android.content.Intent.ACTION_BOOT_COMPLETED && MonitorStore.isEnabled(context)) {
            ResourceMonitorService.start(context)
        }
    }
}

/** A newly installed or updated app is a signal to prompt a fresh scan, never an automatic verdict. */
class PackageChangeReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context, intent: android.content.Intent) {
        if (intent.action == android.content.Intent.ACTION_PACKAGE_ADDED || intent.action == android.content.Intent.ACTION_PACKAGE_REPLACED) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                nm.createNotificationChannel(android.app.NotificationChannel("threatshield_changes", "App change notices", android.app.NotificationManager.IMPORTANCE_DEFAULT))
            }
            val notification = androidx.core.app.NotificationCompat.Builder(context, "threatshield_changes")
                .setSmallIcon(android.R.drawable.stat_sys_warning)
                .setContentTitle("App changed — scan recommended")
                .setContentText("A package was installed or updated. Run ThreatShield scan to review it.")
                .setAutoCancel(true)
                .build()
            nm.notify(107, notification)
        }
    }
}
