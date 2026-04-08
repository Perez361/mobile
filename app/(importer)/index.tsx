import { useCallback, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet, Image } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatCurrency, getTimeAgo, getOrderId, parseNumber } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'


type IconName = React.ComponentProps<typeof Ionicons>['name']

const STAT_CARDS: { label: string; key: string; note: (s: any) => string; icon: IconName; color: string }[] = [
  { label: 'Products',  key: 'productCount',   note: () => 'listed',            icon: 'cube-outline',     color: Colors.brand    },
  { label: 'Orders',    key: 'orderCount',      note: (s) => `${s.pendingCount} pending`, icon: 'receipt-outline', color: Colors.warning  },
  { label: 'Customers', key: 'customerCount',   note: () => 'registered',        icon: 'people-outline',   color: Colors.success  },
  { label: 'Revenue',   key: 'totalRevenue',    note: () => 'excl. cancelled',   icon: 'cash-outline',     color: Colors.brand    },
  { label: 'Shipping',  key: 'shippingRevenue', note: () => 'collected',         icon: 'boat-outline',     color: Colors.textMuted },
]

const QUICK_ACTIONS: { label: string; icon: IconName; route: string }[] = [
  { label: 'New Product', icon: 'add-circle-outline',   route: '/(importer)/products/new' },
  { label: 'Orders',      icon: 'receipt-outline',      route: '/(importer)/orders'       },
  { label: 'Analytics',   icon: 'bar-chart-outline',    route: '/(importer)/analytics'    },
  { label: 'Shipments',   icon: 'boat-outline',         route: '/(importer)/shipments'    },
]

export default function DashboardScreen() {
  const router = useRouter()
  const { user, importer, loading } = useImporterSession()
  const [stats, setStats] = useState<any>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return
    const supabase = createImporterClient()
    const [
      { count: productCount },
      { count: orderCount },
      { count: customerCount },
      { data: orders },
      { data: recent },
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('importer_id', user.id),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', user.id),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('store_id', user.id),
      supabase.from('orders').select('total, shipping_fee, status').eq('store_id', user.id),
      supabase.from('orders')
        .select('id, status, created_at, total, customers (full_name, username)')
        .eq('store_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const active = (orders || []).filter((o: any) => o.status !== 'cancelled')
    setStats({
      productCount: productCount ?? 0,
      orderCount: orderCount ?? 0,
      customerCount: customerCount ?? 0,
      pendingCount: (orders || []).filter((o: any) => o.status === 'pending').length,
      totalRevenue: active.reduce((s: number, o: any) => s + parseNumber(o.total) + parseNumber(o.shipping_fee), 0),
      shippingRevenue: active.reduce((s: number, o: any) => s + parseNumber(o.shipping_fee), 0),
    })
    setRecentOrders(recent || [])
    setStatsLoading(false)
  }, [user])

  useFocusEffect(useCallback(() => { fetchData() }, [fetchData]))
  async function onRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  if (loading || statsLoading) return <LoadingSpinner fullScreen />

  const businessName = importer?.business_name || 'My Business'

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <View style={s.topBarLeft}>
            <View style={s.logoBox}>
  <Image 
    source={require('../../assets/images/icon.png')} 
    style={s.logoImage}
    resizeMode="contain"
  />
</View>
            <View>
              <Text style={s.appTitle}>ImportFlow PRO</Text>
              <Text style={s.welcome}>Hi, {businessName}</Text>
            </View>
          </View>
          {importer?.store_slug && (
            <TouchableOpacity style={s.storeBtn} onPress={() => router.push('/(importer)/mystore')}>
              <Ionicons name="storefront-outline" size={14} color="#fff" />
              <Text style={s.storeBtnText}>Store</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.body}>
          {/* Stats grid */}
          <View style={s.statsGrid}>
            {STAT_CARDS.map(({ label, key, note, icon, color }) => {
              const raw = stats?.[key] ?? 0
              const value = key === 'totalRevenue' || key === 'shippingRevenue'
                ? formatCurrency(raw)
                : String(raw)
              return (
                <Card key={label} style={s.statCard}>
                  <View style={s.statRow}>
                    <Text style={s.statLabel}>{label}</Text>
                    <Ionicons name={icon} size={16} color={color} />
                  </View>
                  <Text style={s.statValue}>{value}</Text>
                  <Text style={s.statNote}>{note(stats)}</Text>
                </Card>
              )
            })}
          </View>

          {/* Quick actions */}
          <View style={s.quickActions}>
            {QUICK_ACTIONS.map(({ label, icon, route }) => (
              <TouchableOpacity key={route} style={s.qaBtn} onPress={() => router.push(route as any)}>
                <Ionicons name={icon} size={20} color={Colors.brand} />
                <Text style={s.qaText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Recent orders */}
          <Card>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Recent Orders</Text>
              <TouchableOpacity onPress={() => router.push('/(importer)/orders')}>
                <Text style={s.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {recentOrders.length === 0 ? (
              <View style={s.emptyOrders}>
                <Ionicons name="receipt-outline" size={32} color={Colors.textMuted} />
                <Text style={s.emptyText}>No orders yet</Text>
              </View>
            ) : recentOrders.map((order: any, i: number) => {
              const customerName = order.customers?.full_name || order.customers?.username || 'Unknown'
              return (
                <View key={order.id} style={[s.orderRow, i < recentOrders.length - 1 && s.orderBorder]}>
                  <View style={s.orderLeft}>
                    <Text style={s.orderId}>Order {getOrderId(order.id)}</Text>
                    <Text style={s.orderCustomer}>{customerName}</Text>
                  </View>
                  <View style={s.orderRight}>
                    <StatusBadge status={order.status} />
                    <Text style={s.orderAmount}>{formatCurrency(parseNumber(order.total))}</Text>
                    <Text style={s.orderTime}>{getTimeAgo(order.created_at)}</Text>
                  </View>
                </View>
              )
            })}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },

  logoImage: {
    width: '100%',
    height: '100%',
  },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.lg,
    backgroundColor: Colors.brand,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  logoBox: {
     width: 36,
  height: 36,
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden', // prevents overflow
  //backgroundColor: '#fff', // optional (if image has transparency)
  },

  appTitle: { fontSize: FontSize.sm, fontWeight: '900', color: '#fff' },
  welcome: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  storeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.sm,
  },
  storeBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: '#fff' },

  body: { padding: Spacing.lg, gap: Spacing.lg },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  statCard: { flex: 1, minWidth: '44%', padding: Spacing.lg, gap: Spacing.xs },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { fontSize: FontSize.xs, fontWeight: '500', color: Colors.textMuted },
  statValue: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.textPrimary },
  statNote: { fontSize: FontSize.xs, color: Colors.textMuted },

  quickActions: { flexDirection: 'row', gap: Spacing.sm },
  qaBtn: {
    flex: 1, alignItems: 'center', gap: 6,
    backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.md,
  },
  qaText: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textAlign: 'center' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  seeAll: { fontSize: FontSize.xs, color: Colors.brand, fontWeight: '600' },
  emptyOrders: { alignItems: 'center', paddingVertical: 32, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted },

  orderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  orderBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  orderLeft: { flex: 1, gap: 2 },
  orderId: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  orderCustomer: { fontSize: FontSize.xs, color: Colors.textMuted },
  orderRight: { alignItems: 'flex-end', gap: 3 },
  orderAmount: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },
  orderTime: { fontSize: FontSize.xs, color: Colors.textMuted },
})
