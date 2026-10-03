package com.kinshield.app

import com.kinshield.app.lite.LiteModel
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Parity with the Python reference (lambda/evidence-detector/lite.py). Expected scores in
 * src/test/resources/lite_parity.json were produced by running lite.score() with python3.
 */
class LiteModelTest {
    private val model = LiteModel.fromJson(File("src/main/assets/lite_model.json").readText())

    @Test
    fun matchesPythonReference() {
        val cases = Json.parseToJsonElement(javaClass.classLoader!!.getResource("lite_parity.json")!!.readText()).jsonArray
        assertTrue("need at least 10 parity texts", cases.size >= 10)
        for (c in cases) {
            val o = c.jsonObject
            val text = o.getValue("text").jsonPrimitive.content
            val expected = o.getValue("score").jsonPrimitive.double
            assertEquals("score for: ${text.take(40)}", expected, model.score(text), 1e-9)
        }
    }

    @Test
    fun scamScoresHigherThanBenign() {
        val scam = model.score("Grandma it's me, I'm in jail. Don't tell Mom. Buy gift cards and read me the numbers.")
        val benign = model.score("Hi Mom, dinner is at 7 on Sunday. Can you bring the potato salad?")
        assertTrue(scam > 0.5)
        assertTrue(benign < 0.5)
    }
}
