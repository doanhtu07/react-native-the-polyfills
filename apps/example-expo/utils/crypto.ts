import type { GetRandomValuesFn } from '@the-polyfills/get-random-values'
import type { RandomUuidFn } from '@the-polyfills/random-uuid'

export function getCrypto(): GetRandomValuesFn | null {
  const g = globalThis as any

  if (
    typeof g.crypto === 'object' &&
    g.crypto !== null &&
    typeof g.crypto.getRandomValues === 'function'
  ) {
    return g.crypto.getRandomValues as GetRandomValuesFn
  }

  return null
}

export function getRandomUUID(): RandomUuidFn | null {
  const g = globalThis as any

  if (
    typeof g.crypto === 'object' &&
    g.crypto !== null &&
    typeof g.crypto.randomUUID === 'function'
  ) {
    return g.crypto.randomUUID as RandomUuidFn
  }

  return null
}
