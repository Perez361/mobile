export const Colors = {
  brand: '#2563EB',
  brandDark: '#1D4ED8',
  brandLight: '#EFF6FF',
  surface: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textMuted: '#64748B',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  white: '#FFFFFF',
  black: '#000000',
} as const

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: Colors.warningLight, text: Colors.warning },
  product_paid: { bg: Colors.brandLight, text: Colors.brand },
  processing: { bg: '#F0FDF4', text: '#15803D' },
  arrived: { bg: '#FEF3C7', text: '#B45309' },
  shipping_billed: { bg: '#FDF4FF', text: '#9333EA' },
  shipping_paid: { bg: Colors.successLight, text: Colors.success },
  delivered: { bg: Colors.successLight, text: Colors.success },
  cancelled: { bg: Colors.dangerLight, text: Colors.danger },
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  product_paid: 'Product Paid',
  processing: 'Processing',
  arrived: 'Arrived',
  shipping_billed: 'Shipping Billed',
  shipping_paid: 'Shipping Paid',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
