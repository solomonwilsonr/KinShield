package com.kinshield.app

import android.util.Log

/** Logcat helper. Tag is always "KinShield"; debug/info lines are dropped in release builds. */
object KLog {
    const val TAG = "KinShield"
    fun d(msg: String) { if (BuildConfig.DEBUG) Log.d(TAG, msg) }
    fun i(msg: String) { if (BuildConfig.DEBUG) Log.i(TAG, msg) }
    fun w(msg: String, t: Throwable? = null) { Log.w(TAG, msg, t) }
    fun e(msg: String, t: Throwable? = null) { Log.e(TAG, msg, t) }
}
