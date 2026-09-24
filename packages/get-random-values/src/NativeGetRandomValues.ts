import { TurboModuleRegistry, type TurboModule } from 'react-native'

let cachedSpec: Spec | null = null

export interface Spec extends TurboModule {
  getRandomBase64(byteLength: number): string
}

export function getNativeGetRandomValues(): Spec {
  if (cachedSpec == null) {
    cachedSpec = TurboModuleRegistry.getEnforcing<Spec>('GetRandomValues')
  }
  return cachedSpec
}
