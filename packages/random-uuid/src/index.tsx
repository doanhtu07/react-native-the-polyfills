import { randomUUID } from './utils/random-uuid'

export { randomUUID } from './utils/random-uuid'
export type { RandomUuidFn } from './utils/random-uuid'
export { stringify } from './utils/stringify'
export { UUID_V4_REGEX } from './utils/random-uuid'

export function installRandomUuid(options?: { force?: boolean }): void {
  const g = globalThis as any

  if (typeof g.crypto !== 'object' || g.crypto === null) {
    g.crypto = {}
  }

  if (options?.force || typeof g.crypto.randomUUID !== 'function') {
    g.crypto.randomUUID = randomUUID
  }
}

// Side-effect import installs the polyfill, matching
// `react-native-random-uuid` behavior.
installRandomUuid()
