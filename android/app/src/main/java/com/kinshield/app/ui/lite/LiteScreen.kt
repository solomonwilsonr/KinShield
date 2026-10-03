package com.kinshield.app.ui.lite

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AssistChip
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.kinshield.app.data.AppGraph
import com.kinshield.app.ui.common.ReadableColumn
import com.kinshield.app.ui.common.SectionLabel
import com.kinshield.app.ui.common.pct
import com.kinshield.app.ui.kinbot.EXAMPLES
import com.kinshield.app.ui.theme.RiskHigh
import com.kinshield.app.ui.theme.RiskLow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun LiteScreen(onBack: () -> Unit, onFullCheck: (String) -> Unit) {
    var text by rememberSaveable { mutableStateOf("") }
    val score by produceState<Double?>(null, text) {
        delay(150)
        value = if (text.isBlank()) null else withContext(Dispatchers.Default) { runCatching { AppGraph.lite().score(text) }.onFailure { com.kinshield.app.KLog.e("lite failed", it) }.getOrNull() }
    }
    Scaffold(topBar = {
        TopAppBar(title = { Text("KinModel-Lite") },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } })
    }) { pad ->
        ReadableColumn(Modifier.padding(pad).fillMaxSize()) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Score a message on this phone", style = MaterialTheme.typography.titleLarge)
                Text(
                    "KinShield-Lite is a small TF-IDF + logistic-regression model (int8 weights, about 120 KB) bundled in the app. " +
                        "It runs offline and nothing leaves the phone. It spots scam-like wording; it doesn't understand context, " +
                        "so use KinBot for the real check.",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(text, { text = it.take(2000) }, Modifier.fillMaxWidth().heightIn(min = 140.dp).testTag("liteInput"),
                    placeholder = { Text("Paste or type a message") })
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    EXAMPLES.forEach { (l, t) -> AssistChip(onClick = { text = t }, label = { Text(l) }) }
                }
                score?.let { p ->
                    Column(Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag("liteScore"),
                        verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        SectionLabel("On-device score")
                        Text("${pct(p)} scam-like", style = MaterialTheme.typography.headlineMedium, color = if (p >= 0.5) RiskHigh else RiskLow)
                        LinearProgressIndicator(progress = { p.toFloat() }, color = if (p >= 0.5) RiskHigh else RiskLow, modifier = Modifier.fillMaxWidth())
                        Text(if (p >= 0.5) "Wording like this shows up in scams. Get Kip's full check before you act."
                            else "No strong scam wording. That doesn't prove it's safe.", style = MaterialTheme.typography.bodyMedium)
                    }
                    androidx.compose.material3.OutlinedButton(onClick = { onFullCheck(text) }) { Text("Get Kip's full check") }
                }
            }
        }
    }
}
