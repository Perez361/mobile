import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  TextInput, Image, Alert, Linking, StyleSheet,
} from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCurrency, parseNumber, getOrderId } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

// ─── helpers ────────────────────────────────────────────────────────────────

function monthLabel(key: string) {
  const [year, mon] = key.split('-')
  return new Date(Number(year), Number(mon) - 1, 1)
    .toLocaleDateString('en', { month: 'long', year: 'numeric' })
}

function openWhatsApp(contact: string, message: string) {
  const phone = '233' + contact.replace(/^0/, '').replace(/\D/g, '')
  const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`
  Linking.openURL(url).catch(() => Alert.alert('WhatsApp not installed'))
}

function productInvoiceMsg(customer: any, items: any[], month: string): string {
  const name = customer.full_name || customer.username || 'there'
  const lines = items.map((i: any) => `  • ${i.name} ×${i.quantity} — ${formatCurrency(i.unitPrice * i.quantity)}`).join('\n')
  const total = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0)
  return `Hello ${name}! 👋\n\nHere's your product payment invoice for the *${month}* batch:\n\n${lines}\n\nTotal: *${formatCurrency(total)}*\n\nPlease send payment via MoMo. Thank you! 🙏`
}

function shippingInvoiceMsg(customer: any, items: any[], month: string): string {
  const name = customer.full_name || customer.username || 'there'
  const lines = items.map((i: any) => `  • ${i.name} ×${i.quantity} — Shipping: ${formatCurrency(i.shippingFee)}`).join('\n')
  const total = items.reduce((s: number, i: any) => s + i.shippingFee, 0)
  return `Hello ${name}! 👋\n\nYour items from the *${month}* batch have arrived! Here's your shipping invoice:\n\n${lines}\n\nTotal shipping: *${formatCurrency(total)}*\n\nPlease send payment via MoMo. Thank you! 🙏`
}

// ─── types ───────────────────────────────────────────────────────────────────

type OrderEntry = {
  orderId: string
  status: string
  total: number
  shippingFee: number | null
  shippingNote: string | null
  shippingBilledAt: string | null
  shippingPaidAt: string | null
  customer: { id: string; full_name: string; username: string; contact: string; location: string }
  quantity: number
  unitPrice: number
  itemId: string
}

type ProductGroup = {
  productId: string
  name: string
  imageUrl: string | null
  supplierName: string | null
  trackingNumber: string | null
  entries: OrderEntry[]
}

// ─── main component ──────────────────────────────────────────────────────────

export default function PreOrderMonthScreen() {
  const router = useRouter()
  const { month } = useLocalSearchParams<{ month: string }>()
  const { user, importer } = useImporterSession()

  const [productGroups, setProductGroups] = useState<ProductGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'products' | 'product-invoices' | 'shipping-invoices'>('products')

  // Per-product expanded state and shipping fee inputs
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({})
  const [savingTracking, setSavingTracking] = useState<string | null>(null)
  const [shippingFeeInputs, setShippingFeeInputs] = useState<Record<string, string>>({})
  const [shippingNoteInputs, setShippingNoteInputs] = useState<Record<string, string>>({})
  const [billingProduct, setBillingProduct] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!importer || !month) return

    // Build date range for the month
    const [year, mon] = month.split('-').map(Number)
    const startDate = `${month}-01T00:00:00.000Z`
    const endMon = mon === 12 ? 1 : mon + 1
    const endYear = mon === 12 ? year + 1 : year
    const endDate = `${endYear}-${String(endMon).padStart(2, '0')}-01T00:00:00.000Z`

    const { data } = await createImporterClient()
      .from('orders')
      .select(`
        id, total, status, shipping_fee, shipping_note, shipping_billed_at, shipping_paid_at, created_at,
        customers (id, full_name, username, contact, location),
        order_items (
          id, quantity, price,
          products (id, name, image_url, supplier_name, tracking_number)
        )
      `)
      .eq('store_id', importer.id)
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    // Build product groups from order_items
    const map = new Map<string, ProductGroup>()
    for (const order of data) {
      const customer = order.customers as any
      const items: any[] = order.order_items || []

      for (const item of items) {
        const product = item.products
        if (!product) continue
        const pid = product.id

        if (!map.has(pid)) {
          map.set(pid, {
            productId: pid,
            name: product.name,
            imageUrl: product.image_url,
            supplierName: product.supplier_name,
            trackingNumber: product.tracking_number,
            entries: [],
          })
        }

        map.get(pid)!.entries.push({
          orderId: order.id,
          status: order.status,
          total: parseNumber(order.total),
          shippingFee: order.shipping_fee ? parseNumber(order.shipping_fee) : null,
          shippingNote: order.shipping_note,
          shippingBilledAt: order.shipping_billed_at,
          shippingPaidAt: order.shipping_paid_at,
          customer,
          quantity: item.quantity,
          unitPrice: parseNumber(item.price),
          itemId: item.id,
        })
      }
    }

    const groups = Array.from(map.values())
    setProductGroups(groups)

    // Initialize tracking inputs from current values
    const ti: Record<string, string> = {}
    for (const g of groups) {
      ti[g.productId] = g.trackingNumber || ''
    }
    setTrackingInputs(ti)
    setLoading(false)
  }, [importer, month])

  useFocusEffect(useCallback(() => { fetchData() }, [fetchData]))
  async function onRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  async function saveTracking(productId: string) {
    const val = (trackingInputs[productId] || '').trim().toUpperCase()
    setSavingTracking(productId)
    try {
      const { error } = await createImporterClient()
        .from('products').update({ tracking_number: val || null }).eq('id', productId)
      if (error) { Alert.alert('Error', error.message); return }
      setProductGroups((prev) => prev.map((g) =>
        g.productId === productId ? { ...g, trackingNumber: val || null } : g
      ))
    } finally { setSavingTracking(null) }
  }

  async function billShippingAll(productId: string) {
    const fee = parseNumber(shippingFeeInputs[productId])
    if (!fee || fee <= 0) { Alert.alert('Enter fee', 'Enter a shipping fee amount.'); return }
    const note = (shippingNoteInputs[productId] || '').trim() || null
    const group = productGroups.find((g) => g.productId === productId)
    if (!group) return

    const orderIds = group.entries
      .filter((e) => e.status === 'arrived')
      .map((e) => e.orderId)

    if (orderIds.length === 0) { Alert.alert('None to bill', 'No arrived orders to bill.'); return }

    setBillingProduct(productId)
    try {
      const { error } = await createImporterClient()
        .from('orders')
        .update({
          status: 'shipping_billed',
          shipping_fee: fee,
          shipping_note: note,
          shipping_billed_at: new Date().toISOString(),
        })
        .in('id', orderIds)
      if (error) { Alert.alert('Error', error.message); return }
      await fetchData()
    } finally { setBillingProduct(null) }
  }

  async function billShippingSingle(orderId: string, productId: string) {
    const fee = parseNumber(shippingFeeInputs[productId])
    if (!fee || fee <= 0) { Alert.alert('Enter fee', 'Enter a shipping fee amount first.'); return }
    const note = (shippingNoteInputs[productId] || '').trim() || null
    setBillingProduct(orderId)
    try {
      const { error } = await createImporterClient()
        .from('orders')
        .update({
          status: 'shipping_billed',
          shipping_fee: fee,
          shipping_note: note,
          shipping_billed_at: new Date().toISOString(),
        })
        .eq('id', orderId)
      if (error) { Alert.alert('Error', error.message); return }
      await fetchData()
    } finally { setBillingProduct(null) }
  }

  async function markDelivered(orderId: string) {
    const { error } = await createImporterClient()
      .from('orders')
      .update({ status: 'delivered', shipping_paid_at: new Date().toISOString() })
      .eq('id', orderId)
    if (error) Alert.alert('Error', error.message)
    else await fetchData()
  }

  if (loading) return <LoadingSpinner fullScreen />

  const label = month ? monthLabel(month) : ''

  // Compute totals for header
  const allEntries = productGroups.flatMap((g) => g.entries)
  const uniqueOrders = new Set(allEntries.map((e) => e.orderId)).size
  const totalItems = allEntries.reduce((s, e) => s + e.quantity, 0)

  // Product invoices: pending orders grouped by customer
  const pendingByCustomer = new Map<string, { customer: any; items: { name: string; quantity: number; unitPrice: number }[] }>()
  for (const g of productGroups) {
    for (const e of g.entries) {
      if (e.status !== 'pending') continue
      const cid = e.customer?.id
      if (!cid) continue
      if (!pendingByCustomer.has(cid)) pendingByCustomer.set(cid, { customer: e.customer, items: [] })
      pendingByCustomer.get(cid)!.items.push({ name: g.name, quantity: e.quantity, unitPrice: e.unitPrice })
    }
  }

  // Shipping invoices: shipping_billed orders grouped by customer
  const shippingByCustomer = new Map<string, { customer: any; items: { name: string; quantity: number; shippingFee: number }[] }>()
  for (const g of productGroups) {
    for (const e of g.entries) {
      if (e.status !== 'shipping_billed') continue
      const cid = e.customer?.id
      if (!cid || !e.shippingFee) continue
      if (!shippingByCustomer.has(cid)) shippingByCustomer.set(cid, { customer: e.customer, items: [] })
      shippingByCustomer.get(cid)!.items.push({ name: g.name, quantity: e.quantity, shippingFee: e.shippingFee })
    }
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Nav bar */}
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.brand} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <View style={s.navCenter}>
          <Ionicons name="calendar-outline" size={15} color={Colors.textPrimary} />
          <Text style={s.navTitle} numberOfLines={1}>{label}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Stats strip */}
      <View style={s.statsStrip}>
        <Text style={s.statItem}>{productGroups.length} product{productGroups.length !== 1 ? 's' : ''}</Text>
        <View style={s.statDot} />
        <Text style={s.statItem}>{uniqueOrders} order{uniqueOrders !== 1 ? 's' : ''}</Text>
        <View style={s.statDot} />
        <Text style={s.statItem}>{totalItems} items</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {([
          { key: 'products', label: 'Products' },
          { key: 'product-invoices', label: 'Product Invoices' },
          { key: 'shipping-invoices', label: 'Shipping Invoices' },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.scroll}
      >

        {/* ── Products tab ── */}
        {tab === 'products' && productGroups.map((g) => {
          const isExpanded = expandedProduct === g.productId
          const arrivedEntries = g.entries.filter((e) => e.status === 'arrived')
          const hasArrived = arrivedEntries.length > 0

          return (
            <View key={g.productId} style={s.productCard}>
              {/* Product header */}
              <TouchableOpacity
                style={s.productHeader}
                onPress={() => setExpandedProduct(isExpanded ? null : g.productId)}
                activeOpacity={0.8}
              >
                <View style={s.productThumb}>
                  {g.imageUrl
                    ? <Image source={{ uri: g.imageUrl }} style={s.thumbImg} resizeMode="cover" />
                    : <Ionicons name="cube-outline" size={20} color={Colors.textMuted} />
                  }
                </View>
                <View style={s.productHeaderInfo}>
                  <Text style={s.productName} numberOfLines={1}>{g.name}</Text>
                  {g.supplierName && <Text style={s.supplierName} numberOfLines={1}>{g.supplierName}</Text>}
                  <View style={s.productMeta}>
                    <Text style={s.productMetaText}>{g.entries.length} customer{g.entries.length !== 1 ? 's' : ''}</Text>
                    <Text style={s.productMetaText}>·</Text>
                    <Text style={s.productMetaText}>{g.entries.reduce((s, e) => s + e.quantity, 0)} units</Text>
                  </View>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16} color={Colors.textMuted}
                />
              </TouchableOpacity>

              {/* Tracking number */}
              <View style={s.trackingRow}>
                {g.trackingNumber ? (
                  <View style={s.trackingBadge}>
                    <Ionicons name="barcode-outline" size={12} color={Colors.success} />
                    <Text style={s.trackingText}>{g.trackingNumber}</Text>
                  </View>
                ) : (
                  <View style={s.trackingMissing}>
                    <Ionicons name="alert-circle-outline" size={12} color="#B45309" />
                    <Text style={s.trackingMissingText}>No tracking number</Text>
                  </View>
                )}
                <TextInput
                  style={s.trackingInput}
                  placeholder="Add tracking #"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                  value={trackingInputs[g.productId] || ''}
                  onChangeText={(v) => setTrackingInputs((p) => ({ ...p, [g.productId]: v }))}
                />
                <TouchableOpacity
                  style={s.trackingSaveBtn}
                  onPress={() => saveTracking(g.productId)}
                  disabled={savingTracking === g.productId}
                >
                  <Text style={s.trackingSaveBtnText}>
                    {savingTracking === g.productId ? '…' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Bulk shipping fee form for arrived orders */}
              {hasArrived && (
                <View style={s.billingPanel}>
                  <Text style={s.billingTitle}>Bill Shipping — {arrivedEntries.length} arrived order{arrivedEntries.length !== 1 ? 's' : ''}</Text>
                  <View style={s.billingRow}>
                    <TextInput
                      style={[s.billingInput, { flex: 1 }]}
                      placeholder="Shipping fee (GH₵)"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="decimal-pad"
                      value={shippingFeeInputs[g.productId] || ''}
                      onChangeText={(v) => setShippingFeeInputs((p) => ({ ...p, [g.productId]: v }))}
                    />
                    <TouchableOpacity
                      style={[s.billAllBtn, billingProduct === g.productId && { opacity: 0.6 }]}
                      onPress={() => billShippingAll(g.productId)}
                      disabled={billingProduct === g.productId}
                    >
                      <Text style={s.billAllBtnText}>
                        {billingProduct === g.productId ? 'Billing…' : 'Bill All'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={s.billingInput}
                    placeholder="Note for customers (optional)"
                    placeholderTextColor={Colors.textMuted}
                    value={shippingNoteInputs[g.productId] || ''}
                    onChangeText={(v) => setShippingNoteInputs((p) => ({ ...p, [g.productId]: v }))}
                  />
                </View>
              )}

              {/* Customer rows (expandable) */}
              {isExpanded && (
                <View style={s.entriesSection}>
                  {g.entries.map((e, i) => {
                    const name = e.customer?.full_name || e.customer?.username || 'Unknown'
                    const contact = e.customer?.contact
                    return (
                      <View key={e.orderId + e.itemId} style={[s.entryRow, i < g.entries.length - 1 && s.entryBorder]}>
                        <View style={s.entryLeft}>
                          <Text style={s.entryName} numberOfLines={1}>{name}</Text>
                          {contact && (
                            <View style={s.entryContact}>
                              <Ionicons name="call-outline" size={10} color={Colors.textMuted} />
                              <Text style={s.entryContactText}>{contact}</Text>
                            </View>
                          )}
                          {e.customer?.location && (
                            <View style={s.entryContact}>
                              <Ionicons name="location-outline" size={10} color={Colors.textMuted} />
                              <Text style={s.entryContactText} numberOfLines={1}>{e.customer.location}</Text>
                            </View>
                          )}
                          <Text style={s.entryQty}>×{e.quantity} · {formatCurrency(e.unitPrice * e.quantity)}</Text>
                        </View>
                        <View style={s.entryRight}>
                          <StatusBadge status={e.status} />
                          {e.shippingFee && (
                            <Text style={s.entryShipping}>+{formatCurrency(e.shippingFee)} shipping</Text>
                          )}
                          {/* Per-order actions */}
                          {e.status === 'arrived' && contact && (
                            <TouchableOpacity
                              style={s.waSmallBtn}
                              onPress={() => {
                                const fee = shippingFeeInputs[g.productId] ? `GH₵${shippingFeeInputs[g.productId]}` : '___'
                                openWhatsApp(contact,
                                  `Hello ${name}! 👋\n\nYour *${g.name}* has arrived!\n\nProduct: ${formatCurrency(e.unitPrice * e.quantity)}\nShipping fee: ${fee}\n\nPlease send via MoMo. Thank you! 🙏`
                                )
                              }}
                            >
                              <Ionicons name="logo-whatsapp" size={12} color="#fff" />
                              <Text style={s.waSmallText}>WhatsApp</Text>
                            </TouchableOpacity>
                          )}
                          {e.status === 'arrived' && (
                            <TouchableOpacity
                              style={s.billSingleBtn}
                              onPress={() => billShippingSingle(e.orderId, g.productId)}
                              disabled={billingProduct === e.orderId}
                            >
                              <Text style={s.billSingleText}>Bill This</Text>
                            </TouchableOpacity>
                          )}
                          {e.status === 'shipping_paid' && (
                            <TouchableOpacity
                              style={s.deliverBtn}
                              onPress={() => Alert.alert(
                                'Mark as Delivered',
                                `Mark ${name}'s order as delivered?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Delivered', onPress: () => markDelivered(e.orderId) },
                                ]
                              )}
                            >
                              <Text style={s.deliverBtnText}>Mark Delivered</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )
        })}

        {/* ── Product Invoices tab ── */}
        {tab === 'product-invoices' && (
          <>
            {pendingByCustomer.size === 0 ? (
              <View style={s.emptyTab}>
                <Ionicons name="checkmark-circle-outline" size={36} color={Colors.success} />
                <Text style={s.emptyTabText}>All product payments collected</Text>
              </View>
            ) : Array.from(pendingByCustomer.values()).map(({ customer, items }) => {
              const name = customer.full_name || customer.username || 'Unknown'
              const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
              return (
                <View key={customer.id} style={[s.invoiceCard, { borderLeftColor: Colors.brand }]}>
                  <View style={s.invoiceHeader}>
                    <View style={s.invoiceAvatar}>
                      <Text style={s.invoiceAvatarText}>{name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={s.invoiceInfo}>
                      <Text style={s.invoiceName}>{name}</Text>
                      {customer.contact && <Text style={s.invoiceContact}>{customer.contact}</Text>}
                      {customer.location && <Text style={s.invoiceLocation}>{customer.location}</Text>}
                    </View>
                    <Text style={s.invoiceTotal}>{formatCurrency(total)}</Text>
                  </View>
                  <View style={s.invoiceItems}>
                    {items.map((item, i) => (
                      <View key={i} style={s.invoiceItemRow}>
                        <Text style={s.invoiceItemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={s.invoiceItemDetail}>×{item.quantity}</Text>
                        <Text style={s.invoiceItemPrice}>{formatCurrency(item.unitPrice * item.quantity)}</Text>
                      </View>
                    ))}
                  </View>
                  {customer.contact && (
                    <TouchableOpacity
                      style={s.invoiceWaBtn}
                      onPress={() => openWhatsApp(customer.contact, productInvoiceMsg(customer, items, label))}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#fff" />
                      <Text style={s.invoiceWaBtnText}>Send Invoice via WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })}
          </>
        )}

        {/* ── Shipping Invoices tab ── */}
        {tab === 'shipping-invoices' && (
          <>
            {shippingByCustomer.size === 0 ? (
              <View style={s.emptyTab}>
                <Ionicons name="checkmark-circle-outline" size={36} color={Colors.success} />
                <Text style={s.emptyTabText}>No shipping fees pending</Text>
              </View>
            ) : Array.from(shippingByCustomer.values()).map(({ customer, items }) => {
              const name = customer.full_name || customer.username || 'Unknown'
              const total = items.reduce((s, i) => s + i.shippingFee, 0)
              return (
                <View key={customer.id} style={[s.invoiceCard, { borderLeftColor: Colors.warning }]}>
                  <View style={s.invoiceHeader}>
                    <View style={[s.invoiceAvatar, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[s.invoiceAvatarText, { color: '#B45309' }]}>{name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={s.invoiceInfo}>
                      <Text style={s.invoiceName}>{name}</Text>
                      {customer.contact && <Text style={s.invoiceContact}>{customer.contact}</Text>}
                      {customer.location && <Text style={s.invoiceLocation}>{customer.location}</Text>}
                    </View>
                    <Text style={[s.invoiceTotal, { color: Colors.warning }]}>{formatCurrency(total)}</Text>
                  </View>
                  <View style={s.invoiceItems}>
                    {items.map((item, i) => (
                      <View key={i} style={s.invoiceItemRow}>
                        <Text style={s.invoiceItemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={s.invoiceItemDetail}>×{item.quantity}</Text>
                        <Text style={[s.invoiceItemPrice, { color: Colors.warning }]}>{formatCurrency(item.shippingFee)}</Text>
                      </View>
                    ))}
                  </View>
                  {customer.contact && (
                    <TouchableOpacity
                      style={[s.invoiceWaBtn, { backgroundColor: '#F59E0B' }]}
                      onPress={() => openWhatsApp(customer.contact, shippingInvoiceMsg(customer, items, label))}
                    >
                      <Ionicons name="logo-whatsapp" size={14} color="#fff" />
                      <Text style={s.invoiceWaBtnText}>Send Shipping Invoice via WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },

  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  backText: { fontSize: FontSize.sm, color: Colors.brand, fontWeight: '500' },
  navCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, maxWidth: 200 },

  statsStrip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm,
    backgroundColor: Colors.brandLight, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  statItem: { fontSize: FontSize.xs, color: Colors.brand, fontWeight: '600' },
  statDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Colors.brand },

  tabs: {
    flexDirection: 'row', backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1, paddingVertical: Spacing.md, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.brand },
  tabText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.brand },

  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  // Product cards
  productCard: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden',
  },
  productHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg,
  },
  productThumb: {
    width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  thumbImg: { width: 44, height: 44 },
  productHeaderInfo: { flex: 1, gap: 2 },
  productName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  supplierName: { fontSize: FontSize.xs, color: Colors.textMuted },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  productMetaText: { fontSize: FontSize.xs, color: Colors.textMuted },

  trackingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  trackingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successLight, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full,
  },
  trackingText: { fontSize: 10, fontWeight: '700', color: Colors.success, fontFamily: 'monospace' },
  trackingMissing: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3C7', paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.full, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D97706',
  },
  trackingMissingText: { fontSize: 10, fontWeight: '600', color: '#B45309' },
  trackingInput: {
    flex: 1, fontSize: FontSize.xs, color: Colors.textPrimary,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  trackingSaveBtn: {
    backgroundColor: Colors.brand, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  trackingSaveBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#fff' },

  billingPanel: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    padding: Spacing.lg, gap: Spacing.sm,
    backgroundColor: '#FFF7ED',
  },
  billingTitle: { fontSize: FontSize.xs, fontWeight: '700', color: '#B45309' },
  billingRow: { flexDirection: 'row', gap: Spacing.sm },
  billingInput: {
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 8,
    fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  billAllBtn: {
    backgroundColor: '#F59E0B', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 8, justifyContent: 'center',
  },
  billAllBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#fff' },

  entriesSection: { borderTopWidth: 1, borderTopColor: Colors.border },
  entryRow: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.md },
  entryBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  entryLeft: { flex: 1, gap: 3 },
  entryName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  entryContact: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  entryContactText: { fontSize: 10, color: Colors.textMuted },
  entryQty: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  entryRight: { alignItems: 'flex-end', gap: 4 },
  entryShipping: { fontSize: 10, color: Colors.warning, fontWeight: '600' },
  waSmallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#25D366', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  waSmallText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  billSingleBtn: {
    backgroundColor: '#FEF3C7', borderRadius: Radius.sm, borderWidth: 1, borderColor: '#D97706',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  billSingleText: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  deliverBtn: {
    backgroundColor: Colors.successLight, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.success,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  deliverBtnText: { fontSize: 10, fontWeight: '700', color: Colors.success },

  emptyTab: { alignItems: 'center', paddingVertical: 48, gap: Spacing.md },
  emptyTabText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500' },

  // Invoice cards
  invoiceCard: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, borderLeftWidth: 4, overflow: 'hidden', gap: 0,
  },
  invoiceHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    padding: Spacing.lg,
  },
  invoiceAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.brandLight, alignItems: 'center', justifyContent: 'center',
  },
  invoiceAvatarText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.brand },
  invoiceInfo: { flex: 1, gap: 2 },
  invoiceName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  invoiceContact: { fontSize: FontSize.xs, color: Colors.textMuted },
  invoiceLocation: { fontSize: FontSize.xs, color: Colors.textMuted },
  invoiceTotal: { fontSize: FontSize.base, fontWeight: '900', color: Colors.brand },
  invoiceItems: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.xs,
  },
  invoiceItemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  invoiceItemName: { flex: 1, fontSize: FontSize.xs, color: Colors.textPrimary },
  invoiceItemDetail: { fontSize: FontSize.xs, color: Colors.textMuted },
  invoiceItemPrice: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textPrimary },
  invoiceWaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    backgroundColor: '#25D366', margin: Spacing.lg, marginTop: 0,
    borderRadius: Radius.md, paddingVertical: Spacing.md,
  },
  invoiceWaBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#fff' },
})
