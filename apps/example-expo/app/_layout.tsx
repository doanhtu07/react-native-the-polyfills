import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Stack } from 'expo-router'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView>
        <Stack />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}
