package com.kinshield.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.kinshield.app.media.ImageEncoder
import com.kinshield.app.ui.KinShieldNav
import com.kinshield.app.ui.theme.KinShieldTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        Notifier.ensureChannel(this)
        // Only on a fresh start: after rotation or process death the share was already handled and its result restored.
        if (savedInstanceState == null) handleShare(intent)
        setContent { KinShieldTheme { KinShieldNav() } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleShare(intent)
    }

    private fun handleShare(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND) return
        val type = intent.type ?: return
        when {
            type.startsWith("text/") -> {
                val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim()
                if (!text.isNullOrEmpty()) {
                    KLog.d("share: text (${text.length} chars)")
                    ShareInbox.post(SharedPayload(text = text))
                }
            }
            type.startsWith("image/") -> {
                val uri = streamUri(intent) ?: return
                // Copy now, while this activity holds the read grant for the shared URI.
                lifecycleScope.launch {
                    val path = withContext(Dispatchers.IO) {
                        runCatching { ImageEncoder.copyToCache(this@MainActivity, uri).path }
                            .onFailure { KLog.w("share: couldn't read image", it) }.getOrNull()
                    }
                    ShareInbox.post(if (path != null) SharedPayload(imagePath = path) else SharedPayload(error = "KinBot couldn't open the shared picture. Try saving it and attaching it with the picture button instead."))
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun streamUri(intent: Intent): Uri? =
        if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        else intent.getParcelableExtra(Intent.EXTRA_STREAM)
}
