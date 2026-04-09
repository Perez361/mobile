import { useCallback, useState, useEffect } from 'react'
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  TextInput, Linking, StyleSheet,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { StatusBadge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAlert } from '@/components/ui/AlertModal'
import { formatCurrency, getTimeAgo, getOrderId, parseNumber } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

type OrderStatus = 'pending' | 'product_paid' | 'processing' | 'arrived' | 'shipping_billed' | 'shipping_paid' | 'delivered' | 'cancelled'

const FILTERS: { label: string; value: string; dot: string }[] = [
  { label: 'All',          value: 'all',             dot: Colors.textMuted },
  { label: 'Pending',      value: 'pending',          dot: '#D97706' },
  { label: 'Prod. Paid',   value: 'product_paid',     dot: '#3B82F6' },
  { label: 'Processing',   value: 'processing',       dot: Colors.brand },
  { label: 'Arrived',      value: 'arrived',          dot: '#7C3AED' },
  { label: 'Ship. Billed', value: 'shipping_billed',  dot: '#F97316' },
  { label: 'Ship. Paid',   value: 'shipping_paid',    dot: '#10B981' },
  { label: 'Delivered',    value: 'delivered',        dot: Colors.success },
  { label: 'Cancelled',    value: 'cancelled',        dot: Colors.danger },
]

function openWhatsApp(contact: string, message: string) {
  const phone = '233' + contact.replace(/^0/, '').replace(/\D/g, '')
  const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`
  Linking.canOpenURL(url).then((ok) => {
    if (ok) Linking.openURL(url)
  }).catch(() => Linking.openURL(url))
}

function itemsList(items: any[]): string {
  if (!items?.length) return ''
  return items.map((i: any) => `  • ${i.products?.name || 'Product'} ×${i.quantity}`).join('\n')
}

function waProductPaymentMsg(order: any): string {
  const name = order.customers?.full_name || order.customers?.username || 'there'
  const total = formatCurrency(parseNumber(order.total))
  const id = order.id.slice(-8).toUpperCase()
  const items = itemsList(order.order_items || [])
  return `Hello ${name}! 👋\n\nReminder: your product payment of *${total}* is still pending.\n\n📦 Order #${id}${items ? `\n${items}` : ''}\n\nPlease send ${total} via MoMo to confirm your order. Thank you! 🙏`
}

function waShippingMsg(order: any, fee: string): string {
  const name = order.customers?.full_name || order.customers?.username || 'there'
  const feeAmt = fee ? `GH₵${fee}` : formatCurrency(parseNumber(order.shipping_fee))
  const id = order.id.slice(-8).toUpperCase()
  const items = itemsList(order.order_items || [])
  const note = order.shipping_note ? `📝 ${order.shipping_note}\n\n` : ''
  return `Hello ${name}! 👋\n\nYour shipment has arrived! Shipping fee: *${feeAmt}*\n\n📦 Order #${id}${items ? `\n${items}` : ''}\n\n${note}Please send ${feeAmt} via MoMo to receive your order. Thank you! 🙏`
}

function waShippingReminderMsg(order: any): string {
  const name = order.customers?.full_name || order.customers?.username || 'there'
  const fee = formatCurrency(parseNumber(order.shipping_fee))
  const id = order.id.slice(-8).toUpperCase()
  const note = order.shipping_note ? `📝 ${order.shipping_note}\n\n` : ''
  return `Hello ${name}! 👋\n\nReminder: your shipping fee of *${fee}* is still pending.\n\n📦 Order #${id}\n\n${note}Please send ${fee} via MoMo to receive your order. Thank you! 🙏`
}

export default function OrdersScreen() {
  const { user, importer } = useImporterSession()
  const { showAlert } = useAlert()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Per-order inline input state
  const [momoRef, setMomoRef] = useState('')
  const [shippingFee, setShippingFee] = useState('')
  const [shippingNote, setShippingNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchOrders = useCallback(async () => {
    if (!importer) return
    const { data } = await createImporterClient()
      .from('orders')
      .select(`
        id, total, status, created_at, shipping_fee,
        product_paid, product_payment_reference,
        payment_reference, momo_number, shipping_note,
        shipping_billed_at, shipping_paid_at,
        customers (full_name, username, contact, email, location),
        order_items (quantity, price, products (name))
      `)
      .eq('store_id', importer.id)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }, [importer])

  useFocusEffect(useCallback(() => { fetchOrders() }, [fetchOrders]))
  async function onRefresh() { setRefreshing(true); await fetchOrders(); setRefreshing(false) }

  // Real-time subscription for order updates
  useEffect(() => {
    if (!importer) return
    const supabase = createImporterClient()
    const channel = supabase
      .channel(`orders-mobile-${importer.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `store_id=eq.${importer.id}`,
      }, () => {
        fetchOrders()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [importer, fetchOrders])

  function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setMomoRef('')
    setShippingFee('')
    setShippingNote('')
  }

  async function updateStatus(order: any, newStatus: OrderStatus, extra?: Record<string, any>) {
    setActionLoading(true)
    try {
      const { error } = await createImporterClient()
        .from('orders').update({ status: newStatus, ...extra }).eq('id', order.id)
      if (error) { showAlert({ type: 'error', title: 'Error', message: error.message }); return }
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: newStatus, ...extra } : o))
      setExpandedId(null)
    } finally { setActionLoading(false) }
  }

  async function confirmProductPayment(order: any) {
    await updateStatus(order, 'product_paid', {
      product_paid: true,
      product_payment_reference: momoRef || null,
    })
  }

  async function billShipping(order: any) {
    const fee = parseNumber(shippingFee)
    if (!fee || fee <= 0) { showAlert({ type: 'error', title: 'Enter fee', message: 'Enter the shipping fee amount.' }); return }
    await updateStatus(order, 'shipping_billed', {
      shipping_fee: fee,
      shipping_note: shippingNote || null,
      shipping_billed_at: new Date().toISOString(),
    })
  }

  // Step 1: Confirm payment was received (stays in shipping_paid status)
  async function verifyShippingPayment(order: any) {
    setActionLoading(true)
    try {
      const { error } = await createImporterClient()
        .from('orders')
        .update({ shipping_paid_at: new Date().toISOString() })
        .eq('id', order.id)
      if (error) { showAlert({ type: 'error', title: 'Error', message: error.message }); return }
      setOrders((prev) => prev.map((o) =>
        o.id === order.id ? { ...o, shipping_paid_at: new Date().toISOString() } : o
      ))
    } finally { setActionLoading(false) }
  }

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter)

  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const arrivedCount = orders.filter((o) => o.status === 'arrived').length
  const shippingPaidCount = orders.filter((o) => o.status === 'shipping_paid').length

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Orders</Text>
        <Text style={s.sub}>{orders.length} total</Text>
      </View>

      {/* Alert badges */}
      {(pendingCount > 0 || arrivedCount > 0 || shippingPaidCount > 0) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={s.alertsScroll} contentContainerStyle={s.alertsContent}>
          {pendingCount > 0 && (
            <TouchableOpacity style={[s.alertBadge, { backgroundColor: '#DBEAFE' }]}
              onPress={() => setFilter('pending')}>
              <Ionicons name="notifications-outline" size={12} color="#1D4ED8" />
              <Text style={[s.alertText, { color: '#1D4ED8' }]}>{pendingCount} awaiting payment</Text>
            </TouchableOpacity>
          )}
          {arrivedCount > 0 && (
            <TouchableOpacity style={[s.alertBadge, { backgroundColor: '#FEF3C7' }]}
              onPress={() => setFilter('arrived')}>
              <Ionicons name="cube-outline" size={12} color="#B45309" />
              <Text style={[s.alertText, { color: '#B45309' }]}>{arrivedCount} need shipping fee</Text>
            </TouchableOpacity>
          )}
          {shippingPaidCount > 0 && (
            <TouchableOpacity style={[s.alertBadge, { backgroundColor: '#D1FAE5' }]}
              onPress={() => setFilter('shipping_paid')}>
              <Ionicons name="checkmark-circle-outline" size={12} color="#065F46" />
              <Text style={[s.alertText, { color: '#065F46' }]}>{shippingPaidCount} to verify</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Status filters — wrapped grid, no overflow */}
      <View style={s.filtersWrap}>
        {FILTERS.map(({ label, value, dot }) => {
          const count = value === 'all' ? orders.length : orders.filter((o) => o.status === value).length
          const active = filter === value
          return (
            <TouchableOpacity key={value} onPress={() => setFilter(value as any)}
              style={[s.chip, active ? s.chipActive : s.chipInactive]}>
              <View style={[s.chipDot, { backgroundColor: active ? '#fff' : dot }]} />
              <Text style={[s.chipText, active ? s.chipTextActive : s.chipTextInactive]}>{label}</Text>
              {count > 0 && (
                <View style={[s.chipBadge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : dot + '22' }]}>
                  <Text style={[s.chipBadgeText, { color: active ? '#fff' : dot }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="receipt-outline" size={40} color={Colors.textMuted} />}
            title="No orders"
            subtitle={filter !== 'all' ? `No ${filter.replace(/_/g, ' ')} orders` : 'Orders will appear here when customers shop'}
          />
        ) : filtered.map((order: any) => {
          const c = order.customers
          const isExpanded = expandedId === order.id
          const items: any[] = order.order_items || []

          return (
            <View key={order.id} style={s.card}>
              {/* Card header — always visible */}
              <TouchableOpacity style={s.cardHeader} onPress={() => toggleExpand(order.id)} activeOpacity={0.8}>
                <View style={s.cardHeaderLeft}>
                  <Text style={s.orderId}>Order {getOrderId(order.id)}</Text>
                  <Text style={s.customerName}>
                    {c?.full_name || c?.username || 'Unknown customer'}
                  </Text>
                  {c?.contact && (
                    <View style={s.contactRow}>
                      <Ionicons name="call-outline" size={11} color={Colors.textMuted} />
                      <Text style={s.contact}>{c.contact}</Text>
                    </View>
                  )}
                  <Text style={s.time}>{getTimeAgo(order.created_at)}</Text>
                </View>
                <View style={s.cardHeaderRight}>
                  <StatusBadge status={order.status} />
                  <Text style={s.amount}>{formatCurrency(parseNumber(order.total))}</Text>
                  {order.shipping_fee ? (
                    <Text style={s.shippingFee}>+{formatCurrency(parseNumber(order.shipping_fee))}</Text>
                  ) : null}
                  <Text style={s.expandChevron}>{isExpanded ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>

              {/* Expanded panel */}
              {isExpanded && (
                <View style={s.expanded}>
                  {/* Order items */}
                  {items.length > 0 && (
                    <View style={s.itemsSection}>
                      <Text style={s.sectionLabel}>Items</Text>
                      {items.map((item: any, i: number) => (
                        <View key={i} style={s.itemRow}>
                          <Text style={s.itemName} numberOfLines={1}>
                            {item.products?.name || 'Product'}
                          </Text>
                          <Text style={s.itemQty}>×{item.quantity}</Text>
                          <Text style={s.itemPrice}>{formatCurrency(parseNumber(item.price) * item.quantity)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Status-specific action panel */}
                  {order.status === 'pending' && (
                    <View style={s.actionPanel}>
                      <View style={s.actionTitleRow}>
                        <Ionicons name="cash-outline" size={16} color={Colors.textPrimary} />
                        <Text style={s.actionTitle}>Confirm Product Payment</Text>
                      </View>
                      <TextInput
                        style={s.actionInput}
                        placeholder="MoMo reference (optional)"
                        placeholderTextColor={Colors.textMuted}
                        value={momoRef}
                        onChangeText={setMomoRef}
                      />
                      <View style={s.actionRow}>
                        <TouchableOpacity
                          style={[s.actionBtn, { flex: 1 }]}
                          onPress={() => confirmProductPayment(order)}
                          disabled={actionLoading}
                        >
                          <Text style={s.actionBtnText}>
                            {actionLoading ? 'Confirming…' : '✓ Confirm Payment'}
                          </Text>
                        </TouchableOpacity>
                        {c?.contact && (
                          <TouchableOpacity
                            style={s.waBtn}
                            onPress={() => openWhatsApp(c.contact, waProductPaymentMsg(order))}
                          >
                            <Ionicons name="logo-whatsapp" size={14} color="#fff" />
                            <Text style={s.waBtnText}>WhatsApp</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {order.status === 'product_paid' && (
                    <View style={[s.infoStrip, { backgroundColor: '#DBEAFE' }]}>
                      <View style={s.infoRow}>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#1D4ED8" />
                        <Text style={[s.infoText, { color: '#1D4ED8' }]}>
                          Product payment received — {formatCurrency(parseNumber(order.total))}
                          {order.product_payment_reference ? ` (Ref: ${order.product_payment_reference})` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[s.actionBtn, { marginTop: Spacing.sm }]}
                        onPress={() => updateStatus(order, 'processing')}
                        disabled={actionLoading}
                      >
                        <Text style={s.actionBtnText}>Mark as Processing</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {order.status === 'processing' && (
                    <View style={[s.infoStrip, { backgroundColor: '#EFF6FF' }]}>
                      <View style={s.infoRow}>
                        <Ionicons name="sync-outline" size={14} color="#2563EB" />
                        <Text style={[s.infoText, { color: '#2563EB' }]}>Order is being processed</Text>
                      </View>
                      <TouchableOpacity
                        style={[s.actionBtn, { marginTop: Spacing.sm }]}
                        onPress={() => updateStatus(order, 'arrived')}
                        disabled={actionLoading}
                      >
                        <Text style={s.actionBtnText}>Mark as Arrived</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {order.status === 'arrived' && (
                    <View style={s.actionPanel}>
                      <View style={s.actionTitleRow}>
                        <Ionicons name="boat-outline" size={16} color={Colors.textPrimary} />
                        <Text style={s.actionTitle}>Bill Shipping Fee</Text>
                      </View>
                      <TextInput
                        style={s.actionInput}
                        placeholder="Shipping fee (GH₵)"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                        value={shippingFee}
                        onChangeText={setShippingFee}
                      />
                      <TextInput
                        style={[s.actionInput, { marginTop: Spacing.sm }]}
                        placeholder="Note for customer (optional)"
                        placeholderTextColor={Colors.textMuted}
                        value={shippingNote}
                        onChangeText={setShippingNote}
                      />
                      <View style={s.actionRow}>
                        <TouchableOpacity
                          style={[s.actionBtn, { flex: 1 }]}
                          onPress={() => billShipping(order)}
                          disabled={actionLoading}
                        >
                          <Text style={s.actionBtnText}>
                            {actionLoading ? 'Billing…' : 'Bill Customer'}
                          </Text>
                        </TouchableOpacity>
                        {c?.contact && (
                          <TouchableOpacity
                            style={s.waBtn}
                            onPress={() => openWhatsApp(c.contact, waShippingMsg(order, shippingFee))}
                          >
                            <Ionicons name="logo-whatsapp" size={14} color="#fff" />
                            <Text style={s.waBtnText}>WhatsApp</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {order.status === 'shipping_billed' && (
                    <View style={[s.infoStrip, { backgroundColor: '#FEF3C7' }]}>
                      <View style={s.infoRow}>
                        <Ionicons name="receipt-outline" size={14} color="#B45309" />
                        <Text style={[s.infoText, { color: '#B45309' }]}>
                          Shipping fee billed: {formatCurrency(parseNumber(order.shipping_fee))}
                          {order.shipping_note ? `\n"${order.shipping_note}"` : ''}
                        </Text>
                      </View>
                      {c?.contact && (
                        <TouchableOpacity
                          style={[s.waBtn, { marginTop: Spacing.sm, alignSelf: 'flex-start' }]}
                          onPress={() => openWhatsApp(c.contact, waShippingReminderMsg(order))}
                        >
                          <Ionicons name="logo-whatsapp" size={14} color="#fff" />
                          <Text style={s.waBtnText}>Remind on WhatsApp</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {order.status === 'shipping_paid' && !order.shipping_paid_at && (
                    <View style={s.actionPanel}>
                      <View style={s.actionTitleRow}>
                        <Ionicons name="cash-outline" size={16} color={Colors.textPrimary} />
                        <Text style={s.actionTitle}>Verify Shipping Payment</Text>
                      </View>
                      <View style={[s.infoRow, { marginTop: 2 }]}>
                        <Text style={[s.infoText, { color: Colors.textMuted }]}>
                          Customer submitted payment
                          {order.momo_number ? `\nMoMo: ${order.momo_number}` : ''}
                          {order.payment_reference ? `\nRef: ${order.payment_reference}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[s.actionBtn, { marginTop: Spacing.sm }]}
                        onPress={() => verifyShippingPayment(order)}
                        disabled={actionLoading}
                      >
                        <Text style={s.actionBtnText}>
                          {actionLoading ? 'Verifying…' : 'Verify Payment Received'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {order.status === 'shipping_paid' && !!order.shipping_paid_at && (
                    <View style={s.actionPanel}>
                      <View style={s.infoRow}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                        <Text style={[s.infoText, { color: Colors.success }]}>
                          Payment verified — {formatCurrency(parseNumber(order.shipping_fee))} received
                        </Text>
                      </View>
                      <Text style={s.actionHint}>
                        Once you've physically handed the item to the customer, mark it as delivered.
                      </Text>
                      <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: Colors.success }]}
                        onPress={() => updateStatus(order, 'delivered')}
                        disabled={actionLoading}
                      >
                        <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
                        <Text style={s.actionBtnText}>
                          {actionLoading ? 'Updating…' : 'Mark as Delivered'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {order.status === 'delivered' && (
                    <View style={[s.infoStrip, { backgroundColor: Colors.successLight }]}>
                      <View style={s.infoRow}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                        <Text style={[s.infoText, { color: Colors.success }]}>
                          Order complete — {formatCurrency(parseNumber(order.total) + parseNumber(order.shipping_fee))} collected
                        </Text>
                      </View>
                    </View>
                  )}

                  {order.status === 'cancelled' && (
                    <View style={[s.infoStrip, { backgroundColor: Colors.dangerLight }]}>
                      <View style={s.infoRow}>
                        <Ionicons name="close-circle-outline" size={14} color={Colors.danger} />
                        <Text style={[s.infoText, { color: Colors.danger }]}>Order cancelled</Text>
                      </View>
                    </View>
                  )}

                  {/* Cancel button for pending/product_paid */}
                  {(order.status === 'pending' || order.status === 'product_paid') && (
                    <TouchableOpacity
                      style={s.cancelBtn}
                      onPress={() => showAlert({
                        type: 'confirm',
                        title: 'Cancel Order',
                        message: `Cancel order ${getOrderId(order.id)}?`,
                        confirmText: 'Cancel Order',
                        cancelText: 'No',
                        onConfirm: () => updateStatus(order, 'cancelled'),
                      })}
                    >
                      <Text style={s.cancelBtnText}>Cancel Order</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: {
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.md,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },

  alertsScroll: { backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: Colors.border },
  alertsContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm, alignItems: 'center' },
  alertBadge: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full },
  alertText: { fontSize: FontSize.xs, fontWeight: '600' },

  filtersWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1,
  },
  chipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.border },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipTextInactive: { color: Colors.textMuted },
  chipBadge: { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  chipBadgeText: { fontSize: 10, fontWeight: '700' },

  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },

  card: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden',
    boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.06)',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: Spacing.lg, gap: Spacing.md,
  },
  cardHeaderLeft: { flex: 1, gap: 3 },
  orderId: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  customerName: { fontSize: FontSize.sm, color: Colors.textMuted },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  contact: { fontSize: FontSize.xs, color: Colors.textMuted },
  time: { fontSize: FontSize.xs, color: Colors.textMuted },
  cardHeaderRight: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.success },
  shippingFee: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: '600' },
  expandChevron: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  expanded: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    padding: Spacing.lg, gap: Spacing.md,
  },

  itemsSection: { gap: Spacing.xs },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemName: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  itemQty: { fontSize: FontSize.xs, color: Colors.textMuted },
  itemPrice: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },

  actionPanel: {
    backgroundColor: Colors.surface, borderRadius: 10, padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  actionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  actionInput: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 8,
    fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.brand, borderRadius: Radius.sm,
    paddingVertical: 10,
  },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  actionHint: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
  waBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#25D366', borderRadius: Radius.sm,
    paddingVertical: 10, paddingHorizontal: Spacing.md,
  },
  waBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#fff' },

  infoStrip: { borderRadius: 10, padding: Spacing.md, gap: Spacing.xs },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  infoText: { fontSize: FontSize.sm, fontWeight: '500', lineHeight: 20, flex: 1 },

  cancelBtn: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: Spacing.md },
  cancelBtnText: { fontSize: FontSize.xs, color: Colors.danger, fontWeight: '600' },
})
