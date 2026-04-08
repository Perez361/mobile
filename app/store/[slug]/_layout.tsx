import { useEffect, useState } from 'react'
import { Tabs, useLocalSearchParams, useRouter } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Colors, FontSize } from '@/constants/theme'

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={s.tab}>
      <Text style={s.tabEmoji}>{emoji}</Text>
      <Text style={[s.tabLabel, { color: focused ? Colors.brand : Colors.textMuted }]}>{label}</Text>
    </View>
  )
}

export default function StoreLayout() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const [storeValid, setStoreValid] = useState<boolean | null>(null)

  useEffect(() => {
    if (!slug) { setStoreValid(false); return }
    createCustomerClient(slug).from('importers').select('id').ilike('store_slug', slug).single().then(({ data }) => {
      if (!data) { setStoreValid(false); router.replace('/store') }
      else setStoreValid(true)
    })
  }, [slug])

  if (storeValid === null) return <LoadingSpinner fullScreen />

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: Colors.card, borderTopColor: Colors.border, height: 65, paddingBottom: 8 },
      tabBarShowLabel: false,
    }}>
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏪" label="Shop" focused={focused} /> }} />
      <Tabs.Screen name="cart" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" label="Cart" focused={focused} /> }} />
      <Tabs.Screen name="orders" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📋" label="Orders" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} /> }} />
      <Tabs.Screen name="login" options={{ href: null }} />
      <Tabs.Screen name="register" options={{ href: null }} />
    </Tabs>
  )
}

const s = StyleSheet.create({
  tab: { alignItems: 'center', gap: 2, paddingTop: 4 },
  tabEmoji: { fontSize: 20 },
  tabLabel: { fontSize: FontSize.xs, fontWeight: '500' },
})
