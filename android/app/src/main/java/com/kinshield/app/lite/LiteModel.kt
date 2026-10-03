package com.kinshield.app.lite

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.regex.Pattern
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.sqrt

/**
 * KinShield-Lite on the device: a Kotlin port of lambda/evidence-detector/lite.py.
 *
 * It scores text with the same int8 TF-IDF + logistic-regression export (assets/lite_model.json), re-implementing
 * sklearn's word (1-2 gram) and char_wb (3-5 gram) analyzers. It is a keyword-style second opinion, not a language
 * model, and the cloud detector's verdict always takes precedence. Parity with the Python is checked by LiteModelTest.
 */
class LiteModel private constructor(
    private val wordVocab: Map<String, Int>,
    private val wordIdf: DoubleArray,
    private val wordLo: Int,
    private val wordHi: Int,
    private val charVocab: Map<String, Int>,
    private val charIdf: DoubleArray,
    private val charLo: Int,
    private val charHi: Int,
    private val charOffset: Int,
    private val weights: IntArray,
    private val wScale: Double,
    private val bias: Double,
    private val calibA: Double,
    private val calibB: Double,
) {
    /** Calibrated scam-likeness probability, 0..1. */
    fun score(text: String): Double {
        val feats = HashMap<Int, Double>()
        block(wordNgrams(text), wordVocab, wordIdf, 0, feats)
        block(charWbNgrams(text), charVocab, charIdf, charOffset, feats)
        var raw = 0.0
        for ((i, v) in feats) raw += v * weights[i]
        raw = raw * wScale + bias
        val z = calibA * raw + calibB
        return 1.0 / (1.0 + exp(-z))
    }

    private fun wordNgrams(text: String): List<String> {
        val tokens = ArrayList<String>()
        val m = TOKEN.matcher(text.lowercase())
        while (m.find()) tokens.add(m.group())
        if (wordHi == 1) return tokens
        val out = if (wordLo == 1) ArrayList(tokens) else ArrayList()
        val nTok = tokens.size
        for (n in maxOf(wordLo, 2)..minOf(wordHi, nTok)) {
            for (i in 0..nTok - n) out.add(tokens.subList(i, i + n).joinToString(" "))
        }
        return out
    }

    private fun charWbNgrams(text: String): List<String> {
        val cleaned = WHITE.matcher(text.lowercase()).replaceAll(" ")
        val out = ArrayList<String>()
        for (word in SPLIT.split(cleaned)) {
            if (word.isEmpty()) continue
            // Work in code points so emoji and other non-BMP characters slice like Python strings.
            val w = (" $word ").codePoints().toArray()
            val wLen = w.size
            for (n in charLo..charHi) {
                var offset = 0
                out.add(slice(w, offset, n))
                while (offset + n < wLen) {
                    offset += 1
                    out.add(slice(w, offset, n))
                }
                if (offset == 0) break // word shorter than n
            }
        }
        return out
    }

    private fun slice(cp: IntArray, start: Int, n: Int): String {
        val end = minOf(start + n, cp.size)
        return String(cp, start, end - start)
    }

    private fun block(grams: List<String>, vocab: Map<String, Int>, idf: DoubleArray, offset: Int, into: MutableMap<Int, Double>) {
        val counts = LinkedHashMap<Int, Int>()
        for (g in grams) {
            val i = vocab[g] ?: continue
            counts[i] = (counts[i] ?: 0) + 1
        }
        val vals = LinkedHashMap<Int, Double>()
        var sq = 0.0
        for ((i, c) in counts) {
            val v = (1 + ln(c.toDouble())) * idf[i]
            vals[i] = v
            sq += v * v
        }
        val norm = sqrt(sq)
        for ((i, v) in vals) into[i + offset] = if (norm > 0) v / norm else v
    }

    companion object {
        // sklearn's default token_pattern (?u)\b\w\w+\b and Python's unicode \s. The JVM needs UNICODE_CHARACTER_CLASS
        // for that; Android's ICU regex rejects the flag but its \w, \b and \s are already Unicode-aware.
        private fun unicode(regex: String): Pattern =
            try { Pattern.compile(regex, Pattern.UNICODE_CHARACTER_CLASS) } catch (e: IllegalArgumentException) { Pattern.compile(regex) }
        private val TOKEN: Pattern = unicode("\\b\\w\\w+\\b")
        private val WHITE: Pattern = unicode("\\s\\s+")
        private val SPLIT: Pattern = unicode("\\s+")

        fun fromJson(json: String): LiteModel {
            val m = Json.parseToJsonElement(json).jsonObject
            fun vocab(key: String): Map<String, Int> =
                m.getValue(key).jsonObject.mapValuesTo(HashMap()) { it.value.jsonPrimitive.int }
            fun doubles(key: String) = m.getValue(key).jsonArray.map { it.jsonPrimitive.double }.toDoubleArray()
            fun range(key: String) = m.getValue(key).jsonArray.let { it[0].jsonPrimitive.int to it[1].jsonPrimitive.int }
            fun num(o: JsonObject, key: String) = o.getValue(key).jsonPrimitive.double
            val (wLo, wHi) = range("word_ngram")
            val (cLo, cHi) = range("char_ngram")
            return LiteModel(
                wordVocab = vocab("word_vocab"),
                wordIdf = doubles("word_idf"),
                wordLo = wLo, wordHi = wHi,
                charVocab = vocab("char_vocab"),
                charIdf = doubles("char_idf"),
                charLo = cLo, charHi = cHi,
                charOffset = m.getValue("char_offset").jsonPrimitive.int,
                weights = m.getValue("w_int8").jsonArray.map { it.jsonPrimitive.int }.toIntArray(),
                wScale = num(m, "w_scale"),
                bias = num(m, "bias"),
                calibA = num(m, "calib_a"),
                calibB = num(m, "calib_b"),
            )
        }
    }
}
