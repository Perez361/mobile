import { View, Text, StyleSheet } from 'react-native'
import { Colors, Radius, FontSize } from '@/constants/theme'

export type OrderStatus =
  | 'pending' | 'product_paid' | 'processing' | 'arrived'
  | 'shipping_billed' | 'shipping_paid' | 'delivered' | 'cancelled'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  product_paid: 'Product Paid',
  processing: 'Processing',
  arrived: 'Arrived',
  shipping_billed: 'Shipping Billed',
  shipping_paid: 'Shipping Paid',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export function StatusBadge({ status }: { status: string }) {
  const colors = Colors.statusColors[status as keyof typeof Colors.statusColors]
    ?? { bg: '#F1F5F9', text: '#64748B' }
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ')
  return (
    <View style={[s.badge, { backgroundColor: colors.bg }]}>
      <Text style={[s.text, { color: colors.text }]}>{label}</Text>
    </View>
  )
}

type BadgeVariant = 'default' | 'brand' | 'success' | 'warning' | 'danger'
const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: '#F1F5F9', text: '#64748B' },
  brand: { bg: Colors.brandLight, text: Colors.brand },
  success: { bg: Colors.successLight, text: Colors.success },
  warning: { bg: Colors.warningLight, text: Colors.warning },
  danger: { bg: Colors.dangerLight, text: Colors.danger },
}

export function Badge({ children, variant = 'default' }: { children: string; variant?: BadgeVariant }) {
  const colors = VARIANT_COLORS[variant]
  return (
    <View style={[s.badge, { backgroundColor: colors.bg }]}>
      <Text style={[s.text, { color: colors.text }]}>{children}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  text: { fontSize: FontSize.xs, fontWeight: '600' },
})
