package com.kinshield.app.ui.kinbot

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kinshield.app.R
import com.kinshield.app.data.AskAnswer
import com.kinshield.app.data.CheckResult
import com.kinshield.app.data.Investigation
import com.kinshield.app.ui.common.SectionLabel
import com.kinshield.app.ui.common.RiskBadge
import com.kinshield.app.ui.common.pct
import com.kinshield.app.ui.common.riskColors
import com.kinshield.app.ui.theme.MonoLabel
import com.kinshield.app.ui.theme.RiskHigh
import com.kinshield.app.ui.theme.RiskLow
import com.kinshield.app.ui.theme.RiskMed

@Composable
fun UserBubble(text: String, ask: Boolean) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
        Column(
            Modifier.widthIn(max = 520.dp)
                .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(18.dp, 18.dp, 4.dp, 18.dp))
                .padding(14.dp),
        ) {
            Text(if (ask) "Question" else "Message to check", style = MonoLabel, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f))
            Spacer(Modifier.size(4.dp))
            Text(text, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
        }
    }
}

@Composable
fun AttachmentBubble(kind: String, label: String) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
        Row(
            Modifier.background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(18.dp)).padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(if (kind == "image") Icons.Filled.Image else Icons.Filled.GraphicEq, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(label, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun KipCard(content: @Composable () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.large,
        modifier = Modifier.fillMaxWidth().border(1.dp, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.large),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { content() }
    }
}

@Composable
fun LiteCard(score: Double, offline: Boolean) {
    val scamLike = score >= 0.5
    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.PhoneAndroid, contentDescription = null)
            Spacer(Modifier.width(10.dp))
            Column {
                Text("On this phone · KinModel-Lite: ${pct(score)} ${if (scamLike) "scam-like" else "not scam-like"}",
                    style = MaterialTheme.typography.titleSmall, color = if (scamLike) RiskHigh else RiskLow)
                Text(
                    if (offline) "Works offline. It's a small keyword model (TF-IDF + logistic regression), a second opinion only."
                    else "Instant keyword-model score from this phone. Kip's full check below takes precedence.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
fun MediaReadCard(kind: String, text: String, vision: com.kinshield.app.data.Vision?) {
    KipCard {
        SectionLabel(if (kind == "image") "What Kip read" else "What Kip heard")
        if (text.isNotBlank()) {
            Text("“$text”", style = MaterialTheme.typography.bodyMedium, fontStyle = FontStyle.Italic,
                modifier = Modifier.background(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.shapes.small).padding(12.dp))
        }
        if (vision != null) {
            if (vision.what.isNotBlank()) Text(vision.what, style = MaterialTheme.typography.bodyMedium)
            vision.signs.forEach { s ->
                Text("• ${s.label}: ${s.detail}", style = MaterialTheme.typography.bodySmall)
            }
            if (vision.hasQr) Text("• Has a QR code. Don't scan codes from unexpected messages.", style = MaterialTheme.typography.bodySmall)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun VerdictCard(r: CheckResult, showFollowUps: Boolean, onFollowUp: (String) -> Unit) {
    val c = riskColors(r.riskLevel)
    val mascot = when (r.riskLevel) { "HIGH" -> R.drawable.kip_alarm; "MEDIUM" -> R.drawable.kip_thinking; else -> R.drawable.kip_happy }
    KipCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(painterResource(mascot), contentDescription = null, modifier = Modifier.size(56.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.semantics(mergeDescendants = true) { contentDescription = "KinBot verdict: ${c.label}. ${r.headline}" }) {
                RiskBadge(r.riskLevel)
                Spacer(Modifier.size(6.dp))
                Text(r.headline, style = MaterialTheme.typography.titleLarge, modifier = Modifier.semantics { heading() })
            }
        }
        Text(r.summary, style = MaterialTheme.typography.bodyLarge)
        if (r.signs.isNotEmpty()) {
            SectionLabel("Why Kip is worried · ${r.signs.size} warning sign${if (r.signs.size == 1) "" else "s"}")
            r.signs.forEach { s ->
                Row(Modifier.fillMaxWidth()) {
                    Box(Modifier.padding(top = 7.dp).size(8.dp).background(c.fg, CircleShape))
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(s.label, style = MaterialTheme.typography.titleSmall)
                        Text("“${s.quote}”", style = MaterialTheme.typography.bodyMedium, fontStyle = FontStyle.Italic,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        if (r.steps.isNotEmpty()) {
            SectionLabel("What to do now")
            r.steps.forEachIndexed { i, s ->
                Row {
                    Text("${i + 1}.", fontWeight = FontWeight.Bold, modifier = Modifier.width(24.dp))
                    Text(s, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        HowChecked(r)
        if (showFollowUps) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FOLLOW_UPS.forEach { q -> AssistChip(onClick = { onFollowUp(q) }, label = { Text(q) }) }
            }
        }
    }
}

val FOLLOW_UPS = listOf(
    "Is it safe to call the number back?",
    "What should I tell my family?",
    "What if I already paid?",
)

@Composable
private fun HowChecked(r: CheckResult) {
    var open by rememberSaveable { mutableStateOf(false) }
    Column {
        Row(
            Modifier.clickable { open = !open }.padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("How Kip checked this", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
            Icon(if (open) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore, contentDescription = if (open) "Hide details" else "Show details")
        }
        if (open) {
            Text(
                "The message was read by the KinShield evidence detector (gpt-oss-20b on Amazon Bedrock). It only shows quotes " +
                    "that really appear in your message. Score ${r.riskScore} (Medium from 25, High from 60)." +
                    (r.lite?.let { " KinShield-Lite (a small keyword model) gave it ${pct(it.score)} scam-like." } ?: ""),
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private fun levelColor(level: String): Color = when (level) {
    "danger" -> RiskHigh
    "caution" -> RiskMed
    "ok" -> RiskLow
    else -> Color(0xFF6B7A86)
}

private fun levelText(level: String) = when (level) {
    "danger" -> "Danger"; "caution" -> "Caution"; "ok" -> "OK"; else -> "Note"
}

@Composable
fun InvestigationCard(inv: Investigation) {
    KipCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(painterResource(R.drawable.kip_listen), contentDescription = null, modifier = Modifier.size(40.dp))
            Spacer(Modifier.width(10.dp))
            Text(
                when (inv.level) { "danger" -> "Kip found a problem"; "caution" -> "Kip found warning signs"; else -> "Kip investigated" },
                style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() },
            )
        }
        Text(inv.summary, style = MaterialTheme.typography.bodyMedium)
        if (inv.nextStep.isNotBlank()) {
            Column(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.shapes.small).padding(12.dp)) {
                Text("NEXT STEP", style = MonoLabel, color = MaterialTheme.colorScheme.onSecondaryContainer)
                Text(inv.nextStep, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSecondaryContainer)
            }
        }
        inv.steps.forEach { st ->
            var open by rememberSaveable(st.label, st.target) { mutableStateOf(st.level == "danger") }
            Column(Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth().clickable { open = !open }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(10.dp).background(levelColor(st.level), CircleShape))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(st.label.ifBlank { st.tool }, style = MaterialTheme.typography.titleSmall)
                        if (st.target.isNotBlank()) Text(st.target, style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                    }
                    Text(levelText(st.level).uppercase(), style = MonoLabel, color = levelColor(st.level))
                }
                if (open) st.findings.forEach { f ->
                    Text("• ${f.text}", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(start = 20.dp, bottom = 4.dp))
                }
            }
        }
        Text("Kip's checks are read-only: a domain/registration lookup, public phishing lists, a guarded fetch of the page " +
            "(no scripts, no forms), phone-number patterns and built-in advice.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun AnswerCard(a: AskAnswer) {
    val uri = LocalUriHandler.current
    KipCard {
        Row(verticalAlignment = Alignment.Top) {
            Image(painterResource(R.drawable.kip_face), contentDescription = null, modifier = Modifier.size(32.dp))
            Spacer(Modifier.width(10.dp))
            Text(a.answer, style = MaterialTheme.typography.bodyLarge)
        }
        a.card?.let { card ->
            Column(
                Modifier.fillMaxWidth().background(riskColors("HIGH").bg, MaterialTheme.shapes.medium).padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(card.title, style = MaterialTheme.typography.titleMedium, color = RiskHigh)
                card.steps.forEachIndexed { i, s -> Text("${i + 1}. $s", style = MaterialTheme.typography.bodyMedium, color = Color(0xFF001123)) }
                card.actions.filter { it.href.startsWith("https://") }.forEach { act ->
                    OutlinedButton(onClick = { uri.openUri(act.href) }) { Text(act.label) }
                }
                if (card.note.isNotBlank()) Text(card.note, style = MaterialTheme.typography.bodySmall, color = Color(0xFF3B4A57))
            }
        }
        if (a.source.isNotBlank()) Text("Source: KinShield guide · ${a.source}", style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun OverallCard(level: String, title: String, summary: String) {
    KipCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Image(painterResource(if (level == "HIGH") R.drawable.kip_alarm else R.drawable.kip_thinking), contentDescription = null, modifier = Modifier.size(48.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.semantics(mergeDescendants = true) { contentDescription = "Kip's overall take: ${riskColors(level).label}. $title" }) {
                RiskBadge(level, text = "Overall · ${riskColors(level).label}")
                Spacer(Modifier.size(6.dp))
                Text(title, style = MaterialTheme.typography.titleLarge)
            }
        }
        Text(summary, style = MaterialTheme.typography.bodyLarge)
        SectionLabel("What to do now")
        Text("1. Don't tap the link, scan a code or pay.", style = MaterialTheme.typography.bodyMedium)
        Text("2. Contact the company yourself, using its official app or website.", style = MaterialTheme.typography.bodyMedium)
        Text("Kip's overall take combines the text check, the picture and the link checks.", style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
