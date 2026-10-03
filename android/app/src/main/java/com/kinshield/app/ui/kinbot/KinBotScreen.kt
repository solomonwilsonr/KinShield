package com.kinshield.app.ui.kinbot

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.AudioFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.InputChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.kinshield.app.R
import com.kinshield.app.ShareInbox
import com.kinshield.app.ui.common.ErrorCard
import com.kinshield.app.ui.common.LoadingRow
import com.kinshield.app.ui.common.ReadableColumn
import com.kinshield.app.ui.common.findActivity
import com.kinshield.app.ui.common.openAppSettings
import com.kinshield.app.ui.common.pct
import com.kinshield.app.ui.theme.RiskHigh
import com.kinshield.app.ui.theme.RiskLow

val EXAMPLES = listOf(
    "Grandson in jail" to "Grandma it's me, I got in a car accident and I'm at the police station. Please don't tell Mom. I need \$2,000 for bail today. Can you get Target gift cards and read me the numbers?",
    "Bank 'fraud team'" to "This is the fraud department at your bank. Someone is trying to empty your account right now. Don't call the branch. Move your savings to a safe account I'll give you.",
    "Pharmacy text" to "Walgreens: Your prescription is ready for pickup at your local store. Reply STOP to opt out.",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KinBotScreen(onBack: () -> Unit, vm: KinBotViewModel = viewModel()) {
    val s by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val listState = rememberLazyListState()

    // Shared text/screenshots from other apps land here.
    val shared by ShareInbox.pending.collectAsStateWithLifecycle()
    LaunchedEffect(shared) {
        shared?.let { vm.handleShare(it); ShareInbox.consume(it) }
    }
    LaunchedEffect(s.feed.size, s.busy) {
        val count = s.feed.size + (if (s.busy != null) 1 else 0)
        if (count > 0) listState.animateScrollToItem(count - 1)
    }

    // ---- pickers & permissions ----
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> uri?.let(vm::pickImage) }
    val pickAudio = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> uri?.let(vm::pickAudio) }
    var micDialog by rememberSaveable { mutableStateOf<String?>(null) } // "rationale" | "settings"
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) vm.startRecording()
        else {
            val act = context.findActivity()
            micDialog = if (act != null && act.shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO)) "rationale" else "settings"
        }
    }
    fun onMic() {
        val act = context.findActivity()
        when {
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED -> vm.startRecording()
            act != null && act.shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO) -> micDialog = "rationale"
            else -> micPermission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    micDialog?.let { kind ->
        AlertDialog(
            onDismissRequest = { micDialog = null },
            title = { Text(if (kind == "settings") "Microphone is turned off" else "Allow the microphone?") },
            text = {
                Text(
                    if (kind == "settings") "KinShield can't ask again. To record a voicemail, open Settings › Permissions › Microphone and allow it. " +
                        "You can also pick an audio file instead."
                    else "KinBot uses the microphone only while you press Record, to capture a voicemail you play out loud on speaker. " +
                        "It can't listen to phone calls, and nothing is stored."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    micDialog = null
                    if (kind == "settings") context.openAppSettings() else micPermission.launch(Manifest.permission.RECORD_AUDIO)
                }) { Text(if (kind == "settings") "Open Settings" else "Allow") }
            },
            dismissButton = {
                TextButton(onClick = { micDialog = null; pickAudio.launch("audio/*") }) { Text("Pick a file instead") }
            },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("KinBot") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                actions = {
                    if (s.feed.isNotEmpty()) IconButton(onClick = vm::clear) { Icon(Icons.Filled.DeleteSweep, "Start a new check") }
                },
            )
        },
        bottomBar = {
            Composer(
                s = s,
                onInput = vm::onInput,
                onMode = vm::setMode,
                onSend = vm::submit,
                onPickImage = { pickImage.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                onPickAudio = { pickAudio.launch("audio/*") },
                onMic = ::onMic,
                onStop = vm::stopRecording,
                onRemoveAttachment = vm::removeAttachment,
            )
        },
    ) { pad ->
        ReadableColumn(Modifier.padding(pad).fillMaxSize()) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize().testTag("feed"),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (s.feed.isEmpty() && s.busy == null) item { Welcome(onExample = { vm.onInput(it); vm.setMode(Mode.CHECK) }) }
                val lastVerdictKey = s.feed.lastOrNull { it is FeedItem.Verdict }?.key
                items(s.feed, key = { it.key }) { item ->
                    when (item) {
                        is FeedItem.UserText -> UserBubble(item.text, item.ask)
                        is FeedItem.UserAttachment -> AttachmentBubble(item.kind, item.label)
                        is FeedItem.Lite -> LiteCard(item.score, item.offline)
                        is FeedItem.MediaRead -> MediaReadCard(item.kind, item.text, item.vision)
                        is FeedItem.Verdict -> VerdictCard(item.result, showFollowUps = item.key == lastVerdictKey && s.busy == null, onFollowUp = vm::askFollowUp)
                        is FeedItem.Investigated -> InvestigationCard(item.inv)
                        is FeedItem.Overall -> OverallCard(item.level, item.title, item.summary)
                        is FeedItem.Answer -> AnswerCard(item.answer)
                        is FeedItem.Error -> ErrorCard(item.message, item.retry?.let { { vm.retry(item) } }, offline = item.offline)
                    }
                }
                if (s.busy != null) item(key = "busy") { LoadingRow(s.busy!!) }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Welcome(onExample: (String) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Image(painterResource(R.drawable.kip_calm), contentDescription = "Kip, the KinShield mascot", modifier = Modifier.size(120.dp))
        Text("Is it a scam? Ask Kip first.", style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        Text(
            "Paste a text or email, attach a screenshot, or record a voicemail played on speaker. Kip points to the exact " +
                "words that worry it and what to do next. Nothing you send is stored.",
            style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text("Try an example", style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)) {
            EXAMPLES.forEach { (label, text) -> AssistChip(onClick = { onExample(text) }, label = { Text(label) }) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Composer(
    s: KinBotUiState,
    onInput: (String) -> Unit,
    onMode: (Mode) -> Unit,
    onSend: () -> Unit,
    onPickImage: () -> Unit,
    onPickAudio: () -> Unit,
    onMic: () -> Unit,
    onStop: () -> Unit,
    onRemoveAttachment: () -> Unit,
) {
    var audioMenu by rememberSaveable { mutableStateOf(false) }
    val limit = if (s.mode == Mode.ASK) ASK_MAX else CHECK_MAX
    Surface(tonalElevation = 3.dp, modifier = Modifier.fillMaxWidth()) {
        ReadableColumn(Modifier.navigationBarsPadding().imePadding()) {
            Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                HorizontalDivider()
                if (s.recordingSeconds != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Filled.Mic, contentDescription = null, tint = RiskHigh)
                        Spacer(Modifier.width(8.dp))
                        Text("Recording ${s.recordingSeconds / 60}:${"%02d".format(s.recordingSeconds % 60)} · play the voicemail on speaker near the phone",
                            style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                        FilledIconButton(onClick = onStop, modifier = Modifier.testTag("stop")) { Icon(Icons.Filled.Stop, "Stop recording") }
                    }
                    return@Column
                }
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    SegmentedButton(selected = s.mode == Mode.CHECK, onClick = { onMode(Mode.CHECK) },
                        shape = SegmentedButtonDefaults.itemShape(0, 2)) { Text("Check a message") }
                    SegmentedButton(selected = s.mode == Mode.ASK, onClick = { onMode(Mode.ASK) },
                        shape = SegmentedButtonDefaults.itemShape(1, 2)) { Text("Ask Kip") }
                }
                s.attachment?.let { a ->
                    InputChip(
                        selected = true, onClick = onRemoveAttachment,
                        label = { Text(a.label + if (a.seconds > 0) " · ${a.seconds}s" else "") },
                        leadingIcon = { Icon(if (a.kind == "image") Icons.Filled.Image else Icons.Filled.AudioFile, null) },
                        trailingIcon = { Icon(Icons.Filled.Close, "Remove attachment") },
                    )
                }
                Row(verticalAlignment = Alignment.Bottom) {
                    if (s.mode == Mode.CHECK) {
                        IconButton(onClick = onPickImage, enabled = s.busy == null) { Icon(Icons.Filled.Image, "Check a screenshot") }
                        Column {
                            IconButton(onClick = { audioMenu = true }, enabled = s.busy == null) { Icon(Icons.Filled.Mic, "Check a voicemail") }
                            DropdownMenu(expanded = audioMenu, onDismissRequest = { audioMenu = false }) {
                                DropdownMenuItem(text = { Text("Record a voicemail on speaker") }, leadingIcon = { Icon(Icons.Filled.Mic, null) },
                                    onClick = { audioMenu = false; onMic() })
                                DropdownMenuItem(text = { Text("Pick an audio file") }, leadingIcon = { Icon(Icons.Filled.AudioFile, null) },
                                    onClick = { audioMenu = false; onPickAudio() })
                            }
                        }
                    }
                    OutlinedTextField(
                        value = s.input,
                        onValueChange = onInput,
                        modifier = Modifier.weight(1f).testTag("input"),
                        placeholder = { Text(if (s.mode == Mode.ASK) "Ask a scam-safety question" else "Paste the message here") },
                        maxLines = 5,
                        enabled = s.attachment == null,
                        supportingText = {
                            Row(Modifier.fillMaxWidth()) {
                                val lite = s.liveLite
                                if (s.mode == Mode.CHECK && lite != null) {
                                    Text("On-device: ${pct(lite)} scam-like", color = if (lite >= 0.5) RiskHigh else RiskLow,
                                        modifier = Modifier.weight(1f).testTag("liveLite"))
                                } else Spacer(Modifier.weight(1f))
                                Text("${s.input.length}/$limit")
                            }
                        },
                    )
                    Spacer(Modifier.width(6.dp))
                    val canSend = s.busy == null && (s.attachment != null || s.input.isNotBlank())
                    FilledIconButton(onClick = onSend, enabled = canSend, modifier = Modifier.padding(bottom = 22.dp).testTag("send")) {
                        Icon(Icons.AutoMirrored.Filled.Send, if (s.mode == Mode.ASK) "Ask" else "Check")
                    }
                }
            }
        }
    }
}
