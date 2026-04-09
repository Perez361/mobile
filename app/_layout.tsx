import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { AlertProvider } from '@/components/ui/AlertModal'
import { SafeAreaProvider } from 'react-native-safe-area-context'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaProvider>
        <AlertProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AlertProvider>
      </SafeAreaProvider>
    </>
  )
}
