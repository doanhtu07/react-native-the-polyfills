package com.thepolyfills.randomuuid

import com.facebook.react.bridge.ReactApplicationContext
import java.util.UUID

class RandomUuidModule(reactContext: ReactApplicationContext) :
    NativeRandomUuidSpec(reactContext) {

    override fun getRandomUuid(): String {
        return UUID.randomUUID().toString()
    }

    companion object {
        const val NAME = NativeRandomUuidSpec.NAME
    }
}
