import { useCallback, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TextInput, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { getTimeAgo } from '@/lib/utils'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

export default function CustomersScreen() {
  const { user } = useImporterSession()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  const fetch = useCallback(async () => {
    if (!user) return
    const { data } = await createImporterClient().from('customers').select('*').eq('store_id', user.id).order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }, [user])

  useFocusEffect(useCallback(() => { fetch() }, [fetch]))
  async function onRefresh() { setRefreshing(true); await fetch(); setRefreshing(false) }

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return !q || c.full_name?.toLowerCase().includes(q) || c.username?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.contact?.includes(q)
  })

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Customers</Text>
        <Text style={s.sub}>{customers.length} registered</Text>
      </View>
      <View style={s.searchBar}>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search by name, email or phone..." placeholderTextColor={Colors.textMuted} style={s.searchInput} />
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={s.list}>
        {filtered.length === 0
          ? <EmptyState
              icon={<Ionicons name="people-outline" size={40} color={Colors.textMuted} />}
              title={search ? 'No results' : 'No customers yet'}
              subtitle={search ? 'Try a different search' : 'Customers who register on your store will appear here'}
            />
          : filtered.map((c) => (
            <Card key={c.id} style={s.card}>
              <View style={s.row}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{(c.full_name || c.username || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={s.info}>
                  <Text style={s.name}>{c.full_name || c.username || 'Unknown'}</Text>
                  {c.username && c.full_name && <Text style={s.username}>@{c.username}</Text>}
                </View>
                <Text style={s.time}>{getTimeAgo(c.created_at)}</Text>
              </View>
              <View style={s.details}>
                {c.email && (
                  <View style={s.detail}>
                    <Ionicons name="mail-outline" size={12} color={Colors.textMuted} />
                    <Text style={s.detailText}>{c.email}</Text>
                  </View>
                )}
                {c.contact && (
                  <View style={s.detail}>
                    <Ionicons name="call-outline" size={12} color={Colors.textMuted} />
                    <Text style={s.detailText}>{c.contact}</Text>
                  </View>
                )}
                {c.location && (
                  <View style={s.detail}>
                    <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                    <Text style={s.detailText}>{c.location}</Text>
                  </View>
                )}
                {c.shipping_address && (
                  <View style={s.detail}>
                    <Ionicons name="home-outline" size={12} color={Colors.textMuted} />
                    <Text style={s.detailText}>{c.shipping_address}</Text>
                  </View>
                )}
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
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.md, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  searchBar: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, fontSize: FontSize.sm, color: Colors.textPrimary },
  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  card: { padding: Spacing.lg, gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.brand },
  info: { flex: 1 },
  name: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  username: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  time: { fontSize: FontSize.xs, color: Colors.textMuted },
  details: { gap: 4, paddingLeft: 56 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: FontSize.xs, color: Colors.textMuted },
})
