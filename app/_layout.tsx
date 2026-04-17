import { useEffect, useRef } from 'react'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Notifications from 'expo-notifications'
import { AlertProvider } from '@/components/ui/AlertModal'
import { SafeAreaProvider } from 'react-native-safe-area-context'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const router = useRouter()
  const notificationListener = useRef<Notifications.EventSubscription>()
  const responseListener = useRef<Notifications.EventSubscription>()

  useEffect(() => {
    SplashScreen.hideAsync()

    // Handle notification taps — route to the relevant screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, string> | undefined
      if (data?.screen === 'orders') {
        router.push('/(importer)/orders')
      } else if (data?.screen === 'store-orders' && data?.slug) {
        router.push(`/store/${data.slug}/orders`)
      }
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
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
