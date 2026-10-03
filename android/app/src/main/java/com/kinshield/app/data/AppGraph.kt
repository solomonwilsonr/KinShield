package com.kinshield.app.data

import android.content.Context
import com.kinshield.app.BuildConfig
import com.kinshield.app.lite.LiteModel
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/** Tiny manual dependency container (the app is small enough not to need DI framework). */
object AppGraph {
    lateinit var appContext: Context
        private set
    lateinit var api: KinShieldApi
        private set
    lateinit var connectivity: Connectivity
        private set
    lateinit var prefs: Prefs
        private set

    @Volatile private var lite: LiteModel? = null

    fun init(context: Context) {
        appContext = context.applicationContext
        val builder = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(35, TimeUnit.SECONDS)
            .writeTimeout(35, TimeUnit.SECONDS)
            .callTimeout(40, TimeUnit.SECONDS)
        if (BuildConfig.DEBUG) DebugNetwork.install(builder)
        api = KinShieldApi(BuildConfig.API_BASE_URL, builder.build())
        connectivity = Connectivity(appContext)
        prefs = Prefs(appContext)
    }

    /** KinShield-Lite model, loaded once from assets (about 120 KB of JSON). Call off the main thread. */
    fun lite(): LiteModel = lite ?: synchronized(this) {
        lite ?: LiteModel.fromJson(appContext.assets.open("lite_model.json").bufferedReader().use { it.readText() })
            .also { lite = it }
    }
}
