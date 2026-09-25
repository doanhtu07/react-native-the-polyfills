import { Platform } from 'react-native'

import { MAX_BYTE_LENGTH } from '../constants'
import { getNativeGetRandomValues } from '../NativeGetRandomValues'
import { base64ToBytes } from './base64-decode'
import { isRemoteDebuggingInChrome } from './chrome'
import { insecureRandomValues } from './insecure-random-values'

function isAllowedArray(value: unknown): value is ArrayBufferView {
  if (!ArrayBuffer.isView(value) || value instanceof DataView) {
    return false
  }

  // WebCrypto only allows integer TypedArrays (no float16/32/64).
  return (
    value instanceof Int8Array ||
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof Int16Array ||
    value instanceof Uint16Array ||
    value instanceof Int32Array ||
    value instanceof Uint32Array ||
    value instanceof BigInt64Array ||
    value instanceof BigUint64Array
  )
}

function getLinkingError(): Error {
  const iosHint = Platform.select({
    ios: "- You have run 'pod install'\n",
    default: '',
  })

  return new Error(
    `The package '@the-polyfills/get-random-values' doesn't seem to be linked. Make sure:\n\n` +
      iosHint +
      '- You rebuilt the app after installing the package\n' +
      '- You are not using Expo Go (this package requires a dev client or prebuild)',
  )
}

export type GetRandomValuesFn = <T extends ArrayBufferView>(array: T) => T

export function getRandomValues<T extends ArrayBufferView>(array: T): T {
  if (!isAllowedArray(array)) {
    throw new TypeError(
      'crypto.getRandomValues: expected an integer TypedArray (e.g. Uint8Array)',
    )
  }

  if (array.byteLength > MAX_BYTE_LENGTH) {
    // Browsers throw QuotaExceededError (DOMException). RN Hermes may not
    // have DOMException, so use a plain Error with the same name.
    const error = new Error(
      `crypto.getRandomValues: byteLength ${array.byteLength} exceeds ${MAX_BYTE_LENGTH}`,
    )
    error.name = 'QuotaExceededError'
    throw error
  }

  if (array.byteLength === 0) {
    return array
  }

  // 1. Expo SDK 48+: prefer ExpoCrypto when available so managed workflow
  // apps don't need our native module linked.

  const expoGetRandomValues = (globalThis as any)?.expo?.modules?.ExpoCrypto
    ?.getRandomValues as ((array: ArrayBufferView) => void) | undefined

  if (typeof expoGetRandomValues === 'function') {
    // ExpoCrypto mutates the array in place and returns void.
    expoGetRandomValues.call((globalThis as any).expo.modules.ExpoCrypto, array)
    return array
  }

  // 2. Remote debugging in Chrome can't call sync native methods
  // ("Calling synchronous methods on native modules is not supported in
  // Chrome"), so fall back to Math.random() there.
  if (isRemoteDebuggingInChrome()) {
    return insecureRandomValues(array)
  }

  // 3. Our own native module (blocking sync `getRandomBase64`).
  const native = getNativeGetRandomValues()

  // Note: loose equality (`== null`) intentionally covers both `null` and
  // `undefined` here.
  if (native == null) {
    throw getLinkingError()
  }

  const base64 = native.getRandomBase64(array.byteLength)
  const bytes = base64ToBytes(base64)

  if (bytes.byteLength !== array.byteLength) {
    throw new Error(
      `crypto.getRandomValues: native returned ${bytes.byteLength} bytes, expected ${array.byteLength}`,
    )
  }

  // Write through to the underlying buffer so BigInt arrays work too.
  new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(bytes)

  return array
}
