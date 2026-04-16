import { useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Colors, FontSize, Spacing } from '@/constants/theme'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})
type FormData = z.infer<typeof schema>

export default function CustomerForgotPasswordScreen() {
  const router = useRouter()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      await createCustomerClient(slug).auth.resetPasswordForEmail(data.email, {
        redirectTo: `importflowpro://store/${slug}/reset-password`,
      })
      setSent(true)
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
              <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={s.backText}>Back to login</Text>
            </TouchableOpacity>
            <Text style={s.title}>Reset Password</Text>
            <Text style={s.subtitle}>We'll send a reset link to your email</Text>
          </SafeAreaView>
        </View>

        <View style={s.form}>
          {sent ? (
            <View style={s.successBox}>
              <View style={s.successIcon}>
                <Ionicons name="mail-outline" size={32} color={Colors.success} />
              </View>
              <Text style={s.successTitle}>Check your email</Text>
              <Text style={s.successSub}>
                If an account exists for that email, you'll receive a password reset link shortly. Check your spam folder if you don't see it.
              </Text>
              <Button onPress={() => router.replace(`/store/${slug}/login`)} style={{ marginTop: Spacing.md }}>Back to Sign In</Button>
            </View>
          ) : (
            <>
              <Controller control={control} name="email" render={({ field: { onChange, value } }) => (
                <Input label="Email" placeholder="you@example.com" keyboardType="email-address" onChangeText={onChange} value={value} error={errors.email?.message} />
              )} />
              <Button onPress={handleSubmit(onSubmit)} loading={loading}>Send Reset Link</Button>
              <View style={s.footer}>
                <Text style={s.footerText}>Remember your password?</Text>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={s.link}>Sign in</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.card },
  header: { backgroundColor: Colors.brand, paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.xxxl },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.xxl, marginTop: Spacing.md },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm },
  title: { fontSize: FontSize.xxl, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: Spacing.xs },
  form: { flex: 1, padding: Spacing.xxl, gap: Spacing.xl },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingTop: Spacing.xxxl },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.successLight, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  successSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.xs },
  footerText: { fontSize: FontSize.sm, color: Colors.textMuted },
  link: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand },
})
