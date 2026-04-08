export const Colors = {
  brand: '#2563EB',
  brandDark: '#1D4ED8',
  brandLight: '#EFF6FF',

  surface: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',

  textPrimary: '#0F172A',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',

  statusColors: {
    pending: { bg: '#DBEAFE', text: '#1D4ED8' },
    processing: { bg: '#EFF6FF', text: '#2563EB' },
    arrived: { bg: '#FEF9C3', text: '#A16207' },
    shipping_billed: { bg: '#FFFBEB', text: '#D97706' },
    shipping_paid: { bg: '#ECFDF5', text: '#059669' },
    delivered: { bg: '#ECFDF5', text: '#10B981' },
    cancelled: { bg: '#FEF2F2', text: '#EF4444' },
    product_paid: { bg: '#F0FDF4', text: '#16A34A' },
  },
} as const

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
} as const

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
} as const

export const Shadow = {
  sm: {
    boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.06)',
  },
  md: {
    boxShadow: '0px 2px 6px rgba(15, 23, 42, 0.08)',
  },
} as const
