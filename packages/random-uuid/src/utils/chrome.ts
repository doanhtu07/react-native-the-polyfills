declare const __DEV__: boolean | undefined

export function isRemoteDebuggingInChrome(): boolean {
  const g = globalThis as any

  // Remote debugging in Chrome is not supported in bridgeless mode.
  if ('RN$Bridgeless' in g && g.RN$Bridgeless === true) {
    return false
  }

  try {
    return (
      __DEV__ !== undefined && __DEV__ && g.nativeCallSyncHook === undefined
    )
  } catch {
    return false
  }
}
