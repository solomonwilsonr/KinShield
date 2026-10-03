package com.kinshield.app.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.core.graphics.scale
import java.io.ByteArrayOutputStream
import java.io.File

/** Screenshots are shrunk to at most 1600 px on the long side and sent as JPEG, like the web app does. */
object ImageEncoder {
    const val MAX_SIDE = 1600

    /** Copy a picked/shared image into app cache (so it survives rotation, retries and process death). */
    fun copyToCache(context: Context, uri: Uri): File {
        val out = File(context.cacheDir, "shot-${System.currentTimeMillis()}.img")
        context.contentResolver.openInputStream(uri)?.use { input -> out.outputStream().use { input.copyTo(it) } }
            ?: throw IllegalArgumentException("Couldn't open that image")
        return out
    }

    /** Returns a `data:image/jpeg;base64,...` URL. */
    fun toJpegDataUrl(file: File): String {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        require(bounds.outWidth > 0 && bounds.outHeight > 0) { "That file isn't a picture KinBot can read." }
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SIDE) sample *= 2
        val decoded = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: throw IllegalArgumentException("That file isn't a picture KinBot can read.")
        val longSide = maxOf(decoded.width, decoded.height)
        val bmp = if (longSide > MAX_SIDE) {
            val k = MAX_SIDE.toFloat() / longSide
            decoded.scale((decoded.width * k).toInt(), (decoded.height * k).toInt())
        } else decoded
        val bytes = ByteArrayOutputStream().use { bos ->
            bmp.compress(Bitmap.CompressFormat.JPEG, 85, bos)
            bos.toByteArray()
        }
        return "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
    }
}
