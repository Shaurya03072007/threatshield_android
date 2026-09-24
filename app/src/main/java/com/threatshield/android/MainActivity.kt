package com.threatshield.android

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
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
import androidx.compose.animation.Crossfade
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.material3.ElevatedCard
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.SettingsEthernet
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.filled.Delete
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
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.sp

private enum class Page(val title: String) { DASHBOARD("ThreatShield"), SCAN("App scan"), ACTIVITY("Activity"), CONNECT("Dashboard connection"), CHAT("Chat with AI") }
private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF90CAF9),
    secondary = Color(0xFFCE93D8),
    tertiary = Color(0xFF80CBC4),
    background = Color(0xFF121212),
    surface = Color(0xFF1E1E1E),
    onPrimary = Color.Black,
    onSecondary = Color.Black,
    onTertiary = Color.Black,
    onBackground = Color.White,
    onSurface = Color.White,
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFF1976D2),
    secondary = Color(0xFF9C27B0),
    tertiary = Color(0xFF00897B),
    background = Color(0xFFF5F5F5),
    surface = Color.White,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onTertiary = Color.White,
    onBackground = Color(0xFF1C1B1F),
    onSurface = Color(0xFF1C1B1F),
)

@Composable
fun ThreatShieldTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ThreatShieldTheme {
                Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { ThreatShieldApp() }
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
    var activityMetrics by remember { mutableStateOf<List<AppActivityMetric>>(emptyList()) }
    var selectedAppMetric by remember { mutableStateOf<AppActivityMetric?>(null) }
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
            activityMetrics = withContext(Dispatchers.Default) { UsageInsights.aggregateActivity(context) }
            loadingUsage = false
        }
    }
    fun startMonitoring() {
        if (Build.VERSION.SDK_INT >= 33) notificationPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        ResourceMonitorService.start(context)
    }

    BackHandler(enabled = page != Page.DASHBOARD || selectedAppMetric != null) {
        if (selectedAppMetric != null) {
            selectedAppMetric = null
        } else {
            page = Page.DASHBOARD
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text(page.title) }) }) { padding ->
        Crossfade(targetState = page, animationSpec = tween(300), label = "PageTransition", modifier = Modifier.padding(padding)) { targetPage ->
            when (targetPage) {
                Page.DASHBOARD -> Dashboard(
                    modifier = Modifier, monitorActive = MonitorStore.isEnabled(context), report = report,
                    onStart = ::startMonitoring, onStop = { ResourceMonitorService.stop(context) },
                    onScan = { page = Page.SCAN; runScan() }, onActivity = { page = Page.ACTIVITY; refreshUsage() },
                    onUsageAccess = { context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }, onConnect = { page = Page.CONNECT },
                    onChat = { page = Page.CHAT }
                )
                Page.SCAN -> ScannerPage(Modifier, report, scanning, ::runScan, { page = Page.DASHBOARD })
                Page.ACTIVITY -> {
                    Crossfade(targetState = selectedAppMetric, animationSpec = tween(300), label = "AppDetailTransition") { metric ->
                        if (metric != null) {
                            AppDetailPage(Modifier, metric) { selectedAppMetric = null }
                        } else {
                            ActivityPage(Modifier, UsageInsights.hasUsageAccess(context), activityMetrics, loadingUsage, ::refreshUsage, { page = Page.DASHBOARD }, onUsageAccess = { context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }) { selectedAppMetric = it }
                        }
                    }
                }
                Page.CONNECT -> ConnectionPage(Modifier, onBack = { page = Page.DASHBOARD })
                Page.CHAT -> ChatPage(Modifier, onBack = { page = Page.DASHBOARD })
            }
        }
    }
}

@Composable
private fun Dashboard(
    modifier: Modifier, monitorActive: Boolean, report: ScanReport?, onStart: () -> Unit, onStop: () -> Unit,
    onScan: () -> Unit, onActivity: () -> Unit, onUsageAccess: () -> Unit, onConnect: () -> Unit, onChat: () -> Unit
) {
    val samples = MonitorStore.samples(LocalContext.current)
    val latest = samples.lastOrNull()
    
    LazyColumn(modifier = modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Text("Overview", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        }
        
        item {
            StatusCard(
                title = "Protection monitor",
                text = if (monitorActive) "Active — monitoring live resources" else "Off — tap to start monitoring",
                color = if (monitorActive) Color(0xFF087F23) else Color(0xFFC62828)
            )
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                ElevatedCard(onClick = if (monitorActive) onStop else onStart, modifier = Modifier.weight(1f).height(100.dp)) {
                    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Icon(if (monitorActive) Icons.Default.Shield else Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(8.dp))
                        Text(if (monitorActive) "Stop Monitor" else "Start Monitor", fontWeight = FontWeight.SemiBold)
                    }
                }
                ElevatedCard(onClick = onScan, modifier = Modifier.weight(1f).height(100.dp)) {
                    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Icon(Icons.Default.Security, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(8.dp))
                        Text("Scan Apps", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
        
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                ElevatedCard(onClick = onActivity, modifier = Modifier.weight(1f).height(100.dp)) {
                    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Icon(Icons.Default.BarChart, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(8.dp))
                        Text("App Activity", fontWeight = FontWeight.SemiBold)
                    }
                }
                ElevatedCard(onClick = onChat, modifier = Modifier.weight(1f).height(100.dp)) {
                    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Icon(Icons.Default.Chat, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(8.dp))
                        Text("AI Chat", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
        
        item {
            ElevatedCard(onClick = onConnect, modifier = Modifier.fillMaxWidth().height(60.dp)) {
                Row(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.SettingsEthernet, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(16.dp))
                    Text(if (BackendConfig.isConfigured(LocalContext.current)) "Dashboard connected" else "Connect dashboard", fontWeight = FontWeight.SemiBold)
                }
            }
        }

        latest?.let { sample ->
            item {
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Latest Snapshot", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(8.dp))
                        Text("CPU: ${sample.cpuPercent}%  •  Battery: ${sample.batteryPercent}%  •  Temp: ${sample.temperatureC}°C")
                        Text("Network: ${formatBytes(sample.networkBytesPerMinute)}/min" + (sample.foregroundApp?.let { "\nRecent App: $it" } ?: ""), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        
        report?.let { 
            item {
                ScanSummary(it, Modifier.fillMaxWidth().clickable(onClick = onScan))
            }
        }
        
        if (!UsageInsights.hasUsageAccess(LocalContext.current)) {
            item {
                ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Optional permission: Usage access", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onErrorContainer)
                        Text("Granting usage access allows ThreatShield to show you how much time you spend in apps.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onErrorContainer)
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = onUsageAccess, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) {
                            Text("Grant Access", color = MaterialTheme.colorScheme.onError)
                        }
                    }
                }
            }
        }
        
        item {
            Text("ThreatShield identifies risk signals, not certain malware. Review each result before removing an app.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun StatusCard(title: String, text: String, color: Color) {
    ElevatedCard(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(12.dp).background(color, androidx.compose.foundation.shape.CircleShape))
            Spacer(Modifier.width(12.dp))
            Column {
                Text(title, fontWeight = FontWeight.Bold)
                Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
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
private fun ActivityPage(modifier: Modifier, allowed: Boolean, apps: List<AppActivityMetric>, loading: Boolean, onRefresh: () -> Unit, onBack: () -> Unit, onUsageAccess: () -> Unit, onAppSelected: (AppActivityMetric) -> Unit) {
    var tabIndex by remember { mutableStateOf(0) }
    Column(modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f)) { Text("Dashboard") }
            Button(onClick = if (allowed) onRefresh else onUsageAccess, modifier = Modifier.weight(1f)) { Text(if (allowed) "Refresh" else "Grant Access") }
        }
        if (!allowed) Text("Android requires the Usage access setting for this screen.", Modifier.padding(top = 16.dp), color = MaterialTheme.colorScheme.error)
        if (loading) CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally).padding(top = 24.dp))
        if (allowed && !loading) {
            TabRow(selectedTabIndex = tabIndex, modifier = Modifier.padding(top = 12.dp)) {
                Tab(selected = tabIndex == 0, onClick = { tabIndex = 0 }, text = { Text("All Apps") })
                Tab(selected = tabIndex == 1, onClick = { tabIndex = 1 }, text = { Text("Foreground Apps") })
            }
            val filteredApps = if (tabIndex == 1) apps.filter { it.foregroundMinutes > 0 } else apps
            LazyColumn(Modifier.padding(top = 12.dp).weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(filteredApps) { item -> 
                    UsageRow(
                        name = item.label,
                        packageName = item.packageName,
                        value = if (tabIndex == 1) "${item.foregroundMinutes} min" else formatBytes(item.networkBytes),
                        onClick = { onAppSelected(item) }
                    )
                }
            }
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

@Composable private fun ScanSummary(report: ScanReport, modifier: Modifier) = ElevatedCard(modifier, colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) { Column(Modifier.padding(16.dp)) { Text("${report.inspected} installed apps inspected", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimaryContainer); Text("${report.findings.size} app(s) need review", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer) } }

@Composable private fun FindingCard(finding: ThreatFinding) {
    val color = when (finding.severity) { Severity.CRITICAL -> Color(0xFFB00020); Severity.HIGH -> Color(0xFFD84315); Severity.MEDIUM -> Color(0xFFF57F17); Severity.REVIEW -> Color(0xFF1565C0) }
    ElevatedCard(colors = CardDefaults.elevatedCardColors(containerColor = color.copy(alpha = .1f))) { Column(Modifier.padding(16.dp)) {
        Text("${finding.severity} • score ${finding.score}/100", color = color, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge); Text(finding.appName, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium); Text(finding.packageName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(8.dp))
        finding.reasons.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall) }
    } }
}
@Composable private fun ReviewList(title: String, values: List<String>) {
    ElevatedCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) {
        Text(title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall); Spacer(Modifier.height(4.dp)); values.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    } }
}
@Composable private fun UsageRow(name: String, packageName: String, value: String, onClick: (() -> Unit)? = null) {
    ElevatedCard(Modifier.fillMaxWidth().let { if (onClick != null) it.clickable(onClick = onClick) else it }) { Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { Text(name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall); Text(packageName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }; Text(value, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.primary)
    } }
}

@Composable
private fun AppDetailPage(modifier: Modifier, metric: AppActivityMetric, onBack: () -> Unit) {
    val context = LocalContext.current
    var hourlyStats by remember { mutableStateOf<AppHourlyStats?>(null) }
    
    LaunchedEffect(metric.packageName) {
        withContext(Dispatchers.Default) {
            hourlyStats = UsageInsights.hourlyStats(context, metric.packageName)
        }
    }
    
    Column(modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) { Text("Back to Activity") }
        Text(metric.label, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
        Text(metric.packageName, style = MaterialTheme.typography.bodyMedium)
        
        ElevatedCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text("Storage Info", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(8.dp))
                Text("Cache Memory: ${formatBytes(metric.cacheBytes)}")
                Text("Data Storage: ${formatBytes(metric.dataBytes)}")
            }
        }
        
        ElevatedCard(Modifier.fillMaxWidth().height(160.dp)) {
            Column(Modifier.padding(16.dp)) {
                Text("Network Usage (Last 24h)", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                Text("${formatBytes(metric.networkBytes)} total", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                val targetStats = hourlyStats?.networkBytes ?: List(24) { 0f }
                
                Canvas(Modifier.fillMaxSize()) {
                    val maxBytes = maxOf(targetStats.maxOrNull() ?: 1f, 1f)
                    val barWidth = size.width / 24f
                    val spacing = 4f
                    
                    for (i in 0 until 24) {
                        val animatedHeight by androidx.compose.animation.core.animateFloatAsState(
                            targetValue = (targetStats[i] / maxBytes) * size.height,
                            animationSpec = tween(1000)
                        )
                        val barHeight = animatedHeight
                        drawRect(
                            color = Color(0xFF1976D2), // Using a nice blue for network
                            topLeft = Offset(i * barWidth + spacing / 2, size.height - barHeight),
                            size = Size(barWidth - spacing, barHeight),
                            alpha = if (targetStats[i] > 0) 1f else 0.2f
                        )
                    }
                }
            }
        }
        
        ElevatedCard(Modifier.fillMaxWidth().height(160.dp)) {
            Column(Modifier.padding(16.dp)) {
                Text("Time Active (Last 24h)", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                Text("${metric.foregroundMinutes} minutes", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                val targetStats = hourlyStats?.timeActiveMinutes ?: List(24) { 0f }
                
                Canvas(Modifier.fillMaxSize()) {
                    val maxMinutes = 60f
                    val barWidth = size.width / 24f
                    val spacing = 4f
                    
                    for (i in 0 until 24) {
                        val animatedHeight by androidx.compose.animation.core.animateFloatAsState(
                            targetValue = (targetStats[i] / maxMinutes) * size.height,
                            animationSpec = tween(1000)
                        )
                        val barHeight = animatedHeight
                        drawRect(
                            color = Color(0xFF9C27B0), // Purple for time active
                            topLeft = Offset(i * barWidth + spacing / 2, size.height - barHeight),
                            size = Size(barWidth - spacing, barHeight),
                            alpha = if (targetStats[i] > 0) 1f else 0.2f
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatPage(modifier: Modifier, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    var sessions by remember { mutableStateOf(GeminiChatStore.sessions(context)) }
    var currentSession by remember { mutableStateOf(sessions.firstOrNull() ?: GeminiChatStore.createSession(context, "Support Chat").also { sessions = listOf(it) }) }
    var messages by remember { mutableStateOf(GeminiChatStore.messages(context, currentSession.id)) }
    var input by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var expanded by remember { mutableStateOf(false) }
    
    val listState = rememberLazyListState()
    
    LaunchedEffect(currentSession.id) {
        messages = GeminiChatStore.messages(context, currentSession.id)
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    Column(modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = onBack, modifier = Modifier.weight(1f)) { Text("Dashboard") }
            Spacer(Modifier.width(8.dp))
            androidx.compose.foundation.layout.Box {
                Button(onClick = { expanded = true }) {
                    Text("Session ▼")
                }
                androidx.compose.material3.DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    sessions.forEach { s ->
                        androidx.compose.material3.DropdownMenuItem(
                            text = { 
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(s.title + if (s.id == currentSession.id) " (Active)" else "", Modifier.weight(1f))
                                    IconButton(onClick = { 
                                        GeminiChatStore.deleteSession(context, s.id)
                                        sessions = GeminiChatStore.sessions(context)
                                        if (currentSession.id == s.id) {
                                            currentSession = sessions.firstOrNull() ?: GeminiChatStore.createSession(context, "Support Chat").also { sessions = listOf(it) }
                                        }
                                        expanded = false
                                    }) {
                                        Icon(Icons.Default.Delete, "Delete")
                                    }
                                }
                            },
                            onClick = { 
                                currentSession = s
                                expanded = false 
                            }
                        )
                    }
                    androidx.compose.material3.DropdownMenuItem(
                        text = { Text("➕ New Session") },
                        onClick = {
                            val newS = GeminiChatStore.createSession(context, "New Chat ${sessions.size + 1}")
                            sessions = GeminiChatStore.sessions(context)
                            currentSession = newS
                            expanded = false
                        }
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        
        LazyColumn(state = listState, modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (messages.isEmpty()) {
                item {
                    Text(
                        "No messages in this session yet. Please note that ThreatShield AI requires a valid backend connection via the 'Dashboard connection' menu. If you see red error messages, your backend is unreachable.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.Gray,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
            items(messages) { msg ->
                val isUser = msg.role == "user"
                val bgColor = if (isUser) Color(0xFF075E54).copy(alpha = 0.1f) else Color.LightGray.copy(alpha = 0.2f)
                val alignment = if (isUser) Alignment.End else Alignment.Start
                
                Column(Modifier.fillMaxWidth(), horizontalAlignment = alignment) {
                    Card(
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = bgColor),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp).widthIn(max = 280.dp)
                    ) {
                        Text(
                            msg.text, 
                            Modifier.padding(12.dp), 
                            color = if (msg.isError) Color(0xFFB00020) else Color.Black
                        )
                    }
                }
            }
        }
        
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Ask ThreatShield AI...") },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send)
            )
            IconButton(
                onClick = {
                    if (input.isNotBlank() && !sending) {
                        val text = input
                        input = ""
                        sending = true
                        scope.launch {
                            sendChatMessage(context, currentSession.id, text)
                            messages = GeminiChatStore.messages(context, currentSession.id)
                            sending = false
                        }
                    }
                },
                enabled = !sending
            ) {
                Icon(Icons.Default.Send, contentDescription = "Send")
            }
        }
    }
}
