import { useState } from 'react'
import { View, Text, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAlert } from '@/components/ui/AlertModal'
import { Colors, FontSize, Spacing } from '@/constants/theme'

export default function StoreEntryScreen() {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const { showAlert } = useAlert()

  async function handleVisit() {
    const trimmed = slug.trim().toLowerCase()
    if (!trimmed) return
    setLoading(true)
    try {
      const { data, error } = await createCustomerClient(trimmed).from('importers').select('id, store_slug').ilike('store_slug', trimmed).single()
      if (error || !data) { showAlert({ type: 'error', title: 'Store not found', message: `No store found for "${trimmed}". Check the name and try again.` }); return }
      router.push(`/store/${data.store_slug}`)
    } catch (e: any) {
      showAlert({ type: 'error', title: 'Error', message: e?.message ?? 'Could not connect. Check your internet and try again.' })
    } finally { setLoading(false) }
  }

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.body}>
          <View style={s.heroSection}>
            <Text style={s.heroIcon}>🛍️</Text>
            <Text style={s.heroTitle}>Visit a Store</Text>
            <Text style={s.heroSub}>Enter the store name to browse products and place orders</Text>
          </View>
          <Input label="Store Name" placeholder="e.g. samsung-imports" value={slug} onChangeText={setSlug} autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={handleVisit} />
          <Button onPress={handleVisit} loading={loading}>Visit Store</Button>
          <Button variant="ghost" onPress={() => router.back()}>← Back</Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.card },
  kav: { flex: 1 },
  body: { flex: 1, paddingHorizontal: Spacing.xxl, justifyContent: 'center', gap: Spacing.xl },
  heroSection: { alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  heroIcon: { fontSize: 52 },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  heroSub: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center' },
})
