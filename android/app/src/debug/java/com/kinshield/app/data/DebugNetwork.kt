package com.kinshield.app.data

import com.kinshield.app.KLog
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor

/** Debug builds only: log request lines and status codes (BASIC never logs bodies, so pasted messages stay out of Logcat). */
object DebugNetwork {
    fun install(builder: OkHttpClient.Builder) {
        val logger = HttpLoggingInterceptor { KLog.d("http: $it") }.apply { level = HttpLoggingInterceptor.Level.BASIC }
        builder.addInterceptor(logger)
    }
}
