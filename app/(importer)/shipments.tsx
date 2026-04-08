import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  TextInput, Alert, StyleSheet,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { getTimeAgo } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

type BatchStatus = 'open' | 'received' | 'reconciled'
const STATUS_COLORS: Record<BatchStatus, { bg: string; text: string }> = {
  open:        { bg: '#DBEAFE', text: '#1D4ED8' },
  received:    { bg: '#FEF9C3', text: '#A16207' },
  reconciled:  { bg: '#D1FAE5', text: '#065F46' },
}

export default function ShipmentsScreen() {
  const router = useRouter()
  const { user } = useImporterSession()
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [batchName, setBatchName] = useState('')
  const [company, setCompany] = useState('')
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchBatches = useCallback(async () => {
    if (!user) return
    const { data } = await createImporterClient()
      .from('shipment_batches')
      .select('*, shipment_items (id, status)')
      .eq('importer_id', user.id)
      .order('created_at', { ascending: false })
    setBatches(data || [])
    setLoading(false)
  }, [user])

  useFocusEffect(useCallback(() => { fetchBatches() }, [fetchBatches]))
  async function onRefresh() { setRefreshing(true); await fetchBatches(); setRefreshing(false) }

  async function createBatch() {
    if (!batchName.trim()) { Alert.alert('Name required', 'Enter a batch name.'); return }
    if (!user) return
    setCreating(true)
    try {
      const { error } = await createImporterClient()
        .from('shipment_batches')
        .insert({ importer_id: user.id, name: batchName.trim(), shipping_company: company.trim() || null, notes: notes.trim() || null })
      if (error) { Alert.alert('Error', error.message); return }
      setBatchName(''); setCompany(''); setNotes(''); setShowForm(false)
      await fetchBatches()
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong.')
    } finally { setCreating(false) }
  }

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <SafeAreaView style={s.root}>
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.brand} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Shipments</Text>
        <TouchableOpacity onPress={() => setShowForm((v) => !v)} style={s.newBtn}>
          <Text style={s.newBtnText}>{showForm ? 'Cancel' : '+ New'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.scroll}
      >
        {/* Create batch form */}
        {showForm && (
          <View style={s.form}>
            <Text style={s.formTitle}>New Shipment Batch</Text>
            <TextInput
              style={s.input} placeholder="Batch name *  e.g. July 2025 Batch"
              placeholderTextColor={Colors.textMuted}
              value={batchName} onChangeText={setBatchName}
            />
            <TextInput
              style={s.input} placeholder="Shipping company  e.g. Speedaf, DHL"
              placeholderTextColor={Colors.textMuted}
              value={company} onChangeText={setCompany}
            />
            <TextInput
              style={[s.input, { height: 64, textAlignVertical: 'top' }]}
              placeholder="Notes (optional)"
              placeholderTextColor={Colors.textMuted}
              value={notes} onChangeText={setNotes} multiline
            />
            <TouchableOpacity
              style={[s.createBtn, creating && { opacity: 0.6 }]}
              onPress={createBatch} disabled={creating}
            >
              <Text style={s.createBtnText}>{creating ? 'Creating…' : 'Create Batch'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {batches.length === 0 && !showForm ? (
          <EmptyState
            icon={<Ionicons name="boat-outline" size={40} color={Colors.textMuted} />}
            title="No shipment batches"
            subtitle="Create a batch to track your overseas freight shipments"
          />
        ) : batches.map((batch) => {
          const items: any[] = batch.shipment_items || []
          const received = items.filter((i) => i.status === 'received').length
          const missing  = items.filter((i) => i.status === 'missing').length
          const colors = STATUS_COLORS[batch.status as BatchStatus] ?? STATUS_COLORS.open

          return (
            <TouchableOpacity
              key={batch.id}
              style={s.batchCard}
              onPress={() => router.push(`/(importer)/shipments/${batch.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={s.batchHeader}>
                <View style={s.batchIcon}>
                  <Ionicons name="boat-outline" size={22} color={Colors.brand} />
                </View>
                <View style={s.batchInfo}>
                  <Text style={s.batchName}>{batch.name}</Text>
                  {batch.shipping_company && (
                    <Text style={s.batchSub}>{batch.shipping_company}</Text>
                  )}
                  <Text style={s.batchTime}>{getTimeAgo(batch.created_at)}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[s.statusText, { color: colors.text }]}>
                    {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                  </Text>
                </View>
              </View>

              {items.length > 0 && (
                <View style={s.batchStats}>
                  <View style={s.statItem}>
                    <Ionicons name="cube-outline" size={12} color={Colors.textMuted} />
                    <Text style={s.statText}>{items.length} items</Text>
                  </View>
                  <View style={s.statItem}>
                    <Ionicons name="checkmark-circle-outline" size={12} color={Colors.success} />
                    <Text style={[s.statText, { color: Colors.success }]}>{received} received</Text>
                  </View>
                  {missing > 0 && (
                    <View style={s.statItem}>
                      <Ionicons name="warning-outline" size={12} color={Colors.danger} />
                      <Text style={[s.statText, { color: Colors.danger }]}>{missing} missing</Text>
                    </View>
                  )}
                </View>
              )}

              {batch.notes && (
                <Text style={s.batchNotes} numberOfLines={1}>{batch.notes}</Text>
              )}

              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={s.chevron} />
            </TouchableOpacity>
          )
        })}
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
  newBtn: { backgroundColor: Colors.brand, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm },
  newBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: '#fff' },
  scroll: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 40 },

  form: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: Spacing.xl, gap: Spacing.md,
  },
  formTitle: { fontSize: FontSize.base, fontWeight: '800', color: Colors.textPrimary },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  createBtn: {
    backgroundColor: Colors.brand, borderRadius: Radius.md,
    paddingVertical: 12, alignItems: 'center',
  },
  createBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },

  batchCard: {
    backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.sm,
  },
  batchHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  batchIcon: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  batchInfo: { flex: 1, gap: 2 },
  batchName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  batchSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  batchTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  batchStats: { flexDirection: 'row', gap: Spacing.md },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  batchNotes: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: 'italic' },
  chevron: { position: 'absolute', right: Spacing.lg, top: Spacing.lg },
})
