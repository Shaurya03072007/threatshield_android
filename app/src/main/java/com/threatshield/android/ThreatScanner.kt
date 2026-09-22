package com.threatshield.android

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.PowerManager
import android.provider.Settings

enum class Severity { CRITICAL, HIGH, MEDIUM, REVIEW }

data class ThreatFinding(
    val severity: Severity,
    val appName: String,
    val packageName: String,
    val score: Int,
    val reasons: List<String>,
)

data class ScanReport(
    val inspected: Int,
    val findings: List<ThreatFinding>,
    val accessibilityServices: List<String>,
    val deviceAdministrators: List<String>,
)

/**
 * On-device, explainable risk scoring. It does not claim to identify every malware family;
 * each result is a review signal that the user can investigate or remove from Android Settings.
 */
object ThreatScanner {
    private val sensitivePermissions = setOf(
        "android.permission.CAMERA", "android.permission.RECORD_AUDIO",
        "android.permission.READ_SMS", "android.permission.RECEIVE_SMS",
        "android.permission.SEND_SMS", "android.permission.READ_CALL_LOG",
        "android.permission.READ_CONTACTS", "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION", "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.PACKAGE_USAGE_STATS",
    )

    // A deliberately small, bundled starter list. Production should use a signed,
    // versioned intelligence feed with provenance and expiration metadata.
    private val knownThreatPackages = mapOf(
        "com.flexispy.android" to "Documented stalkerware package identifier",
        "com.hoverwatch.rem" to "Documented stalkerware package identifier",
        "com.mobile.spy" to "Documented stalkerware package identifier",
        "com.mspyagent" to "Documented stalkerware package identifier",
    )

    fun scan(context: Context): ScanReport {
        val pm = context.packageManager
        val accessibility = enabledAccessibilityPackages(context)
        val administrators = activeAdministrators(context)
        val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        @Suppress("DEPRECATION")
        val packages = try {
            pm.getInstalledPackages(PackageManager.GET_PERMISSIONS)
        } catch (_: Exception) { emptyList() }

        val findings = packages.mapNotNull { pkg ->
            val app = pkg.applicationInfo ?: return@mapNotNull null
            val isSystem = app.flags and ApplicationInfo.FLAG_SYSTEM != 0
            val name = pm.getApplicationLabel(app).toString()
            val reasons = mutableListOf<String>()
            var score = 0
            knownThreatPackages[pkg.packageName]?.let {
                score += 90; reasons += it
            }
            val permissions = grantedSensitivePermissions(pkg)
            if (permissions.isNotEmpty()) {
                score += minOf(35, permissions.size * 7)
                reasons += "Sensitive permissions: ${permissions.joinToString() }"
            }
            val hidden = pm.getLaunchIntentForPackage(pkg.packageName) == null
            if (!isSystem && hidden) {
                score += 25; reasons += "No launcher icon (hidden from app drawer)"
            }
            if (pkg.packageName in accessibility) {
                score += 25; reasons += "Enabled accessibility service: can read screen content and act for the user"
            }
            if (power?.isIgnoringBatteryOptimizations(pkg.packageName) == true) {
                score += 10; reasons += "Excluded from battery optimisation"
            }
            val recentlyInstalled = System.currentTimeMillis() - pkg.firstInstallTime < 7L * 24 * 60 * 60 * 1000
            if (!isSystem && recentlyInstalled && permissions.size >= 3) {
                score += 10; reasons += "Recently installed with broad sensitive access"
            }
            if (score < 25) return@mapNotNull null
            val severity = when {
                score >= 90 -> Severity.CRITICAL
                score >= 60 -> Severity.HIGH
                score >= 35 -> Severity.MEDIUM
                else -> Severity.REVIEW
            }
            ThreatFinding(severity, name, pkg.packageName, score.coerceAtMost(100), reasons)
        }.sortedWith(compareByDescending<ThreatFinding> { it.score }.thenBy { it.appName })

        return ScanReport(packages.size, findings, accessibility.toList().sorted(), administrators.sorted())
    }

    private fun grantedSensitivePermissions(pkg: PackageInfo): List<String> {
        val permissions = pkg.requestedPermissions ?: return emptyList()
        val flags = pkg.requestedPermissionsFlags ?: return emptyList()
        return permissions.indices.mapNotNull { index ->
            val granted = index < flags.size && flags[index] and PackageInfo.REQUESTED_PERMISSION_GRANTED != 0
            permissions[index].takeIf { granted && it in sensitivePermissions }?.substringAfterLast('.')
        }
    }

    private fun enabledAccessibilityPackages(context: Context): Set<String> =
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
            ?.split(':')
            ?.mapNotNull { it.substringBefore('/').takeIf(String::isNotBlank) }
            ?.toSet() ?: emptySet()

    private fun activeAdministrators(context: Context): List<String> = try {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        dpm.activeAdmins?.map { it.packageName } ?: emptyList()
    } catch (_: Exception) { emptyList() }
}
