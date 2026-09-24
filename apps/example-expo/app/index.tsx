import { ScrollView, StyleSheet, Text, View } from 'react-native'

export default function Index() {
  // MARK: Renderers

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.header}>Example App</Text>
      <View style={styles.divider} />
    </ScrollView>
  )
}

// MARK: Styles

const styles = StyleSheet.create({
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
})
