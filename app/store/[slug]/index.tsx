import { useCallback, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, Image, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { useCustomerSession } from '@/lib/hooks/useCustomerSession'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

export default function StorefrontScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { user, customer } = useCustomerSession(slug)
  const [products, setProducts] = useState<any[]>([])
  const [store, setStore] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!slug) return
    const supabase = createCustomerClient(slug)
    const { data: imp } = await supabase.from('importers').select('id, business_name, store_slug, phone, location').ilike('store_slug', slug).single()
    if (!imp) { setLoading(false); return }
    setStore(imp)
    const { data: prods } = await supabase.from('products').select('id, name, price, description, image_url, slug, shipping_tag, created_at, importer_id').eq('importer_id', imp.id).order('created_at', { ascending: false })
    setProducts(prods || [])
    setLoading(false)
  }, [slug])

  useFocusEffect(useCallback(() => { fetchData() }, [fetchData]))
  async function onRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  async function handleAddToCart(product: any) {
    if (!user || !customer) {
      Alert.alert('Sign in required', 'You need to sign in to add items to your cart.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push(`/store/${slug}/login`) },
      ])
      return
    }
    const supabase = createCustomerClient(slug)
    let { data: cart } = await supabase.from('carts').select('id').eq('customer_id', customer.id).eq('store_id', customer.store_id).single()
    if (!cart) {
      const { data: newCart } = await supabase.from('carts').insert({ customer_id: customer.id, store_id: customer.store_id }).select('id').single()
      cart = newCart
    }
    await supabase.from('cart_items').upsert({ cart_id: cart!.id, product_id: product.id, quantity: 1 }, { onConflict: 'cart_id,product_id' })
    Alert.alert('Added to cart', `${product.name} has been added to your cart.`, [
      { text: 'Continue Shopping' },
      { text: 'View Cart', onPress: () => router.push(`/store/${slug}/cart`) },
    ])
  }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <SafeAreaView style={s.root}>
      <View style={s.storeHeader}>
        <View style={s.storeHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.storeName}>{store?.business_name || slug}</Text>
            {store?.location && <Text style={s.storeLocation}>📍 {store.location}</Text>}
          </View>
          {!user && (
            <TouchableOpacity style={s.signInBtn} onPress={() => router.push(`/store/${slug}/login`)}>
              <Text style={s.signInBtnText}>Sign In</Text>
            </TouchableOpacity>
          )}
          {user && (
            <TouchableOpacity style={s.signInBtn} onPress={() => router.push(`/store/${slug}/cart`)}>
              <Text style={s.signInBtnText}>🛒 Cart</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={s.productCount}>{products.length} product{products.length !== 1 ? 's' : ''} available</Text>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={s.list}>
        {products.length === 0
          ? <EmptyState icon={<Text style={s.emptyIcon}>🛍️</Text>} title="No products yet" subtitle="This store hasn't added any products yet. Check back later." />
          : products.map((product) => (
            <Card key={product.id} style={s.productCard}>
              {product.image_url && <Image source={{ uri: product.image_url }} style={s.productImg} resizeMode="cover" />}
              <View style={s.productBody}>
                <Text style={s.productName}>{product.name}</Text>
                {product.description && <Text style={s.productDesc} numberOfLines={3}>{product.description}</Text>}
                {product.shipping_tag && <Text style={s.productShipping}>🚚 {product.shipping_tag}</Text>}
                <View style={s.productFooter}>
                  <Text style={s.productPrice}>{formatCurrency(product.price)}</Text>
                  <Button onPress={() => handleAddToCart(product)} style={s.addBtn}>Add to Cart</Button>
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
  storeHeader: { backgroundColor: Colors.brand, paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  storeHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storeName: { fontSize: FontSize.xl, fontWeight: '900', color: '#fff' },
  storeLocation: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  signInBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.sm },
  signInBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: '#fff' },
  productCount: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: Spacing.sm },
  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  emptyIcon: { fontSize: 40 },
  productCard: { overflow: 'hidden' },
  productImg: { width: '100%', height: 180 },
  productBody: { padding: Spacing.lg, gap: Spacing.xs },
  productName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  productDesc: { fontSize: FontSize.sm, color: Colors.textMuted },
  productShipping: { fontSize: FontSize.xs, color: Colors.textMuted },
  productFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  productPrice: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.brand },
  addBtn: { height: 36, paddingHorizontal: Spacing.md },
})
