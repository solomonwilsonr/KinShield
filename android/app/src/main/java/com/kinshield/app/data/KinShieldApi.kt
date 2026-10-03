package com.kinshield.app.data

import com.kinshield.app.KLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.io.InterruptedIOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

val ApiJson = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    explicitNulls = false
    isLenient = true
}

/** An error the UI can show as-is. [offline]/[timeout] let screens pick the right wording. */
class ApiException(
    message: String,
    val offline: Boolean = false,
    val timeout: Boolean = false,
    val notConfigured: Boolean = false,
) : Exception(message)

/**
 * Client for the public KinShield API Gateway endpoint (no keys: the Bedrock key stays server-side).
 * Routes: POST /kinbot (check, investigate, ask, screenshot, voicemail), GET /scenarios, GET /scenario, POST /detect.
 */
class KinShieldApi(private val baseUrl: String, private val client: OkHttpClient) {
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    val isConfigured: Boolean get() = baseUrl.startsWith("https://")
    val host: String get() = baseUrl.toHttpUrlOrNull()?.host ?: "(not set)"

    suspend fun check(message: String): CheckResult =
        kinbot(buildJsonObject { put("mode", "check"); put("message", message) }, CheckResult.serializer())

    suspend fun investigate(message: String, verdict: String?): Investigation =
        kinbot(buildJsonObject {
            put("mode", "investigate"); put("message", message)
            if (verdict != null) put("verdict", verdict)
        }, Investigation.serializer())

    suspend fun ask(message: String, history: List<ChatTurn>, contextLevel: String?, contextSignals: List<String>): AskAnswer =
        kinbot(buildJsonObject {
            put("mode", "ask"); put("message", message)
            putJsonArray("history") {
                history.forEach { h -> addJsonObject { put("role", h.role); put("content", h.content) } }
            }
            if (contextLevel != null) putJsonObject("context") {
                put("risk_level", contextLevel)
                putJsonArray("signals") { contextSignals.forEach { add(it) } }
            }
        }, AskAnswer.serializer())

    /** [imageDataUrl] is a `data:image/jpeg;base64,...` URL, like the web app sends. */
    suspend fun screenshot(imageDataUrl: String): ScreenshotResult =
        kinbot(buildJsonObject { put("mode", "screenshot"); put("image", imageDataUrl) }, ScreenshotResult.serializer())

    /** [wavBase64] is a 16 kHz mono 16-bit WAV, base64 encoded (no data: prefix), like the web app sends. */
    suspend fun voicemail(wavBase64: String): VoicemailResult =
        kinbot(buildJsonObject { put("mode", "voicemail"); put("audio", wavBase64); put("mime", "audio/wav") }, VoicemailResult.serializer())

    suspend fun scenarios(): List<ScenarioSummary> = get("/scenarios", ScenarioList.serializer()).scenarios

    suspend fun scenario(id: String): Scenario = get("/scenario?id=" + java.net.URLEncoder.encode(id, "UTF-8"), Scenario.serializer())

    suspend fun detect(turns: List<Turn>): DetectResult {
        val body = buildJsonObject {
            putJsonArray("turns") {
                turns.forEach { t -> addJsonObject { put("t", t.t); put("speaker", t.speaker); put("text", t.text) } }
            }
            put("session_id", "android-" + System.currentTimeMillis())
        }
        return post("/detect", body, DetectResult.serializer())
    }

    private suspend fun <T> kinbot(body: JsonObject, de: DeserializationStrategy<T>): T = post("/kinbot", body, de)

    private suspend fun <T> post(path: String, body: JsonObject, de: DeserializationStrategy<T>): T {
        val req = Request.Builder().url(url(path)).post(body.toString().toRequestBody(jsonType)).build()
        return execute(req, de)
    }

    private suspend fun <T> get(path: String, de: DeserializationStrategy<T>): T =
        execute(Request.Builder().url(url(path)).get().build(), de)

    private fun url(path: String): String {
        if (!isConfigured) throw ApiException(
            "The app has no API address. Add kinshield.apiBaseUrl=https://… to android/local.properties and rebuild.",
            notConfigured = true,
        )
        return baseUrl + path
    }

    private suspend fun <T> execute(req: Request, de: DeserializationStrategy<T>): T {
        val (code, text) = try {
            client.newCall(req).await()
        } catch (e: InterruptedIOException) {
            throw ApiException("Kip took too long to answer. Please try again.", timeout = true)
        } catch (e: IOException) {
            KLog.w("network error on ${req.url.encodedPath}: ${e.javaClass.simpleName}")
            throw ApiException("Couldn't reach KinShield. Check your internet connection and try again.", offline = true)
        }
        if (code !in 200..299) {
            val msg = parseApiError(text)
            KLog.w("HTTP $code on ${req.url.encodedPath}: $msg")
            throw ApiException(
                when {
                    code == 400 || code == 413 -> msg ?: "KinShield couldn't use that input."
                    code == 504 -> "Kip took too long to answer. Please try again."
                    else -> "KinShield is having trouble right now (error $code). Please try again in a moment."
                },
            )
        }
        return withContext(Dispatchers.Default) {
            try {
                ApiJson.decodeFromString(de, text)
            } catch (e: Exception) {
                KLog.e("bad response on ${req.url.encodedPath}", e)
                throw ApiException("KinShield sent an answer the app couldn't read. Please try again.")
            }
        }
    }
}

private suspend fun Call.await(): Pair<Int, String> = suspendCancellableCoroutine { cont ->
    cont.invokeOnCancellation { cancel() }
    enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) {
            if (cont.isActive) cont.resumeWithException(e)
        }

        override fun onResponse(call: Call, response: Response) {
            val result = try {
                response.use { it.code to (it.body?.string() ?: "") }
            } catch (e: IOException) {
                if (cont.isActive) cont.resumeWithException(e)
                return
            }
            cont.resume(result)
        }
    })
}
