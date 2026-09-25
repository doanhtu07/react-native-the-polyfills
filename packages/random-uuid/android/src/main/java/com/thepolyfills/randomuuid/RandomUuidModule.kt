package com.thepolyfills.randomuuid

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.UUID

class RandomUuidModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    // Blocking synchronous method so `getRandomUuid` returns the value
    // directly, matching the synchronous WebCrypto API.
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getRandomUuid(): String {
        return UUID.randomUUID().toString()
    }

    companion object {
        const val NAME = "RandomUuid"
    }
}
