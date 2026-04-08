import { useCallback, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useCustomerSession } from '@/lib/hooks/useCustomerSession'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, getTimeAgo, getOrderId, parseNumber } from '@/lib/utils'
import { Colors, FontSize, Spacing } from '@/constants/theme'

export default function CustomerOrdersScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { user, customer, loading: sessionLoading } = useCustomerSession(slug)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrders = useCallback(async () => {
    if (!customer) { setLoading(false); return }
    const { data } = await createCustomerClient(slug).from('orders')
      .select('id, total, shipping_fee, status, created_at, order_items (quantity, price, products (name, image_url))')
      .eq('customer_id', customer.id).order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }, [customer, slug])

  useFocusEffect(useCallback(() => { fetchOrders() }, [fetchOrders]))
  async function onRefresh() { setRefreshing(true); await fetchOrders(); setRefreshing(false) }

  if (sessionLoading || loading) return <LoadingSpinner fullScreen />

  if (!user || !customer) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}><Text style={s.title}>My Orders</Text></View>
        <EmptyState icon={<Text style={s.emptyIcon}>🔒</Text>} title="Sign in to view your orders" subtitle="You need an account to track your orders"
          action={<Button onPress={() => router.push(`/store/${slug}/login`)}>Sign In</Button>} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>My Orders</Text>
        <Text style={s.sub}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={s.list}>
        {orders.length === 0
          ? <EmptyState icon={<Text style={s.emptyIcon}>📋</Text>} title="No orders yet" subtitle="Your orders will appear here after you make a purchase"
              action={<Button variant="secondary" onPress={() => router.push(`/store/${slug}`)}>Start Shopping</Button>} />
          : orders.map((order: any) => (
            <Card key={order.id} style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.orderId}>Order {getOrderId(order.id)}</Text>
                <StatusBadge status={order.status} />
              </View>
              {order.order_items?.length > 0 && (
                <View style={s.items}>
                  {order.order_items.slice(0, 3).map((item: any, i: number) => (
                    <Text key={i} style={s.itemText}>• {item.products?.name} × {item.quantity}</Text>
                  ))}
                  {order.order_items.length > 3 && <Text style={s.moreText}>+{order.order_items.length - 3} more</Text>}
                </View>
              )}
              <View style={s.cardBottom}>
                <Text style={s.time}>{getTimeAgo(order.created_at)}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.amount}>{formatCurrency(parseNumber(order.total))}</Text>
                  {order.shipping_fee ? <Text style={s.shipping}>+ {formatCurrency(parseNumber(order.shipping_fee))} shipping</Text> : null}
                </View>
              </View>
            </Card>
          ))
        }
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.md, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  emptyIcon: { fontSize: 40 },
  card: { padding: Spacing.lg, gap: Spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderId: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  items: { gap: 3 },
  itemText: { fontSize: FontSize.sm, color: Colors.textMuted },
  moreText: { fontSize: FontSize.xs, color: Colors.textMuted },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  time: { fontSize: FontSize.xs, color: Colors.textMuted },
  amount: { fontSize: FontSize.base, fontWeight: '900', color: Colors.success },
  shipping: { fontSize: FontSize.xs, color: Colors.textMuted },
})
