package com.kinshield.app

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Something shared into the app from another app (text, or an image already copied to cache). */
data class SharedPayload(val text: String? = null, val imagePath: String? = null, val error: String? = null, val id: Long = System.nanoTime())

object ShareInbox {
    private val _pending = MutableStateFlow<SharedPayload?>(null)
    val pending: StateFlow<SharedPayload?> = _pending.asStateFlow()

    fun post(p: SharedPayload) { _pending.value = p }
    fun consume(p: SharedPayload) { _pending.compareAndSet(p, null) }
}
