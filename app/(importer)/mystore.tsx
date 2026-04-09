import { useCallback, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image, Clipboard, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

export default function MyStoreScreen() {
  const router = useRouter()
  const { user, importer } = useImporterSession()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)

  const storeSlug = importer?.store_slug

  const fetchProducts = useCallback(async () => {
    if (!importer) return
    const { data } = await createImporterClient()
      .from('products').select('*').eq('importer_id', importer.id)
      .order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }, [importer])

  useFocusEffect(useCallback(() => { fetchProducts() }, [fetchProducts]))
  async function onRefresh() { setRefreshing(true); await fetchProducts(); setRefreshing(false) }

  function copyLink() {
    if (!storeSlug) return
    Clipboard.setString(`importflow://store/${storeSlug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <SafeAreaView style={s.root}>
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.brand} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>My Store</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.scroll}
      >
        {/* Store header */}
        <View style={s.storeCard}>
          <View style={s.storeIconBox}>
            <Ionicons name="storefront-outline" size={28} color="#fff" />
          </View>
          <View style={s.storeInfo}>
            <Text style={s.storeName}>{importer?.business_name || 'My Store'}</Text>
            {importer?.location && (
              <View style={s.locationRow}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={s.storeLocation}>{importer.location}</Text>
              </View>
            )}
            <Text style={s.productCount}>{products.length} product{products.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {/* Store link */}
        {storeSlug && (
          <View style={s.linkSection}>
            <Text style={s.linkLabel}>Store Link</Text>
            <View style={s.linkBox}>
              <Text style={s.linkText} numberOfLines={1}>/store/{storeSlug}</Text>
              <TouchableOpacity style={s.copyBtn} onPress={copyLink}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color="#fff" />
                <Text style={s.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.linkHint}>Share this link with your customers</Text>
          </View>
        )}

        {/* Product preview */}
        <Text style={s.sectionTitle}>Product Preview</Text>

        {products.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="cube-outline" size={40} color={Colors.textMuted} />}
            title="No products yet"
            subtitle="Add products to see how your store looks"
            action={
              <TouchableOpacity style={s.addBtn} onPress={() => router.push('/(importer)/products/new')}>
                <Text style={s.addBtnText}>+ Add Product</Text>
              </TouchableOpacity>
            }
          />
        ) : (
          <View style={s.grid}>
            {products.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={s.productCard}
                onPress={() => router.push(`/(importer)/products/${p.id}`)}
                activeOpacity={0.8}
              >
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={s.productImg} resizeMode="cover" />
                ) : (
                  <View style={s.productImgPlaceholder}>
                    <Ionicons name="cube-outline" size={28} color={Colors.textMuted} />
                  </View>
                )}
                <View style={s.productInfo}>
                  <Text style={s.productName} numberOfLines={2}>{p.name}</Text>
                  {p.description && (
                    <Text style={s.productDesc} numberOfLines={2}>{p.description}</Text>
                  )}
                  <Text style={s.productPrice}>{formatCurrency(p.price)}</Text>
                  {p.shipping_tag && (
                    <View style={s.shippingTagRow}>
                      <Ionicons name="boat-outline" size={11} color={Colors.textMuted} />
                      <Text style={s.shippingTag}>{p.shipping_tag}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
  scroll: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: 40 },

  storeCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    backgroundColor: Colors.brand, borderRadius: 16, padding: Spacing.xl,
  },
  storeIconBox: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  storeInfo: { flex: 1, gap: 3 },
  storeName: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  storeLocation: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)' },
  productCount: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  linkSection: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.sm,
  },
  linkLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  linkBox: {
    flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  linkText: { flex: 1, paddingHorizontal: Spacing.lg, fontSize: FontSize.sm, color: Colors.brand, fontWeight: '600' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.brand, paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  copyBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  linkHint: { fontSize: FontSize.xs, color: Colors.textMuted },

  sectionTitle: { fontSize: FontSize.base, fontWeight: '800', color: Colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  productCard: {
    width: '47%', backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  productImg: { width: '100%', height: 130 },
  productImgPlaceholder: {
    width: '100%', height: 130, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  productInfo: { padding: Spacing.md, gap: 4 },
  productName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  productDesc: { fontSize: FontSize.xs, color: Colors.textMuted },
  productPrice: { fontSize: FontSize.base, fontWeight: '900', color: Colors.brand },
  shippingTagRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  shippingTag: { fontSize: FontSize.xs, color: Colors.textMuted },
  addBtn: { backgroundColor: Colors.brand, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  addBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
})
