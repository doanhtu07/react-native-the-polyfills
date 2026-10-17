package com.thepolyfills.streamingfetch

import com.facebook.react.bridge.ReactApplicationContext

class StreamingFetchModule(reactContext: ReactApplicationContext) :
  NativeStreamingFetchSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeStreamingFetchSpec.NAME
  }
}
