package com.kinshield.app.data

import okhttp3.OkHttpClient

/** Release builds: no HTTP logging at all. */
object DebugNetwork {
    @Suppress("UNUSED_PARAMETER")
    fun install(builder: OkHttpClient.Builder) = Unit
}
