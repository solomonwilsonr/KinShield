package com.kinshield.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// Website palette (web/src/styles.css). Red is reserved for risk.
val Brand = Color(0xFF5EBE6A)
val BrandDeep = Color(0xFF23863D)
val Mint = Color(0xFFA2F1A9)
val Ink = Color(0xFF001123)
val Paper = Color(0xFFF3F5F4)
val RiskHigh = Color(0xFFC62828)
val RiskHighBg = Color(0xFFFDECEC)
val RiskMed = Color(0xFF9A6100)
val RiskMedBg = Color(0xFFFFF4DC)
val RiskLow = BrandDeep
val RiskLowBg = Color(0xFFE6F8E8)

private val Light = lightColorScheme(
    primary = BrandDeep,
    onPrimary = Color.White,
    primaryContainer = Mint,
    onPrimaryContainer = Ink,
    secondary = Brand,
    onSecondary = Ink,
    secondaryContainer = Color(0xFFDDF5DF),
    onSecondaryContainer = Ink,
    background = Color.White,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Paper,
    onSurfaceVariant = Color(0xFF3B4A57),
    surfaceContainer = Paper,
    surfaceContainerLow = Color(0xFFF8FAF9),
    surfaceContainerHigh = Color(0xFFEAEFEC),
    outline = Color(0xFF8A97A0),
    outlineVariant = Color(0xFFD5DDD8),
    error = RiskHigh,
    onError = Color.White,
)

private val Dark = darkColorScheme(
    primary = Mint,
    onPrimary = Ink,
    primaryContainer = BrandDeep,
    onPrimaryContainer = Color.White,
    secondary = Brand,
    onSecondary = Ink,
    secondaryContainer = Color(0xFF1C3A28),
    onSecondaryContainer = Color.White,
    background = Ink,
    onBackground = Color(0xFFE8EEF2),
    surface = Ink,
    onSurface = Color(0xFFE8EEF2),
    surfaceVariant = Color(0xFF14283A),
    onSurfaceVariant = Color(0xFFB9C6CF),
    surfaceContainer = Color(0xFF0B1F33),
    surfaceContainerLow = Color(0xFF07192B),
    surfaceContainerHigh = Color(0xFF14283A),
    outline = Color(0xFF6B7A86),
    outlineVariant = Color(0xFF243A4D),
    error = Color(0xFFFF8A80),
    onError = Ink,
)

private val Type = Typography().let { t ->
    t.copy(
        displaySmall = t.displaySmall.copy(fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.5).sp),
        headlineMedium = t.headlineMedium.copy(fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.3).sp),
        headlineSmall = t.headlineSmall.copy(fontWeight = FontWeight.Bold),
        titleLarge = t.titleLarge.copy(fontWeight = FontWeight.Bold),
        titleMedium = t.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        bodyLarge = t.bodyLarge.copy(fontSize = 17.sp, lineHeight = 25.sp),
        labelLarge = t.labelLarge.copy(fontWeight = FontWeight.SemiBold, fontSize = 15.sp),
    )
}

val MonoLabel = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp)

@Composable
fun KinShieldTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) Dark else Light,
        typography = Type,
        shapes = Shapes(
            small = RoundedCornerShape(10.dp),
            medium = RoundedCornerShape(16.dp),
            large = RoundedCornerShape(22.dp),
        ),
        content = content,
    )
}
