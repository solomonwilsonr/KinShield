package com.kinshield.app.media

import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** 16 kHz, mono, 16-bit PCM WAV: the format the KinBot voicemail route expects (max 110 s). */
object Wav {
    const val RATE = 16_000
    const val MAX_SECONDS = 110
    const val MAX_SAMPLES = RATE * MAX_SECONDS

    fun write(file: File, samples: ShortArray, count: Int = samples.size) {
        val dataLen = count * 2
        val buf = ByteBuffer.allocate(44 + dataLen).order(ByteOrder.LITTLE_ENDIAN)
        buf.put("RIFF".toByteArray()); buf.putInt(36 + dataLen); buf.put("WAVE".toByteArray())
        buf.put("fmt ".toByteArray()); buf.putInt(16); buf.putShort(1); buf.putShort(1)
        buf.putInt(RATE); buf.putInt(RATE * 2); buf.putShort(2); buf.putShort(16)
        buf.put("data".toByteArray()); buf.putInt(dataLen)
        for (i in 0 until count) buf.putShort(samples[i])
        file.writeBytes(buf.array())
    }

    fun seconds(file: File): Int = ((file.length() - 44).coerceAtLeast(0) / (RATE * 2)).toInt()
}
