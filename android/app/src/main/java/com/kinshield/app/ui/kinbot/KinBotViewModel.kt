package com.kinshield.app.ui.kinbot

import android.net.Uri
import android.util.Base64
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kinshield.app.KLog
import com.kinshield.app.KeepAlive
import com.kinshield.app.SharedPayload
import com.kinshield.app.data.ApiException
import com.kinshield.app.data.ApiJson
import com.kinshield.app.data.AppGraph
import com.kinshield.app.data.AskAnswer
import com.kinshield.app.data.ChatTurn
import com.kinshield.app.data.CheckResult
import com.kinshield.app.data.Investigation
import com.kinshield.app.data.Vision
import com.kinshield.app.media.AudioDecoder
import com.kinshield.app.media.ImageEncoder
import com.kinshield.app.media.VoiceRecorder
import com.kinshield.app.media.Wav
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

const val CHECK_MAX = 2000
const val ASK_MAX = 500
private const val MAX_HISTORY = 8
private const val MAX_FEED = 40

enum class Mode { CHECK, ASK }

/** What to run again when the user taps "Try again" (also saved so an interrupted check can be retried after process death). */
@Serializable
data class Retry(val op: String, val text: String = "", val path: String = "", val verdict: String? = null)

@Serializable
data class Attachment(val kind: String, val path: String, val label: String, val seconds: Int = 0, val cut: Boolean = false)

@Serializable
sealed interface FeedItem {
    val key: Long

    @Serializable @SerialName("user")
    data class UserText(override val key: Long, val text: String, val ask: Boolean = false) : FeedItem

    @Serializable @SerialName("attach")
    data class UserAttachment(override val key: Long, val kind: String, val label: String) : FeedItem

    @Serializable @SerialName("lite")
    data class Lite(override val key: Long, val score: Double, val offline: Boolean) : FeedItem

    @Serializable @SerialName("read")
    data class MediaRead(override val key: Long, val kind: String, val text: String, val vision: Vision? = null) : FeedItem

    @Serializable @SerialName("verdict")
    data class Verdict(override val key: Long, val result: CheckResult) : FeedItem

    @Serializable @SerialName("inv")
    data class Investigated(override val key: Long, val inv: Investigation) : FeedItem

    @Serializable @SerialName("answer")
    data class Answer(override val key: Long, val answer: AskAnswer) : FeedItem

    /** Kip's overall take: raises (never lowers) concern when the picture or the link checks found more than the words. */
    @Serializable @SerialName("overall")
    data class Overall(override val key: Long, val level: String, val title: String, val summary: String) : FeedItem

    @Serializable @SerialName("error")
    data class Error(override val key: Long, val message: String, val retry: Retry? = null, val offline: Boolean = false) : FeedItem
}

@Serializable
private data class AskContext(val level: String, val signals: List<String>)

data class KinBotUiState(
    val feed: List<FeedItem> = emptyList(),
    val input: String = "",
    val mode: Mode = Mode.CHECK,
    val attachment: Attachment? = null,
    val busy: String? = null,
    val recordingSeconds: Int? = null,
    val liveLite: Double? = null,
)

@OptIn(FlowPreview::class)
class KinBotViewModel(private val saved: SavedStateHandle) : ViewModel() {
    private val api = AppGraph.api
    private val settings get() = AppGraph.prefs.settings.value
    private val online get() = AppGraph.connectivity.online.value

    private val _state = MutableStateFlow(restore())
    val state: StateFlow<KinBotUiState> = _state.asStateFlow()

    private var history: List<ChatTurn> = load("history", ListSerializer(ChatTurn.serializer())) ?: emptyList()
    private var askContext: AskContext? = load("context", AskContext.serializer())
    private var recordJob: Job? = null
    private val recordStop = AtomicBoolean(false)
    private var seq = System.currentTimeMillis()
    private val inputFlow = MutableStateFlow(_state.value.input)

    init {
        // A check that was running when the process died: offer to run it again instead of losing it silently.
        load("inflight", Retry.serializer())?.let { r ->
            saved.remove<String>("inflight")
            add(FeedItem.Error(nextKey(), "That check was interrupted. Tap Try again to run it.", r))
        }
        viewModelScope.launch {
            inputFlow.debounce(250).collectLatest { text ->
                val score = if (text.isBlank() || _state.value.mode != Mode.CHECK) null
                else withContext(Dispatchers.Default) { runCatching { AppGraph.lite().score(text) }.onFailure { com.kinshield.app.KLog.e("lite failed", it) }.getOrNull() }
                _state.update { it.copy(liveLite = score) }
            }
        }
    }

    // ---- input -----------------------------------------------------------------------------------------------

    fun onInput(text: String) {
        val limit = if (_state.value.mode == Mode.ASK) ASK_MAX else CHECK_MAX
        val t = text.take(limit)
        _state.update { it.copy(input = t) }
        saved["input"] = t
        inputFlow.value = t
    }

    fun setMode(mode: Mode) {
        _state.update { it.copy(mode = mode, input = if (mode == Mode.ASK) it.input.take(ASK_MAX) else it.input) }
        saved["mode"] = mode.name
        inputFlow.value = _state.value.input + "" // re-trigger live score
    }

    fun submit() {
        val s = _state.value
        if (s.busy != null || s.recordingSeconds != null) return
        val att = s.attachment
        if (att != null) {
            setAttachment(null)
            when (att.kind) {
                "image" -> runScreenshot(att, addUser = true)
                else -> runVoicemail(att, addUser = true)
            }
            return
        }
        val text = s.input.trim()
        if (text.isEmpty()) return
        onInput("")
        if (s.mode == Mode.ASK) runAsk(text, addUser = true) else runCheck(text, addUser = true)
    }

    fun askFollowUp(question: String) {
        if (_state.value.busy != null) return
        setMode(Mode.ASK)
        runAsk(question, addUser = true)
    }

    fun retry(item: FeedItem.Error) {
        if (_state.value.busy != null) return
        val r = item.retry ?: return
        _state.update { st -> st.copy(feed = st.feed.filterNot { it.key == item.key }) }
        persistFeed()
        when (r.op) {
            "check" -> runCheck(r.text, addUser = false)
            "investigate" -> runInvestigate(r.text, r.verdict)
            "ask" -> runAsk(r.text, addUser = false)
            "screenshot" -> runScreenshot(Attachment("image", r.path, "Screenshot"), addUser = false)
            "voicemail" -> runVoicemail(Attachment("audio", r.path, "Voicemail"), addUser = false)
        }
    }

    fun clear() {
        recordStop.set(true)
        history = emptyList(); askContext = null
        _state.value = KinBotUiState()
        listOf("feed", "history", "context", "input", "attachment", "inflight").forEach { saved.remove<String>(it) }
        inputFlow.value = ""
    }

    fun handleShare(p: SharedPayload) {
        setMode(Mode.CHECK)
        when {
            p.error != null -> add(FeedItem.Error(nextKey(), p.error))
            p.imagePath != null -> {
                val att = Attachment("image", p.imagePath, "Shared screenshot")
                if (_state.value.busy == null) runScreenshot(att, addUser = true) else setAttachment(att)
            }
            !p.text.isNullOrBlank() -> {
                val text = p.text.trim().take(CHECK_MAX)
                if (_state.value.busy == null) runCheck(text, addUser = true) else onInput(text)
            }
        }
    }

    // ---- attachments ----------------------------------------------------------------------------------------

    fun removeAttachment() = setAttachment(null)

    fun pickImage(uri: Uri) {
        viewModelScope.launch {
            try {
                val f = withContext(Dispatchers.IO) { ImageEncoder.copyToCache(AppGraph.appContext, uri) }
                setMode(Mode.CHECK)
                setAttachment(Attachment("image", f.path, "Screenshot"))
            } catch (e: Exception) {
                KLog.w("image pick failed", e)
                add(FeedItem.Error(nextKey(), "Couldn't open that picture. Try a different one."))
            }
        }
    }

    fun pickAudio(uri: Uri) {
        if (_state.value.busy != null) return
        viewModelScope.launch {
            busy("Getting the recording ready")
            try {
                val d = withContext(Dispatchers.IO) { AudioDecoder.toWav(AppGraph.appContext, uri) }
                setMode(Mode.CHECK)
                setAttachment(Attachment("audio", d.file.path, "Voicemail", d.seconds, d.cut))
            } catch (e: Exception) {
                KLog.w("audio decode failed", e)
                add(FeedItem.Error(nextKey(), "Couldn't read that audio file. Try a different recording (m4a, mp3, wav)."))
            } finally {
                busy(null)
            }
        }
    }

    fun startRecording() {
        if (recordJob != null || _state.value.busy != null) return
        _state.update { it.copy(recordingSeconds = 0) }
        recordStop.set(false)
        recordJob = viewModelScope.launch {
            try {
                val f = VoiceRecorder(AppGraph.appContext).record(recordStop) { sec -> _state.update { it.copy(recordingSeconds = sec) } }
                val secs = Wav.seconds(f)
                if (secs < 1) add(FeedItem.Error(nextKey(), "That recording was too short. Hold the phone near the speaker and try again."))
                else { setMode(Mode.CHECK); setAttachment(Attachment("audio", f.path, "Recording", secs, secs >= Wav.MAX_SECONDS)) }
            } catch (e: Exception) {
                KLog.w("recording failed", e)
                add(FeedItem.Error(nextKey(), "The microphone couldn't record. ${e.message ?: ""}".trim()))
            } finally {
                recordJob = null
                _state.update { it.copy(recordingSeconds = null) }
            }
        }
    }

    /** Stops recording; the recorder loop sees the flag, then saves what it captured as a WAV. */
    fun stopRecording() = recordStop.set(true)

    // ---- operations -----------------------------------------------------------------------------------------

    private fun runCheck(text: String, addUser: Boolean, vision: Vision? = null) {
        val clean = text.trim().take(CHECK_MAX)
        if (addUser) add(FeedItem.UserText(nextKey(), clean))
        viewModelScope.launch {
            val lite = withContext(Dispatchers.Default) { runCatching { AppGraph.lite().score(clean) }.onFailure { KLog.e("lite failed", it) }.getOrNull() }
            if (lite != null && (settings.showLite || !online)) add(FeedItem.Lite(nextKey(), lite, offline = !online))
            if (!online) {
                add(FeedItem.Error(nextKey(),
                    "You're offline, so only the on-device score is available. Connect to the internet and try again for Kip's full check.",
                    Retry("check", clean), offline = true))
                return@launch
            }
            val r = Retry("check", clean)
            val result = call(r, "Kip is reading the message") { api.check(clean) } ?: return@launch
            add(FeedItem.Verdict(nextKey(), result))
            remember("user", "Please check this message: ${clean.take(400)}")
            remember("assistant", ("${result.riskLevel} risk. ${result.headline} " +
                result.signs.joinToString("; ") { "${it.label}: \"${it.quote}\"" }).take(500))
            askContext = AskContext(result.riskLevel, result.signs.map { it.signal }.distinct())
            saved["context"] = ApiJson.encodeToString(AskContext.serializer(), askContext!!)
            val inv = if (settings.autoInvestigate) runInvestigateNow(clean, result.riskLevel) else null
            overallTake(result, vision, inv)
        }
    }

    private fun runInvestigate(text: String, verdict: String?) {
        viewModelScope.launch { runInvestigateNow(text, verdict) }
    }

    private suspend fun runInvestigateNow(text: String, verdict: String?): Investigation? {
        val r = Retry("investigate", text, verdict = verdict)
        val inv = call(r, "Kip is checking the links, numbers and advice") { api.investigate(text, verdict) } ?: return null
        add(FeedItem.Investigated(nextKey(), inv))
        remember("assistant", "Investigation: ${inv.summary}".take(500))
        return inv
    }

    /** Same rule as the web app (kinbot-app.js overall()): only ever raises the level above the text verdict. */
    private fun overallTake(check: CheckResult, vision: Vision?, inv: Investigation?) {
        if (check.riskLevel == "HIGH") return
        val reasons = mutableListOf<String>()
        if (inv?.level == "danger") reasons += "the links or numbers in it failed Kip's checks"
        val vis = vision?.signs.orEmpty()
        if (vis.size >= 2) reasons += "the picture shows ${vis.size} warning signs (${vis.take(2).joinToString(", ") { it.label.lowercase() }})"
        else if (vision?.hasQr == true) reasons += "it shows a QR code"
        if (reasons.isEmpty()) return
        val level = if (reasons.size >= 2 || inv?.level == "danger") "HIGH" else "MEDIUM"
        val words = when (check.riskLevel) { "MEDIUM" -> "worrying"; else -> "safe" }
        add(FeedItem.Overall(nextKey(), level,
            if (level == "HIGH") "Treat this as a likely scam." else "Be careful with this one.",
            "The words alone looked $words, but ${reasons.joinToString(", and ")}."))
        remember("assistant", "Overall $level: ${reasons.joinToString("; ")}".take(500))
        askContext = AskContext(level, askContext?.signals ?: emptyList())
        saved["context"] = ApiJson.encodeToString(AskContext.serializer(), askContext!!)
    }

    private fun runAsk(text: String, addUser: Boolean) {
        val clean = text.trim().take(ASK_MAX)
        if (addUser) add(FeedItem.UserText(nextKey(), clean, ask = true))
        viewModelScope.launch {
            val ctx = askContext
            val r = Retry("ask", clean)
            val ans = call(r, "Kip is thinking") {
                api.ask(clean, history.takeLast(MAX_HISTORY), ctx?.level, ctx?.signals ?: emptyList())
            } ?: return@launch
            add(FeedItem.Answer(nextKey(), ans))
            remember("user", clean)
            remember("assistant", ans.answer.take(500))
        }
    }

    private fun runScreenshot(att: Attachment, addUser: Boolean) {
        if (addUser) add(FeedItem.UserAttachment(nextKey(), "image", att.label))
        viewModelScope.launch {
            val r = Retry("screenshot", path = att.path)
            val res = call(r, "Kip is reading the screenshot") {
                val dataUrl = withContext(Dispatchers.IO) { ImageEncoder.toJpegDataUrl(File(att.path)) }
                api.screenshot(dataUrl)
            } ?: return@launch
            add(FeedItem.MediaRead(nextKey(), "image", res.text, res.vision))
            if (res.text.isBlank()) {
                add(FeedItem.Error(nextKey(), "Kip couldn't find any words in that picture. Try a clearer screenshot, or paste the text."))
            } else runCheck(res.text, addUser = false, vision = res.vision)
        }
    }

    private fun runVoicemail(att: Attachment, addUser: Boolean) {
        if (addUser) add(FeedItem.UserAttachment(nextKey(), "audio",
            att.label + if (att.seconds > 0) " · ${att.seconds}s${if (att.cut) " (first 110s)" else ""}" else ""))
        viewModelScope.launch {
            val r = Retry("voicemail", path = att.path)
            val res = call(r, "Kip is listening to the recording") {
                val b64 = withContext(Dispatchers.IO) { Base64.encodeToString(File(att.path).readBytes(), Base64.NO_WRAP) }
                api.voicemail(b64)
            } ?: return@launch
            add(FeedItem.MediaRead(nextKey(), "audio", res.text))
            if (res.text.isBlank()) {
                add(FeedItem.Error(nextKey(), "Kip couldn't hear any words in that recording. Play it louder, closer to the phone."))
            } else runCheck(res.text, addUser = false)
        }
    }

    /** Runs one API call with a busy label; on failure adds an error card with a retry and returns null. */
    private suspend fun <T> call(retry: Retry, label: String, block: suspend () -> T): T? {
        busy(label)
        KeepAlive.acquire(AppGraph.appContext)
        saved["inflight"] = ApiJson.encodeToString(Retry.serializer(), retry)
        return try {
            block()
        } catch (e: ApiException) {
            add(FeedItem.Error(nextKey(), e.message ?: "Something went wrong.", retry.takeUnless { e.notConfigured }, e.offline))
            null
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: Exception) {
            KLog.e("unexpected error in ${retry.op}", e)
            add(FeedItem.Error(nextKey(), "Something went wrong on this phone (${e.javaClass.simpleName}).", retry))
            null
        } finally {
            KeepAlive.release()
            saved.remove<String>("inflight")
            busy(null)
        }
    }

    // ---- state helpers --------------------------------------------------------------------------------------

    private fun busy(label: String?) = _state.update { it.copy(busy = label) }

    private fun setAttachment(a: Attachment?) {
        _state.update { it.copy(attachment = a) }
        if (a == null) saved.remove<String>("attachment") else saved["attachment"] = ApiJson.encodeToString(Attachment.serializer(), a)
    }

    private fun add(item: FeedItem) {
        _state.update { it.copy(feed = (it.feed + item).takeLast(MAX_FEED)) }
        persistFeed()
    }

    private fun persistFeed() {
        saved["feed"] = ApiJson.encodeToString(ListSerializer(FeedItem.serializer()), _state.value.feed)
    }

    private fun remember(role: String, content: String) {
        history = (history + ChatTurn(role, content)).takeLast(MAX_HISTORY * 2)
        saved["history"] = ApiJson.encodeToString(ListSerializer(ChatTurn.serializer()), history)
    }

    private fun nextKey() = ++seq

    private fun restore() = KinBotUiState(
        feed = load("feed", ListSerializer(FeedItem.serializer())) ?: emptyList(),
        input = saved.get<String>("input") ?: "",
        mode = runCatching { Mode.valueOf(saved.get<String>("mode") ?: "CHECK") }.getOrDefault(Mode.CHECK),
        attachment = load("attachment", Attachment.serializer())?.takeIf { File(it.path).exists() },
    )

    private fun <T> load(key: String, de: kotlinx.serialization.KSerializer<T>): T? =
        saved.get<String>(key)?.let { runCatching { ApiJson.decodeFromString(de, it) }.getOrNull() }
}
