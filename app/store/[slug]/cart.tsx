import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  Image, ActivityIndicator, Alert, StyleSheet,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useCustomerContext } from '@/lib/hooks/CustomerContext'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatCurrency, parseNumber } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

export default function CartScreen() {
const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { user, customer, loading: sessionLoading, error } = useCustomerContext()
  const [cartItems, setCartItems] = useState<any[]>([])
  const [cartId, setCartId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [placing, setPlacing] = useState(false)

  const fetchCart = useCallback(async () => {
    if (!slug || !customer) return
    const { data } = await createCustomerClient(slug)
      .from('carts')
      .select('id, cart_items (id, product_id, quantity, products (name, price, image_url))')
      .eq('customer_id', customer.id)
      .eq('store_id', customer.store_id)
      .single()
    if (data) {
      setCartId(data.id)
      setCartItems((data.cart_items as any) || [])
    } else {
      setCartItems([])
    }
  }, [customer, slug])

  // Fetch when customer becomes available
  useEffect(() => { fetchCart() }, [fetchCart])
  // Re-fetch on screen focus
  useFocusEffect(useCallback(() => { fetchCart() }, [fetchCart]))

  async function onRefresh() { setRefreshing(true); await fetchCart(); setRefreshing(false) }

  async function updateQty(itemId: string, qty: number) {
    if (!cartId) return
    const supabase = createCustomerClient(slug)
    if (qty <= 0) {
      await supabase.from('cart_items').delete().eq('id', itemId)
      setCartItems(prev => prev.filter((i: any) => i.id !== itemId))
    } else {
      await supabase.from('cart_items').update({ quantity: qty }).eq('id', itemId)
      setCartItems(prev => prev.map((i: any) => i.id === itemId ? { ...i, quantity: qty } : i))
    }
  }

  const total = cartItems.reduce(
    (sum: number, item: any) => sum + parseNumber(item.products.price) * item.quantity, 0,
  )

  async function handleCheckout() {
    if (!customer || cartItems.length === 0) return
    Alert.alert(
      'Place Order',
      `Confirm your order for ${formatCurrency(total)}?\n\nShipping fee will be billed separately once your items arrive.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Place Order',
          onPress: async () => {
            setPlacing(true)
            try {
              const supabase = createCustomerClient(slug)
              const { data: order, error } = await supabase
                .from('orders')
                .insert({ customer_id: customer.id, store_id: customer.store_id, total })
                .select()
                .single()
              if (error || !order) { Alert.alert('Error', 'Failed to place order. Please try again.'); return }
              await supabase.from('order_items').insert(
                cartItems.map((item: any) => ({
                  order_id: order.id, product_id: item.product_id,
                  quantity: item.quantity, price: item.products.price,
                })),
              )
              if (cartId) await supabase.from('cart_items').delete().eq('cart_id', cartId)
              setCartItems([])
              Alert.alert(
                'Order placed!',
                'Your order has been placed. The importer will process it and notify you once your items arrive.',
                [{ text: 'Track Order', onPress: () => router.push(`/store/${slug}/orders`) }],
              )
            } finally { setPlacing(false) }
          },
        },
      ],
    )
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
        <View style={s.header}><Text style={s.title}>Cart</Text></View>
        <View style={s.centered}>
          <View style={s.emptyIconBox}>
            <Ionicons name="lock-closed-outline" size={32} color={Colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>Sign in to view your cart</Text>
          <Text style={s.emptySub}>You need an account to add items and place orders</Text>
          <View style={s.emptyActions}>
            <Button onPress={() => router.push(`/store/${slug}/login`)}>Sign In</Button>
            <Button variant="secondary" onPress={() => router.push(`/store/${slug}/register`)}>Create Account</Button>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}><Text style={s.title}>Cart</Text></View>
        <View style={s.centered}>
          <View style={s.emptyIconBox}>
            <Ionicons name="cart-outline" size={32} color={Colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>Your cart is empty</Text>
          <Text style={s.emptySub}>Add products from the store to get started</Text>
          <View style={s.emptyActions}>
            <Button variant="secondary" onPress={() => router.push(`/store/${slug}`)}>Browse Products</Button>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Cart</Text>
        <Text style={s.sub}>{cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
      >
        {cartItems.map((item: any) => (
          <View key={item.id} style={s.itemCard}>
            <View style={s.imgBox}>
              {item.products.image_url
                ? <Image source={{ uri: item.products.image_url }} style={s.img} resizeMode="cover" />
                : <View style={s.imgFallback}><Ionicons name="cube-outline" size={22} color="#CBD5E1" /></View>}
            </View>
            <View style={s.itemInfo}>
              <Text style={s.itemName} numberOfLines={2}>{item.products.name}</Text>
              <Text style={s.itemPrice}>{formatCurrency(parseNumber(item.products.price))}</Text>
              <View style={s.qtyRow}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.id, item.quantity - 1)}>
                  <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={15}
                    color={item.quantity === 1 ? Colors.danger : Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.qtyNum}>{item.quantity}</Text>
                <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.id, item.quantity + 1)}>
                  <Ionicons name="add" size={15} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.lineTotal}>
                  = {formatCurrency(parseNumber(item.products.price) * item.quantity)}
                </Text>
              </View>
            </View>
          </View>
        ))}

        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Subtotal</Text>
            <Text style={s.summaryTotal}>{formatCurrency(total)}</Text>
          </View>
          <View style={s.shippingNote}>
            <Ionicons name="information-circle-outline" size={15} color={Colors.warning} style={{ marginTop: 1 }} />
            <Text style={s.shippingNoteText}>
              <Text style={{ fontWeight: '700' }}>No shipping fee now.</Text> You'll pay shipping once your items arrive.
            </Text>
          </View>
          <TouchableOpacity
            style={[s.checkoutBtn, placing && s.checkoutBtnDisabled]}
            onPress={handleCheckout}
            disabled={placing}
            activeOpacity={0.85}
          >
            {placing
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={s.checkoutBtnText}>Place Order · {formatCurrency(total)}</Text>
                </>}
          </TouchableOpacity>
        </View>
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
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm },
  emptyActions: { width: '100%', gap: Spacing.sm },
  itemCard: {
    flexDirection: 'row', backgroundColor: Colors.card,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  imgBox: { width: 90, height: 90, backgroundColor: Colors.surface },
  img: { width: 90, height: 90 },
  imgFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1, padding: Spacing.md, gap: 3 },
  itemName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, lineHeight: 18 },
  itemPrice: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.brand },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
  },
  qtyNum: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, minWidth: 20, textAlign: 'center' },
  lineTotal: { fontSize: FontSize.xs, color: Colors.textMuted },
  summaryCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.md, marginTop: Spacing.sm,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textMuted },
  summaryTotal: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.textPrimary },
  shippingNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.warningLight, borderRadius: Radius.md, padding: Spacing.md,
  },
  shippingNoteText: { flex: 1, fontSize: FontSize.xs, color: '#92400E', lineHeight: 17 },
  checkoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: Radius.lg, backgroundColor: Colors.brand,
  },
  checkoutBtnDisabled: { opacity: 0.6 },
  checkoutBtnText: { fontSize: FontSize.base, fontWeight: '800', color: '#fff' },
})
