import { describe, expect, it } from '@jest/globals'

import { stringify } from '../utils/stringify'

describe('stringify', () => {
  it('formats 16 bytes as a hyphenated UUID string', () => {
    const data = new Uint8Array(16).map((_, i) => i)
    expect(stringify(data)).toBe('00010203-0405-0607-0809-0a0b0c0d0e0f')
  })

  it('formats all-zero and all-0xff bytes', () => {
    expect(stringify(new Uint8Array(16))).toBe(
      '00000000-0000-0000-0000-000000000000',
    )

    expect(stringify(new Uint8Array(16).fill(0xff))).toBe(
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
    )
  })
})
