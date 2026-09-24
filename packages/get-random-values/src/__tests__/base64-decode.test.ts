import { beforeEach, describe, expect, it } from '@jest/globals'

import { base64ToBytes } from '../utils/base64-decode'

// Minimal Node Buffer access without adding `@types/node` to this package.
const NodeBuffer = (globalThis as any).Buffer as {
  from(
    data: Uint8Array | string,
    encoding?: string,
  ): Uint8Array & {
    toString(encoding: string): string
  }
}

function toBase64(bytes: Uint8Array): string {
  return NodeBuffer.from(bytes).toString('base64')
}

describe('base64ToBytes', () => {
  beforeEach(() => {
    // No global state; oracle is Node Buffer (standard base64, same as
    // NO_WRAP Android / no-line-break iOS native output).
  })

  it('decodes empty string to empty array', () => {
    expect(base64ToBytes('')).toEqual(new Uint8Array(0))
  })

  it('decodes known vectors incl. padding', () => {
    // 'Hello' -> 5 bytes -> 1 padding char
    expect(Array.from(base64ToBytes('SGVsbG8='))).toEqual([
      72, 101, 108, 108, 111,
    ])

    // 1 byte -> '=='
    expect(Array.from(base64ToBytes('TQ=='))).toEqual([77])

    // 2 bytes -> '='
    expect(Array.from(base64ToBytes('TWE='))).toEqual([77, 97])

    // 3 bytes -> no padding
    expect(Array.from(base64ToBytes('TWFu'))).toEqual([77, 97, 110])
  })

  it('matches Buffer oracle for binary lengths 0..64 and full byte range', () => {
    for (let length = 0; length <= 64; length++) {
      const bytes = new Uint8Array(length).map((_, i) => (i * 37 + 11) % 256)
      expect(base64ToBytes(toBase64(bytes))).toEqual(bytes)
    }

    const allBytes = new Uint8Array(256).map((_, i) => i)

    // Exercises '+' and '/' alphabet codes.
    expect(base64ToBytes(toBase64(allBytes))).toEqual(allBytes)
  })

  it('strips whitespace/newlines', () => {
    expect(Array.from(base64ToBytes('SGVs\nbG8='))).toEqual([
      72, 101, 108, 108, 111,
    ])

    expect(Array.from(base64ToBytes(' SGVs bG8= '))).toEqual([
      72, 101, 108, 108, 111,
    ])
  })

  it('throws on non-multiple-of-4 length', () => {
    expect(() => base64ToBytes('ABC')).toThrow('Invalid base64 string length')
    expect(() => base64ToBytes('ABCDE')).toThrow('Invalid base64 string length')
  })

  it('throws on invalid characters', () => {
    expect(() => base64ToBytes('!!!!')).toThrow('Invalid base64 character')
    expect(() => base64ToBytes('AB*C')).toThrow('Invalid base64 character')
  })
})
