import { useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { slugify } from '@/lib/utils'
import { Colors, FontSize, Spacing } from '@/constants/theme'

const schema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function RegisterScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const { error } = await createImporterClient().auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            business_name: data.businessName,
            full_name: data.fullName,
            username: slugify(data.businessName),
            phone: data.phone,
            store_slug: slugify(data.businessName),
          },
        },
      })
      if (error) { Alert.alert('Registration failed', error.message); return }
      Alert.alert('Account created', 'Check your email to confirm your account, then sign in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ])
    } catch (e: any) {
      Alert.alert('Registration failed', e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <SafeAreaView edges={['top']}>
            <TouchableOpacity onPress={() => router.back()} style={s.back}>
              <Text style={s.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.title}>Create account</Text>
            <Text style={s.subtitle}>Start managing your importation business</Text>
          </SafeAreaView>
        </View>

        <View style={s.form}>
          <Controller control={control} name="businessName" render={({ field: { onChange, value } }) => (
            <Input label="Business Name" placeholder="e.g. Samsung Imports GH" onChangeText={onChange} value={value} error={errors.businessName?.message} />
          )} />
          <Controller control={control} name="fullName" render={({ field: { onChange, value } }) => (
            <Input label="Full Name" placeholder="Your full name" onChangeText={onChange} value={value} error={errors.fullName?.message} />
          )} />
          <Controller control={control} name="email" render={({ field: { onChange, value } }) => (
            <Input label="Email" placeholder="you@example.com" keyboardType="email-address" onChangeText={onChange} value={value} error={errors.email?.message} />
          )} />
          <Controller control={control} name="phone" render={({ field: { onChange, value } }) => (
            <Input label="Phone Number" placeholder="e.g. 0551234567" keyboardType="phone-pad" onChangeText={onChange} value={value} error={errors.phone?.message} />
          )} />
          <Controller control={control} name="password" render={({ field: { onChange, value } }) => (
            <Input label="Password" placeholder="••••••••" secureTextEntry onChangeText={onChange} value={value} error={errors.password?.message} />
          )} />

          <Button onPress={handleSubmit(onSubmit)} loading={loading} style={{ marginTop: Spacing.xs }}>Create Account</Button>

          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
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
  title: { fontSize: FontSize.xxxl, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: Spacing.xs },
  form: { flex: 1, padding: Spacing.xxl, gap: Spacing.xl },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  footerText: { fontSize: FontSize.sm, color: Colors.textMuted },
  link: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand },
})
