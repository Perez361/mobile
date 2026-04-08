import { Stack } from 'expo-router'
import { Colors } from '@/constants/theme'

export default function ProductsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.card },
        headerTintColor: Colors.brand,
        headerTitleStyle: { color: Colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Products', headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'New Product', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Edit Product', presentation: 'modal' }} />
    </Stack>
  )
}
