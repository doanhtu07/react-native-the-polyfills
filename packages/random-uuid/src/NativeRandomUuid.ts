import { TurboModuleRegistry, type TurboModule } from 'react-native'

let cachedSpec: Spec | null = null

export interface Spec extends TurboModule {
  getRandomUuid(): string
}

export function getNativeRandomUuid(): Spec {
  // Note: loose equality (`== null`) intentionally covers both `null` and
  // `undefined` here.
  if (cachedSpec == null) {
    cachedSpec = TurboModuleRegistry.getEnforcing<Spec>('RandomUuid')
  }

  return cachedSpec
}
