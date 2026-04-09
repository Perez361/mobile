import { useCallback, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

function monthKey(iso: string) {
  return iso.slice(0, 7) // "YYYY-MM"
}

function monthLabel(key: string) {
  const [year, mon] = key.split('-')
  return new Date(Number(year), Number(mon) - 1, 1)
    .toLocaleDateString('en', { month: 'long', year: 'numeric' })
}

type MonthGroup = {
  key: string
  label: string
  orderCount: number
  itemCount: number
  needTracking: number
  arrivedCount: number
  shippingPaidCount: number
}

export default function PreOrdersScreen() {
  const router = useRouter()
  const { user, importer } = useImporterSession()
  const [groups, setGroups] = useState<MonthGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!importer) return
    const { data } = await createImporterClient()
      .from('orders')
      .select(`
        id, status, created_at,
        order_items (
          quantity,
          products (tracking_number)
        )
      `)
      .eq('store_id', importer.id)
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    const map = new Map<string, MonthGroup>()
    for (const order of data) {
      const key = monthKey(order.created_at)
      if (!map.has(key)) {
        map.set(key, { key, label: monthLabel(key), orderCount: 0, itemCount: 0, needTracking: 0, arrivedCount: 0, shippingPaidCount: 0 })
      }
      const g = map.get(key)!
      g.orderCount++

      const items: any[] = order.order_items || []
      for (const item of items) {
        g.itemCount += item.quantity || 1
        const hasTracking = !!item.products?.tracking_number
        const isActive = order.status !== 'delivered' && order.status !== 'cancelled'
        if (!hasTracking && isActive) g.needTracking++
      }
      if (order.status === 'arrived') g.arrivedCount++
      if (order.status === 'shipping_paid') g.shippingPaidCount++
    }

    setGroups(Array.from(map.values()))
    setLoading(false)
  }, [importer])

  useFocusEffect(useCallback(() => { fetchData() }, [fetchData]))
  async function onRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <SafeAreaView style={s.root}>
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.brand} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Pre-orders</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.scroll}
      >
        {groups.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />}
            title="No orders yet"
            subtitle="Customer orders will be grouped here by month"
          />
        ) : groups.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={s.card}
            onPress={() => router.push(`/(importer)/preorders/${g.key}` as any)}
            activeOpacity={0.8}
          >
            <View style={s.cardHeader}>
              <View style={s.iconBox}>
                <Ionicons name="calendar-outline" size={22} color={Colors.brand} />
              </View>
              <View style={s.cardInfo}>
                <Text style={s.cardTitle}>{g.label}</Text>
                <Text style={s.cardSub}>{g.orderCount} orders · {g.itemCount} items</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </View>

            {(g.needTracking > 0 || g.arrivedCount > 0 || g.shippingPaidCount > 0) && (
              <View style={s.badges}>
                {g.needTracking > 0 && (
                  <View style={[s.badge, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="alert-circle-outline" size={11} color="#B45309" />
                    <Text style={[s.badgeText, { color: '#B45309' }]}>{g.needTracking} need tracking</Text>
                  </View>
                )}
                {g.arrivedCount > 0 && (
                  <View style={[s.badge, { backgroundColor: '#EDE9FE' }]}>
                    <Ionicons name="cube-outline" size={11} color="#7C3AED" />
                    <Text style={[s.badgeText, { color: '#7C3AED' }]}>{g.arrivedCount} arrived — bill shipping</Text>
                  </View>
                )}
                {g.shippingPaidCount > 0 && (
                  <View style={[s.badge, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="checkmark-circle-outline" size={11} color="#065F46" />
                    <Text style={[s.badgeText, { color: '#065F46' }]}>{g.shippingPaidCount} awaiting verification</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  backText: { fontSize: FontSize.sm, color: Colors.brand, fontWeight: '500' },
  navTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconBox: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.brandLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  badgeText: { fontSize: 10, fontWeight: '600' },
})
