package com.kinshield.app.media

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.coroutineContext

/**
 * Records from the microphone straight to 16 kHz mono PCM (so no conversion is needed), up to 110 s.
 * Meant for a voicemail played out loud on speaker. It cannot and does not capture phone-call audio.
 */
class VoiceRecorder(private val context: Context) {
    /** Records until [stop] is set (or 110 s pass) and returns the WAV; [onTick] gets elapsed seconds. */
    @SuppressLint("MissingPermission") // checked explicitly below
    suspend fun record(stop: AtomicBoolean, onTick: (Int) -> Unit): File = withContext(Dispatchers.IO) {
        check(ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            "Microphone permission is off"
        }
        val minBuf = AudioRecord.getMinBufferSize(Wav.RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val rec = AudioRecord(MediaRecorder.AudioSource.MIC, Wav.RATE, AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT, maxOf(minBuf, Wav.RATE))
        check(rec.state == AudioRecord.STATE_INITIALIZED) { "The microphone isn't available" }
        val samples = ShortArray(Wav.MAX_SAMPLES)
        var count = 0
        val chunk = ShortArray(Wav.RATE / 10)
        var lastTick = -1
        try {
            rec.startRecording()
            while (!stop.get() && coroutineContext.isActive && count < Wav.MAX_SAMPLES) {
                val n = rec.read(chunk, 0, minOf(chunk.size, Wav.MAX_SAMPLES - count))
                if (n < 0) break
                System.arraycopy(chunk, 0, samples, count, n)
                count += n
                val sec = count / Wav.RATE
                if (sec != lastTick) { lastTick = sec; onTick(sec) }
            }
        } finally {
            runCatching { rec.stop() }
            rec.release()
        }
        val file = File(context.cacheDir, "recording-${System.currentTimeMillis()}.wav")
        Wav.write(file, samples, count)
        file
    }
}
