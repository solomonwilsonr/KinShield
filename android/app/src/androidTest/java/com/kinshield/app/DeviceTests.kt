package com.kinshield.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.kinshield.app.data.AppGraph
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** KinShield-Lite parity on Android's own regex engine (ICU), which differs from the JVM's. */
@RunWith(AndroidJUnit4::class)
class LiteParityDeviceTest {
    @Test
    fun matchesPythonOnDevice() {
        val testCtx = InstrumentationRegistry.getInstrumentation().context
        val cases = Json.parseToJsonElement(testCtx.assets.open("lite_parity.json").bufferedReader().readText()).jsonArray
        val model = AppGraph.lite()
        for (c in cases) {
            val o = c.jsonObject
            val text = o.getValue("text").jsonPrimitive.content
            assertEquals("score for: ${text.take(40)}", o.getValue("score").jsonPrimitive.double, model.score(text), 1e-9)
        }
    }
}

/** Offline-capable UI path: Home -> KinModel-Lite -> type -> on-device score appears. No network calls. */
@RunWith(AndroidJUnit4::class)
class HomeNavigationTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    @Test
    fun liteScoresTypedMessage() {
        rule.onNodeWithTag("entry_lite").performClick()
        rule.onNodeWithTag("liteInput").performTextInput("Grandma it's me, I'm in jail. Don't tell Mom. Buy gift cards and read me the numbers.")
        rule.waitUntil(5_000) { rule.onAllNodes(androidx.compose.ui.test.hasTestTag("liteScore")).fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithTag("liteScore").assertIsDisplayed()
    }

    @Test
    fun aboutListsHonestLimits() {
        rule.onNode(androidx.compose.ui.test.hasContentDescription("About and limits")).performClick()
        rule.onNodeWithText("What this app can't do", substring = true, ignoreCase = true).assertIsDisplayed()
    }
}
