import '@the-polyfills/random-uuid'

import { getRandomUUID } from '@/utils/crypto'

import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

type TestStatus = 'pass' | 'fail' | 'idle'

interface TestResult {
  status: TestStatus
  detail: string
}

type TestId =
  'installed' | 'format' | 'version' | 'variant' | 'lowercase' | 'uniqueness'

const INITIAL_RESULTS: Record<TestId, TestResult> = {
  installed: { status: 'idle', detail: 'Not run yet' },
  format: { status: 'idle', detail: 'Not run yet' },
  version: { status: 'idle', detail: 'Not run yet' },
  variant: { status: 'idle', detail: 'Not run yet' },
  lowercase: { status: 'idle', detail: 'Not run yet' },
  uniqueness: { status: 'idle', detail: 'Not run yet' },
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export default function RandomUuid() {
  const [results, setResults] =
    useState<Record<TestId, TestResult>>(INITIAL_RESULTS)

  const setResult = useCallback((id: TestId, result: TestResult) => {
    setResults((prev) => ({ ...prev, [id]: result }))
  }, [])

  const runInstalled = useCallback(() => {
    try {
      const randomUUID = getRandomUUID()
      if (!randomUUID) throw new Error('globalThis.crypto.randomUUID missing')

      setResult('installed', {
        status: 'pass',
        detail: 'crypto.randomUUID installed (auto-installed on import)',
      })
    } catch (e) {
      setResult('installed', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runFormat = useCallback(() => {
    try {
      const randomUUID = getRandomUUID()
      if (!randomUUID) throw new Error('globalThis.crypto.randomUUID missing')

      const uuid = randomUUID()

      if (!UUID_V4_REGEX.test(uuid)) {
        throw new Error(`not a v4 UUID: ${uuid}`)
      }

      setResult('format', { status: 'pass', detail: uuid })
    } catch (e) {
      setResult('format', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runVersion = useCallback(() => {
    try {
      const randomUUID = getRandomUUID()
      if (!randomUUID) throw new Error('globalThis.crypto.randomUUID missing')

      const uuid = randomUUID()

      if (uuid[14] !== '4') {
        throw new Error(`bad version nibble: ${uuid}`)
      }

      setResult('version', {
        status: 'pass',
        detail: `version nibble is 4: ${uuid}`,
      })
    } catch (e) {
      setResult('version', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runVariant = useCallback(() => {
    try {
      const randomUUID = getRandomUUID()
      if (!randomUUID) throw new Error('globalThis.crypto.randomUUID missing')

      const uuid = randomUUID()
      const variant = uuid[19]

      if (
        variant !== '8' &&
        variant !== '9' &&
        variant !== 'a' &&
        variant !== 'b'
      ) {
        throw new Error(`bad variant nibble: ${uuid}`)
      }

      setResult('variant', {
        status: 'pass',
        detail: `variant nibble is ${variant}: ${uuid}`,
      })
    } catch (e) {
      setResult('variant', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runLowercase = useCallback(() => {
    try {
      const randomUUID = getRandomUUID()
      if (!randomUUID) throw new Error('globalThis.crypto.randomUUID missing')

      const uuid = randomUUID()

      if (uuid !== uuid.toLowerCase()) {
        throw new Error(`not lowercase: ${uuid}`)
      }

      setResult('lowercase', { status: 'pass', detail: uuid })
    } catch (e) {
      setResult('lowercase', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runUniqueness = useCallback(() => {
    try {
      const randomUUID = getRandomUUID()
      if (!randomUUID) throw new Error('globalThis.crypto.randomUUID missing')

      const seen = new Set<string>()
      let first = ''

      for (let i = 0; i < 200; i++) {
        const uuid = randomUUID()
        if (i === 0) first = uuid
        if (seen.has(uuid)) throw new Error(`duplicate UUID: ${uuid}`)
        seen.add(uuid)
      }

      setResult('uniqueness', {
        status: 'pass',
        detail: `200/200 distinct (e.g. ${first})`,
      })
    } catch (e) {
      setResult('uniqueness', {
        status: 'fail',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }, [setResult])

  const runAll = useCallback(() => {
    runInstalled()
    runFormat()
    runVersion()
    runVariant()
    runLowercase()
    runUniqueness()
  }, [
    runInstalled,
    runFormat,
    runVersion,
    runVariant,
    runLowercase,
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
      <Text style={styles.header}>random-uuid</Text>

      <Text style={styles.subheader}>
        Manual QA calls for crypto.randomUUID (polyfill auto-installed on
        import)
      </Text>

      <Pressable style={[styles.button, styles.runAllButton]} onPress={runAll}>
        <Text style={styles.buttonText}>Run all tests</Text>
      </Pressable>

      <View style={styles.divider} />

      {renderTest(
        'installed',
        '1. Installed',
        'globalThis.crypto.randomUUID is a function',
        runInstalled,
      )}

      {renderTest(
        'format',
        '2. v4 format',
        'Matches RFC 4122 v4 pattern',
        runFormat,
      )}

      {renderTest(
        'version',
        '3. Version nibble',
        'Character 15 (uuid[14]) must be 4',
        runVersion,
      )}

      {renderTest(
        'variant',
        '4. Variant nibble',
        'Character 20 (uuid[19]) must be 8, 9, a, or b',
        runVariant,
      )}

      {renderTest(
        'lowercase',
        '5. Lowercase',
        'Output must already be lowercase',
        runLowercase,
      )}

      {renderTest(
        'uniqueness',
        '6. Randomness sanity',
        '200 consecutive calls must all differ',
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
