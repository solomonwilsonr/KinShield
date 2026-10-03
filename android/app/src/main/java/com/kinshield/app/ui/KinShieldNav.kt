package com.kinshield.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.kinshield.app.SharedPayload
import com.kinshield.app.ShareInbox
import com.kinshield.app.data.AppGraph
import com.kinshield.app.ui.about.AboutScreen
import com.kinshield.app.ui.common.OfflineBanner
import com.kinshield.app.ui.home.HomeScreen
import com.kinshield.app.ui.kinbot.KinBotScreen
import com.kinshield.app.ui.lite.LiteScreen
import com.kinshield.app.ui.settings.SettingsScreen
import com.kinshield.app.ui.voice.VoiceListScreen
import com.kinshield.app.ui.voice.VoicePlayerScreen

object Routes {
    const val HOME = "home"
    const val KINBOT = "kinbot"
    const val VOICE = "voice"
    const val VOICE_PLAY = "voice/{id}"
    const val LITE = "lite"
    const val ABOUT = "about"
    const val SETTINGS = "settings"
}

@Composable
fun KinShieldNav() {
    val nav = rememberNavController()
    val online by AppGraph.connectivity.online.collectAsStateWithLifecycle()
    val shared by ShareInbox.pending.collectAsStateWithLifecycle()

    // Anything shared into the app opens KinBot, which runs the check.
    LaunchedEffect(shared) {
        if (shared != null && nav.currentDestination?.route != Routes.KINBOT) {
            nav.navigate(Routes.KINBOT) { launchSingleTop = true; popUpTo(Routes.HOME) }
        }
    }

    Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            if (!online) OfflineBanner(Modifier.windowInsetsPadding(WindowInsets.statusBars))
            NavHost(
                navController = nav,
                startDestination = Routes.HOME,
                modifier = Modifier.weight(1f).then(if (!online) Modifier.consumeWindowInsets(WindowInsets.statusBars) else Modifier),
            ) {
                composable(Routes.HOME) {
                    HomeScreen(
                        onKinBot = { nav.navigate(Routes.KINBOT) },
                        onVoice = { nav.navigate(Routes.VOICE) },
                        onLite = { nav.navigate(Routes.LITE) },
                        onAbout = { nav.navigate(Routes.ABOUT) },
                        onSettings = { nav.navigate(Routes.SETTINGS) },
                    )
                }
                composable(Routes.KINBOT) { KinBotScreen(onBack = { nav.popBackStack() }) }
                composable(Routes.VOICE) { VoiceListScreen(onBack = { nav.popBackStack() }, onOpen = { nav.navigate("voice/$it") }) }
                composable(Routes.VOICE_PLAY, arguments = listOf(navArgument("id") { type = NavType.StringType })) {
                    VoicePlayerScreen(onBack = { nav.popBackStack() })
                }
                composable(Routes.LITE) {
                    LiteScreen(onBack = { nav.popBackStack() }, onFullCheck = { text -> ShareInbox.post(SharedPayload(text = text)) })
                }
                composable(Routes.ABOUT) { AboutScreen(onBack = { nav.popBackStack() }) }
                composable(Routes.SETTINGS) { SettingsScreen(onBack = { nav.popBackStack() }) }
            }
        }
    }
}
