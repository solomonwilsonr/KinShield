package com.kinshield.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Shapes mirror lambda/evidence-detector/handler.py and agent.py. Unknown fields are ignored.

@Serializable
data class Sign(
    val signal: String = "",
    val label: String = "",
    val quote: String = "",
    val weight: Int = 0,
)

@Serializable
data class LiteScore(val score: Double = 0.0, val label: String = "")

@Serializable
data class CheckResult(
    @SerialName("risk_level") val riskLevel: String = "LOW",
    @SerialName("risk_score") val riskScore: Int = 0,
    val headline: String = "",
    val summary: String = "",
    val signs: List<Sign> = emptyList(),
    val steps: List<String> = emptyList(),
    @SerialName("recommended_action") val recommendedAction: String = "",
    val lite: LiteScore? = null,
    @SerialName("latency_ms") val latencyMs: Long = 0,
)

@Serializable
data class Finding(val level: String = "info", val text: String = "")

@Serializable
data class InvestigationStep(
    val tool: String = "",
    val label: String = "",
    val target: String = "",
    val findings: List<Finding> = emptyList(),
    val level: String = "info",
)

@Serializable
data class Investigation(
    val level: String = "info",
    val steps: List<InvestigationStep> = emptyList(),
    val summary: String = "",
    @SerialName("next_step") val nextStep: String = "",
)

@Serializable
data class CardAction(val label: String = "", val href: String = "", val primary: Boolean = false)

@Serializable
data class SafetyCard(
    val kind: String = "",
    val title: String = "",
    val steps: List<String> = emptyList(),
    val actions: List<CardAction> = emptyList(),
    val note: String = "",
)

@Serializable
data class AskAnswer(val answer: String = "", val source: String = "", val card: SafetyCard? = null)

@Serializable
data class VisualSign(val label: String = "", val detail: String = "")

@Serializable
data class Vision(
    val model: String = "",
    val what: String = "",
    val brand: String? = null,
    @SerialName("has_qr") val hasQr: Boolean = false,
    val signs: List<VisualSign> = emptyList(),
)

@Serializable
data class ScreenshotResult(val text: String = "", val lines: Int = 0, val reader: String? = null, val vision: Vision? = null)

@Serializable
data class VoicemailResult(val text: String = "", val model: String = "")

@Serializable
data class Turn(val t: String = "", val speaker: String = "", val text: String = "")

@Serializable
data class ScenarioSummary(val id: String, val title: String = "", val label: String = "")

@Serializable
data class ScenarioList(val scenarios: List<ScenarioSummary> = emptyList())

@Serializable
data class Scenario(
    val id: String = "",
    val title: String = "",
    val label: String = "",
    @SerialName("claimed_identity") val claimedIdentity: String? = null,
    val turns: List<Turn> = emptyList(),
)

@Serializable
data class Evidence(val t: String = "", val quote: String = "", val signal: String = "", val weight: Int = 0)

@Serializable
data class DetectResult(
    @SerialName("risk_level") val riskLevel: String = "LOW",
    @SerialName("risk_score") val riskScore: Int = 0,
    val evidence: List<Evidence> = emptyList(),
    @SerialName("recommended_action") val recommendedAction: String = "",
)

@Serializable
data class ChatTurn(val role: String, val content: String)

@Serializable
private data class ApiError(val error: String = "")

internal fun parseApiError(body: String?): String? =
    runCatching { body?.let { ApiJson.decodeFromString(ApiError.serializer(), it).error } }.getOrNull()?.takeIf { it.isNotBlank() }
