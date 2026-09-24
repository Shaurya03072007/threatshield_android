package com.threatshield.android

import android.app.AppOpsManager
import android.app.usage.NetworkStats
import android.app.usage.NetworkStatsManager
import android.app.usage.StorageStatsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Process
import android.os.storage.StorageManager
import java.util.UUID

data class AppNetworkUsage(val label: String, val packageName: String, val bytes: Long)
data class AppUsage(val label: String, val packageName: String, val foregroundMinutes: Long)

data class AppActivityMetric(
    val label: String,
    val packageName: String,
    val foregroundMinutes: Long,
    val networkBytes: Long,
    val cacheBytes: Long,
    val dataBytes: Long,
    val lastTimeUsed: Long
)

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

    fun aggregateActivity(context: Context): List<AppActivityMetric> {
        if (!hasUsageAccess(context)) return emptyList()
        val usageManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val networkManager = context.getSystemService(Context.NETWORK_STATS_SERVICE) as NetworkStatsManager
        val storageManager = context.getSystemService(Context.STORAGE_STATS_SERVICE) as StorageStatsManager
        val pm = context.packageManager
        
        val now = System.currentTimeMillis()
        val from = now - 24 * 60 * 60 * 1000
        
        // 1. Get Usage Stats
        val usageStats = usageManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, from, now)
        val packageForeground = mutableMapOf<String, Long>()
        val packageLastUsed = mutableMapOf<String, Long>()
        for (stat in usageStats) {
            packageForeground[stat.packageName] = (packageForeground[stat.packageName] ?: 0L) + stat.totalTimeInForeground
            packageLastUsed[stat.packageName] = maxOf(packageLastUsed[stat.packageName] ?: 0L, stat.lastTimeUsed)
        }
        
        // 2. Get Network Stats
        val networkMap = mutableMapOf<Int, Long>()
        listOf(android.net.ConnectivityManager.TYPE_WIFI, android.net.ConnectivityManager.TYPE_MOBILE).forEach { type ->
            try {
                networkManager.querySummary(type, null, from, now).use { stats ->
                    val bucket = NetworkStats.Bucket()
                    while (stats.hasNextBucket()) {
                        stats.getNextBucket(bucket)
                        networkMap[bucket.uid] = (networkMap[bucket.uid] ?: 0L) + bucket.rxBytes + bucket.txBytes
                    }
                }
            } catch (_: Exception) {}
        }
        
        // Map uid to packageName for network stats
        val packageNetwork = mutableMapOf<String, Long>()
        for ((uid, bytes) in networkMap) {
            val pkgs = pm.getPackagesForUid(uid) ?: continue
            val pkg = pkgs.firstOrNull() ?: continue
            packageNetwork[pkg] = (packageNetwork[pkg] ?: 0L) + bytes
        }
        
        // Combine all packages that have either usage or network activity
        val allPackages = (packageForeground.keys + packageNetwork.keys).distinct()
        
        val result = allPackages.mapNotNull { pkg ->
            var cache = 0L
            var data = 0L
            try {
                val stats = storageManager.queryStatsForPackage(StorageManager.UUID_DEFAULT, pkg, Process.myUserHandle())
                cache = stats.cacheBytes
                data = stats.dataBytes
            } catch (e: Exception) {}
            
            AppActivityMetric(
                label = label(context, pkg),
                packageName = pkg,
                foregroundMinutes = (packageForeground[pkg] ?: 0L) / 60_000L,
                networkBytes = packageNetwork[pkg] ?: 0L,
                cacheBytes = cache,
                dataBytes = data,
                lastTimeUsed = packageLastUsed[pkg] ?: 0L
            )
        }
        
        return result.sortedByDescending { it.lastTimeUsed }
    }

    private fun label(context: Context, packageName: String): String = try {
        val info = context.packageManager.getApplicationInfo(packageName, 0)
        context.packageManager.getApplicationLabel(info).toString()
    } catch (_: Exception) { packageName }
    
    fun hourlyStats(context: Context, packageName: String): AppHourlyStats {
        val usageManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val networkManager = context.getSystemService(Context.NETWORK_STATS_SERVICE) as NetworkStatsManager
        val pm = context.packageManager
        
        val now = System.currentTimeMillis()
        val hourMs = 60 * 60 * 1000L
        val timeActive = FloatArray(24)
        val networkUse = FloatArray(24)
        
        val uid = try { pm.getPackageUid(packageName, 0) } catch (e: Exception) { -1 }
        
        for (i in 0 until 24) {
            val end = now - (23 - i) * hourMs
            val start = end - hourMs
            
            // Usage
            val stats = usageManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end)
            val stat = stats.find { it.packageName == packageName }
            timeActive[i] = (stat?.totalTimeInForeground ?: 0L) / 60_000f
        }
        
        // Calculate deltas since queryUsageStats returns cumulative data for the interval bucket
        for (i in 23 downTo 1) {
             var diff = timeActive[i] - timeActive[i-1]
             if (diff < 0) diff = timeActive[i]
             timeActive[i] = diff
        }
        timeActive[0] = 0f 
        
        for (i in 0 until 24) {
            val end = now - (23 - i) * hourMs
            val start = end - hourMs
            
            var rxTx = 0f
            if (uid != -1) {
                listOf(android.net.ConnectivityManager.TYPE_WIFI, android.net.ConnectivityManager.TYPE_MOBILE).forEach { type ->
                    try {
                        networkManager.querySummary(type, null, start, end).use { summary ->
                            val bucket = NetworkStats.Bucket()
                            while (summary.hasNextBucket()) {
                                summary.getNextBucket(bucket)
                                if (bucket.uid == uid) {
                                    rxTx += bucket.rxBytes + bucket.txBytes
                                }
                            }
                        }
                    } catch (_: Exception) {}
                }
            }
            networkUse[i] = rxTx
        }
        
        return AppHourlyStats(timeActive.toList(), networkUse.toList())
    }
}

data class AppHourlyStats(val timeActiveMinutes: List<Float>, val networkBytes: List<Float>)

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
