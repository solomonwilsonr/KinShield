package com.kinshield.app.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.kinshield.app.R
import com.kinshield.app.ui.common.ReadableColumn
import com.kinshield.app.ui.theme.Brand
import com.kinshield.app.ui.theme.Ink
import com.kinshield.app.ui.theme.Mint
import com.kinshield.app.ui.theme.MonoLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(onKinBot: () -> Unit, onVoice: () -> Unit, onLite: () -> Unit, onAbout: () -> Unit, onSettings: () -> Unit) {
    Scaffold(topBar = {
        TopAppBar(
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Image(painterResource(R.drawable.kip_face), null, Modifier.size(32.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("KinShield")
                }
            },
            actions = {
                IconButton(onClick = onAbout) { Icon(Icons.Filled.Info, "About and limits") }
                IconButton(onClick = onSettings) { Icon(Icons.Filled.Settings, "Settings") }
            },
        )
    }) { pad ->
        ReadableColumn(Modifier.padding(pad).fillMaxSize()) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(
                    Modifier.fillMaxWidth()
                        .background(Brush.verticalGradient(listOf(Mint, Brand)), MaterialTheme.shapes.large)
                        .padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("ONE FAMILY. THREE WAYS KIP KEEPS WATCH.", style = MonoLabel, color = Ink)
                        Spacer(Modifier.size(6.dp))
                        Text("Pause. Check. Call back.", style = MaterialTheme.typography.headlineMedium, color = Ink,
                            modifier = Modifier.semantics { heading() })
                        Spacer(Modifier.size(6.dp))
                        Text("Scammers rush you. Kip helps you slow down and find the exact words that should worry you.",
                            style = MaterialTheme.typography.bodyMedium, color = Ink)
                    }
                    Image(painterResource(R.drawable.kip_happy), "Kip, the KinShield mascot", Modifier.size(110.dp))
                }
                BoxWithConstraints {
                    val wide = maxWidth >= 600.dp
                    val cards: List<@Composable (Modifier) -> Unit> = listOf(
                        { m -> EntryCard("KinBot", "Check a text, email, screenshot or voicemail", "Is it a scam? Kip reads it with the detector on Amazon Bedrock, cites the exact words and investigates links and numbers.", R.drawable.kip_listen, onKinBot, m.testTag("entry_kinbot")) },
                        { m -> EntryCard("KinVoice demo", "Watch a trusted call turn dangerous", "Scripted practice calls scored turn by turn, with the alert a caregiver would get.", R.drawable.kip_alarm, onVoice, m.testTag("entry_voice")) },
                        { m -> EntryCard("KinModel-Lite", "Instant score on this phone, even offline", "A small keyword model that runs on the device. A second opinion, not the final word.", R.drawable.kip_thinking, onLite, m.testTag("entry_lite")) },
                    )
                    if (wide) Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) { cards.forEach { it(Modifier.weight(1f)) } }
                    else Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { cards.forEach { it(Modifier.fillMaxWidth()) } }
                }
                Text(
                    "KinShield can't listen to phone calls: Android doesn't allow apps to capture call audio. Nothing you check is stored.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun EntryCard(title: String, tagline: String, body: String, mascot: Int, onClick: () -> Unit, modifier: Modifier) {
    Column(
        modifier
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.large)
            .clickable(role = Role.Button, onClickLabel = "Open $title", onClick = onClick)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(painterResource(mascot), null, Modifier.size(52.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleLarge)
                Text(tagline, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
            }
            Icon(Icons.AutoMirrored.Filled.ArrowForward, null)
        }
        Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
