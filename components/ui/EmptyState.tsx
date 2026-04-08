import { View, Text, StyleSheet } from 'react-native'
import { Colors, FontSize, Spacing } from '@/constants/theme'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={s.container}>
      {icon && <View style={s.icon}>{icon}</View>}
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      {action && <View style={s.action}>{action}</View>}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: Spacing.xxl },
  icon: { marginBottom: Spacing.sm },
  title: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xs },
  action: { marginTop: Spacing.md },
})
