import { NativeModules } from 'react-native'

// Old Architecture (Paper) only: the native module is registered via
// RCT_EXPORT_MODULE / ReactPackage and looked up through NativeModules.
// There is intentionally no TurboModuleRegistry usage and no codegen spec
// in this package.
export interface Spec {
  getRandomBase64(byteLength: number): string
}

export function getNativeGetRandomValues(): Spec {
  const native = NativeModules.GetRandomValues as Spec | undefined

  if (native == null || typeof native.getRandomBase64 !== 'function') {
    throw new Error(
      "Native module 'GetRandomValues' not found. Rebuild the app after installing the package (e.g. `expo prebuild --clean`).",
    )
  }

  return native
}
