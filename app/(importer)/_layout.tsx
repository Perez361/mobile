import { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Colors, FontSize } from '@/constants/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

export default function ImporterLayout() {
  const router = useRouter()
  const { user, loading } = useImporterSession()

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading])

  if (loading) return <LoadingSpinner fullScreen />

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
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          tabBarLabel: 'Shop',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={22} color={color} />
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
        name="customers"
        options={{
          tabBarLabel: 'Clients',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ color }) => (
            <Ionicons name="ellipsis-horizontal" size={22} color={color} />
          ),
        }}
      />

      {/* Hidden screens — navigable via More menu, not shown in tab bar */}
      <Tabs.Screen name="analytics"         options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="settings"          options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="mystore"           options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="shipments"         options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="preorders/index"   options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="preorders/[month]" options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  )
}
