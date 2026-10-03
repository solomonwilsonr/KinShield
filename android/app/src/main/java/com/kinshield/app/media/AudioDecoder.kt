package com.kinshield.app.media

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.io.File
import java.nio.ByteOrder

/**
 * Decode any audio file Android can read (m4a, mp3, ogg, wav, amr...) to 16 kHz mono 16-bit WAV, keeping the first
 * 110 seconds. Mirrors the web app, which decodes in the browser and downmixes before upload.
 */
object AudioDecoder {
    data class Decoded(val file: File, val seconds: Int, val cut: Boolean)

    fun toWav(context: Context, uri: Uri): Decoded {
        val extractor = MediaExtractor()
        extractor.setDataSource(context, uri, null)
        try {
            val track = (0 until extractor.trackCount).firstOrNull {
                extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: throw IllegalArgumentException("That file has no audio KinBot can read.")
            extractor.selectTrack(track)
            val inFormat = extractor.getTrackFormat(track)
            val codec = MediaCodec.createDecoderByType(inFormat.getString(MediaFormat.KEY_MIME)!!)
            codec.configure(inFormat, null, null, 0)
            codec.start()

            var srcRate = inFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var channels = inFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var floatPcm = false
            val mono = FloatList()
            var cut = false
            val info = MediaCodec.BufferInfo()
            var inputDone = false
            var outputDone = false
            try {
                while (!outputDone) {
                    if (!inputDone) {
                        val inIdx = codec.dequeueInputBuffer(10_000)
                        if (inIdx >= 0) {
                            val buf = codec.getInputBuffer(inIdx)!!
                            val n = extractor.readSampleData(buf, 0)
                            if (n < 0) {
                                codec.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                inputDone = true
                            } else {
                                codec.queueInputBuffer(inIdx, 0, n, extractor.sampleTime, 0)
                                extractor.advance()
                            }
                        }
                    }
                    val outIdx = codec.dequeueOutputBuffer(info, 10_000)
                    when {
                        outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                            val f = codec.outputFormat
                            srcRate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                            channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                            floatPcm = f.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
                                f.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
                        }
                        outIdx >= 0 -> {
                            val buf = codec.getOutputBuffer(outIdx)!!.order(ByteOrder.LITTLE_ENDIAN)
                            buf.position(info.offset); buf.limit(info.offset + info.size)
                            if (floatPcm) {
                                val fb = buf.asFloatBuffer()
                                while (fb.remaining() >= channels) {
                                    var s = 0f; repeat(channels) { s += fb.get() }; mono.add(s / channels)
                                }
                            } else {
                                val sb = buf.asShortBuffer()
                                while (sb.remaining() >= channels) {
                                    var s = 0f; repeat(channels) { s += sb.get() / 32768f }; mono.add(s / channels)
                                }
                            }
                            codec.releaseOutputBuffer(outIdx, false)
                            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
                            if (mono.size.toLong() * Wav.RATE / srcRate >= Wav.MAX_SAMPLES) { cut = true; outputDone = true }
                        }
                    }
                }
            } finally {
                runCatching { codec.stop() }
                codec.release()
            }
            val out = resample(mono, srcRate)
            val file = File(context.cacheDir, "voicemail-${System.currentTimeMillis()}.wav")
            Wav.write(file, out)
            return Decoded(file, out.size / Wav.RATE, cut)
        } finally {
            extractor.release()
        }
    }

    /** Linear-interpolation resample to 16 kHz, capped at 110 s. */
    private fun resample(src: FloatList, srcRate: Int): ShortArray {
        if (src.size == 0) throw IllegalArgumentException("That recording is empty.")
        val outLen = minOf((src.size.toLong() * Wav.RATE / srcRate).toInt(), Wav.MAX_SAMPLES)
        val ratio = srcRate.toDouble() / Wav.RATE
        return ShortArray(outLen) { i ->
            val pos = i * ratio
            val i0 = pos.toInt().coerceAtMost(src.size - 1)
            val i1 = (i0 + 1).coerceAtMost(src.size - 1)
            val frac = (pos - i0).toFloat()
            val v = src[i0] * (1 - frac) + src[i1] * frac
            (v.coerceIn(-1f, 1f) * 32767f).toInt().toShort()
        }
    }

    private class FloatList {
        private var data = FloatArray(1 shl 16)
        var size = 0
            private set
        fun add(v: Float) {
            if (size == data.size) data = data.copyOf(data.size * 2)
            data[size++] = v
        }
        operator fun get(i: Int) = data[i]
    }
}
