package com.kinshield.app.ui.voice

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.kinshield.app.R
import com.kinshield.app.ui.common.EmptyState
import com.kinshield.app.ui.common.ErrorCard
import com.kinshield.app.ui.common.LoadingRow
import com.kinshield.app.ui.common.PrimaryButton
import com.kinshield.app.ui.common.ReadableColumn
import com.kinshield.app.ui.common.RiskBadge
import com.kinshield.app.ui.common.SectionLabel
import com.kinshield.app.ui.common.riskColors
import com.kinshield.app.ui.theme.RiskHigh
import com.kinshield.app.ui.theme.RiskHighBg

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VoiceListScreen(onBack: () -> Unit, onOpen: (String) -> Unit, vm: VoiceListViewModel = viewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    Scaffold(topBar = {
        TopAppBar(title = { Text("KinVoice demo") },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } })
    }) { pad ->
        ReadableColumn(Modifier.padding(pad).fillMaxSize()) {
            LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), modifier = Modifier.testTag("scenarios")) {
                item {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Practice with scripted calls", style = MaterialTheme.typography.titleLarge)
                        Text(
                            "These are written scripts based on real FTC and FBI IC3 cases, not live calls. Play one and the " +
                                "detector scores it turn by turn. Android doesn't let apps listen to phone calls, so KinVoice " +
                                "on a real phone would need carrier or OS support.",
                            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("all" to "All", "scam" to "Scam", "benign" to "Safe").forEach { (k, l) ->
                                FilterChip(selected = s.filter == k, onClick = { vm.setFilter(k) }, label = { Text(l) })
                            }
                        }
                    }
                }
                when {
                    s.loading -> item { LoadingRow("Loading practice calls", Modifier.padding(16.dp)) }
                    s.error != null -> item { ErrorCard(s.error!!, vm::load, Modifier.padding(16.dp), offline = s.offline) }
                    else -> {
                        val list = s.scenarios.filter { s.filter == "all" || it.label == s.filter }
                        if (list.isEmpty()) item { EmptyState("No calls here", "Try another filter.") }
                        items(list, key = { it.id }) { sc ->
                            ListItem(
                                headlineContent = { Text(sc.title) },
                                supportingContent = { Text(sc.id) },
                                trailingContent = { RiskBadge(if (sc.label == "scam") "HIGH" else "LOW", text = if (sc.label == "scam") "Scam" else "Safe") },
                                modifier = Modifier.clickable { onOpen(sc.id) },
                            )
                            HorizontalDivider()
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VoicePlayerScreen(onBack: () -> Unit, vm: VoicePlayerViewModel = viewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var askedNotif by rememberSaveable { mutableStateOf(false) }
    val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { vm.play() }
    fun start() {
        val needs = Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        if (needs && !askedNotif) { askedNotif = true; notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS) } else vm.play()
    }
    val listState = rememberLazyListState()
    LaunchedEffect(s.shown) { if (s.shown > 0) listState.animateScrollToItem(s.shown + 1) }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text(s.scenario?.title ?: "Practice call", maxLines = 1) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } })
        },
        bottomBar = {
            Surface(tonalElevation = 3.dp) {
                ReadableColumn(Modifier.navigationBarsPadding()) {
                    Row(Modifier.padding(12.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        val last = s.points.lastOrNull()
                        Column(Modifier.weight(1f)) {
                            Text(if (last == null) "Risk: not scored yet" else "Risk score ${last.score}", style = MaterialTheme.typography.labelLarge)
                            LinearProgressIndicator(
                                progress = { ((last?.score ?: 0) / 120f).coerceIn(0f, 1f) },
                                color = riskColors(last?.level ?: "LOW").fg,
                                modifier = Modifier.fillMaxWidth().padding(top = 6.dp).testTag("meter"),
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        PrimaryButton(
                            text = when { s.playing -> "Playing…"; s.shown == 0 -> "Play call"; else -> "Replay" },
                            onClick = ::start, enabled = s.scenario != null && !s.playing,
                            icon = { Icon(if (s.shown == 0) Icons.Filled.PlayArrow else Icons.Filled.Replay, null) },
                            modifier = Modifier.testTag("play"),
                        )
                    }
                }
            }
        },
    ) { pad ->
        ReadableColumn(Modifier.padding(pad).fillMaxSize()) {
            when {
                s.loading -> LoadingRow("Loading the call", Modifier.padding(16.dp))
                s.scenario == null -> ErrorCard(s.error ?: "Couldn't load this call.", vm::load, Modifier.padding(16.dp))
                else -> {
                    val sc = s.scenario!!
                    LazyColumn(state = listState, contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        item {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Image(painterResource(if (s.alertTurn != null) R.drawable.kip_alarm else R.drawable.kip_calm), null, Modifier.size(56.dp))
                                Spacer(Modifier.width(12.dp))
                                Column {
                                    Text("Caller claims to be ${sc.claimedIdentity ?: "someone familiar"}", style = MaterialTheme.typography.titleMedium)
                                    Text("Scripted practice call · ${sc.turns.size} turns · scored up to $MAX_POINTS times",
                                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                        if (s.shown == 0) item { EmptyState("Ready when you are", "Press Play call. Each line appears in turn and Kip scores the call as it goes.") }
                        itemsIndexed(sc.turns.take(s.shown)) { i, t ->
                            val victim = t.speaker == "victim"
                            val point = s.points.firstOrNull { it.turn == i }
                            Box(Modifier.fillMaxWidth(), contentAlignment = if (victim) Alignment.CenterEnd else Alignment.CenterStart) {
                                Column(
                                    Modifier.widthIn(max = 520.dp)
                                        .background(if (victim) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(16.dp))
                                        .padding(12.dp),
                                ) {
                                    Text("${t.t}  ${if (victim) "Mom" else sc.claimedIdentity ?: "Caller"}", style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text(t.text, style = MaterialTheme.typography.bodyLarge)
                                    if (point != null) {
                                        Spacer(Modifier.size(6.dp))
                                        RiskBadge(point.level, text = "Score ${point.score} · ${point.level.lowercase()}")
                                    }
                                }
                            }
                        }
                        if (s.scoring) item { LoadingRow("Kip is scoring the call so far") }
                        s.alertTurn?.let { turn ->
                            item {
                                Column(
                                    Modifier.fillMaxWidth().background(RiskHighBg, RoundedCornerShape(16.dp)).padding(14.dp)
                                        .semantics { liveRegion = LiveRegionMode.Assertive }.testTag("alert"),
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Filled.NotificationsActive, null, tint = RiskHigh)
                                        Spacer(Modifier.width(8.dp))
                                        Text("High risk at turn ${turn + 1}", style = MaterialTheme.typography.titleMedium, color = RiskHigh)
                                    }
                                    Text(
                                        if (s.notified == true) "A notification was sent, like the alert a caregiver would get."
                                        else "Notifications are off, so the alert is shown here only. Turn them on in Settings to see the caregiver alert.",
                                        style = MaterialTheme.typography.bodyMedium, color = androidx.compose.ui.graphics.Color(0xFF001123),
                                    )
                                }
                            }
                        }
                        s.error?.let { err -> item { ErrorCard(err, vm::retry) } }
                        s.verdict?.let { v ->
                            item {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    SectionLabel("Whole-call verdict")
                                    RiskBadge(v.riskLevel, text = "${riskColors(v.riskLevel).label} · score ${v.riskScore}")
                                    Text(v.recommendedAction, style = MaterialTheme.typography.bodyLarge)
                                    v.evidence.sortedByDescending { it.weight }.forEach { e ->
                                        Text("• [${e.t}] ${e.signal.replace('_', ' ')}: “${e.quote}”", style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
