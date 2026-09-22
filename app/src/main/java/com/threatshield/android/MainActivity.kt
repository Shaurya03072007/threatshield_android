package com.threatshield.android

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private enum class Page(val title: String) { DASHBOARD("ThreatShield"), SCAN("App scan"), ACTIVITY("Activity"), CONNECT("Dashboard connection") }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme(colorScheme = androidx.compose.material3.lightColorScheme(primary = Color(0xFF075E54))) {
                Surface(Modifier.fillMaxSize()) { ThreatShieldApp() }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ThreatShieldApp() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var page by remember { mutableStateOf(Page.DASHBOARD) }
    var report by remember { mutableStateOf<ScanReport?>(null) }
    var scanning by remember { mutableStateOf(false) }
    var appUsage by remember { mutableStateOf<List<AppUsage>>(emptyList()) }
    var networkUsage by remember { mutableStateOf<List<AppNetworkUsage>>(emptyList()) }
    var loadingUsage by remember { mutableStateOf(false) }
    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }

    fun runScan() {
        scanning = true
        scope.launch {
            report = withContext(Dispatchers.Default) { ThreatScanner.scan(context) }
            report?.let { current -> withContext(Dispatchers.IO) { BackendUploader.uploadScan(context, current) } }
            scanning = false
        }
    }
    fun refreshUsage() {
        loadingUsage = true
        scope.launch {
            val values = withContext(Dispatchers.Default) {
                UsageInsights.topUsedApps(context) to UsageInsights.networkUsage(context)
            }
            appUsage = values.first; networkUsage = values.second; loadingUsage = false
        }
    }
    fun startMonitoring() {
        if (Build.VERSION.SDK_INT >= 33) notificationPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        ResourceMonitorService.start(context)
    }

    Scaffold(topBar = { TopAppBar(title = { Text(page.title) }) }) { padding ->
        when (page) {
            Page.DASHBOARD -> Dashboard(
                modifier = Modifier.padding(padding), monitorActive = MonitorStore.isEnabled(context), report = report,
                onStart = ::startMonitoring, onStop = { ResourceMonitorService.stop(context) },
                onScan = { page = Page.SCAN; runScan() }, onActivity = { page = Page.ACTIVITY; refreshUsage() },
                onUsageAccess = { context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }, onConnect = { page = Page.CONNECT },
            )
            Page.SCAN -> ScannerPage(Modifier.padding(padding), report, scanning, ::runScan, { page = Page.DASHBOARD })
            Page.ACTIVITY -> ActivityPage(Modifier.padding(padding), UsageInsights.hasUsageAccess(context), appUsage, networkUsage, loadingUsage, ::refreshUsage, { page = Page.DASHBOARD }, onUsageAccess = { context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) })
            Page.CONNECT -> ConnectionPage(Modifier.padding(padding), onBack = { page = Page.DASHBOARD })
        }
    }
}

@Composable
private fun Dashboard(
    modifier: Modifier, monitorActive: Boolean, report: ScanReport?, onStart: () -> Unit, onStop: () -> Unit,
    onScan: () -> Unit, onActivity: () -> Unit, onUsageAccess: () -> Unit, onConnect: () -> Unit,
) {
    val samples = MonitorStore.samples(LocalContext.current)
    val latest = samples.lastOrNull()
    Column(modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatusCard("Protection monitor", if (monitorActive) "Active — samples device health every minute" else "Off — start to monitor live resource anomalies", if (monitorActive) Color(0xFF087F23) else Color(0xFF8A4B00))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Button(onClick = if (monitorActive) onStop else onStart, modifier = Modifier.weight(1f)) { Text(if (monitorActive) "Stop monitor" else "Start monitor") }
            OutlinedButton(onClick = onScan, modifier = Modifier.weight(1f)) { Text("Scan apps") }
        }
        latest?.let { sample ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Text("Latest device snapshot", fontWeight = FontWeight.Bold)
                    Text("CPU ${sample.cpuPercent}%  •  Battery ${sample.batteryPercent}%  •  ${sample.temperatureC}°C")
                    Text("Network ${formatBytes(sample.networkBytesPerMinute)}/min" + (sample.foregroundApp?.let { "  •  Recent: $it" } ?: ""), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        report?.let { ScanSummary(it, Modifier.fillMaxWidth().clickable(onClick = onScan)) }
        OutlinedButton(onClick = onActivity, modifier = Modifier.fillMaxWidth()) { Text("View app & network activity") }
        OutlinedButton(onClick = onConnect, modifier = Modifier.fillMaxWidth()) { Text(if (BackendConfig.isConfigured(LocalContext.current)) "Dashboard connection configured" else "Connect local dashboard") }
        if (!UsageInsights.hasUsageAccess(LocalContext.current)) {
            Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF4CE))) {
                Column(Modifier.padding(14.dp)) {
                    Text("Optional permission: Usage access", fontWeight = FontWeight.Bold)
                    Text("Needed for per-app network totals and recent app usage. ThreatShield never reads the content inside other apps.", style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(8.dp)); OutlinedButton(onClick = onUsageAccess) { Text("Open Usage access settings") }
                }
            }
        }
        Text("ThreatShield identifies risk signals, not certain malware. Review each result before removing an app.", style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun ScannerPage(modifier: Modifier, report: ScanReport?, scanning: Boolean, onScan: () -> Unit, onBack: () -> Unit) {
    Column(modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onScan, enabled = !scanning, modifier = Modifier.weight(1f)) { Text(if (scanning) "Scanning…" else "Run full scan") }
            OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f)) { Text("Dashboard") }
        }
        if (scanning) CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally).padding(top = 32.dp))
        report?.let { current ->
            LazyColumn(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                item { ScanSummary(current, Modifier.fillMaxWidth()) }
                if (current.findings.isEmpty()) item { Text("No risk signals were found by the current rules.") }
                items(current.findings) { FindingCard(it) }
                if (current.accessibilityServices.isNotEmpty()) item { ReviewList("Enabled accessibility services", current.accessibilityServices) }
                if (current.deviceAdministrators.isNotEmpty()) item { ReviewList("Active device administrators", current.deviceAdministrators) }
                item { Text("A clean result is not proof that a device is malware-free. Android limits what a normal app can inspect.", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 12.dp)) }
            }
        }
    }
}

@Composable
private fun ActivityPage(modifier: Modifier, allowed: Boolean, apps: List<AppUsage>, network: List<AppNetworkUsage>, loading: Boolean, onRefresh: () -> Unit, onBack: () -> Unit, onUsageAccess: () -> Unit) {
    Column(modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = if (allowed) onRefresh else onUsageAccess, modifier = Modifier.weight(1f)) { Text(if (allowed) "Refresh" else "Grant usage access") }
            OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f)) { Text("Dashboard") }
        }
        if (!allowed) Text("Android requires the Usage access setting for this screen. This is separate from normal runtime permissions.", Modifier.padding(top = 16.dp))
        if (loading) CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally).padding(top = 24.dp))
        if (allowed && !loading) LazyColumn(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item { Text("Most-used apps — last 24 hours", fontWeight = FontWeight.Bold) }
            items(apps) { item -> UsageRow(item.label, item.packageName, "${item.foregroundMinutes} min foreground") }
            item { Spacer(Modifier.height(12.dp)); Text("Network use — last 24 hours", fontWeight = FontWeight.Bold) }
            items(network) { item -> UsageRow(item.label, item.packageName, formatBytes(item.bytes)) }
        }
    }
}

@Composable
private fun ConnectionPage(modifier: Modifier, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var url by remember { mutableStateOf(BackendConfig.url(context)) }
    var token by remember { mutableStateOf(BackendConfig.token(context)) }
    var status by remember { mutableStateOf<String?>(null) }
    Column(modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Optional private dashboard", fontWeight = FontWeight.Bold)
        Text("ThreatShield sends summaries only after you save a backend address and token. For a laptop on your Wi-Fi, use its private address, such as http://192.168.1.20:8787 — never use localhost.", style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(value = url, onValueChange = { url = it }, label = { Text("Backend URL") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = token, onValueChange = { token = it }, label = { Text("Shared dashboard token") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Button(onClick = { BackendConfig.save(context, url, token); status = "Saved. Start monitoring or run a scan to upload local summaries." }, modifier = Modifier.fillMaxWidth(), enabled = url.isNotBlank() && token.isNotBlank()) { Text("Save connection") }
        OutlinedButton(onClick = { scope.launch { status = if (withContext(Dispatchers.IO) { BackendUploader.healthCheck(context) }) "Backend is reachable." else "Could not reach backend. Confirm its Wi-Fi address, server status, and firewall." } }, modifier = Modifier.fillMaxWidth()) { Text("Test backend connection") }
        status?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        OutlinedButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) { Text("Back to dashboard") }
    }
}

@Composable private fun ScanSummary(report: ScanReport, modifier: Modifier) = Card(modifier) { Column(Modifier.padding(14.dp)) { Text("${report.inspected} installed apps inspected", fontWeight = FontWeight.Bold); Text("${report.findings.size} app(s) need review", style = MaterialTheme.typography.bodySmall) } }
@Composable private fun StatusCard(title: String, body: String, color: Color) = Card(colors = CardDefaults.cardColors(containerColor = color.copy(alpha = .10f)), modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp)) { Text(title, fontWeight = FontWeight.Bold, color = color); Text(body, style = MaterialTheme.typography.bodySmall) } }
@Composable private fun FindingCard(finding: ThreatFinding) {
    val color = when (finding.severity) { Severity.CRITICAL -> Color(0xFFB00020); Severity.HIGH -> Color(0xFFD84315); Severity.MEDIUM -> Color(0xFF8A6200); Severity.REVIEW -> Color(0xFF1565C0) }
    Card(colors = CardDefaults.cardColors(containerColor = color.copy(alpha = .08f))) { Column(Modifier.padding(14.dp)) {
        Text("${finding.severity} • score ${finding.score}/100", color = color, fontWeight = FontWeight.Bold); Text(finding.appName, fontWeight = FontWeight.Bold); Text(finding.packageName, style = MaterialTheme.typography.bodySmall)
        finding.reasons.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall) }
    } }
}
@Composable private fun ReviewList(title: String, values: List<String>) {
    Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp)) {
        Text(title, fontWeight = FontWeight.Bold); values.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall) }
    } }
}
@Composable private fun UsageRow(name: String, packageName: String, value: String) {
    Card(Modifier.fillMaxWidth()) { Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text(name, fontWeight = FontWeight.Medium); Text(packageName, style = MaterialTheme.typography.bodySmall) }; Text(value)
    } }
}
