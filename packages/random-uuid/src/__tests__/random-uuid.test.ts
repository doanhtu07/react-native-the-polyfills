import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import { NativeModules } from 'react-native'

import * as NativeModule from '../NativeRandomUuid'
import * as Chrome from '../utils/chrome'
import { UUID_V4_REGEX, randomUUID } from '../utils/random-uuid'

// Minimal Node Buffer access without adding `@types/node` to this package.
const NodeBuffer = (globalThis as any).Buffer as {
  from(
    data: Uint8Array | string,
    encoding?: string,
  ): Uint8Array & {
    toString(encoding: string): string
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  return NodeBuffer.from(bytes).toString('base64')
}

function bytes0to15(): Uint8Array {
  return new Uint8Array(16).map((_, i) => i)
}

describe('randomUUID', () => {
  const g = globalThis as any

  let nativeSpy: ReturnType<typeof jest.spyOn>
  let chromeSpy: ReturnType<typeof jest.spyOn>
  let warnSpy: ReturnType<typeof jest.spyOn>
  let savedExpo: unknown
  let hadExpo: boolean
  let savedCrypto: unknown
  let hadCrypto: boolean

  beforeEach(() => {
    hadExpo = 'expo' in g
    savedExpo = g.expo
    delete g.expo

    // Neutralize Node's host `crypto.getRandomValues` so fallback priority
    // is fully controlled by each test.
    hadCrypto = 'crypto' in g
    savedCrypto = g.crypto
    g.crypto = {}

    delete (NativeModules as any).ExpoRandom

    // Default: native module linked, not remote debugging.
    nativeSpy = jest
      .spyOn(NativeModule, 'getNativeRandomUuid')
      .mockReturnValue({
        getRandomUuid: () => '00000000-0000-4000-8000-000000000000',
      })

    chromeSpy = jest
      .spyOn(Chrome, 'isRemoteDebuggingInChrome')
      .mockReturnValue(false)

    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    nativeSpy.mockRestore()
    chromeSpy.mockRestore()
    warnSpy.mockRestore()

    if (hadExpo) {
      g.expo = savedExpo
    } else {
      delete g.expo
    }

    if (hadCrypto) {
      g.crypto = savedCrypto
    } else {
      delete g.crypto
    }

    delete (NativeModules as any).ExpoRandom
    jest.restoreAllMocks()
  })

  it('returns the native UUID', () => {
    expect(randomUUID()).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('lowercases native UUIDs', () => {
    nativeSpy.mockReturnValue({
      getRandomUuid: () => 'A1B2C3D4-E5F6-4A7B-8C9D-E0F1A2B3C4D5',
    })

    expect(randomUUID()).toBe('a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5')
  })

  it('prefers ExpoCrypto.randomUUID over native', () => {
    const nativeGetRandomUuid = jest.fn(
      () => '00000000-0000-4000-8000-000000000000',
    )
    nativeSpy.mockReturnValue({ getRandomUuid: nativeGetRandomUuid })

    const expoRandomUUID = jest.fn(() => '11111111-1111-4111-8111-111111111111')
    g.expo = { modules: { ExpoCrypto: { randomUUID: expoRandomUUID } } }

    expect(randomUUID()).toBe('11111111-1111-4111-8111-111111111111')
    expect(nativeGetRandomUuid).not.toHaveBeenCalled()
  })

  it('uses ExpoCrypto.randomUUID (SDK 48+) and lowercases it', () => {
    nativeSpy.mockReturnValue(undefined)

    g.expo = {
      modules: {
        ExpoCrypto: {
          randomUUID: () => 'A1B2C3D4-E5F6-4A7B-8C9D-E0F1A2B3C4D5',
        },
      },
    }

    expect(randomUUID()).toBe('a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5')
  })

  it('uses host crypto.getRandomValues with v4 version/variant bits', () => {
    nativeSpy.mockReturnValue(undefined)

    g.crypto.getRandomValues = (array: Uint8Array) => {
      array.set(bytes0to15())
      return array
    }

    // bytes[6] 0x06 -> 0x46 (version 4), bytes[8] 0x08 -> 0x88 (variant).
    expect(randomUUID()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })

  it('uses ExpoCrypto.getRandomValues (managed workflow)', () => {
    nativeSpy.mockReturnValue(undefined)

    g.expo = {
      modules: {
        ExpoCrypto: {
          getRandomValues: jest.fn((array: Uint8Array) => {
            array.set(bytes0to15())
          }),
        },
      },
    }

    expect(randomUUID()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
    expect(g.expo.modules.ExpoCrypto.getRandomValues).toHaveBeenCalledTimes(1)
  })

  it('uses legacy ExpoRandom base64 (SDK 41-47)', () => {
    nativeSpy.mockReturnValue(undefined)

    ;(NativeModules as any).ExpoRandom = {
      getRandomBase64String: () => bytesToBase64(bytes0to15()),
    }

    expect(randomUUID()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })

  it('throws when ExpoRandom returns a mismatched length', () => {
    nativeSpy.mockReturnValue(undefined)

    ;(NativeModules as any).ExpoRandom = {
      getRandomBase64String: () => bytesToBase64(new Uint8Array([1, 2])),
    }

    expect(() => randomUUID()).toThrow(/expected 16/)
  })

  it('falls back to Math.random in remote debugging without calling native', () => {
    // Native stays linked: the insecure fallback must win anyway, since
    // calling sync native methods throws in Chrome remote debugging.
    const nativeGetRandomUuid = jest.fn(
      () => '00000000-0000-4000-8000-000000000000',
    )
    nativeSpy.mockReturnValue({ getRandomUuid: nativeGetRandomUuid })
    chromeSpy.mockReturnValue(true)

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5)

    try {
      // 0.5 * 0x100000000 = 0x80000000 -> LE bytes [0x00, 0x00, 0x00, 0x80]
      // per word, then version/variant bits on bytes[6]/bytes[8].
      expect(randomUUID()).toBe('00000080-0000-4080-8000-008000000080')
      expect(nativeGetRandomUuid).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      randomSpy.mockRestore()
    }
  })

  it('throws a linking error when no source is available', () => {
    nativeSpy.mockReturnValue(undefined)
    expect(() => randomUUID()).toThrow(/doesn't seem to be linked/)
  })

  it('generates valid v4 UUIDs from random bytes', () => {
    nativeSpy.mockReturnValue(undefined)

    for (let i = 0; i < 10; i++) {
      const seed = i

      g.crypto.getRandomValues = (array: Uint8Array) => {
        for (let j = 0; j < array.length; j++) {
          array[j] = (j * 37 + seed * 101 + 11) % 256
        }

        return array
      }

      expect(randomUUID()).toMatch(UUID_V4_REGEX)
    }
  })
})
