import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

describe('insecureRandomValues', () => {
  let warnSpy: ReturnType<typeof jest.spyOn>
  let randomSpy: ReturnType<typeof jest.spyOn>

  beforeEach(() => {
    jest.resetModules()
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    randomSpy?.mockRestore()
  })

  it('warns only once across calls', async () => {
    const { insecureRandomValues } =
      await import('../utils/insecure-random-values')

    insecureRandomValues(new Uint8Array(4))
    insecureRandomValues(new Uint8Array(4))

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/insecure random/)
  })

  it('returns the same array reference', async () => {
    const { insecureRandomValues } =
      await import('../utils/insecure-random-values')
    const array = new Uint8Array(8)
    expect(insecureRandomValues(array)).toBe(array)
  })

  it('fills bytes little-endian from each Math.random() word', async () => {
    const { insecureRandomValues } =
      await import('../utils/insecure-random-values')

    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5)

    // 0.5 * 0x100000000 = 0x80000000 -> bytes [0x00, 0x00, 0x00, 0x80] LE
    const array = new Uint8Array(8)

    insecureRandomValues(array)
    expect(Array.from(array)).toEqual([0, 0, 0, 0x80, 0, 0, 0, 0x80])
  })

  it('fills through the byte view so Uint16Array and offsets work', async () => {
    const { insecureRandomValues } =
      await import('../utils/insecure-random-values')

    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5)

    const u16 = new Uint16Array(2)
    insecureRandomValues(u16)

    // 4 bytes written -> both 16-bit lanes filled, not just low bytes.
    expect(Array.from(new Uint8Array(u16.buffer))).toEqual([0, 0, 0, 0x80])

    const buffer = new ArrayBuffer(8)
    const view = new Uint8Array(buffer, 2, 4)

    insecureRandomValues(view)
    expect(Array.from(new Uint8Array(buffer))).toEqual([
      0, 0, 0, 0, 0, 0x80, 0, 0,
    ])
  })

  it('supports BigInt arrays without throwing', async () => {
    const { insecureRandomValues } =
      await import('../utils/insecure-random-values')

    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5)

    const array = new BigUint64Array(1)

    expect(() => insecureRandomValues(array)).not.toThrow()
    expect(Array.from(new Uint8Array(array.buffer))).toEqual([
      0, 0, 0, 0x80, 0, 0, 0, 0x80,
    ])
  })
})
