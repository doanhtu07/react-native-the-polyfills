package com.thepolyfills.getrandomvalues

import com.facebook.react.bridge.ReactApplicationContext

class GetRandomValuesModule(reactContext: ReactApplicationContext) :
  NativeGetRandomValuesSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeGetRandomValuesSpec.NAME
  }
}
