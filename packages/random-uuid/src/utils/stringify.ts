/**
 * Formats 16 random bytes as a lowercase RFC 4122 v4 UUID string.
 *
 * The caller is responsible for setting the version (`data[6]`) and variant
 * (`data[8]`) bits before calling this. Ported from
 * `LinusU/react-native-random-uuid` (`stringify.js`).
 */
export function stringify(data: Uint8Array): string {
  const hex = (byte: number): string => byte.toString(16).padStart(2, '0')

  return (
    hex(data[0]!) +
    hex(data[1]!) +
    hex(data[2]!) +
    hex(data[3]!) +
    '-' +
    hex(data[4]!) +
    hex(data[5]!) +
    '-' +
    hex(data[6]!) +
    hex(data[7]!) +
    '-' +
    hex(data[8]!) +
    hex(data[9]!) +
    '-' +
    hex(data[10]!) +
    hex(data[11]!) +
    hex(data[12]!) +
    hex(data[13]!) +
    hex(data[14]!) +
    hex(data[15]!)
  )
}
