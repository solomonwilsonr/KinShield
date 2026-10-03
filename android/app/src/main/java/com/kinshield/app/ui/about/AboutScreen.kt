package com.kinshield.app.ui.about

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.kinshield.app.ui.common.ReadableColumn
import com.kinshield.app.ui.common.SectionLabel

private val LIMITS = listOf(
    "It can't listen to phone calls. Android 10 and later block third-party apps from capturing call audio, so the KinVoice screen uses scripted practice calls only.",
    "It doesn't read your texts or notifications by itself. You choose what to check: paste it, share it to KinBot, or attach a screenshot or recording.",
    "KinBot needs the internet. Checks run on the KinShield API (gpt-oss-20b on Amazon Bedrock, plus a vision model for screenshots and a speech model for voicemails). Offline, only the on-device KinModel-Lite score works.",
    "No model here is fine-tuned. The detector is a general model with KinShield's instructions; KinShield-Lite is a small TF-IDF + logistic-regression model with int8 weights.",
    "A \"Looks safe\" result doesn't prove a message is safe. It only means Kip didn't find the warning signs scammers usually use.",
    "Kip's link checks are read-only lookups and a guarded fetch of the page (no scripts, cookies or forms). They are not a sandboxed browser.",
    "Alerts are local notifications from the demo. There's no account, no family sharing and no push service yet.",
    "Nothing you check is stored by KinShield. Results live on this phone only until you clear them or the app is closed for good.",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AboutScreen(onBack: () -> Unit) {
    val uri = LocalUriHandler.current
    Scaffold(topBar = {
        TopAppBar(title = { Text("About KinShield") },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } })
    }) { pad ->
        ReadableColumn(Modifier.padding(pad).fillMaxSize()) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Helping older adults pause before a scam call or message costs them.", style = MaterialTheme.typography.titleLarge)
                Text("KinShield is a pre-launch project. Kip points to the exact words that look like a scam and suggests a safe next step: hang up and call back on a number you already have.",
                    style = MaterialTheme.typography.bodyMedium)
                SectionLabel("What this app can't do")
                LIMITS.forEach { Text("• $it", style = MaterialTheme.typography.bodyMedium) }
                SectionLabel("If money was already sent")
                Text("Call your bank or card company now, then report it.", style = MaterialTheme.typography.bodyMedium)
                OutlinedButton(onClick = { uri.openUri("https://reportfraud.ftc.gov/") }) { Text("Report: ftc.gov") }
                OutlinedButton(onClick = { uri.openUri("https://www.ic3.gov/") }) { Text("Report: ic3.gov") }
                Text("DOJ Elder Fraud Hotline: 1-833-372-8311", style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
