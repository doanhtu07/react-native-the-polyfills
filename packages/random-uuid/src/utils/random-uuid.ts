import { NativeModules } from 'react-native'

import { getNativeRandomUuid } from '../NativeRandomUuid'
import { UUID_BYTE_LENGTH } from '../constants'
import { base64ToBytes } from './base64-decode'
import { isRemoteDebuggingInChrome } from './chrome'
import { insecureRandomValues } from './insecure-random-values'
import { stringify } from './stringify'

function applyVersionAndVariant(data: Uint8Array): Uint8Array {
  data[6] = (data[6]! & 0x0f) | 0x40
  data[8] = (data[8]! & 0x3f) | 0x80
  return data
}

function fromRandomBytes(randomBytes: Uint8Array): string {
  if (randomBytes.byteLength !== UUID_BYTE_LENGTH) {
    throw new Error(
      `crypto.randomUUID: expected ${UUID_BYTE_LENGTH} random bytes, got ${randomBytes.byteLength}`,
    )
  }

  return stringify(applyVersionAndVariant(randomBytes.slice()))
}

export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export type RandomUuidFn = () => string

export function randomUUID(): string {
  const g = globalThis as any

  const expoCrypto = g?.expo?.modules?.ExpoCrypto as
    | {
        randomUUID?: () => string
        getRandomValues?: (array: Uint8Array) => void
      }
    | undefined

  // 1. Expo SDK 48+: prefer ExpoCrypto when available so managed workflow
  // apps don't need our native module linked (mirrors
  // `@the-polyfills/get-random-values`).
  if (typeof expoCrypto?.randomUUID === 'function') {
    // ExpoCrypto.randomUUID() sometimes returns uppercase UUIDs, so convert
    // to lowercase like `LinusU/react-native-random-uuid` does.
    return expoCrypto.randomUUID().toLowerCase()
  }

  // 2. Host `crypto.getRandomValues` (web, or `@the-polyfills/get-random-values`
  // installed alongside) — mirrors `index.web.js` in the reference repo.
  const hostGetRandomValues = g?.crypto?.getRandomValues as
    ((array: Uint8Array) => Uint8Array) | undefined

  if (typeof hostGetRandomValues === 'function') {
    return fromRandomBytes(
      hostGetRandomValues(new Uint8Array(UUID_BYTE_LENGTH)),
    )
  }

  // 3. Expo SDK 48+ managed workflow: `ExpoCrypto.getRandomValues(array)`
  // mutates the array in place and returns void. Covers managed apps where
  // `ExpoCrypto.randomUUID` is unavailable.
  if (typeof expoCrypto?.getRandomValues === 'function') {
    const array = new Uint8Array(UUID_BYTE_LENGTH)
    expoCrypto.getRandomValues(array)
    return fromRandomBytes(array)
  }

  // 4. Expo SDK 41-47: `NativeModules.ExpoRandom.getRandomBase64String(16)`.
  const expoRandom = NativeModules.ExpoRandom as
    { getRandomBase64String?: (byteLength: number) => string } | undefined

  if (typeof expoRandom?.getRandomBase64String === 'function') {
    return fromRandomBytes(
      base64ToBytes(expoRandom.getRandomBase64String(UUID_BYTE_LENGTH)),
    )
  }

  // 5. Remote debugging in Chrome can't call sync native methods
  // ("Calling synchronous methods on native modules is not supported in
  // Chrome"), so fall back to Math.random() before touching our native
  // module below (mirrors `@the-polyfills/get-random-values`). This edge
  // case goes beyond `LinusU/react-native-random-uuid`, which throws its
  // linking error here.
  if (isRemoteDebuggingInChrome()) {
    return fromRandomBytes(
      insecureRandomValues(new Uint8Array(UUID_BYTE_LENGTH)),
    )
  }

  // 6. Our own native module (blocking sync `getRandomUuid`), mirroring
  // `LinusU/react-native-random-uuid` (`NativeModules.RandomUuid`).
  const native = getNativeRandomUuid()

  // Android `UUID.randomUUID()` is already lowercase; iOS explicitly
  // lowercases `NSUUID`. Normalize anyway for consistency.
  return native.getRandomUuid().toLowerCase()
}
