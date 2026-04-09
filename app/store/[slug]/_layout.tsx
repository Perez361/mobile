import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Tabs, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { CustomerProvider, useCustomerContext } from '@/lib/hooks/CustomerContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Colors, FontSize } from '@/constants/theme'

export default function StoreLayout() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const [storeValid, setStoreValid] = useState<boolean | null>(null)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    if (!slug) { 
      setStoreValid(false)
      router.replace('/store')
      return 
    }

    const supabase = createCustomerClient(slug as string)
    let settled = false

    // Timeout + validation
    Promise.race([
      supabase
        .from('importers')
        .select('id')
        .ilike('store_slug', slug)
        .single(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Store validation timeout')), 3000)
      )
    ]).then(({ data, error }) => {
      if (settled) return
      if (error || !data) {
        console.error('Store validation failed:', error || 'No store found')
        setStoreValid(false)
        router.replace('/store')
      } else {
        setStoreValid(true)
      }
    }).catch(err => {
      if (settled) return
      console.error('Store validation error:', err)
      setStoreValid(false)
      router.replace('/store')
    })

    return () => { settled = true }
  }, [slug, router])



  // Keep cart badge count fresh
  useEffect(() => {
    if (!slug) return
    const supabase = createCustomerClient(slug)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: imp } = await supabase.from('importers').select('id').ilike('store_slug', slug).single()
      if (!imp) return
      const { data: cust } = await supabase
        .from('customers').select('id, store_id')
        .eq('user_id', session.user.id).eq('store_id', imp.id).single()
      if (!cust) return
      const { data: cart } = await supabase
        .from('carts').select('id')
        .eq('customer_id', cust.id).eq('store_id', cust.store_id).single()
      if (!cart) return
      const { count } = await supabase
        .from('cart_items').select('id', { count: 'exact', head: true }).eq('cart_id', cart.id)
      setCartCount(count || 0)
    })
  }, [slug])

  if (storeValid === null) return <LoadingSpinner fullScreen />

  return (
    <CustomerProvider slug={slug as string}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.brand,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: {
            backgroundColor: Colors.card,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: FontSize.xs,
            fontWeight: '600',
            marginTop: 2,
          },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Shop',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          tabBarLabel: 'Cart',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? 'cart' : 'cart-outline'} size={22} color={color} />
              {cartCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="login" options={{ href: null }} />
      <Tabs.Screen name="register" options={{ href: null }} />
    </Tabs>
    </CustomerProvider>
  )
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
})
