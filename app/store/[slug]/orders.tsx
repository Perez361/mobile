import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  TextInput, ActivityIndicator, Image, StyleSheet,
} from 'react-native'
import { useAlert } from '@/components/ui/AlertModal'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useCustomerContext } from '@/lib/hooks/CustomerContext'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatCurrency, parseNumber } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string
  quantity: number
  price: number
  products: { name: string; price: number; image_url?: string | null }
}

interface Order {
  id: string
  total: number
  status: string
  created_at: string
  shipping_fee?: number | null
  shipping_note?: string | null
  payment_reference?: string | null
  momo_number?: string | null
  order_items: OrderItem[]
}

interface MonthGroup {
  key: string
  label: string
  orders: Order[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  product_paid: 'Product Paid',
  processing: 'Processing',
  arrived: 'Arrived',
  shipping_billed: 'Shipping Due',
  shipping_paid: 'Shipping Paid',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF9C3', text: '#A16207' },
  product_paid: { bg: '#DBEAFE', text: '#1D4ED8' },
  processing: { bg: '#EEF2FF', text: '#4338CA' },
  arrived: { bg: '#F3E8FF', text: '#7E22CE' },
  shipping_billed: { bg: '#FFEDD5', text: '#C2410C' },
  shipping_paid: { bg: '#DCFCE7', text: '#15803D' },
  delivered: { bg: '#D1FAE5', text: '#065F46' },
  cancelled: { bg: '#FEE2E2', text: '#B91C1C' },
}

const nv = (v: any) => parseFloat(String(v || 0)) || 0

function monthKey(d: string) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order, slug, onUpdate,
}: {
  order: Order
  slug: string
  onUpdate: (id: string, patch: Partial<Order>) => void
}) {
  const { showAlert } = useAlert()
  const [expanded, setExpanded] = useState(false)
  const [momoNumber, setMomoNumber] = useState(order.momo_number || '')
  const [reference, setReference] = useState(order.payment_reference || '')
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const status = (order.status || 'pending').toLowerCase()
  const productTotal = nv(order.total)
  const shippingFee = nv(order.shipping_fee)
  const grandTotal = productTotal + shippingFee
  const statusStyle = STATUS_COLORS[status] || { bg: '#F1F5F9', text: '#64748B' }

  const itemSummary = order.order_items
    .map(i => `${i.products?.name} ×${i.quantity}`)
    .join(', ')

  async function handlePay() {
    if (!momoNumber.trim() || !reference.trim()) {
      showAlert({ type: 'error', title: 'Missing info', message: 'Enter your MoMo number and transaction reference.' })
      return
    }
    setPaying(true)
    const { error } = await createCustomerClient(slug)
      .from('orders')
      .update({ momo_number: momoNumber.trim(), payment_reference: reference.trim(), status: 'shipping_paid' })
      .eq('id', order.id)
    setPaying(false)
    if (error) { showAlert({ type: 'error', title: 'Error', message: error.message }); return }
    showAlert({ type: 'success', title: 'Payment submitted', message: 'The importer will verify your payment and arrange delivery.' })
    onUpdate(order.id, { status: 'shipping_paid', momo_number: momoNumber, payment_reference: reference })
  }

  async function handleCancel() {
    showAlert({
      type: 'confirm',
      title: 'Cancel order?',
      message: 'This cannot be undone. Your order will be marked as cancelled.',
      confirmText: 'Yes, cancel',
      cancelText: 'Keep order',
      onConfirm: async () => {
        setCancelling(true)
        const { error } = await createCustomerClient(slug)
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', order.id)
          .eq('status', 'pending')
        setCancelling(false)
        if (error) { showAlert({ type: 'error', title: 'Error', message: error.message }); return }
        onUpdate(order.id, { status: 'cancelled' })
        setExpanded(false)
      },
    })
  }

  return (
    <View style={oc.card}>
      {/* Summary row — tappable to expand */}
      <TouchableOpacity style={oc.row} onPress={() => setExpanded(prev => !prev)} activeOpacity={0.7}>
        <View style={oc.iconBox}>
          <Ionicons name="cube-outline" size={16} color={Colors.textMuted} />
        </View>
        <View style={oc.rowMid}>
          <Text style={oc.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
          <Text style={oc.rowItems} numberOfLines={1}>{itemSummary}</Text>
        </View>
        <View style={oc.rowRight}>
          <Text style={oc.grandTotal}>GH₵{grandTotal.toLocaleString('en-GH', { maximumFractionDigits: 0 })}</Text>
          {shippingFee > 0 && (
            <Text style={oc.shippingChip}>+GH₵{shippingFee.toLocaleString('en-GH', { maximumFractionDigits: 0 })} ship</Text>
          )}
          <View style={[oc.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[oc.badgeText, { color: statusStyle.text }]}>
              {STATUS_LABELS[status] || status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {/* Expanded detail */}
      {expanded && (
        <View style={oc.detail}>

          {/* Items breakdown */}
          <View style={oc.itemsBox}>
            {order.order_items.map((item, i) => (
              <View
                key={i}
                style={[oc.itemRow, i < order.order_items.length - 1 && oc.itemRowBorder]}
              >
                <View style={oc.itemThumb}>
                  {item.products?.image_url
                    ? <Image source={{ uri: item.products.image_url }} style={oc.itemThumbImg} resizeMode="cover" />
                    : <Ionicons name="cube-outline" size={14} color="#CBD5E1" />}
                </View>
                <View style={oc.itemName}>
                  <Text style={oc.itemNameText} numberOfLines={1}>{item.products?.name}</Text>
                  <Text style={oc.itemQty}>Qty: {item.quantity}</Text>
                </View>
                <Text style={oc.itemLineTotal}>
                  GH₵{(nv(item.products?.price) * item.quantity).toLocaleString('en-GH', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            ))}

            {/* Totals footer */}
            <View style={oc.totals}>
              <View style={oc.totalRow}>
                <Text style={oc.totalLabel}>Product Total</Text>
                <Text style={oc.totalVal}>GH₵{productTotal.toLocaleString('en-GH', { maximumFractionDigits: 0 })}</Text>
              </View>
              {shippingFee > 0 && (
                <View style={oc.totalRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="airplane-outline" size={12} color="#C2410C" />
                    <Text style={[oc.totalLabel, { color: '#C2410C' }]}>Shipping Fee</Text>
                  </View>
                  <Text style={[oc.totalVal, { color: '#C2410C' }]}>
                    GH₵{shippingFee.toLocaleString('en-GH', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              )}
              <View style={[oc.totalRow, oc.totalGrand]}>
                <Text style={oc.grandLabel}>Grand Total</Text>
                <Text style={oc.grandVal}>
                  GH₵{grandTotal.toLocaleString('en-GH', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Pending: info + cancel ── */}
          {status === 'pending' && (
            <View style={oc.infoBox}>
              <Ionicons name="time-outline" size={15} color="#A16207" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={[oc.infoText, { color: '#A16207' }]}>
                  Awaiting payment confirmation. The importer will process your order once payment is verified.
                </Text>
                <TouchableOpacity
                  style={oc.cancelLink}
                  onPress={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling
                    ? <ActivityIndicator size={12} color={Colors.danger} />
                    : <Ionicons name="close-circle-outline" size={13} color={Colors.danger} />}
                  <Text style={oc.cancelLinkText}>Cancel this order</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Shipping billed: payment form ── */}
          {status === 'shipping_billed' && (
            <View style={oc.paymentBox}>
              <View style={oc.paymentHeader}>
                <Ionicons name="alert-circle-outline" size={18} color="#C2410C" />
                <View style={{ flex: 1 }}>
                  <Text style={oc.paymentTitle}>
                    Shipping fee due — GH₵{shippingFee.toLocaleString('en-GH', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={oc.paymentSub}>
                    Your items have arrived! Pay the shipping fee via MoMo to receive your order.
                  </Text>
                  {order.shipping_note ? (
                    <View style={oc.noteBox}>
                      <Ionicons name="document-text-outline" size={12} color={Colors.textMuted} />
                      <Text style={oc.noteText}>{order.shipping_note}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={oc.paymentFields}>
                <View>
                  <Text style={oc.fieldLabel}>Your MoMo Number</Text>
                  <TextInput
                    style={oc.fieldInput}
                    value={momoNumber}
                    onChangeText={setMomoNumber}
                    placeholder="e.g. 0551234567"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
                <View>
                  <Text style={oc.fieldLabel}>Transaction Reference</Text>
                  <TextInput
                    style={oc.fieldInput}
                    value={reference}
                    onChangeText={setReference}
                    placeholder="e.g. ABC123456"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
                <TouchableOpacity
                  style={[oc.payBtn, paying && { opacity: 0.6 }]}
                  onPress={handlePay}
                  disabled={paying}
                  activeOpacity={0.85}
                >
                  {paying
                    ? <ActivityIndicator color="#fff" size="small" />
                    : (
                      <>
                        <Ionicons name="send-outline" size={15} color="#fff" />
                        <Text style={oc.payBtnText}>Submit Shipping Payment</Text>
                      </>
                    )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Shipping paid ── */}
          {status === 'shipping_paid' && (
            <View style={[oc.infoBox, { backgroundColor: Colors.successLight }]}>
              <Ionicons name="checkmark-circle-outline" size={15} color={Colors.success} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={[oc.infoText, { color: '#065F46', fontWeight: '700' }]}>Payment submitted</Text>
                <Text style={[oc.infoText, { color: '#065F46' }]}>
                  The importer will verify your payment and arrange delivery.
                </Text>
              </View>
            </View>
          )}

          {/* ── Delivered ── */}
          {status === 'delivered' && (
            <View style={[oc.infoBox, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="checkmark-circle" size={15} color="#065F46" style={{ marginTop: 1 }} />
              <Text style={[oc.infoText, { color: '#065F46', fontWeight: '700', flex: 1 }]}>
                Order delivered — enjoy your items!
              </Text>
            </View>
          )}

          {/* ── Cancelled ── */}
          {status === 'cancelled' && (
            <View style={[oc.infoBox, { backgroundColor: Colors.dangerLight }]}>
              <Ionicons name="close-circle-outline" size={15} color={Colors.danger} style={{ marginTop: 1 }} />
              <Text style={[oc.infoText, { color: Colors.danger, fontWeight: '700', flex: 1 }]}>
                Order cancelled
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

// ─── Month Group ──────────────────────────────────────────────────────────────

function MonthGroupCard({
  group, slug, onUpdate,
}: {
  group: MonthGroup
  slug: string
  onUpdate: (id: string, patch: Partial<Order>) => void
}) {
  const { showAlert } = useAlert()
  const [open, setOpen] = useState(true)
  const [orders, setOrders] = useState(group.orders)

  const handleUpdate = (id: string, patch: Partial<Order>) => {
    setOrders((prev: Order[]) => prev.map((o: Order) => o.id === id ? { ...o, ...patch } : o))
    onUpdate(id, patch)
  }

  const totalProducts = orders.reduce((s: number, o: Order) => s + nv(o.total), 0)
  const totalShipping = orders.reduce((s: number, o: Order) => s + nv(o.shipping_fee), 0)
  const grandTotal = totalProducts + totalShipping

  // For bulk shipping payment
  const shippingBilledOrders = orders.filter(o => o.status === 'shipping_billed')
  const totalShippingDue = shippingBilledOrders.reduce((s: number, o: Order) => s + nv(o.shipping_fee), 0)
  const [momoNumber, setMomoNumber] = useState('')
  const [reference, setReference] = useState('')
  const [paying, setPaying] = useState(false)

  async function handlePayAll() {
    if (!momoNumber.trim() || !reference.trim()) {
      showAlert({ type: 'error', title: 'Missing info', message: 'Enter your MoMo number and transaction reference.' })
      return
    }
    setPaying(true)
    
    for (const order of shippingBilledOrders) {
      const { error } = await createCustomerClient(slug)
        .from('orders')
        .update({ momo_number: momoNumber.trim(), payment_reference: reference.trim(), status: 'shipping_paid' })
        .eq('id', order.id)
      if (error) {
        showAlert({ type: 'error', title: 'Error', message: `Payment failed for order #${order.id.slice(-6)}: ${error.message}` })
      } else {
        handleUpdate(order.id, { status: 'shipping_paid', momo_number: momoNumber, payment_reference: reference })
      }
    }
    
    setPaying(false)
    showAlert({ type: 'success', title: 'Payment submitted', message: `Shipping payment submitted for ${shippingBilledOrders.length} order${shippingBilledOrders.length > 1 ? 's' : ''}! The importer will verify and deliver your orders.` })
    setMomoNumber('')
    setReference('')
  }

  return (
    <View style={mg.card}>
      {/* Month header */}
      <TouchableOpacity style={mg.header} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <View style={mg.headerLeft}>
          <View style={mg.receiptBox}>
            <Ionicons name="receipt-outline" size={16} color={Colors.brand} />
          </View>
          <View>
            <Text style={mg.monthLabel}>{group.label}</Text>
            <Text style={mg.monthSub}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={mg.headerRight}>
          <Text style={mg.monthTotal}>
            GH₵{grandTotal.toLocaleString('en-GH', { maximumFractionDigits: 0 })}
          </Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>

      {open && (
        <View style={mg.body}>
          {orders.map(order => (
            <OrderCard key={order.id} order={order} slug={slug} onUpdate={handleUpdate} />
          ))}

          {/* Bulk shipping payment */}
          {shippingBilledOrders.length > 0 && totalShippingDue > 0 && (
            <View style={mg.paymentBox}>
              <View style={mg.paymentHeader}>
                <Ionicons name="alert-circle-outline" size={18} color="#C2410C" />
                <View style={{ flex: 1 }}>
                  <Text style={mg.paymentTitle}>
                    {shippingBilledOrders.length} order{shippingBilledOrders.length > 1 ? 's' : ''} awaiting shipping — Total: GH₵{totalShippingDue.toLocaleString('en-GH', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={mg.paymentSub}>
                    Your items have arrived! Pay the shipping fee via MoMo to receive your orders.
                  </Text>
                </View>
              </View>
              <View style={mg.paymentFields}>
                <View>
                  <Text style={mg.fieldLabel}>Your MoMo Number</Text>
                  <TextInput
                    style={mg.fieldInput}
                    value={momoNumber}
                    onChangeText={setMomoNumber}
                    placeholder="e.g. 0551234567"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
                <View>
                  <Text style={mg.fieldLabel}>Transaction Reference</Text>
                  <TextInput
                    style={mg.fieldInput}
                    value={reference}
                    onChangeText={setReference}
                    placeholder="e.g. ABC123456"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
                <TouchableOpacity
                  style={[mg.payBtn, paying && { opacity: 0.6 }]}
                  onPress={handlePayAll}
                  disabled={paying}
                  activeOpacity={0.85}
                >
                  {paying
                    ? <ActivityIndicator color="#fff" size="small" />
                    : (
                      <>
                        <Ionicons name="send-outline" size={15} color="#fff" />
                        <Text style={mg.payBtnText}>Pay GH₵{totalShippingDue.toLocaleString('en-GH', { maximumFractionDigits: 0 })} for {shippingBilledOrders.length} Order{shippingBilledOrders.length > 1 ? 's' : ''}</Text>
                      </>
                    )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Month totals */}
          <View style={mg.summary}>
            <View style={mg.summaryRow}>
              <Text style={mg.summaryLabel}>Products total</Text>
              <Text style={mg.summaryVal}>
                GH₵{totalProducts.toLocaleString('en-GH', { maximumFractionDigits: 0 })}
              </Text>
            </View>
            {totalShipping > 0 && (
              <View style={mg.summaryRow}>
                <Text style={[mg.summaryLabel, { color: '#C2410C' }]}>Shipping total</Text>
                <Text style={[mg.summaryVal, { color: '#C2410C' }]}>
                  GH₵{totalShipping.toLocaleString('en-GH', { maximumFractionDigits: 0 })}
                </Text>
              </View>
            )}
            <View style={[mg.summaryRow, mg.summaryGrand]}>
              <Text style={mg.grandLabel}>Grand Total</Text>
              <Text style={mg.grandVal}>
                GH₵{grandTotal.toLocaleString('en-GH', { maximumFractionDigits: 0 })}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CustomerOrdersScreen() {
  const { user, customer, loading: sessionLoading, error, storeSlug } = useCustomerContext()
  const router = useRouter()
  const { showAlert } = useAlert()
  const [orders, setOrders] = useState<Order[]>([])
  const [refreshing, setRefreshing] = useState(false)
  
  const slug = storeSlug || ''
  console.log('orders: storeSlug from context =', slug)

  const fetchOrders = useCallback(async () => {
    console.log('orders: slug from params =', slug)
    console.log('fetchOrders: slug=', slug, 'customer=', customer?.id)
    if (!slug || !customer) {
      console.log('fetchOrders: skipping - slug=', slug, 'customer=', customer ? customer.id : null)
      return
    }
    console.log('fetching orders for customer:', customer.id)
    
    // Check if there are ANY orders for this store (to verify RLS allows some access)
    const { count, error: countError } = await createCustomerClient(slug)
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', customer.store_id)
    console.log('Total orders in store (count):', count, 'error:', countError)
    
    // Fetch actual orders
    const { data: simpleData, error: simpleError } = await createCustomerClient(slug)
      .from('orders')
      .select('id, total, status, created_at, shipping_fee')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    console.log('simple orders query result:', simpleData?.length || 0, 'error:', simpleError)
    
    // Now fetch with order_items
    const { data, error } = await createCustomerClient(slug)
      .from('orders')
      .select(`
        id, total, shipping_fee, status, created_at,
        shipping_note, payment_reference, momo_number,
        order_items (id, quantity, price, products (name, price, image_url))
      `)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('orders query error:', error)
    }
    console.log('orders with items fetched:', data?.length || 0)
    setOrders((data as any) || [])
  }, [customer, slug])

  // Fetch when customer becomes available
  useEffect(() => { fetchOrders() }, [fetchOrders])
  // Re-fetch on screen focus
  useFocusEffect(useCallback(() => { fetchOrders() }, [fetchOrders]))
  async function onRefresh() { setRefreshing(true); await fetchOrders(); setRefreshing(false) }

  const updateOrder = (id: string, patch: Partial<Order>) => {
    setOrders((prev: Order[]) => prev.map((o: Order) => o.id === id ? { ...o, ...patch } : o))
  }

  // Group by month
  const groups: MonthGroup[] = []
  const seen = new Map<string, MonthGroup>()
  for (const order of orders) {
    const key = monthKey(order.created_at)
    if (!seen.has(key)) {
      const g = { key, label: monthLabel(key), orders: [] }
      seen.set(key, g)
      groups.push(g)
    }
    seen.get(key)!.orders.push(order)
  }

  // Only block on session resolution
  if (sessionLoading) return <LoadingSpinner fullScreen />
  
  if (error && !customer) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.warning} />
          <Text style={[s.emptyTitle, { color: Colors.warning }]}>Session Error</Text>
          <Text style={s.emptySub}>{error}</Text>
          <Button onPress={() => router.push(`/store/${slug}/login`)}>Retry Login</Button>
        </View>
      </SafeAreaView>
    )
  }

  // Not signed in
  if (!user || !customer) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}><Text style={s.title}>My Orders</Text></View>
        <View style={s.centered}>
          <View style={s.emptyIconBox}>
            <Ionicons name="lock-closed-outline" size={32} color={Colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>Sign in to view your orders</Text>
          <Text style={s.emptySub}>You need an account to track your orders</Text>
          <View style={s.emptyActions}>
            <Button onPress={() => router.push(`/store/${slug}/login`)}>Sign In</Button>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>My Orders</Text>
        <Text style={s.sub}>
          {groups.length} invoice{groups.length !== 1 ? 's' : ''} · {orders.length} order{orders.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
      >
        {orders.length === 0 ? (
          <View style={s.centered}>
            <View style={s.emptyIconBox}>
              <Ionicons name="receipt-outline" size={32} color={Colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No orders yet</Text>
            <Text style={s.emptySub}>Your orders will appear here after you make a purchase</Text>
            <View style={s.emptyActions}>
              <Button variant="secondary" onPress={() => router.push(`/store/${slug}`)}>Start Shopping</Button>
            </View>
          </View>
        ) : (
          groups.map(group => (
            <MonthGroupCard key={group.key} group={group} slug={slug} onUpdate={updateOrder} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: {
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.md,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm },
  emptyActions: { width: '100%', gap: Spacing.sm },
})

// Order card styles
const oc = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  iconBox: { width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  rowMid: { flex: 1, minWidth: 0 },
  orderId: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  rowItems: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  grandTotal: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textPrimary },
  shippingChip: { fontSize: 10, color: '#C2410C' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { fontSize: 10, fontWeight: '700' },

  detail: { borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface, padding: Spacing.md, gap: Spacing.md },

  itemsBox: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemThumb: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  itemThumbImg: { width: 36, height: 36 },
  itemName: { flex: 1 },
  itemNameText: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textPrimary },
  itemQty: { fontSize: FontSize.xs, color: Colors.textMuted },
  itemLineTotal: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },

  totals: { borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.md, gap: Spacing.xs },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  totalVal: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textPrimary },
  totalGrand: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.xs, marginTop: 2 },
  grandLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  grandVal: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.success },

  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.warningLight, borderRadius: Radius.md, padding: Spacing.md },
  infoText: { fontSize: FontSize.xs, color: '#A16207', lineHeight: 17 },

  cancelLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  cancelLinkText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.danger },

  paymentBox: { backgroundColor: '#FFF7ED', borderRadius: Radius.md, borderWidth: 1, borderColor: '#FED7AA', padding: Spacing.md, gap: Spacing.md },
  paymentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  paymentTitle: { fontSize: FontSize.sm, fontWeight: '700', color: '#C2410C' },
  paymentSub: { fontSize: FontSize.xs, color: '#9A3412', marginTop: 2, lineHeight: 16 },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 6, backgroundColor: '#FFF', borderRadius: Radius.sm, borderWidth: 1, borderColor: '#FED7AA', padding: 8 },
  noteText: { fontSize: FontSize.xs, color: Colors.textMuted, flex: 1, lineHeight: 16 },
  paymentFields: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderColor: '#FED7AA', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: FontSize.sm, color: Colors.textPrimary, backgroundColor: Colors.card },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: Radius.md, backgroundColor: '#F97316' },
  payBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
})

// Month group styles
const mg = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  receiptBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  monthSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  monthTotal: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textPrimary },

  body: { borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.md, gap: 0 },
  
  // Bulk payment box
  paymentBox: { backgroundColor: '#FFF7ED', borderRadius: Radius.md, borderWidth: 1, borderColor: '#FED7AA', padding: Spacing.md, gap: Spacing.md, marginTop: Spacing.sm },
  paymentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  paymentTitle: { fontSize: FontSize.sm, fontWeight: '700', color: '#C2410C' },
  paymentSub: { fontSize: FontSize.xs, color: '#9A3412', marginTop: 2, lineHeight: 16 },
  paymentFields: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderColor: '#FED7AA', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: FontSize.sm, color: Colors.textPrimary, backgroundColor: Colors.card },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: Radius.md, backgroundColor: '#F97316' },
  payBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  
  summary: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.xs, marginTop: Spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  summaryVal: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textPrimary },
  summaryGrand: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.xs, marginTop: 2 },
  grandLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  grandVal: { fontSize: FontSize.sm, fontWeight: '900', color: Colors.success },
})
