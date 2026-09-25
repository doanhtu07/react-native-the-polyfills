import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'

import { installRandomUuid } from '../index'
import { randomUUID } from '../utils/random-uuid'

describe('installRandomUuid', () => {
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

  it('creates global.crypto when missing and installs randomUUID', () => {
    delete g.crypto
    installRandomUuid()
    expect(typeof g.crypto).toBe('object')
    expect(g.crypto.randomUUID).toBe(randomUUID)
  })

  it('repairs a null global.crypto', () => {
    g.crypto = null
    installRandomUuid()
    expect(g.crypto.randomUUID).toBe(randomUUID)
  })

  it('does not overwrite an existing implementation by default', () => {
    const existing = () => {}
    g.crypto = { randomUUID: existing }
    installRandomUuid()
    expect(g.crypto.randomUUID).toBe(existing)
  })

  it('overwrites with force:true', () => {
    g.crypto = { randomUUID: () => {} }
    installRandomUuid({ force: true })
    expect(g.crypto.randomUUID).toBe(randomUUID)
  })

  it('auto-installs on side-effect import', async () => {
    jest.resetModules()
    delete g.crypto
    await import('../index')
    expect(typeof (globalThis as any).crypto?.randomUUID).toBe('function')
  })
})
