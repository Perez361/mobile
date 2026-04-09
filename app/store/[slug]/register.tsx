import { useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAlert } from '@/components/ui/AlertModal'
import { Colors, FontSize, Spacing } from '@/constants/theme'

const schema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  location: z.string().optional(),
  shippingAddress: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function CustomerRegisterScreen() {
  const router = useRouter()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [loading, setLoading] = useState(false)
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })
  const { showAlert } = useAlert()

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const supabase = createCustomerClient(slug)
      const { data: imp } = await supabase.from('importers').select('id').ilike('store_slug', slug).single()
      if (!imp) { showAlert({ type: 'error', title: 'Error', message: 'Store not found.' }); return }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email, password: data.password,
        options: {
          data: {
            customer: true,
            store_slug: slug,
            full_name: data.fullName,
            contact: data.phone,
            location: data.location || '',
            shipping_address: data.shippingAddress || '',
          },
        },
      })
      if (signUpError) { showAlert({ type: 'error', title: 'Registration failed', message: signUpError.message }); return }

      // If email confirmation is off, session is active — insert customer row directly
      if (authData.session && authData.user) {
        const { error: upsertError } = await supabase.from('customers').upsert({
          user_id: authData.user.id, store_id: imp.id, full_name: data.fullName,
          email: data.email, contact: data.phone,
          location: data.location || null, shipping_address: data.shippingAddress || null,
        })
        if (upsertError) { showAlert({ type: 'error', title: 'Registration failed', message: upsertError.message }); return }
      }

      showAlert({
        type: 'success',
        title: 'Account created',
        message: 'Welcome! You can now start shopping.',
        confirmText: 'Shop Now',
        onConfirm: () => router.replace(`/store/${slug}`),
      })
    } catch (e: any) {
      showAlert({ type: 'error', title: 'Registration failed', message: e?.message ?? 'Something went wrong. Please try again.' })
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <SafeAreaView edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={s.back}>
              <Text style={s.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.title}>Create Account</Text>
            <Text style={s.subtitle}>Register to shop on this store</Text>
          </SafeAreaView>
        </View>
        <View style={s.form}>
          <Controller control={control} name="fullName" render={({ field: { onChange, value } }) => (
            <Input label="Full Name *" placeholder="Your full name" onChangeText={onChange} value={value} error={errors.fullName?.message} />
          )} />
          <Controller control={control} name="email" render={({ field: { onChange, value } }) => (
            <Input label="Email *" placeholder="you@example.com" keyboardType="email-address" onChangeText={onChange} value={value} error={errors.email?.message} />
          )} />
          <Controller control={control} name="phone" render={({ field: { onChange, value } }) => (
            <Input label="Phone Number *" placeholder="e.g. 0551234567" keyboardType="phone-pad" onChangeText={onChange} value={value} error={errors.phone?.message} />
          )} />
          <Controller control={control} name="location" render={({ field: { onChange, value } }) => (
            <Input label="Location" placeholder="e.g. Accra, Ghana" onChangeText={onChange} value={value} />
          )} />
          <Controller control={control} name="shippingAddress" render={({ field: { onChange, value } }) => (
            <Input label="Shipping Address" placeholder="Where should we deliver?" onChangeText={onChange} value={value} multiline numberOfLines={2} style={{ height: 60, textAlignVertical: 'top' }} />
          )} />
          <Controller control={control} name="password" render={({ field: { onChange, value } }) => (
            <Input label="Password *" placeholder="••••••••" secureTextEntry onChangeText={onChange} value={value} error={errors.password?.message} />
          )} />
          <Button onPress={handleSubmit(onSubmit)} loading={loading} style={{ marginTop: Spacing.xs }}>Create Account</Button>
          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push(`/store/${slug}/login`)}>
              <Text style={s.link}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.card },
  header: { backgroundColor: Colors.brand, paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.xxxl },
  back: { marginBottom: Spacing.xxl, marginTop: Spacing.md },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm },
  title: { fontSize: FontSize.xxl, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: Spacing.xs },
  form: { flex: 1, padding: Spacing.xxl, gap: Spacing.xl },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  footerText: { fontSize: FontSize.sm, color: Colors.textMuted },
  link: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand },
})
