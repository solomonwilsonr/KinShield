package com.kinshield.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kinshield.app.ui.theme.Ink
import com.kinshield.app.ui.theme.MonoLabel
import com.kinshield.app.ui.theme.RiskHigh
import com.kinshield.app.ui.theme.RiskHighBg
import com.kinshield.app.ui.theme.RiskLow
import com.kinshield.app.ui.theme.RiskLowBg
import com.kinshield.app.ui.theme.RiskMed
import com.kinshield.app.ui.theme.RiskMedBg

/** Centers content and caps its width so tablets and unfolded foldables get a readable column. */
@Composable
fun ReadableColumn(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        Box(Modifier.widthIn(max = 760.dp).fillMaxWidth()) { content() }
    }
}

@Composable
fun OfflineBanner(modifier: Modifier = Modifier) {
    Surface(color = Ink, contentColor = Color.White, modifier = modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.CloudOff, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(10.dp))
            Text(
                "You're offline. KinModel-Lite still scores messages on this phone; KinBot and KinVoice need the internet.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

data class RiskColors(val fg: Color, val bg: Color, val label: String)

fun riskColors(level: String): RiskColors = when (level.uppercase()) {
    "HIGH" -> RiskColors(RiskHigh, RiskHighBg, "High risk")
    "MEDIUM" -> RiskColors(RiskMed, RiskMedBg, "Be careful")
    else -> RiskColors(RiskLow, RiskLowBg, "Looks safe")
}

@Composable
fun RiskBadge(level: String, modifier: Modifier = Modifier, text: String = riskColors(level).label) {
    val c = riskColors(level)
    Box(
        modifier
            .background(c.bg, RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 5.dp),
    ) {
        Text(text.uppercase(), color = c.fg, style = MonoLabel)
    }
}

@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    Text("[ ${text.uppercase()} ]", style = MonoLabel, color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.semantics { heading() })
}

@Composable
fun LoadingRow(label: String, modifier: Modifier = Modifier) {
    Row(modifier.padding(vertical = 8.dp).semantics { liveRegion = LiveRegionMode.Polite },
        verticalAlignment = Alignment.CenterVertically) {
        CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.5.dp)
        Spacer(Modifier.size(12.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun ErrorCard(message: String, onRetry: (() -> Unit)?, modifier: Modifier = Modifier, offline: Boolean = false) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = MaterialTheme.shapes.medium,
        modifier = modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Assertive },
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(if (offline) Icons.Filled.CloudOff else Icons.Filled.ErrorOutline, contentDescription = null)
                Spacer(Modifier.size(10.dp))
                Text(message, style = MaterialTheme.typography.bodyMedium)
            }
            if (onRetry != null) {
                OutlinedButton(onClick = onRetry) {
                    Icon(Icons.Filled.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.size(6.dp))
                    Text("Try again")
                }
            }
        }
    }
}

@Composable
fun EmptyState(title: String, body: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        action?.invoke()
    }
}

@Composable
fun PrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
                  icon: (@Composable () -> Unit)? = null) {
    Button(onClick = onClick, enabled = enabled, modifier = modifier,
        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)) {
        if (icon != null) { icon(); Spacer(Modifier.size(8.dp)) }
        Text(text)
    }
}
