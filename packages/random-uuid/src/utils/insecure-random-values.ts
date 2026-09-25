let insecureWarned = false

export function insecureRandomValues<T extends ArrayBufferView>(array: T): T {
  if (!insecureWarned) {
    console.warn(
      'crypto.randomUUID: using an insecure random number generator, ' +
        'this should only happen when running in a debugger without support for crypto.randomUUID',
    )

    insecureWarned = true
  }

  // Fill through a Uint8 view so BigInt arrays work too.
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength)

  for (let i = 0, r = 0; i < bytes.length; i++) {
    if ((i & 0x03) === 0) {
      r = Math.random() * 0x100000000
    }

    bytes[i] = (r >>> ((i & 0x03) << 3)) & 0xff
  }

  return array
}
