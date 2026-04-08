import { useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { Colors, FontSize, Spacing, Radius, Shadow } from '@/constants/theme'
import { Image } from 'react-native'

export default function WelcomeScreen() {
  const router = useRouter()
  const { user, loading } = useImporterSession()

  useEffect(() => {
    if (!loading && user) router.replace('/(importer)')
  }, [user, loading])

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <View style={s.root}>
      {/* Blue header */}
<View style={s.header}>
  <SafeAreaView edges={['top']}>
    <View style={s.headerContent}>
      {/* Logo */}
      <Image
        source={require('../assets/images/icon.png')}
        style={s.logoImage}
        resizeMode="contain"
      />

      {/* App name + tagline */}
      <View style={s.headerText}>
        <Text style={s.appName}>ImportFlow PRO</Text>
        <Text style={s.tagline}>Manage your importation business on the go</Text>
      </View>
    </View>
  </SafeAreaView>
</View>

      {/* Role cards */}
      <View style={s.body}>
        <Text style={s.question}>How are you using the app?</Text>

        {/* Importer card */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <View style={[s.iconBox, { backgroundColor: Colors.brandLight }]}>
              <Text style={s.iconText}>🏪</Text>
            </View>
            <View style={s.cardInfo}>
              <Text style={s.cardTitle}>Business Owner</Text>
              <Text style={s.cardSub}>Manage products, orders & customers</Text>
            </View>
          </View>
          <View style={s.gap}>
            <Button onPress={() => router.push('/(auth)/login')}>Sign in as Importer</Button>
            <Button variant="ghost" onPress={() => router.push('/(auth)/register')}>Create an account</Button>
          </View>
        </View>

        {/* Customer card */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <View style={[s.iconBox, { backgroundColor: Colors.successLight }]}>
              <Text style={s.iconText}>🛍️</Text>
            </View>
            <View style={s.cardInfo}>
              <Text style={s.cardTitle}>Customer</Text>
              <Text style={s.cardSub}>Browse stores and place orders</Text>
            </View>
          </View>
          <Button variant="secondary" onPress={() => router.push('/store')}>Visit a Store</Button>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  header: { backgroundColor: Colors.brand, paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.xxxl },
  logoBox: {
    width: 60, height: 60, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md, marginTop: Spacing.lg,
  },
 logoImage: { width: 50, height: 50, borderRadius: Radius.lg },
 headerContent: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: Spacing.md,       // space between logo and text
  marginTop: Spacing.lg,
  marginBottom: Spacing.md,
},


headerText: {
  flex: 0,               // takes remaining space
  marginRight: Spacing.sm, // optional padding from screen edge
},

appName: {
  fontSize: FontSize.xxl,
  fontWeight: '900',
  color: '#fff',
  marginBottom: Spacing.xs,
},

tagline: {
  fontSize: FontSize.sm,
  color: 'rgba(255,255,255,0.85)',
  flexShrink: 0,         // prevents truncation
},
  body: { flex: 1, padding: Spacing.xxl, gap: Spacing.md },
  question: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.xs },
  card: {
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card, padding: Spacing.xl, gap: Spacing.md,
    ...Shadow.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconBox: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  gap: { gap: Spacing.sm },
})
