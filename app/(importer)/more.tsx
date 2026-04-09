import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { useAlert } from '@/components/ui/AlertModal'
import { Colors, FontSize, Spacing } from '@/constants/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

type MenuItem = { icon: IconName; label: string; sub: string; route: string }

const MENU: MenuItem[] = [
  { icon: 'calendar-outline',   label: 'Pre-orders', sub: 'Monthly import batches by product', route: '/(importer)/preorders' },
  { icon: 'bar-chart-outline',  label: 'Analytics',  sub: 'Revenue trends and performance',    route: '/(importer)/analytics' },
  { icon: 'boat-outline',       label: 'Shipments',  sub: 'Track overseas freight batches',    route: '/(importer)/shipments' },
  { icon: 'storefront-outline', label: 'My Store',   sub: 'Preview and share your storefront', route: '/(importer)/mystore'   },
  { icon: 'settings-outline',   label: 'Settings',   sub: 'Profile, store link, password',     route: '/(importer)/settings'  },
]

export default function MoreScreen() {
  const router = useRouter()
  const { importer, user, signOut } = useImporterSession()
  const { showAlert } = useAlert()

  async function handleSignOut() {
    showAlert({
      type: 'confirm',
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await signOut()
          router.replace('/(auth)/login')
        } catch (error) {
          console.error('Sign out error:', error)
          router.replace('/(auth)/login')
        }
      },
    })
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Profile header */}
        <View style={s.profile}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(importer?.business_name || user?.email || 'I')[0].toUpperCase()}
            </Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.bizName} numberOfLines={1}>
              {importer?.business_name || 'My Business'}
            </Text>
            <Text style={s.email} numberOfLines={1}>{user?.email}</Text>
            {importer?.store_slug && (
              <Text style={s.slug}>/{importer.store_slug}</Text>
            )}
          </View>
        </View>

        {/* Menu items */}
        <View style={s.section}>
          {MENU.map((item, i) => (
            <TouchableOpacity
              key={item.route}
              style={[s.row, i === MENU.length - 1 && s.rowLast]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={s.rowIcon}>
                <Ionicons name={item.icon} size={20} color={Colors.brand} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowLabel}>{item.label}</Text>
                <Text style={s.rowSub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={s.signOut} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={s.version}>ImportFlow PRO</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  scroll: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: 40 },

  profile: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    backgroundColor: Colors.card, borderRadius: 16, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.xl, fontWeight: '900', color: '#fff' },
  profileInfo: { flex: 1, gap: 2 },
  bizName: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  email: { fontSize: FontSize.xs, color: Colors.textMuted },
  slug: { fontSize: FontSize.xs, color: Colors.brand, fontWeight: '600', marginTop: 2 },

  section: {
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: FontSize.base, fontWeight: '600', color: Colors.textPrimary },
  rowSub: { fontSize: FontSize.xs, color: Colors.textMuted },

  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.dangerLight, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.danger,
    paddingVertical: Spacing.lg,
  },
  signOutText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.danger },

  version: { textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted, marginTop: -8 },
})
