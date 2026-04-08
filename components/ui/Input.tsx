import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native'
import { Colors, Radius, FontSize, Spacing } from '@/constants/theme'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <View style={s.wrapper}>
      {label && <Text style={s.label}>{label}</Text>}
      <TextInput
        style={[s.input, error ? s.inputError : s.inputNormal]}
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        {...props}
      />
      {error && <Text style={s.error}>{error}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textPrimary },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.card,
  },
  inputNormal: { borderColor: Colors.border },
  inputError: { borderColor: Colors.danger },
  error: { fontSize: FontSize.xs, color: Colors.danger },
})
