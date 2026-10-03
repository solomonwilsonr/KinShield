package com.kinshield.app.data

import android.content.Context
import androidx.core.content.edit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class Settings(
    val autoInvestigate: Boolean = true,
    val showLite: Boolean = true,
    val alertsEnabled: Boolean = true,
)

/** User settings in SharedPreferences (this device only, excluded from backup). */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("kinshield_settings", Context.MODE_PRIVATE)
    private val _settings = MutableStateFlow(read())
    val settings: StateFlow<Settings> = _settings.asStateFlow()

    private fun read() = Settings(
        autoInvestigate = sp.getBoolean("auto_investigate", true),
        showLite = sp.getBoolean("show_lite", true),
        alertsEnabled = sp.getBoolean("alerts_enabled", true),
    )

    fun update(s: Settings) {
        sp.edit {
            putBoolean("auto_investigate", s.autoInvestigate)
            putBoolean("show_lite", s.showLite)
            putBoolean("alerts_enabled", s.alertsEnabled)
        }
        _settings.value = s
    }
}
