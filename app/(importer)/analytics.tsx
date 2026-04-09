import { useCallback, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatCurrency, parseNumber } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

type Period = '7d' | '30d' | '90d' | '1y'
const DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }

function pct(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? '+100%' : '0%'
  const d = ((cur - prev) / prev) * 100
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`
}

function fmt(v: number) {
  return v.toLocaleString('en-GH', { maximumFractionDigits: 0 })
}

const STATUS_CONFIG = [
  { key: 'pending',         label: 'Pending',         color: '#D97706' },
  { key: 'product_paid',    label: 'Product Paid',    color: '#3B82F6' },
  { key: 'processing',      label: 'Processing',      color: Colors.brand },
  { key: 'arrived',         label: 'Arrived',         color: '#7C3AED' },
  { key: 'shipping_billed', label: 'Shipping Billed', color: '#F97316' },
  { key: 'shipping_paid',   label: 'Shipping Paid',   color: '#10B981' },
  { key: 'delivered',       label: 'Delivered',       color: Colors.success },
  { key: 'cancelled',       label: 'Cancelled',       color: Colors.danger },
]

export default function AnalyticsScreen() {
  const router = useRouter()
  const { user, importer } = useImporterSession()
  const [period, setPeriod] = useState<Period>('30d')
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = useCallback(async () => {
    if (!importer) return
    const supabase = createImporterClient()
    const days = DAYS[period]
    const since = new Date(); since.setDate(since.getDate() - days)
    const prevSince = new Date(); prevSince.setDate(prevSince.getDate() - days * 2)
    const sinceISO = since.toISOString()
    const prevSinceISO = prevSince.toISOString()

    const [
      { data: orders },
      { data: prevOrders },
      { data: allOrders },
      { data: customers },
      { data: prevCustomers },
      { data: orderItems },
      { data: products },
    ] = await Promise.all([
      supabase.from('orders').select('id, total, shipping_fee, status, created_at').eq('store_id', importer.id).gte('created_at', sinceISO),
      supabase.from('orders').select('id, total, shipping_fee, status').eq('store_id', importer.id).gte('created_at', prevSinceISO).lt('created_at', sinceISO),
      supabase.from('orders').select('id, total, shipping_fee, status, created_at').eq('store_id', importer.id),
      supabase.from('customers').select('id').eq('store_id', importer.id).gte('created_at', sinceISO),
      supabase.from('customers').select('id').eq('store_id', importer.id).gte('created_at', prevSinceISO).lt('created_at', sinceISO),
      supabase.from('order_items').select('product_id, quantity, price, order_id').in('order_id', (orders || []).map((o: any) => o.id)),
      supabase.from('products').select('id, name').eq('importer_id', importer.id),
    ])

    const paid = (orders || []).filter((o: any) => o.status !== 'cancelled')
    const prevPaid = (prevOrders || []).filter((o: any) => o.status !== 'cancelled')
    const allPaid = (allOrders || []).filter((o: any) => o.status !== 'cancelled')

    const revenue = paid.reduce((s: number, o: any) => s + parseNumber(o.total) + parseNumber(o.shipping_fee), 0)
    const prevRevenue = prevPaid.reduce((s: number, o: any) => s + parseNumber(o.total) + parseNumber(o.shipping_fee), 0)
    const allRevenue = allPaid.reduce((s: number, o: any) => s + parseNumber(o.total) + parseNumber(o.shipping_fee), 0)

    const productRevenue = paid.reduce((s: number, o: any) => s + parseNumber(o.total), 0)
    const shippingRevenue = paid.reduce((s: number, o: any) => s + parseNumber(o.shipping_fee), 0)
    const prevShippingRevenue = prevPaid.reduce((s: number, o: any) => s + parseNumber(o.shipping_fee), 0)
    const deliveredRevenue = (orders || []).filter((o: any) => o.status === 'delivered').reduce((s: number, o: any) => s + parseNumber(o.total) + parseNumber(o.shipping_fee), 0)
    const cancelledRevenue = (orders || []).filter((o: any) => o.status === 'cancelled').reduce((s: number, o: any) => s + parseNumber(o.total) + parseNumber(o.shipping_fee), 0)

    // Status breakdown
    const statusMap: Record<string, number> = {}
    for (const o of (orders || [])) {
      const s = o.status || 'pending'
      statusMap[s] = (statusMap[s] || 0) + 1
    }

    // Top products
    const productMap = new Map((products || []).map((p: any) => [p.id, p.name]))
    const productStats = new Map<string, { count: number; revenue: number }>()
    for (const item of orderItems || []) {
      const e = productStats.get(item.product_id) || { count: 0, revenue: 0 }
      productStats.set(item.product_id, { count: e.count + item.quantity, revenue: e.revenue + parseNumber(item.price) * item.quantity })
    }
    const topProducts = Array.from(productStats.entries())
      .map(([id, s]) => ({ name: productMap.get(id) || 'Unknown', ...s }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 5)

    // Monthly revenue (last 6 months, all orders)
    const monthly: { label: string; revenue: number; products: number; shipping: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const key = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('en', { month: 'short' })
      const monthOrders = (allOrders || []).filter((o: any) => o.created_at?.slice(0, 7) === key && o.status !== 'cancelled')
      const monthProducts = monthOrders.reduce((s: number, o: any) => s + parseNumber(o.total), 0)
      const monthShipping = monthOrders.reduce((s: number, o: any) => s + parseNumber(o.shipping_fee), 0)
      monthly.push({ label, revenue: Math.round(monthProducts + monthShipping), products: Math.round(monthProducts), shipping: Math.round(monthShipping) })
    }

    setStats({
      revenue, prevRevenue, allRevenue,
      productRevenue, shippingRevenue, prevShippingRevenue,
      deliveredRevenue, cancelledRevenue,
      orders: paid.length, prevOrders: prevPaid.length,
      totalOrders: (orders || []).length,
      customers: (customers || []).length, prevCustomers: (prevCustomers || []).length,
      avgOrderValue: paid.length > 0 ? revenue / paid.length : 0,
      prevAvgOrderValue: prevPaid.length > 0 ? prevRevenue / prevPaid.length : 0,
      statusMap,
      topProducts,
      monthly,
    })
    setLoading(false)
  }, [importer, period])

  useFocusEffect(useCallback(() => { fetchStats() }, [fetchStats]))
  async function onRefresh() { setRefreshing(true); await fetchStats(); setRefreshing(false) }

  if (loading) return <LoadingSpinner fullScreen />

  const kpis = stats ? [
    { label: 'Total Revenue',     value: formatCurrency(stats.revenue),        change: pct(stats.revenue, stats.prevRevenue),              positive: stats.revenue >= stats.prevRevenue },
    { label: 'Shipping Collected',value: formatCurrency(stats.shippingRevenue), change: pct(stats.shippingRevenue, stats.prevShippingRevenue), positive: stats.shippingRevenue >= stats.prevShippingRevenue },
    { label: 'Orders',            value: String(stats.orders),                 change: pct(stats.orders, stats.prevOrders),                 positive: stats.orders >= stats.prevOrders },
    { label: 'Avg. Order',        value: formatCurrency(stats.avgOrderValue),   change: pct(stats.avgOrderValue, stats.prevAvgOrderValue),   positive: stats.avgOrderValue >= stats.prevAvgOrderValue },
    { label: 'New Customers',     value: String(stats.customers),              change: pct(stats.customers, stats.prevCustomers),           positive: stats.customers >= stats.prevCustomers },
    { label: 'Product Revenue',   value: formatCurrency(stats.productRevenue),  change: '',                                                  positive: true },
  ] : []

  const maxMonthly = stats ? Math.max(...stats.monthly.map((m: any) => m.revenue), 1) : 1

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.brand} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Analytics & Finances</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.periodRow}>
        {(['7d', '30d', '90d', '1y'] as Period[]).map((p) => (
          <TouchableOpacity key={p} onPress={() => { setPeriod(p); setLoading(true) }} style={[s.period, period === p ? s.periodActive : s.periodInactive]}>
            <Text style={[s.periodText, period === p ? s.periodTextActive : s.periodTextInactive]}>{p === '7d' ? '7 days' : p === '30d' ? '30 days' : p === '90d' ? '90 days' : '1 year'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={s.list}>

        {/* KPI Grid */}
        <View style={s.kpiGrid}>
          {kpis.map(({ label, value, change, positive }) => (
            <Card key={label} style={s.kpiCard}>
              <Text style={s.kpiLabel}>{label}</Text>
              <Text style={s.kpiValue}>{value}</Text>
              {!!change && (
                <View style={s.kpiChangeRow}>
                  <Ionicons
                    name={positive ? 'arrow-up' : 'arrow-down'}
                    size={10}
                    color={positive ? Colors.success : Colors.danger}
                  />
                  <Text style={[s.kpiChange, { color: positive ? Colors.success : Colors.danger }]}>{change} vs prev</Text>
                </View>
              )}
            </Card>
          ))}
        </View>

        {/* Monthly Revenue Chart */}
        {stats && (
          <Card style={s.card}>
            <View style={s.cardTitleRow}>
              <View>
                <Text style={s.cardTitle}>Monthly Revenue</Text>
                <Text style={s.cardSub}>Last 6 months · excl. cancelled</Text>
              </View>
              <Ionicons name="bar-chart-outline" size={16} color={Colors.textMuted} />
            </View>

            {stats.monthly.every((m: any) => m.revenue === 0) ? (
              <Text style={s.emptyText}>No revenue data yet</Text>
            ) : (
              <View style={s.chartContainer}>
                {stats.monthly.map((m: any) => {
                  const totalPct = Math.max((m.revenue / maxMonthly) * 100, m.revenue > 0 ? 4 : 0)
                  const shippingPct = m.revenue > 0 ? (m.shipping / m.revenue) * 100 : 0
                  return (
                    <View key={m.label} style={s.barCol}>
                      {m.revenue > 0 && (
                        <Text style={s.barValue}>
                          {m.revenue >= 1000 ? `${Math.round(m.revenue / 1000)}k` : `${Math.round(m.revenue)}`}
                        </Text>
                      )}
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { height: `${totalPct}%` as any }]}>
                          {shippingPct > 0 && (
                            <View style={[s.barShipping, { height: `${shippingPct}%` as any }]} />
                          )}
                        </View>
                      </View>
                      <Text style={s.barLabel}>{m.label}</Text>
                    </View>
                  )
                })}
              </View>
            )}

            <View style={s.chartLegend}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: Colors.brand }]} />
                <Text style={s.legendText}>Products</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: '#F97316' }]} />
                <Text style={s.legendText}>Shipping</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Order Status Breakdown */}
        {stats && stats.totalOrders > 0 && (
          <Card style={s.card}>
            <Text style={s.cardTitle}>Order Status</Text>
            {STATUS_CONFIG.map(({ key, label, color }) => {
              const count = stats.statusMap[key] || 0
              if (count === 0) return null
              const pctVal = stats.totalOrders > 0 ? Math.round((count / stats.totalOrders) * 100) : 0
              return (
                <View key={key} style={s.statusRow}>
                  <View style={s.statusLabelRow}>
                    <Text style={s.statusLabel}>{label}</Text>
                    <Text style={s.statusCount}>{count} <Text style={s.statusPct}>({pctVal}%)</Text></Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${pctVal}%` as any, backgroundColor: color }]} />
                  </View>
                </View>
              )
            })}
          </Card>
        )}

        {/* Top Products */}
        {stats && stats.topProducts.length > 0 && (
          <Card style={s.card}>
            <Text style={s.cardTitle}>Top Products <Text style={s.cardTitleMuted}>by revenue</Text></Text>
            {stats.topProducts.map((p: any, i: number) => {
              const maxRev = stats.topProducts[0]?.revenue || 1
              const barPct = Math.round((p.revenue / maxRev) * 100)
              return (
                <View key={p.name} style={s.productRow}>
                  <View style={s.rankBox}><Text style={s.rankText}>{i + 1}</Text></View>
                  <View style={s.productInfo}>
                    <Text style={s.productName} numberOfLines={1}>{p.name}</Text>
                    <View style={s.productBarTrack}>
                      <View style={[s.productBarFill, { width: `${barPct}%` as any }]} />
                    </View>
                  </View>
                  <View style={s.productRight}>
                    <Text style={s.productRevText}>{formatCurrency(p.revenue)}</Text>
                    <Text style={s.productUnits}>{p.count} units</Text>
                  </View>
                </View>
              )
            })}
          </Card>
        )}

        {/* Revenue Summary */}
        {stats && (
          <Card style={s.card}>
            <Text style={s.cardTitle}>Revenue Summary</Text>
            {[
              { label: 'Gross Revenue', note: 'excl. cancelled', value: stats.revenue, color: Colors.textPrimary, icon: 'trending-up-outline' as const, iconColor: Colors.success },
              { label: 'Product Revenue', note: 'product prices only', value: stats.productRevenue, color: Colors.brand, icon: 'pricetag-outline' as const, iconColor: Colors.brand },
              { label: 'Shipping Collected', note: 'shipping fees billed', value: stats.shippingRevenue, color: '#F97316', icon: 'boat-outline' as const, iconColor: '#F97316' },
              { label: 'Delivered Revenue', note: 'confirmed delivered', value: stats.deliveredRevenue, color: Colors.success, icon: 'checkmark-circle-outline' as const, iconColor: Colors.success },
              { label: 'Lost to Cancellations', note: 'cancelled order value', value: stats.cancelledRevenue, color: Colors.danger, icon: 'close-circle-outline' as const, iconColor: Colors.danger },
              { label: 'All-time Revenue', note: 'since account creation', value: stats.allRevenue, color: Colors.textPrimary, icon: 'calendar-outline' as const, iconColor: '#7C3AED' },
            ].map(({ label, note, value, color, icon, iconColor }) => (
              <View key={label} style={s.summaryRow}>
                <View style={[s.summaryIcon, { backgroundColor: iconColor + '20' }]}>
                  <Ionicons name={icon} size={16} color={iconColor} />
                </View>
                <View style={s.summaryInfo}>
                  <Text style={s.summaryLabel}>{label}</Text>
                  <Text style={s.summaryNote}>{note}</Text>
                </View>
                <Text style={[s.summaryValue, { color }]}>{formatCurrency(value)}</Text>
              </View>
            ))}
          </Card>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  backText: { fontSize: FontSize.sm, color: Colors.brand, fontWeight: '500' },
  title: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },

  periodRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    gap: Spacing.sm, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  period: { flex: 1, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center' },
  periodActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  periodInactive: { backgroundColor: Colors.surface, borderColor: Colors.border },
  periodText: { fontSize: 10, fontWeight: '600' },
  periodTextActive: { color: '#fff' },
  periodTextInactive: { color: Colors.textMuted },

  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  kpiCard: { flex: 1, minWidth: '44%', padding: Spacing.lg, gap: 4 },
  kpiLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary },
  kpiChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  kpiChange: { fontSize: FontSize.xs, fontWeight: '600' },

  card: { padding: Spacing.lg, gap: Spacing.md },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  cardTitleMuted: { fontSize: FontSize.base, fontWeight: '400', color: Colors.textMuted },
  cardSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },

  // Chart
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: Spacing.sm },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barValue: { fontSize: 9, color: Colors.textMuted },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: Colors.brand, opacity: 0.8, borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-start' },
  barShipping: { width: '100%', backgroundColor: '#F97316' },
  barLabel: { fontSize: 10, color: Colors.textMuted },
  chartLegend: { flexDirection: 'row', gap: Spacing.lg, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Status
  statusRow: { gap: 4 },
  statusLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  statusCount: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textPrimary },
  statusPct: { fontWeight: '400', color: Colors.textMuted },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.surface, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  // Top Products
  productRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rankBox: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.brand },
  productInfo: { flex: 1, gap: 4 },
  productName: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textPrimary },
  productBarTrack: { height: 4, borderRadius: 2, backgroundColor: Colors.surface, overflow: 'hidden' },
  productBarFill: { height: '100%', borderRadius: 2, backgroundColor: Colors.brand },
  productRight: { alignItems: 'flex-end', gap: 2 },
  productRevText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.success },
  productUnits: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Revenue Summary
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.sm, borderRadius: 10, backgroundColor: Colors.surface },
  summaryIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  summaryInfo: { flex: 1 },
  summaryLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  summaryNote: { fontSize: FontSize.xs, color: Colors.textMuted },
  summaryValue: { fontSize: FontSize.sm, fontWeight: '700' },
})
