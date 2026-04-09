import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Image,
  TouchableOpacity,
  TextInput,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native'
import { useAlert } from '@/components/ui/AlertModal'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { useCustomerContext } from '@/lib/hooks/CustomerContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatCurrency, parseNumber } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

// ─── Theme ────────────────────────────────────────────────────────────────────

interface StoreTheme {
  heroBg: string
  accent: string
  priceColor: string
  btnBg: string
  badgeBg: string
  badgeText: string
}

const THEMES: StoreTheme[] = [
  { heroBg: '#0F172A', accent: '#F59E0B', priceColor: '#B45309', btnBg: '#0F172A', badgeBg: 'rgba(245,158,11,0.15)', badgeText: '#F59E0B' },
  { heroBg: '#1a1a2e', accent: '#E94560', priceColor: '#E94560', btnBg: '#0f3460', badgeBg: 'rgba(233,69,96,0.15)', badgeText: '#E94560' },
  { heroBg: '#0D4B3B', accent: '#FCD34D', priceColor: '#059669', btnBg: '#065F46', badgeBg: 'rgba(252,211,77,0.15)', badgeText: '#92400E' },
  { heroBg: '#1C0533', accent: '#A855F7', priceColor: '#7C3AED', btnBg: '#6D28D9', badgeBg: 'rgba(168,85,247,0.15)', badgeText: '#A855F7' },
  { heroBg: '#1A0A00', accent: '#F97316', priceColor: '#C2410C', btnBg: '#C2410C', badgeBg: 'rgba(249,115,22,0.15)', badgeText: '#F97316' },
  { heroBg: '#0C1A2E', accent: '#3B82F6', priceColor: '#1D4ED8', btnBg: '#1D4ED8', badgeBg: 'rgba(59,130,246,0.15)', badgeText: '#3B82F6' },
]

function hashSlug(slug: string): number {
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash * 31 + slug.charCodeAt(i)) >>> 0)
  }
  return hash
}

function getTheme(slug: string): StoreTheme {
  return THEMES[hashSlug(slug) % THEMES.length]
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  price: number
  description?: string
  image_url?: string
  shipping_tag?: string
}

interface Store {
  id: string
  business_name: string
  phone?: string
  location?: string
  store_id?: string
}

// ─── Product Card ─────────────────────────────────────────────────────────────

const CARD_GAP = Spacing.md
const SCREEN_W = Dimensions.get('window').width
const CARD_W = (SCREEN_W - Spacing.lg * 2 - CARD_GAP) / 2

function ProductCard({
  product,
  theme,
  onAddToCart,
}: {
  product: Product
  theme: StoreTheme
  onAddToCart: (product: Product) => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  async function handlePress() {
    if (adding || added) return
    setAdding(true)
    await onAddToCart(product)
    setAdding(false)
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <View style={[s.card, { width: CARD_W }]}>
      {/* Image */}
      <View style={s.cardImgBox}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={s.cardImg} resizeMode="cover" />
        ) : (
          <View style={s.cardImgFallback}>
            <Ionicons name="cube-outline" size={36} color="#CBD5E1" />
          </View>
        )}
        {/* Pre-order badge */}
        <View style={[s.preorderBadge, { backgroundColor: theme.badgeBg }]}>
          <Ionicons name="star" size={8} color={theme.badgeText} />
          <Text style={[s.preorderText, { color: theme.badgeText }]}>Pre-order</Text>
        </View>
      </View>

      {/* Content */}
      <View style={s.cardBody}>
        <Text style={s.cardName} numberOfLines={2}>{product.name}</Text>
        {product.description ? (
          <Text style={s.cardDesc} numberOfLines={1}>{product.description}</Text>
        ) : null}
        {product.shipping_tag ? (
          <View style={s.shippingRow}>
            <Ionicons name="airplane-outline" size={11} color={Colors.textMuted} />
            <Text style={s.shippingText} numberOfLines={1}>{product.shipping_tag}</Text>
          </View>
        ) : null}

        <View style={s.cardFooter}>
          <View>
            <Text style={s.priceLabel}>Price</Text>
            <Text style={[s.price, { color: theme.priceColor }]}>
              GH₵{parseNumber(product.price).toLocaleString('en-GH', { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <Pressable
            onPress={handlePress}
            disabled={adding}
            style={[
              s.addBtn,
              {
                backgroundColor: added
                  ? Colors.success
                  : adding
                  ? '#94A3B8'
                  : theme.btnBg,
              },
            ]}
          >
            {adding ? (
              <ActivityIndicator size={12} color="#fff" />
            ) : added ? (
              <Ionicons name="checkmark" size={14} color="#fff" />
            ) : (
              <Ionicons name="add" size={14} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({
  store,
  theme,
  productCount,
  isLoggedIn,
  onLogin,
  onLogout,
}: {
  store: Store
  theme: StoreTheme
  productCount: number
  isLoggedIn: boolean
  onLogin: () => void
  onLogout: () => void
}) {
  return (
    <View style={[s.hero, { backgroundColor: theme.heroBg }]}>
      {/* Top row: store name + auth button */}
      <View style={s.heroTopRow}>
        <View style={s.heroLeft}>
          {/* Official store badge */}
          <View style={[s.officialBadge, { backgroundColor: theme.badgeBg }]}>
            <Ionicons name="star" size={10} color={theme.accent} />
            <Text style={[s.officialBadgeText, { color: theme.accent }]}>OFFICIAL STORE</Text>
          </View>
          <Text style={s.heroName} numberOfLines={2}>{store.business_name}</Text>
          <Text style={s.heroTagline}>
            Pre-order directly. Pay product price now, shipping when your items arrive.
          </Text>
        </View>

        {/* Auth pill */}
        {isLoggedIn ? (
          <TouchableOpacity style={s.authPill} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={14} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.authPill, { backgroundColor: theme.accent + '22', borderColor: theme.accent + '44' }]}
            onPress={onLogin}
          >
            <Ionicons name="person-outline" size={13} color={theme.accent} />
            <Text style={[s.authPillText, { color: theme.accent }]}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info pills */}
      <View style={s.heroPills}>
        {store.location ? (
          <View style={s.pill}>
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={s.pillText} numberOfLines={1}>{store.location}</Text>
          </View>
        ) : null}
        {store.phone ? (
          <View style={s.pill}>
            <Ionicons name="call-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={s.pillText}>{store.phone}</Text>
          </View>
        ) : null}
        <View style={s.pill}>
          <Ionicons name="cube-outline" size={12} color="rgba(255,255,255,0.6)" />
          <Text style={s.pillText}>{productCount} product{productCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StorefrontScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { user, customer } = useCustomerContext()
  const { showAlert } = useAlert()

  const [products, setProducts] = useState<Product[]>([])
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [cartTotal, setCartTotal] = useState(0)
  const cartRef = useRef({ count: 0, total: 0 })

  // Use context for cart count (shared with tabs badge)
  const { cartCount, setCartCount: updateCartCount } = useCustomerContext()

  const setCartCount = (count: number) => {
    cartRef.current.count = count
    updateCartCount(count)
  }

  const theme = getTheme(slug ?? '')

  // ── Fetch store + products ─────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!slug) return
    const supabase = createCustomerClient(slug)
    const { data: imp } = await supabase
      .from('importers')
      .select('id, business_name, store_slug, phone, location')
      .ilike('store_slug', slug)
      .single()
    if (!imp) { setLoading(false); return }
    setStore(imp)
    const { data: prods } = await supabase
      .from('products')
      .select('id, name, price, description, image_url, shipping_tag, created_at, importer_id')
      .eq('importer_id', imp.id)
      .order('created_at', { ascending: false })
    setProducts(prods || [])
    setLoading(false)
  }, [slug])

  // ── Fetch cart summary ─────────────────────────────────────────────────────

  const fetchCartSummary = useCallback(async () => {
    if (!customer) { setCartCount(0); setCartTotal(0); return }
    const supabase = createCustomerClient(slug)
    const { data: cart } = await supabase
      .from('carts')
      .select('id, cart_items (quantity, products (price))')
      .eq('customer_id', customer.id)
      .eq('store_id', customer.store_id)
      .single()
    if (!cart) { setCartCount(0); setCartTotal(0); return }
    const items = (cart.cart_items as any[]) || []
    const count = items.reduce((s, i) => s + i.quantity, 0)
    const total = items.reduce((s, i) => s + parseNumber(i.products.price) * i.quantity, 0)
    setCartCount(count)
    setCartTotal(total)
    cartRef.current = { count, total }
  }, [customer, slug])

  useFocusEffect(useCallback(() => {
    fetchData()
    fetchCartSummary()
  }, [fetchData, fetchCartSummary]))

  // Real-time subscription for product updates
  useEffect(() => {
    if (!slug || !store) return
    const supabase = createCustomerClient(slug)
    const channel = supabase
      .channel(`products-${store.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products',
        filter: `importer_id=eq.${store.id}`,
      }, () => {
        fetchData()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [slug, store, fetchData])

  async function onRefresh() {
    setRefreshing(true)
    await Promise.all([fetchData(), fetchCartSummary()])
    setRefreshing(false)
  }

  // ── Add to cart ────────────────────────────────────────────────────────────

  async function handleAddToCart(product: Product) {
    if (!user || !customer) {
      showAlert({
        type: 'confirm',
        title: 'Sign in required',
        message: 'You need to sign in to add items to your cart.',
        confirmText: 'Sign In',
        cancelText: 'Cancel',
        onConfirm: () => router.push(`/store/${slug}/login`),
      })
      return
    }
    const supabase = createCustomerClient(slug)
    let { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('store_id', customer.store_id)
      .single()
    if (!cart) {
      const { data: newCart } = await supabase
        .from('carts')
        .insert({ customer_id: customer.id, store_id: customer.store_id })
        .select('id')
        .single()
      cart = newCart
    }
    if (!cart) return
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cart.id)
      .eq('product_id', product.id)
      .single()
    if (existing) {
      await supabase.from('cart_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('cart_items').insert({ cart_id: cart.id, product_id: product.id, quantity: 1 })
    }
    // Update floating bar optimistically
    const newCount = cartRef.current.count + 1
    const newTotal = cartRef.current.total + parseNumber(product.price)
    cartRef.current = { count: newCount, total: newTotal }
    setCartCount(newCount)
    setCartTotal(newTotal)
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function handleLogout() {
    showAlert({
      type: 'confirm',
      title: 'Sign out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      onConfirm: async () => {
        await createCustomerClient(slug).auth.signOut()
        setCartCount(0)
        setCartTotal(0)
        cartRef.current = { count: 0, total: 0 }
      },
    })
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = products.filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
  })

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSpinner fullScreen />

  if (!store) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.notFound}>
          <Ionicons name="storefront-outline" size={52} color="#CBD5E1" />
          <Text style={s.notFoundTitle}>Store not found</Text>
          <Text style={s.notFoundSub}>This store doesn't exist or may have moved.</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.replace('/store')}>
            <Text style={s.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const ListHeader = (
    <>
      <HeroSection
        store={store}
        theme={theme}
        productCount={products.length}
        isLoggedIn={!!user}
        onLogin={() => router.push(`/store/${slug}/login`)}
        onLogout={handleLogout}
      />

      {/* Search */}
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Search products…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={s.searchClear}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Section heading */}
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>All Products</Text>
        <Text style={s.sectionSub}>
          {filtered.length}{filtered.length !== products.length ? ` of ${products.length}` : ''} available
        </Text>
      </View>
    </>
  )

  const gridData: (Product | null)[] = filtered.length % 2 !== 0
    ? [...filtered, null]
    : filtered

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <FlatList
        data={gridData}
        keyExtractor={(item, i) => item?.id ?? `pad-${i}`}
        numColumns={2}
        columnWrapperStyle={s.row}
        contentContainerStyle={[s.listContent, cartCount > 0 && { paddingBottom: 90 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          search.trim() ? (
            <View style={s.emptyWrap}>
              <Ionicons name="search-outline" size={44} color="#CBD5E1" />
              <Text style={s.emptyTitle}>No results for "{search}"</Text>
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={[s.emptyAction, { color: theme.priceColor }]}>Clear search</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.emptyWrap}>
              <Ionicons name="cube-outline" size={52} color="#CBD5E1" />
              <Text style={s.emptyTitle}>No products yet</Text>
              <Text style={s.emptySub}>Check back soon — new items are on the way.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          if (!item) return <View style={{ width: CARD_W }} />
          return (
            <ProductCard
              product={item}
              theme={theme}
              onAddToCart={handleAddToCart}
            />
          )
        }}
      />

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <View style={s.floatingBar}>
          <TouchableOpacity
            style={[s.floatingBtn, { backgroundColor: theme.btnBg }]}
            onPress={() => router.push(`/store/${slug}/cart`)}
            activeOpacity={0.9}
          >
            <View style={s.floatingBadge}>
              <Text style={s.floatingBadgeText}>{cartCount}</Text>
            </View>
            <Ionicons name="cart" size={18} color="#fff" />
            <Text style={s.floatingLabel}>View Cart</Text>
            <Text style={[s.floatingTotal, { color: theme.accent }]}>
              · GH₵{cartTotal.toLocaleString('en-GH', { maximumFractionDigits: 0 })}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },

  // Hero
  hero: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  heroLeft: { flex: 1 },
  officialBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, marginBottom: Spacing.sm },
  officialBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroName: { fontSize: FontSize.xxl, fontWeight: '900', color: '#F8FAFC', lineHeight: 30 },
  heroTagline: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)', marginTop: Spacing.sm, lineHeight: 17 },
  authPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', marginTop: 2 },
  authPillText: { fontSize: FontSize.xs, fontWeight: '700' },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.lg },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  pillText: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  // Search
  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, height: 42 },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  searchClear: { marginLeft: Spacing.xs },

  // Section heading
  sectionHead: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textPrimary },
  sectionSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  // Grid
  listContent: { paddingBottom: Spacing.xxxl },
  row: { paddingHorizontal: Spacing.lg, gap: CARD_GAP, marginBottom: CARD_GAP },

  // Product card
  card: { backgroundColor: Colors.card, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardImgBox: { width: '100%', aspectRatio: 1, backgroundColor: '#F1F5F9' },
  cardImg: { width: '100%', height: '100%' },
  cardImgFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  preorderBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  preorderText: { fontSize: 9, fontWeight: '800' },
  cardBody: { padding: Spacing.md, gap: 4 },
  cardName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, lineHeight: 18 },
  cardDesc: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 15 },
  shippingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  shippingText: { fontSize: FontSize.xs, color: Colors.textMuted, flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  priceLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  price: { fontSize: FontSize.md, fontWeight: '900' },
  addBtn: { width: 34, height: 34, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },

  // Empty states
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginTop: Spacing.md },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xs },
  emptyAction: { fontSize: FontSize.sm, fontWeight: '700', marginTop: Spacing.sm },

  // Not found
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  notFoundTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  notFoundSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  backBtn: { marginTop: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.brand, borderRadius: Radius.md },
  backBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },

  // Floating cart bar
  floatingBar: { position: 'absolute', bottom: Spacing.lg, left: Spacing.lg, right: Spacing.lg },
  floatingBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.xl, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  floatingBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  floatingBadgeText: { fontSize: 11, fontWeight: '900', color: '#fff' },
  floatingLabel: { flex: 1, fontSize: FontSize.sm, fontWeight: '800', color: '#fff' },
  floatingTotal: { fontSize: FontSize.sm, fontWeight: '700' },
})
