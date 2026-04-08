import { useCallback, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, Image, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useCustomerSession } from '@/lib/hooks/useCustomerSession'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency, parseNumber } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

export default function CartScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { user, customer, loading: sessionLoading } = useCustomerSession(slug)
  const [cartItems, setCartItems] = useState<any[]>([])
  const [cartId, setCartId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [placing, setPlacing] = useState(false)

  const fetchCart = useCallback(async () => {
    if (!customer) { setLoading(false); return }
    const { data } = await createCustomerClient(slug).from('carts')
      .select('id, cart_items (id, product_id, quantity, products (name, price, image_url))')
      .eq('customer_id', customer.id).eq('store_id', customer.store_id).single()
    if (data) { setCartId(data.id); setCartItems((data.cart_items as any) || []) }
    setLoading(false)
  }, [customer, slug])

  useFocusEffect(useCallback(() => { fetchCart() }, [fetchCart]))
  async function onRefresh() { setRefreshing(true); await fetchCart(); setRefreshing(false) }

  async function updateQty(itemId: string, qty: number) {
    if (!cartId) return
    const supabase = createCustomerClient(slug)
    if (qty <= 0) {
      await supabase.from('cart_items').delete().eq('id', itemId)
      setCartItems((prev) => prev.filter((i: any) => i.id !== itemId))
    } else {
      await supabase.from('cart_items').update({ quantity: qty }).eq('id', itemId)
      setCartItems((prev) => prev.map((i: any) => i.id === itemId ? { ...i, quantity: qty } : i))
    }
  }

  const total = cartItems.reduce((sum: number, item: any) => sum + parseNumber(item.products.price) * item.quantity, 0)

  async function handleCheckout() {
    if (!customer || cartItems.length === 0) return
    Alert.alert('Place Order', `Confirm your order for ${formatCurrency(total)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Place Order', onPress: async () => {
        setPlacing(true)
        try {
          const supabase = createCustomerClient(slug)
          const { data: order, error } = await supabase.from('orders').insert({ customer_id: customer.id, store_id: customer.store_id, total }).select().single()
          if (error || !order) { Alert.alert('Error', 'Failed to place order. Please try again.'); return }
          await supabase.from('order_items').insert(cartItems.map((item: any) => ({ order_id: order.id, product_id: item.product_id, quantity: item.quantity, price: item.products.price })))
          if (cartId) await supabase.from('cart_items').delete().eq('cart_id', cartId)
          setCartItems([])
          Alert.alert('Order placed!', 'The store owner will contact you about shipping.', [{ text: 'View Orders', onPress: () => router.push(`/store/${slug}/orders`) }])
        } finally { setPlacing(false) }
      }},
    ])
  }

  if (sessionLoading || loading) return <LoadingSpinner fullScreen />

  if (!user || !customer) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}><Text style={s.title}>Cart</Text></View>
        <EmptyState icon={<Text style={s.emptyIcon}>🔒</Text>} title="Sign in to view your cart" subtitle="You need an account to add items and place orders"
          action={<Button onPress={() => router.push(`/store/${slug}/login`)}>Sign In</Button>} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Cart</Text>
        <Text style={s.sub}>{cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</Text>
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={s.list}>
        {cartItems.length === 0
          ? <EmptyState icon={<Text style={s.emptyIcon}>🛒</Text>} title="Your cart is empty" subtitle="Add products from the store to get started"
              action={<Button variant="secondary" onPress={() => router.push(`/store/${slug}`)}>Browse Products</Button>} />
          : <>
            {cartItems.map((item: any) => (
              <Card key={item.id} style={s.itemCard}>
                <View style={s.imgBox}>
                  {item.products.image_url
                    ? <Image source={{ uri: item.products.image_url }} style={s.img} resizeMode="cover" />
                    : <Text style={s.imgFallback}>📦</Text>
                  }
                </View>
                <View style={s.itemInfo}>
                  <Text style={s.itemName} numberOfLines={1}>{item.products.name}</Text>
                  <Text style={s.itemPrice}>{formatCurrency(parseNumber(item.products.price))}</Text>
                  <View style={s.qtyRow}>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.id, item.quantity - 1)}><Text style={s.qtyBtnText}>−</Text></TouchableOpacity>
                    <Text style={s.qtyNum}>{item.quantity}</Text>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.id, item.quantity + 1)}><Text style={s.qtyBtnText}>+</Text></TouchableOpacity>
                    <Text style={s.lineTotal}>= {formatCurrency(parseNumber(item.products.price) * item.quantity)}</Text>
                  </View>
                </View>
              </Card>
            ))}
            <Card style={s.summary}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Subtotal</Text>
                <Text style={s.summaryTotal}>{formatCurrency(total)}</Text>
              </View>
              <Text style={s.summaryNote}>Shipping fee will be calculated by the store owner after your order is placed.</Text>
              <Button onPress={handleCheckout} loading={placing}>Place Order — {formatCurrency(total)}</Button>
            </Card>
          </>
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
  itemCard: { flexDirection: 'row', overflow: 'hidden' },
  imgBox: { width: 80, height: 80, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  img: { width: 80, height: 80 },
  imgFallback: { fontSize: 24 },
  itemInfo: { flex: 1, padding: Spacing.md, gap: 4 },
  itemName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  itemPrice: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.brand },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  qtyBtn: { width: 28, height: 28, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  qtyNum: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary, minWidth: 24, textAlign: 'center' },
  lineTotal: { fontSize: FontSize.xs, color: Colors.textMuted },
  summary: { padding: Spacing.lg, gap: Spacing.md, marginTop: Spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textMuted },
  summaryTotal: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary },
  summaryNote: { fontSize: FontSize.xs, color: Colors.textMuted },
})
