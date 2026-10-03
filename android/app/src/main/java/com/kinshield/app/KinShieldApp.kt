package com.kinshield.app

import android.app.Application
import com.kinshield.app.data.AppGraph

class KinShieldApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AppGraph.init(this)
        KLog.d("App started (debug=${BuildConfig.DEBUG})")
    }
}
