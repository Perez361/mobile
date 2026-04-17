import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Tabs, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { CustomerProvider, useCustomerContext } from '@/lib/hooks/CustomerContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Colors, FontSize } from '@/constants/theme'
import { requestAndGetPushToken, savePushToken } from '@/lib/notifications/push'

export default function StoreLayout() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [storeValid, setStoreValid] = useState<boolean | null>(null)

  useEffect(() => {
    if (!slug) { 
      setStoreValid(false)
      return 
    }

    const supabase = createCustomerClient(slug as string)
    let settled = false

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
        setStoreValid(false)
      } else {
        setStoreValid(true)
      }
    }).catch(() => {
      if (settled) return
      setStoreValid(false)
    })

    return () => { settled = true }
  }, [slug])

  if (storeValid === null) return <LoadingSpinner fullScreen />
  if (storeValid === false) return null

  return (
    <CustomerProvider slug={slug as string}>
      <StoreTabs />
    </CustomerProvider>
  )
}

function StoreTabs() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { user } = useCustomerContext()
  const [cartCount, setCartCount] = useState(0)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Register push token whenever the customer logs in
  useEffect(() => {
    if (!user || !slug) return
    requestAndGetPushToken().then(token => {
      if (token) savePushToken(createCustomerClient(slug), token)
    })
  }, [user?.id, slug])

  // Keep cart badge count fresh - and update on focus
  useEffect(() => {
    if (!slug) return
    
    const updateCartCount = () => {
      const supabase = createCustomerClient(slug)
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) { setCartCount(0); setInitialLoadDone(true); return }
        const { data: imp } = await supabase.from('importers').select('id').ilike('store_slug', slug).single()
        if (!imp) { setCartCount(0); setInitialLoadDone(true); return }
        const { data: cust } = await supabase
          .from('customers').select('id, store_id')
          .eq('user_id', session.user.id).eq('store_id', imp.id).single()
        if (!cust) { setCartCount(0); setInitialLoadDone(true); return }
        const { data: cart } = await supabase
          .from('carts').select('id')
          .eq('customer_id', cust.id).eq('store_id', cust.store_id).single()
        if (!cart) { setCartCount(0); setInitialLoadDone(true); return }
        const { count } = await supabase
          .from('cart_items').select('id', { count: 'exact', head: true }).eq('cart_id', cart.id)
        setCartCount(count || 0)
        setInitialLoadDone(true)
      })
    }

    // Initial load
    updateCartCount()

    // Set up interval to poll for changes (every 2 seconds)
    const interval = setInterval(updateCartCount, 2000)

    return () => clearInterval(interval)
  }, [slug])

  // Only show badge after initial load to avoid showing stale count
  const showBadge = initialLoadDone && cartCount > 0

  return (
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
            <View style={{ position: 'relative' }}>
              <Ionicons name={focused ? 'cart' : 'cart-outline'} size={22} color={color} />
              {showBadge && (
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
      <Tabs.Screen name="login" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="register" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="forgot-password" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
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
