import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Modal, FlatList,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useAlert } from '@/components/ui/AlertModal'
import { formatCurrency } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

export default function ShipmentBatchScreen() {
  const router = useRouter()
  const { id: batchId } = useLocalSearchParams<{ id: string }>()
  const { importer } = useImporterSession()
  const { showAlert } = useAlert()

  const [batch, setBatch] = useState<any>(null)
  const [shipmentItems, setShipmentItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchData = useCallback(async () => {
    if (!batchId || !importer) return

    try {
      const supabase = createImporterClient()

      // Fetch batch
      const { data: batchData, error: batchError } = await supabase
        .from('shipment_batches')
        .select('*')
        .eq('id', batchId)
        .eq('importer_id', importer.id)
        .single()

      if (batchError) {
        console.error('Batch fetch error:', batchError)
        setError('Batch not found')
        return
      }

      setBatch(batchData)

      // Fetch shipment items
      const { data: itemsData } = await supabase
        .from('shipment_items')
        .select(`
          *,
          products ( id, name, price )
        `)
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false })

      setShipmentItems(itemsData || [])

      // Fetch products for adding to shipment
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('importer_id', importer.id)
        .order('name')

      setProducts(productsData || [])

    } catch (err: any) {
      console.error('Fetch batch error:', err)
      setError(err.message || 'Failed to load batch')
    } finally {
      setLoading(false)
    }
  }, [batchId, importer])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const addShipmentItem = async () => {
    if (!selectedProduct || !trackingNumber.trim()) {
      showAlert({ type: 'error', title: 'Error', message: 'Please select a product and enter a tracking number' })
      return
    }

    setAdding(true)
    try {
      const supabase = createImporterClient()

      const { error } = await supabase
        .from('shipment_items')
        .insert({
          batch_id: batchId,
          product_id: selectedProduct.id,
          tracking_number: trackingNumber.trim().toUpperCase(),
        })

      if (error) {
        console.error('Add item error:', error)
        showAlert({ type: 'error', title: 'Error', message: error.message })
        return
      }

      showAlert({ type: 'success', title: 'Success', message: 'Item added to shipment' })
      setShowAddModal(false)
      setSelectedProduct(null)
      setTrackingNumber('')
      fetchData() // Refresh data
    } catch (err: any) {
      console.error('Add item error:', err)
      showAlert({ type: 'error', title: 'Error', message: err.message || 'Failed to add item' })
    } finally {
      setAdding(false)
    }
  }

  const updateItemStatus = async (itemId: string, newStatus: string) => {
    try {
      const supabase = createImporterClient()

      const { error } = await supabase
        .from('shipment_items')
        .update({ status: newStatus })
        .eq('id', itemId)

      if (error) {
        console.error('Update status error:', error)
        showAlert({ type: 'error', title: 'Error', message: error.message })
        return
      }

      // Update local state
      setShipmentItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, status: newStatus } : item
        )
      )
    } catch (err: any) {
      console.error('Update status error:', err)
      showAlert({ type: 'error', title: 'Error', message: err.message || 'Failed to update status' })
    }
  }

  if (loading) return <LoadingSpinner fullScreen />

  const itemStatusOptions = [
    { label: 'Pending', value: 'pending', color: '#D97706' },
    { label: 'Received', value: 'received', color: '#10B981' },
    { label: 'Missing', value: 'missing', color: '#EF4444' },
    { label: 'Extra', value: 'extra', color: '#8B5CF6' },
  ]

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.brand} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{batch?.name || 'Shipment Batch'}</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={s.addBtn}>
          <Ionicons name="add" size={20} color={Colors.brand} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.container}>
        {/* Batch Info */}
        {batch && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Batch Details</Text>
            <View style={s.infoCard}>
              <Text style={s.infoText}>Status: {batch.status}</Text>
              <Text style={s.infoText}>Created: {new Date(batch.created_at).toLocaleDateString()}</Text>
              {batch.shipping_company && (
                <Text style={s.infoText}>Shipping Company: {batch.shipping_company}</Text>
              )}
              {batch.notes && (
                <Text style={s.infoText}>Notes: {batch.notes}</Text>
              )}
            </View>
          </View>
        )}

        {/* Shipment Items */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Shipment Items ({shipmentItems.length})</Text>
          {shipmentItems.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
              <Text style={s.emptyText}>No items in this shipment</Text>
              <Text style={s.emptySubtext}>Tap + to add products with tracking numbers</Text>
            </View>
          ) : (
            shipmentItems.map((item: any) => (
              <View key={item.id} style={s.itemCard}>
                <View style={s.itemHeader}>
                  <View style={s.itemInfo}>
                    <Text style={s.itemTitle}>
                      {item.products?.name || 'Unknown Product'}
                    </Text>
                    <Text style={s.itemTracking}>Tracking: {item.tracking_number}</Text>
                  </View>
                  <View style={s.statusContainer}>
                    {itemStatusOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => updateItemStatus(item.id, option.value)}
                        style={[
                          s.statusOption,
                          item.status === option.value && { backgroundColor: option.color }
                        ]}
                      >
                        <Text style={[
                          s.statusText,
                          item.status === option.value && { color: '#fff' }
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modalRoot}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Add Shipment Item</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={s.modalScroll} contentContainerStyle={s.modalContainer}>
            <Text style={s.modalLabel}>Select Product</Text>
            {selectedProduct ? (
              <TouchableOpacity
                onPress={() => setSelectedProduct(null)}
                style={s.productSelector}
              >
                <Text style={s.productSelectorText}>{selectedProduct.name}</Text>
                <Ionicons name="close" size={20} color={Colors.danger} />
              </TouchableOpacity>
            ) : products.length === 0 ? (
              <View style={s.noProducts}>
                <Text style={s.noProductsText}>No products available</Text>
                <Text style={s.noProductsSubtext}>Add products first to include them in shipments</Text>
              </View>
            ) : (
              <View style={s.productList}>
                {products.slice(0, 10).map((product: any) => (
                  <TouchableOpacity
                    key={product.id}
                    onPress={() => setSelectedProduct(product)}
                    style={s.productOption}
                  >
                    <Text style={s.productOptionText}>{product.name}</Text>
                    <Text style={s.productOptionPrice}>{formatCurrency(product.price)}</Text>
                  </TouchableOpacity>
                ))}
                {products.length > 10 && (
                  <Text style={s.moreProductsText}>And {products.length - 10} more products...</Text>
                )}
              </View>
            )}

            <Text style={s.modalLabel}>Tracking Number</Text>
            <TextInput
              style={s.trackingInput}
              placeholder="Enter tracking number"
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={s.modalButtons}>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={[s.modalButton, s.cancelButton]}
              >
                <Text style={s.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={addShipmentItem}
                disabled={adding}
                style={[s.modalButton, s.addButton, adding && { opacity: 0.6 }]}
              >
                <Text style={s.addButtonText}>
                  {adding ? "Adding..." : "Add Item"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.card },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: FontSize.sm, color: Colors.brand, marginLeft: Spacing.xs },
  headerTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  addBtn: { padding: Spacing.sm },

  scroll: { flex: 1 },
  container: { padding: Spacing.xl, gap: Spacing.xl },

  section: { gap: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '800', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  infoText: { fontSize: FontSize.base, color: Colors.textPrimary },

  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: { fontSize: FontSize.base, color: Colors.textPrimary, textAlign: 'center' },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  itemHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  itemInfo: { flex: 1, gap: Spacing.xs },
  itemTitle: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  itemTracking: { fontSize: FontSize.sm, color: Colors.textMuted },

  statusContainer: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', marginTop: Spacing.sm },
  statusOption: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    minWidth: 60, alignItems: 'center',
  },
  statusText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted },

  // Modal styles
  modalRoot: { flex: 1, backgroundColor: Colors.card },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  modalScroll: { flex: 1 },
  modalContainer: { padding: Spacing.xl, gap: Spacing.lg },

  modalLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  productSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  productSelectorText: { fontSize: FontSize.base, color: Colors.textPrimary },

  trackingInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    fontSize: FontSize.base, color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },

  productList: { gap: Spacing.xs },
  productOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md,
  },
  productOptionText: { fontSize: FontSize.base, color: Colors.textPrimary, flex: 1 },
  productOptionPrice: { fontSize: FontSize.sm, color: Colors.brand, fontWeight: '600' },

  noProducts: {
    padding: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.md,
    alignItems: 'center', gap: Spacing.sm,
  },
  noProductsText: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: '600' },
  noProductsSubtext: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  moreProductsText: {
    fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center',
    padding: Spacing.sm, fontStyle: 'italic',
  },

  modalButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  modalButton: {
    flex: 1, paddingVertical: Spacing.lg, borderRadius: Radius.md, alignItems: 'center',
  },
  cancelButton: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  cancelButtonText: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  addButton: { backgroundColor: Colors.brand },
  addButtonText: { fontSize: FontSize.base, fontWeight: '600', color: '#fff' },
})