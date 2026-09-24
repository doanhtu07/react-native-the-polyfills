import '@the-polyfills/get-random-values'

import { getCrypto } from '@/utils/crypto'
import { toHex } from '@/utils/hex'

import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

type TestStatus = 'pass' | 'fail' | 'idle'

interface TestResult {
  status: TestStatus
  detail: string
}

type TestId =
  | 'basic'
  | 'typedArrays'
  | 'rejections'
  | 'quota'
  | 'zeroLength'
  | 'offset'
  | 'bigInt'
  | 'uuid'
  | 'uniqueness'

const INITIAL_RESULTS: Record<TestId, TestResult> = {
  basic: { status: 'idle', detail: 'Not run yet' },
  typedArrays: { status: 'idle', detail: 'Not run yet' },
  rejections: { status: 'idle', detail: 'Not run yet' },
  quota: { status: 'idle', detail: 'Not run yet' },
  zeroLength: { status: 'idle', detail: 'Not run yet' },
  offset: { status: 'idle', detail: 'Not run yet' },
  bigInt: { status: 'idle', detail: 'Not run yet' },
  uuid: { status: 'idle', detail: 'Not run yet' },
  uniqueness: { status: 'idle', detail: 'Not run yet' },
}

export default function Index() {
  const [results, setResults] =
    useState<Record<TestId, TestResult>>(INITIAL_RESULTS)

  const setResult = useCallback((id: TestId, result: TestResult) => {
    setResults((prev) => ({ ...prev, [id]: result }))
  }, [])

  const runBasic = useCallback(() => {
    try {
      const crypto = getCrypto()
      if (!crypto) throw new Error('globalThis.crypto.getRandomValues missing')

      const array = new Uint8Array(16)
      const returned = crypto.getRandomValues(array)

      if (returned !== array) throw new Error('did not return same reference')

      setResult('basic', {
        status: 'pass',
        detail: `Uint8Array(16) => ${toHex(array)}`,
      })
    } catch (e) {
      setResult('basic', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runTypedArrays = useCallback(() => {
    try {
      const crypto = getCrypto()
      if (!crypto) throw new Error('globalThis.crypto.getRandomValues missing')

      const cases: [string, () => ArrayBufferView][] = [
        ['Int8Array', () => new Int8Array(4)],
        ['Uint8Array', () => new Uint8Array(4)],
        ['Uint8ClampedArray', () => new Uint8ClampedArray(4)],
        ['Int16Array', () => new Int16Array(4)],
        ['Uint16Array', () => new Uint16Array(4)],
        ['Int32Array', () => new Int32Array(4)],
        ['Uint32Array', () => new Uint32Array(4)],
        ['BigInt64Array', () => new BigInt64Array(2)],
        ['BigUint64Array', () => new BigUint64Array(2)],
      ]

      for (const [name, make] of cases) {
        const array = make() as Uint8Array

        if (crypto.getRandomValues(array) !== (array as never)) {
          throw new Error(`${name}: did not return same reference`)
        }
      }

      setResult('typedArrays', {
        status: 'pass',
        detail: `All 9 integer TypedArrays accepted: ${cases.map(([n]) => n).join(', ')}`,
      })
    } catch (e) {
      setResult('typedArrays', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runRejections = useCallback(() => {
    try {
      const crypto = getCrypto()
      if (!crypto) throw new Error('globalThis.crypto.getRandomValues missing')

      const cases: [string, () => unknown][] = [
        ['DataView', () => new DataView(new ArrayBuffer(8))],
        ['Float32Array', () => new Float32Array(4)],
        ['Float64Array', () => new Float64Array(4)],
        ['ArrayBuffer', () => new ArrayBuffer(8)],
        ['plain object', () => ({ length: 4 })],
      ]

      const rejected: string[] = []

      for (const [name, make] of cases) {
        try {
          crypto.getRandomValues(make() as Uint8Array)
        } catch (e) {
          if (e instanceof TypeError) {
            rejected.push(name)
            continue
          }

          throw new Error(`${name}: wrong error (${String(e)})`)
        }

        throw new Error(`${name}: should have thrown TypeError`)
      }

      setResult('rejections', {
        status: 'pass',
        detail: `TypeError for: ${rejected.join(', ')}`,
      })
    } catch (e) {
      setResult('rejections', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runQuota = useCallback(() => {
    try {
      const crypto = getCrypto()
      if (!crypto) throw new Error('globalThis.crypto.getRandomValues missing')

      // Over quota must throw QuotaExceededError (byteLength, not length).
      try {
        crypto.getRandomValues(new Uint8Array(65_537))
        throw new Error('Uint8Array(65537) should have thrown')
      } catch (e) {
        if ((e as { name?: string })?.name !== 'QuotaExceededError') throw e
      }

      // Uint16Array(40000) has length 40000 but byteLength 80000 -> throw.
      try {
        crypto.getRandomValues(new Uint16Array(40_000) as never)
        throw new Error('Uint16Array(40000) should have thrown')
      } catch (e) {
        if ((e as { name?: string })?.name !== 'QuotaExceededError') throw e
      }

      // Boundary (exactly 65536) must pass.
      crypto.getRandomValues(new Uint8Array(65_536))

      setResult('quota', {
        status: 'pass',
        detail:
          '65537 throws QuotaExceededError; Uint16(40000)/80k throws; 65536 passes',
      })
    } catch (e) {
      setResult('quota', {
        status: 'fail',
        detail: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      })
    }
  }, [setResult])

  const runZeroLength = useCallback(() => {
    try {
      const crypto = getCrypto()
      if (!crypto) throw new Error('globalThis.crypto.getRandomValues missing')

      const array = new Uint8Array(0)

      if (crypto.getRandomValues(array) !== (array as never)) {
        throw new Error('did not return same reference')
      }

      setResult('zeroLength', {
        status: 'pass',
        detail: 'Uint8Array(0) returns immediately, same reference',
      })
    } catch (e) {
      setResult('zeroLength', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runOffset = useCallback(() => {
    try {
      const crypto = getCrypto()
      if (!crypto) throw new Error('globalThis.crypto.getRandomValues missing')

      const buffer = new ArrayBuffer(8)
      new Uint8Array(buffer).fill(0xaa)

      const view = new Uint8Array(buffer, 2, 4)
      crypto.getRandomValues(view)

      const full = Array.from(new Uint8Array(buffer))

      if (
        full[0] !== 0xaa ||
        full[1] !== 0xaa ||
        full[6] !== 0xaa ||
        full[7] !== 0xaa
      ) {
        throw new Error(`neighbours clobbered: [${full.join(', ')}]`)
      }

      setResult('offset', {
        status: 'pass',
        detail: `neighbours intact (0xaa), middle filled: [${full.join(', ')}]`,
      })
    } catch (e) {
      setResult('offset', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runBigInt = useCallback(() => {
    try {
      const crypto = getCrypto()
      if (!crypto) throw new Error('globalThis.crypto.getRandomValues missing')

      const array = new BigUint64Array(1)

      if (crypto.getRandomValues(array as never) !== (array as never)) {
        throw new Error('did not return same reference')
      }

      setResult('bigInt', {
        status: 'pass',
        detail: `BigUint64Array(1) => ${array[0]?.toString(16) ?? 'n/a'} (value varies)`,
      })
    } catch (e) {
      setResult('bigInt', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runUuid = useCallback(() => {
    try {
      const crypto = getCrypto()
      if (!crypto) throw new Error('globalThis.crypto.getRandomValues missing')

      // RFC 4122 v4: rand bytes, then version/variant bits.
      const bytes = crypto.getRandomValues(new Uint8Array(16))
      bytes[6] = (bytes[6]! & 0x0f) | 0x40
      bytes[8] = (bytes[8]! & 0x3f) | 0x80

      const hex = toHex(bytes)
      const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`

      if (uuid[14] !== '4') throw new Error(`bad version nibble: ${uuid}`)

      setResult('uuid', { status: 'pass', detail: uuid })
    } catch (e) {
      setResult('uuid', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runUniqueness = useCallback(() => {
    try {
      const crypto = getCrypto()
      if (!crypto) throw new Error('globalThis.crypto.getRandomValues missing')

      const a = toHex(crypto.getRandomValues(new Uint8Array(16)))
      const b = toHex(crypto.getRandomValues(new Uint8Array(16)))

      if (a === b) throw new Error(`two calls returned identical bytes: ${a}`)

      setResult('uniqueness', {
        status: 'pass',
        detail: `a=${a.slice(0, 16)}… b=${b.slice(0, 16)}… (differ)`,
      })
    } catch (e) {
      setResult('uniqueness', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runAll = useCallback(() => {
    runBasic()
    runTypedArrays()
    runRejections()
    runQuota()
    runZeroLength()
    runOffset()
    runBigInt()
    runUuid()
    runUniqueness()
  }, [
    runBasic,
    runTypedArrays,
    runRejections,
    runQuota,
    runZeroLength,
    runOffset,
    runBigInt,
    runUuid,
    runUniqueness,
  ])

  // MARK: Renderers

  const renderTest = (
    id: TestId,
    title: string,
    description: string,
    onRun: () => void,
  ) => {
    const result = results[id]

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>

        <Pressable style={styles.button} onPress={onRun}>
          <Text style={styles.buttonText}>Run</Text>
        </Pressable>

        <Text
          style={[
            styles.result,
            result.status === 'pass' && styles.resultPass,
            result.status === 'fail' && styles.resultFail,
          ]}
        >
          {result.status === 'idle'
            ? '○ Not run yet'
            : `${result.status === 'pass' ? '● PASS' : '● FAIL'}: ${result.detail}`}
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.header}>get-random-values</Text>

      <Text style={styles.subheader}>
        Manual QA calls for crypto.getRandomValues (polyfill auto-installed on
        import)
      </Text>

      <Pressable style={[styles.button, styles.runAllButton]} onPress={runAll}>
        <Text style={styles.buttonText}>Run all tests</Text>
      </Pressable>

      <View style={styles.divider} />

      {renderTest(
        'basic',
        '1. Basic fill',
        'crypto.getRandomValues(new Uint8Array(16))',
        runBasic,
      )}

      {renderTest(
        'typedArrays',
        '2. Integer TypedArrays',
        'All 9 int/uint/bigint array types return same reference',
        runTypedArrays,
      )}

      {renderTest(
        'rejections',
        '3. Rejections',
        'DataView, floats, ArrayBuffer, objects throw TypeError',
        runRejections,
      )}

      {renderTest(
        'quota',
        '4. 65536-byte quota',
        'Checks byteLength (Uint16 40k = 80k bytes throws)',
        runQuota,
      )}

      {renderTest(
        'zeroLength',
        '5. Zero length',
        'Uint8Array(0) short-circuits, same reference',
        runZeroLength,
      )}

      {renderTest(
        'offset',
        '6. Buffer offset',
        'Uint8Array(buffer, 2, 4) fills middle only',
        runOffset,
      )}

      {renderTest(
        'bigInt',
        '7. BigInt array',
        'BigUint64Array(1) filled via byte write-through',
        runBigInt,
      )}

      {renderTest(
        'uuid',
        '8. UUID v4',
        'Real-world usage: 16 random bytes → RFC 4122 string',
        runUuid,
      )}

      {renderTest(
        'uniqueness',
        '9. Randomness sanity',
        'Two consecutive 16-byte calls must differ',
        runUniqueness,
      )}
    </ScrollView>
  )
}

// MARK: Styles

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#f6f6f6',
    borderRadius: 12,
    gap: 4,
    padding: 12,
  },
  cardDescription: {
    color: '#555',
    fontSize: 13,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    gap: 8,
    padding: 16,
    paddingBottom: 64,
  },
  divider: {
    backgroundColor: 'lightgray',
    height: 1,
    marginVertical: 12,
  },
  header: {
    fontSize: 20,
    fontWeight: '500',
  },
  result: {
    fontSize: 13,
    marginTop: 8,
  },
  resultFail: {
    color: '#b42318',
  },
  resultPass: {
    color: '#067647',
  },
  root: {
    flex: 1,
  },
  runAllButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#111',
    marginTop: 12,
  },
  subheader: {
    color: '#555',
    fontSize: 13,
  },
})
