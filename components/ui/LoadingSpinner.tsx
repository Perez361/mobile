import { View, ActivityIndicator, Text, Image, StyleSheet } from 'react-native'
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme'

export function LoadingSpinner({ message, fullScreen = false }: { message?: string; fullScreen?: boolean }) {
  if (fullScreen) {
    return (
      <View style={s.fullScreen}>
        <Image source={require('@/assets/images/icon.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.appName}>ImportFlow PRO</Text>
        <ActivityIndicator size="large" color={Colors.brand} style={s.spinner} />
        {message && <Text style={s.message}>{message}</Text>}
      </View>
    )
  }
  return (
    <View style={s.inline}>
      <ActivityIndicator size="large" color={Colors.brand} />
      {message && <Text style={s.message}>{message}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  fullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, gap: Spacing.xs },
  logo: { width: 72, height: 72, borderRadius: Radius.lg, marginBottom: Spacing.sm },
  appName: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.3 },
  spinner: { marginTop: Spacing.lg },
  inline: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  message: { marginTop: 12, fontSize: FontSize.sm, color: Colors.textMuted },
})
