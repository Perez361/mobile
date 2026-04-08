import { useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useCustomerSession } from '@/lib/hooks/useCustomerSession'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

const schema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  contact: z.string().min(10, 'Enter a valid phone number'),
  location: z.string().optional(),
  shipping_address: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function CustomerProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { user, customer, loading, signOut } = useCustomerSession(slug)
  const [saving, setSaving] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: { full_name: customer?.full_name || '', contact: customer?.contact || '', location: customer?.location || '', shipping_address: customer?.shipping_address || '' },
  })

  async function onSubmit(data: FormData) {
    if (!customer) return
    setSaving(true)
    try {
      const { error } = await createCustomerClient(slug).from('customers').update(data).eq('id', customer.id)
      if (error) { Alert.alert('Error', error.message); return }
      Alert.alert('Saved', 'Your profile has been updated.')
    } finally { setSaving(false) }
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace(`/store/${slug}`) } },
    ])
  }

  if (loading) return <LoadingSpinner fullScreen />

  if (!user || !customer) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}><Text style={s.title}>Profile</Text></View>
        <View style={s.notSignedIn}>
          <Text style={s.bigIcon}>👤</Text>
          <Text style={s.notSignedInTitle}>Not signed in</Text>
          <Text style={s.notSignedInSub}>Sign in to view and edit your profile</Text>
          <Button onPress={() => router.push(`/store/${slug}/login`)} style={s.fullWidth}>Sign In</Button>
          <Button variant="secondary" onPress={() => router.push(`/store/${slug}/register`)} style={s.fullWidth}>Create Account</Button>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={[s.header, s.headerRow]}>
        <Text style={s.title}>Profile</Text>
        <TouchableOpacity onPress={handleSignOut}><Text style={s.signOut}>Sign out</Text></TouchableOpacity>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Card style={s.card}>
            <View style={s.avatarBox}>
              <Text style={s.avatarText}>{(customer.full_name || user.email || '?')[0].toUpperCase()}</Text>
            </View>
            <Text style={s.customerName}>{customer.full_name || 'Customer'}</Text>
            <Text style={s.email}>{user.email}</Text>
          </Card>
          <Card style={s.card}>
            <Text style={s.sectionTitle}>Edit Profile</Text>
            <Controller control={control} name="full_name" render={({ field: { onChange, value } }) => (
              <Input label="Full Name" onChangeText={onChange} value={value} error={errors.full_name?.message} />
            )} />
            <Controller control={control} name="contact" render={({ field: { onChange, value } }) => (
              <Input label="Phone Number" keyboardType="phone-pad" onChangeText={onChange} value={value} error={errors.contact?.message} />
            )} />
            <Controller control={control} name="location" render={({ field: { onChange, value } }) => (
              <Input label="Location" placeholder="e.g. Accra, Ghana" onChangeText={onChange} value={value} />
            )} />
            <Controller control={control} name="shipping_address" render={({ field: { onChange, value } }) => (
              <Input label="Shipping Address" placeholder="Where should we deliver?" onChangeText={onChange} value={value} multiline numberOfLines={2} style={{ height: 60, textAlignVertical: 'top' }} />
            )} />
            <Button onPress={handleSubmit(onSubmit)} loading={saving}>Save Changes</Button>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.md, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary },
  signOut: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.danger },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.md },
  avatarBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.brand },
  customerName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  email: { fontSize: FontSize.sm, color: Colors.textMuted },
  sectionTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  notSignedIn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.md },
  bigIcon: { fontSize: 52 },
  notSignedInTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  notSignedInSub: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center' },
  fullWidth: { width: '100%' } as any,
})
