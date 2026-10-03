package com.kinshield.app.ui.settings

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kinshield.app.BuildConfig
import com.kinshield.app.Notifier
import com.kinshield.app.data.AppGraph
import com.kinshield.app.ui.common.ReadableColumn
import com.kinshield.app.ui.common.openAppSettings

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val prefs = AppGraph.prefs
    val s by prefs.settings.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var tick by remember { mutableIntStateOf(0) }
    LifecycleResumeEffect(Unit) { tick++; onPauseOrDispose { } }
    val canNotify = remember(tick) { Notifier.canPost(context) }
    val askNotif = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { tick++ }

    Scaffold(topBar = {
        TopAppBar(title = { Text("Settings") },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } })
    }) { pad ->
        ReadableColumn(Modifier.padding(pad).fillMaxSize()) {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                ListItem(
                    headlineContent = { Text("Investigate after each check") },
                    supportingContent = { Text("Kip also looks up links, phone numbers and advice. Takes a few more seconds.") },
                    trailingContent = { Switch(s.autoInvestigate, { prefs.update(s.copy(autoInvestigate = it)) }) },
                )
                ListItem(
                    headlineContent = { Text("Show the on-device score") },
                    supportingContent = { Text("Show KinModel-Lite's instant score before Kip's full check.") },
                    trailingContent = { Switch(s.showLite, { prefs.update(s.copy(showLite = it)) }) },
                )
                ListItem(
                    headlineContent = { Text("High-risk alerts (KinVoice demo)") },
                    supportingContent = { Text("Post a notification when a practice call turns high risk.") },
                    trailingContent = { Switch(s.alertsEnabled, { prefs.update(s.copy(alertsEnabled = it)) }) },
                )
                ListItem(
                    headlineContent = { Text("Notification permission") },
                    supportingContent = { Text(if (canNotify) "Allowed" else "Off. Alerts only show inside the app.") },
                    trailingContent = {
                        if (!canNotify) TextButton(onClick = {
                            if (Build.VERSION.SDK_INT >= 33) askNotif.launch(Manifest.permission.POST_NOTIFICATIONS) else context.openAppSettings()
                        }) { Text("Turn on") }
                    },
                )
                ListItem(
                    headlineContent = { Text("App permissions") },
                    supportingContent = { Text("Microphone and notifications can be changed in Android settings.") },
                    trailingContent = { TextButton(onClick = { context.openAppSettings() }) { Text("Open") } },
                )
                HorizontalDivider()
                ListItem(headlineContent = { Text("KinShield API") }, supportingContent = {
                    Text(if (AppGraph.api.isConfigured) AppGraph.api.host else "Not set. Add kinshield.apiBaseUrl to local.properties.")
                })
                ListItem(headlineContent = { Text("Version") }, supportingContent = {
                    Text("${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})${if (BuildConfig.DEBUG) " · debug" else ""}")
                })
            }
        }
    }
}
