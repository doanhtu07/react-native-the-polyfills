import { Link } from 'expo-router'

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

interface PolyfillEntry {
  href: '/get-random-values' | '/random-uuid'
  title: string
  api: string
  description: string
}

const POLYFILLS: PolyfillEntry[] = [
  {
    href: '/get-random-values',
    title: 'get-random-values',
    api: 'crypto.getRandomValues',
    description:
      'Fills integer TypedArrays with cryptographically secure random bytes',
  },
  {
    href: '/random-uuid',
    title: 'random-uuid',
    api: 'crypto.randomUUID',
    description: 'Generates a lowercase RFC 4122 v4 UUID string',
  },
]

export default function Index() {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.header}>the-polyfills</Text>

      <Text style={styles.subheader}>
        Pick a polyfill to open its manual test screen
      </Text>

      <View style={styles.divider} />

      {POLYFILLS.map((entry) => (
        <View key={entry.href} style={styles.card}>
          <Text style={styles.cardTitle}>{entry.title}</Text>
          <Text style={styles.cardApi}>{entry.api}</Text>
          <Text style={styles.cardDescription}>{entry.description}</Text>

          <Link href={entry.href} asChild>
            <Pressable style={styles.button}>
              <Text style={styles.buttonText}>Open test screen</Text>
            </Pressable>
          </Link>
        </View>
      ))}
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
  cardApi: {
    color: '#0a7ea4',
    fontFamily: 'monospace',
    fontSize: 13,
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
  root: {
    flex: 1,
  },
  subheader: {
    color: '#555',
    fontSize: 13,
  },
})
