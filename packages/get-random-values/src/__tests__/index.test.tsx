import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

import { installGetRandomValues } from '../index'
import { getRandomValues } from '../utils/get-random-values'

describe('installGetRandomValues', () => {
  const g = globalThis as any
  let savedCrypto: unknown
  let hadCrypto: boolean

  beforeEach(() => {
    hadCrypto = 'crypto' in g
    savedCrypto = g.crypto
  })

  afterEach(() => {
    if (hadCrypto) {
      g.crypto = savedCrypto
    } else {
      delete g.crypto
    }
  })

  it('creates global.crypto when missing and installs getRandomValues', () => {
    delete g.crypto
    installGetRandomValues()
    expect(typeof g.crypto).toBe('object')
    expect(g.crypto.getRandomValues).toBe(getRandomValues)
  })

  it('repairs a null global.crypto', () => {
    g.crypto = null
    installGetRandomValues()
    expect(g.crypto.getRandomValues).toBe(getRandomValues)
  })

  it('does not overwrite an existing implementation by default', () => {
    const existing = () => {}
    g.crypto = { getRandomValues: existing }
    installGetRandomValues()
    expect(g.crypto.getRandomValues).toBe(existing)
  })

  it('overwrites with force:true', () => {
    g.crypto = { getRandomValues: () => {} }
    installGetRandomValues({ force: true })
    expect(g.crypto.getRandomValues).toBe(getRandomValues)
  })

  it('auto-installs on side-effect import', async () => {
    jest.resetModules()
    delete g.crypto
    await import('../index')
    expect(typeof (globalThis as any).crypto?.getRandomValues).toBe('function')
  })
})
