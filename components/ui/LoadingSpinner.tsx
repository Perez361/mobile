import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { Colors, FontSize } from '@/constants/theme'

export function LoadingSpinner({ message, fullScreen = false }: { message?: string; fullScreen?: boolean }) {
  return (
    <View style={fullScreen ? s.fullScreen : s.inline}>
      <ActivityIndicator size="large" color={Colors.brand} />
      {message && <Text style={s.message}>{message}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  fullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  inline: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  message: { marginTop: 12, fontSize: FontSize.sm, color: Colors.textMuted },
})
