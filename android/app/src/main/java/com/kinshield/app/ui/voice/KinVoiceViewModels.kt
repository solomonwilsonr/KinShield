package com.kinshield.app.ui.voice

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kinshield.app.KLog
import com.kinshield.app.KeepAlive
import com.kinshield.app.Notifier
import com.kinshield.app.data.ApiException
import com.kinshield.app.data.ApiJson
import com.kinshield.app.data.AppGraph
import com.kinshield.app.data.DetectResult
import com.kinshield.app.data.Scenario
import com.kinshield.app.data.ScenarioSummary
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import java.util.concurrent.ConcurrentHashMap

// ---- list -------------------------------------------------------------------------------------------------

data class VoiceListState(
    val loading: Boolean = true,
    val error: String? = null,
    val offline: Boolean = false,
    val scenarios: List<ScenarioSummary> = emptyList(),
    val filter: String = "all", // all | scam | benign
)

class VoiceListViewModel(private val saved: SavedStateHandle) : ViewModel() {
    private val _state = MutableStateFlow(VoiceListState(filter = saved.get<String>("filter") ?: "all"))
    val state: StateFlow<VoiceListState> = _state.asStateFlow()

    init { load() }

    fun setFilter(f: String) { saved["filter"] = f; _state.update { it.copy(filter = f) } }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val list = Cache.scenarios ?: AppGraph.api.scenarios().also { Cache.scenarios = it }
                _state.update { it.copy(loading = false, scenarios = list) }
            } catch (e: ApiException) {
                _state.update { it.copy(loading = false, error = e.message, offline = e.offline) }
            }
        }
    }
}

/** In-memory caches so replays and rotation don't spend extra Bedrock calls (like the web app's sessionStorage). */
private object Cache {
    @Volatile var scenarios: List<ScenarioSummary>? = null
    val scenario = ConcurrentHashMap<String, Scenario>()
    val scores = ConcurrentHashMap<String, DetectResult>()
}

// ---- player -----------------------------------------------------------------------------------------------

const val MAX_POINTS = 6

@Serializable
data class ScorePoint(val turn: Int, val score: Int, val level: String)

data class PlayerState(
    val loading: Boolean = true,
    val error: String? = null,
    val scenario: Scenario? = null,
    val shown: Int = 0,
    val points: List<ScorePoint> = emptyList(),
    val playing: Boolean = false,
    val scoring: Boolean = false,
    val verdict: DetectResult? = null,
    val alertTurn: Int? = null,
    val notified: Boolean? = null, // null = no alert yet; false = alert shown in-app only (notifications blocked/off)
)

class VoicePlayerViewModel(private val saved: SavedStateHandle) : ViewModel() {
    private val id: String = checkNotNull(saved.get<String>("id"))
    private val _state = MutableStateFlow(
        PlayerState(
            shown = saved.get<Int>("shown") ?: 0,
            points = saved.get<String>("points")?.let { runCatching { ApiJson.decodeFromString(ListSerializer(ScorePoint.serializer()), it) }.getOrNull() } ?: emptyList(),
            verdict = saved.get<String>("verdict")?.let { runCatching { ApiJson.decodeFromString(DetectResult.serializer(), it) }.getOrNull() },
            alertTurn = saved.get<Int>("alertTurn"),
            notified = saved.get<Boolean>("notified"),
        ),
    )
    val state: StateFlow<PlayerState> = _state.asStateFlow()
    private var playJob: Job? = null

    init { load() }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                val sc = Cache.scenario[id] ?: AppGraph.api.scenario(id).also { Cache.scenario[id] = it }
                _state.update { it.copy(loading = false, scenario = sc) }
            } catch (e: ApiException) {
                _state.update { it.copy(loading = false, error = e.message) }
            }
        }
    }

    /** Which turns get a detector call: caller turns thinned to MAX_POINTS, plus the last turn (the whole-call verdict). */
    private fun plan(sc: Scenario): Set<Int> {
        val caller = sc.turns.indices.filter { sc.turns[it].speaker != "victim" }
        val pick = if (caller.size > MAX_POINTS - 1) (1 until MAX_POINTS).map { k -> caller[Math.round(k * caller.size.toDouble() / MAX_POINTS).toInt() - 1] } else caller
        return (pick + (sc.turns.size - 1)).toSet()
    }

    fun play(fromStart: Boolean = true) {
        val sc = _state.value.scenario ?: return
        if (playJob?.isActive == true) return
        if (fromStart) {
            _state.update { it.copy(shown = 0, points = emptyList(), verdict = null, alertTurn = null, notified = null, error = null) }
            persist()
        }
        val todo = plan(sc)
        playJob = viewModelScope.launch {
            _state.update { it.copy(playing = true, error = null) }
            KeepAlive.acquire(AppGraph.appContext)
            // Resume at the first planned turn that has no score yet (e.g. the one whose detector call failed).
            val start = (todo.filter { t -> t < _state.value.shown && _state.value.points.none { it.turn == t } }.minOrNull()
                ?.let { it } ?: _state.value.shown).coerceAtMost(sc.turns.size)
            try {
                for (i in start until sc.turns.size) {
                    _state.update { it.copy(shown = i + 1) }
                    persist()
                    val dwell = (700 + sc.turns[i].text.length * 22).coerceIn(1100, 2600).toLong()
                    if (i in todo) {
                        _state.update { it.copy(scoring = true) }
                        val key = "$id:${i + 1}"
                        val r = Cache.scores[key] ?: AppGraph.api.detect(sc.turns.subList(0, i + 1)).also { Cache.scores[key] = it }
                        _state.update { st -> st.copy(scoring = false, points = st.points.filterNot { it.turn == i } + ScorePoint(i, r.riskScore, r.riskLevel)) }
                        if (i == sc.turns.size - 1) _state.update { it.copy(verdict = r) }
                        if (r.riskLevel == "HIGH" && _state.value.alertTurn == null) alert(sc, r, i)
                        persist()
                    }
                    delay(dwell)
                }
            } catch (e: ApiException) {
                _state.update { it.copy(error = e.message, scoring = false) }
            } finally {
                KeepAlive.release()
                _state.update { it.copy(playing = false, scoring = false) }
                persist()
            }
        }
    }

    fun retry() = play(fromStart = false)

    private fun alert(sc: Scenario, r: DetectResult, turn: Int) {
        val ctx = AppGraph.appContext
                val quote = r.evidence.maxByOrNull { it.weight }?.quote
        val posted = AppGraph.prefs.settings.value.alertsEnabled && Notifier.postHighRisk(
            ctx, id.hashCode(),
            "High-risk call · practice demo",
            (sc.claimedIdentity?.let { "Caller claims to be $it." } ?: "The caller is pushing for money.") + (quote?.let { "\n“$it”" } ?: "") + "\nCall them back on a number you already have.",
        )
        KLog.i("KinVoice HIGH at turn ${turn + 1}; notification posted=$posted")
        _state.update { it.copy(alertTurn = turn, notified = posted) }
    }

    private fun persist() {
        val s = _state.value
        saved["shown"] = s.shown
        saved["points"] = ApiJson.encodeToString(ListSerializer(ScorePoint.serializer()), s.points)
        s.verdict?.let { saved["verdict"] = ApiJson.encodeToString(DetectResult.serializer(), it) } ?: saved.remove<String>("verdict")
        s.alertTurn?.let { saved["alertTurn"] = it } ?: saved.remove<Int>("alertTurn")
        s.notified?.let { saved["notified"] = it } ?: saved.remove<Boolean>("notified")
    }
}
