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
  const { user, importer } = useImporterSession()
  const [batches, setBatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [batchName, setBatchName] = useState('')
  const [company, setCompany] = useState('')
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchBatches = useCallback(async () => {
    if (!importer) return
    const { data } = await createImporterClient()
      .from('shipment_batches')
      .select('*, shipment_items (id, status)')
      .eq('importer_id', importer.id)
      .order('created_at', { ascending: false })
    setBatches(data || [])
    setLoading(false)
  }, [importer])

  useFocusEffect(useCallback(() => { fetchBatches() }, [fetchBatches]))
  async function onRefresh() { setRefreshing(true); await fetchBatches(); setRefreshing(false) }

  // TODO: Add real-time updates later

  async function createBatch() {
    if (!batchName.trim()) { Alert.alert('Name required', 'Enter a batch name.'); return }
    if (!importer) return
    setCreating(true)
    try {
      const { error } = await createImporterClient()
        .from('shipment_batches')
        .insert({ importer_id: importer.id, name: batchName.trim(), shipping_company: company.trim() || null, notes: notes.trim() || null })
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
              value={notes} onChangeText={setNotes}
              multiline
            />
            <TouchableOpacity
              style={[s.createBtn, creating && { opacity: 0.6 }]}
              onPress={createBatch} disabled={creating}
            >
              <Text style={s.createBtnText}>{creating ? 'Creating…' : 'Create Batch'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Batch list */}
        {batches.length === 0 && !showForm ? (
          <EmptyState
            icon="boat-outline"
            title="No shipment batches yet"
            subtitle="Create a batch for each delivery from your freight company"
          />
        ) : (
          <View style={s.batchList}>
            {batches.map((batch: any) => {
              const items = batch.shipment_items || []
              const total = items.length
              const received = items.filter((i: any) => i.status === 'received').length
              const missing = items.filter((i: any) => i.status === 'missing').length
              const cfg = STATUS_COLORS[batch.status] || STATUS_COLORS['open']

              return (
                <TouchableOpacity
                  key={batch.id}
                  style={s.batchCard}
                  onPress={() => router.push(`/(importer)/shipments/${batch.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={s.batchHeader}>
                    <Text style={s.batchName}>{batch.name}</Text>
                    <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.statusText, { color: cfg.text }]}>
                        {batch.status === 'open' ? 'Open' : batch.status === 'received' ? 'Received' : 'Reconciled'}
                      </Text>
                    </View>
                  </View>

                  <View style={s.batchMeta}>
                    <Text style={s.batchDate}>{getTimeAgo(batch.created_at)}</Text>
                    {batch.shipping_company && (
                      <Text style={s.batchCompany}>{batch.shipping_company}</Text>
                    )}
                  </View>

                  <View style={s.batchStats}>
                    <View style={s.stat}>
                      <Text style={s.statValue}>{total}</Text>
                      <Text style={s.statLabel}>Items</Text>
                    </View>
                    <View style={s.stat}>
                      <Text style={[s.statValue, { color: Colors.success }]}>{received}</Text>
                      <Text style={s.statLabel}>Received</Text>
                    </View>
                    {missing > 0 && (
                      <View style={s.stat}>
                        <Text style={[s.statValue, { color: Colors.danger }]}>{missing}</Text>
                        <Text style={s.statLabel}>Missing</Text>
                      </View>
                    )}
                  </View>

                  {batch.notes && (
                    <Text style={s.batchNotes} numberOfLines={2}>{batch.notes}</Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.card },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: FontSize.sm, color: Colors.brand, marginLeft: Spacing.xs },
  navTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  newBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.brand, borderRadius: Radius.sm },
  newBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: '#fff' },

  scroll: { padding: Spacing.xl, gap: Spacing.xl },

  form: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.xl, gap: Spacing.md,
  },
  formTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    fontSize: FontSize.base, color: Colors.textPrimary,
  },
  createBtn: {
    backgroundColor: Colors.brand, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: 'center',
  },
  createBtnText: { fontSize: FontSize.base, fontWeight: '700', color: '#fff' },

  batchList: { gap: Spacing.lg },
  batchCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.xl, gap: Spacing.sm,
  },
  batchHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  batchName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  statusBadge: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: '600' },

  batchMeta: { flexDirection: 'row', gap: Spacing.md },
  batchDate: { fontSize: FontSize.sm, color: Colors.textMuted },
  batchCompany: { fontSize: FontSize.sm, color: Colors.brand, fontWeight: '600' },

  batchStats: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.sm },
  stat: { alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase' },

  batchNotes: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs },
})