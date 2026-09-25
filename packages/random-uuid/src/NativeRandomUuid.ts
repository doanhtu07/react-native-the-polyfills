import { NativeModules } from 'react-native'

// Old Architecture (Paper) only: the native module is registered via
// RCT_EXPORT_MODULE / ReactPackage and looked up through NativeModules.
// There is intentionally no TurboModuleRegistry usage and no codegen spec
// in this package.
export interface Spec {
  getRandomUuid(): string
}

export function getNativeRandomUuid(): Spec | undefined {
  const native = NativeModules.RandomUuid as Spec | undefined

  // Note: loose equality (`== null`) intentionally covers both `null` and
  // `undefined` here.
  if (native == null || typeof native.getRandomUuid !== 'function') {
    return undefined
  }

  return native
}
