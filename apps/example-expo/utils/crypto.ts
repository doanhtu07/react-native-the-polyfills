import type { GetRandomValuesFn } from '@the-polyfills/get-random-values'

interface Crypto {
  getRandomValues: GetRandomValuesFn
}

export function getCrypto(): Crypto | null {
  const g = globalThis as any

  if (
    typeof g.crypto === 'object' &&
    g.crypto !== null &&
    typeof g.crypto.getRandomValues === 'function'
  ) {
    return g.crypto
  }

  return null
}
