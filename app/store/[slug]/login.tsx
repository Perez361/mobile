import { useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Colors, FontSize, Spacing } from '@/constants/theme'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function CustomerLoginScreen() {
  const router = useRouter()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [loading, setLoading] = useState(false)
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const { error } = await createCustomerClient(slug).auth.signInWithPassword({ email: data.email, password: data.password })
      if (error) { Alert.alert('Login failed', error.message); return }
      router.replace(`/store/${slug}`)
    } catch (e: any) {
      Alert.alert('Login failed', e?.message ?? 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <SafeAreaView edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={s.back}>
              <Text style={s.backText}>← Back to store</Text>
            </TouchableOpacity>
            <Text style={s.title}>Customer Sign In</Text>
            <Text style={s.subtitle}>Sign in to your account on this store</Text>
          </SafeAreaView>
        </View>
        <View style={s.form}>
          <Controller control={control} name="email" render={({ field: { onChange, value } }) => (
            <Input label="Email" placeholder="you@example.com" keyboardType="email-address" onChangeText={onChange} value={value} error={errors.email?.message} />
          )} />
          <Controller control={control} name="password" render={({ field: { onChange, value } }) => (
            <Input label="Password" placeholder="••••••••" secureTextEntry onChangeText={onChange} value={value} error={errors.password?.message} />
          )} />
          <Button onPress={handleSubmit(onSubmit)} loading={loading} style={{ marginTop: Spacing.xs }}>Sign In</Button>
          <View style={s.footer}>
            <Text style={s.footerText}>No account yet?</Text>
            <TouchableOpacity onPress={() => router.push(`/store/${slug}/register`)}>
              <Text style={s.link}>Create one</Text>
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
