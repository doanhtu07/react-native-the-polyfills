import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Stack } from 'expo-router'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Polyfills' }} />

          <Stack.Screen
            name="get-random-values"
            options={{ title: 'get-random-values' }}
          />

          <Stack.Screen name="random-uuid" options={{ title: 'random-uuid' }} />
        </Stack>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}
