import { getRandomValues } from './utils/get-random-values'

export { getRandomValues } from './utils/get-random-values'
export type { GetRandomValuesFn } from './utils/get-random-values'

export function installGetRandomValues(options?: { force?: boolean }): void {
  const g = globalThis as any

  if (typeof g.crypto !== 'object' || g.crypto === null) {
    g.crypto = {}
  }

  if (options?.force || typeof g.crypto.getRandomValues !== 'function') {
    g.crypto.getRandomValues = getRandomValues
  }
}

// Side-effect import installs the polyfill, matching
// `react-native-get-random-values` behavior.
installGetRandomValues()
