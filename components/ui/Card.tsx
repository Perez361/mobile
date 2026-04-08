import { View, ViewProps, StyleSheet } from 'react-native'
import { Colors, Radius, Shadow } from '@/constants/theme'

interface CardProps extends ViewProps {
  children: React.ReactNode
}

export function Card({ children, style, ...props }: CardProps) {
  return (
    <View style={[s.card, style]} {...props}>
      {children}
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    ...Shadow.sm,
  },
})
