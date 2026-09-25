package com.thepolyfills.getrandomvalues

import android.util.Base64
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.SecureRandom

class GetRandomValuesModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    // Blocking synchronous method so `getRandomBase64` returns the value
    // directly, matching the synchronous WebCrypto API.
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getRandomBase64(byteLength: Double): String {
        val length = byteLength.toInt()

        if (length < 0) {
            throw IllegalArgumentException("byteLength must be >= 0")
        }

        if (length == 0) {
            return ""
        }

        val bytes = ByteArray(length)
        SecureRandom().nextBytes(bytes)

        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    companion object {
        const val NAME = "GetRandomValues"
    }
}
