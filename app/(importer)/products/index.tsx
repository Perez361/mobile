import { useCallback, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

export default function ProductsScreen() {
  const router = useRouter()
  const { user } = useImporterSession()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetch = useCallback(async () => {
    if (!user) return
    const { data } = await createImporterClient().from('products').select('*').eq('importer_id', user.id).order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }, [user])

  useFocusEffect(useCallback(() => { fetch() }, [fetch]))
  async function onRefresh() { setRefreshing(true); await fetch(); setRefreshing(false) }

  function handleDelete(product: any) {
    Alert.alert('Delete Product', `Delete "${product.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await createImporterClient().from('products').delete().eq('id', product.id)
        setProducts((prev) => prev.filter((p) => p.id !== product.id))
      }},
    ])
  }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Products</Text>
          <Text style={s.sub}>{products.length} listed</Text>
        </View>
        <Button onPress={() => router.push('/(importer)/products/new')} style={s.addBtn}>+ Add</Button>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={s.list}>
        {products.length === 0
          ? <EmptyState icon={<Ionicons name="cube-outline" size={40} color={Colors.textMuted} />} title="No products yet" subtitle="Add your first product to start selling"
              action={<Button onPress={() => router.push('/(importer)/products/new')}>Add Product</Button>} />
          : products.map((product) => (
            <Card key={product.id} style={s.card}>
              <View style={s.row}>
                <View style={s.imgBox}>
                  {product.image_url
                    ? <Image source={{ uri: product.image_url }} style={s.img} resizeMode="cover" />
                    : <Ionicons name="cube-outline" size={28} color={Colors.textMuted} />
                  }
                </View>
                <View style={s.info}>
                  <Text style={s.productName} numberOfLines={1}>{product.name}</Text>
                  {product.description && <Text style={s.productDesc} numberOfLines={2}>{product.description}</Text>}
                  <Text style={s.price}>{formatCurrency(product.price)}</Text>
                  {product.shipping_tag && (
                    <View style={s.shippingTagRow}>
                      <Ionicons name="boat-outline" size={11} color={Colors.textMuted} />
                      <Text style={s.shippingTag}>{product.shipping_tag}</Text>
                    </View>
                  )}
                </View>
                <View style={s.actions}>
                  <TouchableOpacity style={s.editBtn} onPress={() => router.push(`/(importer)/products/${product.id}`)}>
                    <Text style={s.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(product)}>
                    <Text style={s.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.md, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  addBtn: { height: 36, paddingHorizontal: Spacing.md },
  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row' },
  imgBox: { width: 80, height: 80, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  img: { width: 80, height: 80 },
  info: { flex: 1, padding: Spacing.md, gap: 3 },
  productName: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  productDesc: { fontSize: FontSize.xs, color: Colors.textMuted },
  price: { fontSize: FontSize.base, fontWeight: '900', color: Colors.brand },
  shippingTagRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  shippingTag: { fontSize: FontSize.xs, color: Colors.textMuted },
  actions: { padding: Spacing.md, gap: Spacing.sm, justifyContent: 'center' },
  editBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: Colors.brandLight },
  editBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.brand },
  deleteBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: Colors.dangerLight },
  deleteBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.danger },
})
