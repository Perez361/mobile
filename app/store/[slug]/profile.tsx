import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, RefreshControl, KeyboardAvoidingView,
  Platform, TouchableOpacity, TextInput, ActivityIndicator,
  Alert, StyleSheet,
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

// ─── Status helpers (shared with orders) ─────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', product_paid: 'Product Paid', processing: 'Processing',
  arrived: 'Arrived', shipping_billed: 'Shipping Due', shipping_paid: 'Shipping Paid',
  delivered: 'Delivered', cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF9C3', text: '#A16207' },
  product_paid: { bg: '#DBEAFE', text: '#1D4ED8' },
  processing: { bg: '#EEF2FF', text: '#4338CA' },
  arrived: { bg: '#F3E8FF', text: '#7E22CE' },
  shipping_billed: { bg: '#FFEDD5', text: '#C2410C' },
  shipping_paid: { bg: '#DCFCE7', text: '#15803D' },
  delivered: { bg: '#D1FAE5', text: '#065F46' },
  cancelled: { bg: '#FEE2E2', text: '#B91C1C' },
}

// ─── Form field ───────────────────────────────────────────────────────────────

function FormField({
  label, value, onChangeText, placeholder, keyboardType, multiline,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  keyboardType?: any
  multiline?: boolean
}) {
  return (
    <View style={f.wrap}>
      <Text style={f.label}>{label}</Text>
      <TextInput
        style={[f.input, multiline && f.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : undefined}
        autoCapitalize="none"
      />
    </View>
  )
}

const f = StyleSheet.create({
  wrap: { gap: 4 },
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44, fontSize: FontSize.sm, color: Colors.textPrimary, backgroundColor: Colors.card },
  multiline: { height: 72, paddingTop: Spacing.sm },
})

// ─── Info tile (view mode) ────────────────────────────────────────────────────

function InfoTile({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value?: string }) {
  return (
    <View style={it.tile}>
      <View style={it.iconBox}>
        <Ionicons name={icon} size={16} color={Colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={it.label}>{label}</Text>
        <Text style={it.value} numberOfLines={2}>{value || 'Not set'}</Text>
      </View>
    </View>
  )
}

const it = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md },
  iconBox: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textPrimary, marginTop: 1 },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CustomerProfileScreen() {
const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { user, customer, loading: sessionLoading, error, signOut } = useCustomerContext()

  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    full_name: '', username: '', contact: '', location: '', shipping_address: '',
  })

  const fetchData = useCallback(async () => {
    if (!slug || !customer) return
    const supabase = createCustomerClient(slug)
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, status, created_at, shipping_fee')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(5)
    setRecentOrders(orders || [])
  }, [customer, slug])

  // Sync form and fetch data when customer becomes available
  useEffect(() => {
    if (!customer) return
    setForm({
      full_name: customer.full_name || '',
      username: customer.username || '',
      contact: customer.contact || '',
      location: customer.location || '',
      shipping_address: customer.shipping_address || '',
    })
    fetchData()
  }, [customer])

  // Re-fetch recent orders on screen focus
  useFocusEffect(useCallback(() => { fetchData() }, [fetchData]))

  async function onRefresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }

  async function handleSave() {
    if (!customer) return
    setSaving(true)
    const { error } = await createCustomerClient(slug)
      .from('customers')
      .update(form)
      .eq('id', customer.id)
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    setIsEditing(false)
    Alert.alert('Saved', 'Your profile has been updated.')
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => { await signOut(); router.replace(`/store/${slug}`) },
      },
    ])
  }

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
        <View style={s.header}><Text style={s.title}>Account</Text></View>
        <View style={s.centered}>
          <View style={s.avatarBox}>
            <Ionicons name="person-outline" size={32} color={Colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>Not signed in</Text>
          <Text style={s.emptySub}>Sign in to view and manage your profile</Text>
          <View style={s.emptyActions}>
            <Button onPress={() => router.push(`/store/${slug}/login`)}>Sign In</Button>
            <Button variant="secondary" onPress={() => router.push(`/store/${slug}/register`)}>Create Account</Button>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  const initial = (customer.full_name || user.email || '?')[0].toUpperCase()
  const displayName = customer.full_name || customer.username || 'Customer'

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Profile card ── */}
          <View style={s.card}>
            {/* Avatar row */}
            <View style={s.profileRow}>
              <View style={s.avatarBox}>
                <Text style={s.avatarInitial}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.displayName}>{displayName}</Text>
                <Text style={s.email} numberOfLines={1}>{user.email}</Text>
              </View>
              {!isEditing ? (
                <TouchableOpacity style={s.editBtn} onPress={() => setIsEditing(true)}>
                  <Ionicons name="pencil-outline" size={14} color={Colors.brand} />
                  <Text style={s.editBtnText}>Edit</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.cancelBtn} onPress={() => setIsEditing(false)}>
                  <Ionicons name="close-outline" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* View mode */}
            {!isEditing ? (
              <View style={s.infoGrid}>
                <InfoTile icon="person-outline" label="Full Name" value={customer.full_name ?? undefined} />
                <InfoTile icon="at-outline" label="Username" value={customer.username ?? undefined} />
                <InfoTile icon="call-outline" label="Contact" value={customer.contact ?? undefined} />
                <InfoTile icon="location-outline" label="Location" value={customer.location ?? undefined} />
                <InfoTile icon="home-outline" label="Shipping Address" value={customer.shipping_address ?? undefined} />
              </View>
            ) : (
              /* Edit mode */
              <View style={s.formWrap}>
                <FormField label="Full Name" value={form.full_name} onChangeText={v => setForm(p => ({ ...p, full_name: v }))} placeholder="John Doe" />
                <FormField label="Username" value={form.username} onChangeText={v => setForm(p => ({ ...p, username: v }))} placeholder="johndoe" />
                <FormField label="Contact" value={form.contact} onChangeText={v => setForm(p => ({ ...p, contact: v }))} placeholder="0551234567" keyboardType="phone-pad" />
                <FormField label="Location" value={form.location} onChangeText={v => setForm(p => ({ ...p, location: v }))} placeholder="Accra, Ghana" />
                <FormField label="Shipping Address" value={form.shipping_address} onChangeText={v => setForm(p => ({ ...p, shipping_address: v }))} placeholder="123 Street, Accra" multiline />

                <TouchableOpacity
                  style={[s.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : (
                      <>
                        <Ionicons name="checkmark-outline" size={16} color="#fff" />
                        <Text style={s.saveBtnText}>Save Changes</Text>
                      </>
                    )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Recent Orders ── */}
          <View style={s.card}>
            <View style={s.sectionHeader}>
              <View style={s.sectionHeaderLeft}>
                <View style={s.sectionIconBox}>
                  <Ionicons name="receipt-outline" size={16} color={Colors.brand} />
                </View>
                <View>
                  <Text style={s.sectionTitle}>Order History</Text>
                  <Text style={s.sectionSub}>Recent orders</Text>
                </View>
              </View>
              <TouchableOpacity style={s.viewAllBtn} onPress={() => router.push(`/store/${slug}/orders`)}>
                <Text style={s.viewAllText}>View all</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.brand} />
              </TouchableOpacity>
            </View>

            {recentOrders.length === 0 ? (
              <View style={s.ordersEmpty}>
                <Ionicons name="cube-outline" size={32} color="#CBD5E1" />
                <Text style={s.ordersEmptyText}>No orders yet</Text>
                <TouchableOpacity onPress={() => router.push(`/store/${slug}`)}>
                  <Text style={s.ordersEmptyLink}>Start shopping →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.ordersList}>
                {recentOrders.map((order: any) => {
                  const status = (order.status || 'pending').toLowerCase()
                  const statusStyle = STATUS_COLORS[status] || { bg: '#F1F5F9', text: '#64748B' }
                  const total = parseNumber(order.total) + parseNumber(order.shipping_fee || 0)
                  return (
                    <View key={order.id} style={s.orderRow}>
                      <View style={s.orderIconBox}>
                        <Ionicons name="cube-outline" size={14} color={Colors.textMuted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.orderIdText}>#{order.id.slice(-8).toUpperCase()}</Text>
                        <Text style={s.orderDate}>
                          {new Date(order.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>
                      <View style={[s.orderBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[s.orderBadgeText, { color: statusStyle.text }]}>
                          {STATUS_LABELS[status] || status}
                        </Text>
                      </View>
                      <Text style={s.orderTotal}>
                        GH₵{Math.round(total).toLocaleString('en-GH')}
                      </Text>
                    </View>
                  )
                })}
                <TouchableOpacity style={s.viewAllRow} onPress={() => router.push(`/store/${slug}/orders`)}>
                  <Text style={s.viewAllRowText}>View all orders</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.brand} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Sign out ── */}
          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: {
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.md,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary },
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },

  // Not signed-in
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  emptySub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm },
  emptyActions: { width: '100%', gap: Spacing.sm },

  // Card container
  card: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.md },

  // Profile row
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatarBox: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.brand },
  displayName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  email: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.md, backgroundColor: Colors.brandLight, borderWidth: 1, borderColor: Colors.brand + '40' },
  editBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.brand },
  cancelBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },

  // View mode info grid
  infoGrid: { gap: Spacing.sm },

  // Edit form
  formWrap: { gap: Spacing.md },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: Radius.md, backgroundColor: Colors.brand, marginTop: Spacing.sm },
  saveBtnText: { fontSize: FontSize.base, fontWeight: '700', color: '#fff' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  sectionIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  sectionSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.brand },

  // Orders empty
  ordersEmpty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  ordersEmptyText: { fontSize: FontSize.sm, color: Colors.textMuted },
  ordersEmptyLink: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand },

  // Orders list
  ordersList: { gap: 0 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  orderIconBox: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  orderIdText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  orderDate: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  orderBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
  orderBadgeText: { fontSize: 10, fontWeight: '700' },
  orderTotal: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textPrimary, minWidth: 64, textAlign: 'right' },
  viewAllRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  viewAllRowText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand },

  // Sign out
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, height: 52, borderRadius: Radius.lg, backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: Colors.danger + '30' },
  signOutText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.danger },
})
