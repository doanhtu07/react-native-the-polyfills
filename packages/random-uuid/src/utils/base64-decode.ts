import { BASE64_LOOKUP } from '../constants'

export function base64ToBytes(base64: string): Uint8Array {
  // Standard base64 (NO_WRAP on Android, no line breaks on iOS), may be padded.
  const clean = base64.replace(/\s/g, '')

  if (clean.length === 0) {
    return new Uint8Array(0)
  }

  if (clean.length % 4 !== 0) {
    throw new Error('Invalid base64 string length')
  }

  let padding = 0

  if (clean.endsWith('==')) {
    padding = 2
  } else if (clean.endsWith('=')) {
    padding = 1
  }

  const outputLength = (clean.length / 4) * 3 - padding
  const output = new Uint8Array(outputLength)

  let outIndex = 0

  for (let i = 0; i < clean.length; i += 4) {
    const a = BASE64_LOOKUP[clean.charCodeAt(i)] ?? -1

    const b = BASE64_LOOKUP[clean.charCodeAt(i + 1)] ?? -1

    const c =
      clean[i + 2] === '=' ? 0 : (BASE64_LOOKUP[clean.charCodeAt(i + 2)] ?? -1)

    const d =
      clean[i + 3] === '=' ? 0 : (BASE64_LOOKUP[clean.charCodeAt(i + 3)] ?? -1)

    if (a < 0 || b < 0 || c < 0 || d < 0) {
      throw new Error('Invalid base64 character')
    }

    const triplet = (a << 18) | (b << 12) | (c << 6) | d

    if (outIndex < outputLength) {
      output[outIndex++] = (triplet >> 16) & 0xff
    }

    if (outIndex < outputLength) {
      output[outIndex++] = (triplet >> 8) & 0xff
    }

    if (outIndex < outputLength) {
      output[outIndex++] = triplet & 0xff
    }
  }

  return output
}
