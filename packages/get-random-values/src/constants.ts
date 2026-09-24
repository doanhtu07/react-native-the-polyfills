/**
 * Maximum number of bytes `crypto.getRandomValues()` may fill in a single call.
 *
 * The WebCrypto spec sets this quota at 65,536 bytes. Browsers throw a
 * `QuotaExceededError` DOMException when `array.byteLength` exceeds it.
 *
 * Notes for this polyfill:
 * - The check uses `byteLength`, not `length`. For example,
 *   `Uint16Array(40_000)` has `length === 40_000` but
 *   `byteLength === 80_000`, so it must throw.
 * - Hermes (React Native) has no `DOMException`, so `getRandomValues`
 *   throws a plain `Error` with `error.name = 'QuotaExceededError'` instead.
 *   Browser-style `catch (e) { e.name === 'QuotaExceededError' }` code keeps
 *   working.
 * - A zero-length array short-circuits before any Expo/native call.
 */
export const MAX_BYTE_LENGTH = 65_536

/**
 * Reverse lookup table for standard base64 decoding.
 *
 * The native module can only return random bytes as a base64 `string` over
 * the synchronous bridge, so JS decodes it back to bytes without an
 * external dependency.
 *
 * How it works:
 * - The base64 alphabet `'A-Za-z0-9+/'` maps index -> 6-bit value
 *   (`'A' === 0`, ..., `'/' === 63`).
 * - This table inverts that: `table[charCode] === 6-bit value`, built once
 *   at module load via the IIFE below.
 * - The table has 128 slots (one per ASCII code). Slots are pre-filled with
 *   `-1` as an "invalid character" marker; only the 64 alphabet codes are
 *   overwritten. `'='` padding is handled separately by the decoder (mapped
 *   to `0`), and any lookup that still yields `-1` (or `undefined ?? -1`
 *   for char codes > 127) makes `base64ToBytes` throw
 *   `'Invalid base64 character'`.
 *
 * Decode math (per 4-char block in `base64ToBytes`):
 * - `triplet = (a << 18) | (b << 12) | (c << 6) | d` reassembles 4 x 6 bits
 *   into 24 bits, then splits into 3 bytes via `>> 16`, `>> 8`, `& 0xff`.
 * - `outputLength = (clean.length / 4) * 3 - padding` accounts for trailing
 *   `'='` / `'=='`, and `outIndex < outputLength` guards drop padding bytes.
 */
export const BASE64_LOOKUP = (() => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  const table = new Array<number>(128).fill(-1)

  for (let i = 0; i < chars.length; i++) {
    table[chars.charCodeAt(i)] = i
  }

  return table
})()
