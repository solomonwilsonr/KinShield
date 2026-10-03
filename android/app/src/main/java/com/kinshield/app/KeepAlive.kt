package com.kinshield.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.MainThread
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Keeps the process allowed to use the network while a check or a practice call is running and the user switches
 * away. Android 15+ blocks network access for cached background processes, so without this a check started in
 * KinBot (or a KinVoice call) fails a few seconds after the user leaves the app.
 *
 * Uses a short foreground service (type shortService on Android 14+, a few minutes at most) with a quiet notification.
 */
object KeepAlive {
    private var count = 0
    internal val active = MutableStateFlow(false)
    private val main = Handler(Looper.getMainLooper())

    @MainThread
    fun acquire(context: Context) {
        count++
        if (active.value) return
        active.value = true
        try {
            ContextCompat.startForegroundService(context, Intent(context, BusyService::class.java))
        } catch (e: Exception) { // e.g. ForegroundServiceStartNotAllowedException when already in the background
            KLog.w("keep-alive service not started", e)
            active.value = false
        }
    }

    /** Stops the service shortly after the last user releases it, so back-to-back calls share one service. */
    @MainThread
    fun release() {
        if (count > 0) count--
        main.postDelayed({ if (count == 0) active.value = false }, 1500)
    }
}

class BusyService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.channel_busy), NotificationManager.IMPORTANCE_LOW))
        }
        val n: Notification = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.busy_title))
            .setOngoing(true)
            .setSilent(true)
            .build()
        // startForeground must happen right away, even if the work already finished, or Android stops the app.
        ServiceCompat.startForeground(this, NOTIFICATION_ID, n,
            if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE else 0)
        scope.launch {
            KeepAlive.active.first { !it }
            ServiceCompat.stopForeground(this@BusyService, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = START_NOT_STICKY

    /** Android 14+ ends a shortService after a few minutes; nothing KinShield does runs that long. */
    override fun onTimeout(startId: Int) {
        KeepAlive.active.value = false
        stopSelf()
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private companion object {
        const val CHANNEL = "kinshield_busy"
        const val NOTIFICATION_ID = 7
    }
}
