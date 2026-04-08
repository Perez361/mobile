import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native'
import { Colors, Radius, FontSize, Spacing } from '@/constants/theme'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps {
  onPress?: () => void
  children: string
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}

export function Button({ onPress, children, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <TouchableOpacity
      style={[s.base, s[variant], isDisabled && s.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? '#fff' : Colors.brand} size="small" />
        : <Text style={[s.text, s[`text_${variant}`]]}>{children}</Text>
      }
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  base: { height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  primary: { backgroundColor: Colors.brand },
  secondary: { backgroundColor: Colors.brandLight, borderWidth: 1, borderColor: Colors.brand },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  danger: { backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: Colors.danger },
  disabled: { opacity: 0.5 },
  text: { fontSize: FontSize.base, fontWeight: '600' },
  text_primary: { color: '#fff' },
  text_secondary: { color: Colors.brand },
  text_ghost: { color: Colors.textMuted },
  text_danger: { color: Colors.danger },
} as any)
