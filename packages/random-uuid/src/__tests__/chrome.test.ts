import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'

import { isRemoteDebuggingInChrome } from '../utils/chrome'

describe('isRemoteDebuggingInChrome', () => {
  const g = globalThis as any

  let savedDev: unknown
  let savedBridgeless: unknown
  let savedHook: unknown
  let hadDev: boolean
  let hadBridgeless: boolean
  let hadHook: boolean

  beforeEach(() => {
    hadDev = '__DEV__' in globalThis
    savedDev = (globalThis as any).__DEV__
    hadBridgeless = 'RN$Bridgeless' in g
    savedBridgeless = g.RN$Bridgeless
    hadHook = 'nativeCallSyncHook' in g
    savedHook = g.nativeCallSyncHook

    delete g.RN$Bridgeless
    delete g.nativeCallSyncHook
  })

  afterEach(() => {
    if (hadDev) {
      ;(globalThis as any).__DEV__ = savedDev
    } else {
      delete (globalThis as any).__DEV__
    }

    if (hadBridgeless) {
      g.RN$Bridgeless = savedBridgeless
    } else {
      delete g.RN$Bridgeless
    }

    if (hadHook) {
      g.nativeCallSyncHook = savedHook
    } else {
      delete g.nativeCallSyncHook
    }
  })

  it('returns false in bridgeless mode even when debugging markers present', () => {
    ;(globalThis as any).__DEV__ = true
    g.RN$Bridgeless = true
    expect(isRemoteDebuggingInChrome()).toBe(false)
  })

  it('returns true in __DEV__ without sync hook (old-arch remote debug)', () => {
    ;(globalThis as any).__DEV__ = true
    expect(isRemoteDebuggingInChrome()).toBe(true)
  })

  it('returns false when sync hook exists (on-device / bridgeless runtime)', () => {
    ;(globalThis as any).__DEV__ = true
    g.nativeCallSyncHook = () => {}
    expect(isRemoteDebuggingInChrome()).toBe(false)
  })

  it('returns false when not in __DEV__', () => {
    ;(globalThis as any).__DEV__ = false
    expect(isRemoteDebuggingInChrome()).toBe(false)
  })

  it('returns false when __DEV__ is undefined instead of throwing', () => {
    ;(globalThis as any).__DEV__ = undefined
    expect(isRemoteDebuggingInChrome()).toBe(false)
  })
})
