import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

import { MAX_BYTE_LENGTH } from '../constants'
import * as NativeModule from '../NativeGetRandomValues'
import * as Chrome from '../utils/chrome'
import { getRandomValues } from '../utils/get-random-values'

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

describe('getRandomValues', () => {
  const g = globalThis as any

  let nativeSpy: ReturnType<typeof jest.spyOn>
  let chromeSpy: ReturnType<typeof jest.spyOn>
  let savedExpo: unknown
  let hadExpo: boolean

  beforeEach(() => {
    hadExpo = 'expo' in g
    savedExpo = g.expo
    delete g.expo

    // Default: not remote debugging; native returns zero bytes of requested size.

    chromeSpy = jest
      .spyOn(Chrome, 'isRemoteDebuggingInChrome')
      .mockReturnValue(false)

    nativeSpy = jest
      .spyOn(NativeModule, 'getNativeGetRandomValues')
      .mockReturnValue({
        getRandomBase64: (byteLength: number) =>
          bytesToBase64(new Uint8Array(byteLength)),
      } as NativeModule.Spec)
  })

  afterEach(() => {
    nativeSpy.mockRestore()
    chromeSpy.mockRestore()

    if (hadExpo) {
      g.expo = savedExpo
    } else {
      delete g.expo
    }

    jest.restoreAllMocks()
  })

  it.each([
    ['DataView', () => new DataView(new ArrayBuffer(8))],
    ['Float32Array', () => new Float32Array(4)],
    ['Float64Array', () => new Float64Array(4)],
    ['plain Array', () => [1, 2, 3]],
    ['null', () => null],
    ['undefined', () => undefined],
    ['object', () => ({ length: 4 })],
    ['ArrayBuffer', () => new ArrayBuffer(8)],
  ])('rejects %s with TypeError', (_name, make) => {
    expect(() => getRandomValues(make() as any)).toThrow(TypeError)
  })

  it.each([
    ['Int8Array', () => new Int8Array(4)],
    ['Uint8Array', () => new Uint8Array(4)],
    ['Uint8ClampedArray', () => new Uint8ClampedArray(4)],
    ['Int16Array', () => new Int16Array(4)],
    ['Uint16Array', () => new Uint16Array(4)],
    ['Int32Array', () => new Int32Array(4)],
    ['Uint32Array', () => new Uint32Array(4)],
    ['BigInt64Array', () => new BigInt64Array(2)],
    ['BigUint64Array', () => new BigUint64Array(2)],
  ])('accepts %s and returns the same reference', (_name, make) => {
    const array = make() as any
    expect(getRandomValues(array)).toBe(array)
  })

  it('enforces the 65536-byte quota on byteLength, not length', () => {
    expect(MAX_BYTE_LENGTH).toBe(65_536)

    const over = new Uint8Array(MAX_BYTE_LENGTH + 1)

    try {
      getRandomValues(over)
      throw new Error('should have thrown')
    } catch (e: any) {
      expect(e?.name).toBe('QuotaExceededError')
      expect(String(e?.message)).toMatch(/65537/)
    }

    // length 40_000 but byteLength 80_000 -> must throw.
    const u16 = new Uint16Array(40_000)

    expect(u16.length).toBe(40_000)
    expect(u16.byteLength).toBe(80_000)
    expect(() => getRandomValues(u16 as any)).toThrow(
      expect.objectContaining({ name: 'QuotaExceededError' }),
    )

    // Boundary passes (native mocked).
    expect(getRandomValues(new Uint8Array(MAX_BYTE_LENGTH))).toHaveLength(
      MAX_BYTE_LENGTH,
    )
  })

  it('short-circuits zero-length arrays without touching native/expo', () => {
    const expoFn = jest.fn()
    g.expo = { modules: { ExpoCrypto: { getRandomValues: expoFn } } }

    const array = new Uint8Array(0)

    expect(getRandomValues(array)).toBe(array)
    expect(nativeSpy).not.toHaveBeenCalled()
    expect(expoFn).not.toHaveBeenCalled()
  })

  it('fills from native base64 and passes byteLength through', () => {
    const wanted = new Uint8Array([1, 2, 3, 255])

    nativeSpy.mockReturnValue({
      getRandomBase64: jest.fn(() => bytesToBase64(wanted)),
    } as any)

    const array = new Uint8Array(4)

    expect(getRandomValues(array)).toBe(array)
    expect(array).toEqual(wanted)
    expect(
      (nativeSpy.mock.results[0]?.value as NativeModule.Spec).getRandomBase64,
    ).toBeDefined()
  })

  it('writes through buffer offsets without clobbering neighbours', () => {
    const wanted = new Uint8Array([9, 8, 7, 6])

    nativeSpy.mockReturnValue({
      getRandomBase64: () => bytesToBase64(wanted),
    } as any)

    const buffer = new ArrayBuffer(8)
    new Uint8Array(buffer).fill(0xaa)

    const view = new Uint8Array(buffer, 2, 4)

    expect(getRandomValues(view)).toBe(view)
    expect(Array.from(new Uint8Array(buffer))).toEqual([
      0xaa, 0xaa, 9, 8, 7, 6, 0xaa, 0xaa,
    ])
  })

  it('supports BigInt arrays via byte write-through', () => {
    const wanted = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])

    nativeSpy.mockReturnValue({
      getRandomBase64: () => bytesToBase64(wanted),
    } as any)

    const array = new BigUint64Array(1)

    expect(getRandomValues(array)).toBe(array)
    expect(Array.from(new Uint8Array(array.buffer))).toEqual(Array.from(wanted))
  })

  it('throws when native returns a mismatched length', () => {
    nativeSpy.mockReturnValue({
      getRandomBase64: () => bytesToBase64(new Uint8Array([1, 2])),
    } as any)

    expect(() => getRandomValues(new Uint8Array(4))).toThrow(/expected 4/)
  })

  it('prefers ExpoCrypto and preserves its receiver, skipping native', () => {
    const expoModule = {
      marker: 'expo',
      getRandomValues: jest.fn(function (this: any, array: Uint8Array) {
        expect(this.marker).toBe('expo')
        array.fill(0x5a)
      }),
    }

    g.expo = { modules: { ExpoCrypto: expoModule } }

    const array = new Uint8Array(4)

    expect(getRandomValues(array)).toBe(array)
    expect(array).toEqual(new Uint8Array([0x5a, 0x5a, 0x5a, 0x5a]))
    expect(expoModule.getRandomValues).toHaveBeenCalledTimes(1)
    expect(nativeSpy).not.toHaveBeenCalled()
  })

  it('falls back to Math.random in remote debugging without calling native', () => {
    chromeSpy.mockReturnValue(true)

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5)
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const array = new Uint8Array(4)
      expect(getRandomValues(array)).toBe(array)
      expect(Array.from(array)).toEqual([0, 0, 0, 0x80])
      expect(nativeSpy).not.toHaveBeenCalled()
    } finally {
      randomSpy.mockRestore()
      warnSpy.mockRestore()
    }
  })
})
