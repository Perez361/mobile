import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform,
  TouchableOpacity, Alert, StyleSheet, TextInput, Clipboard,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

// ─── tiny components ─────────────────────────────────────────────────────────

function SectionHeader({ icon, title, sub }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string }) {
  return (
    <View style={sh.sectionHead}>
      <View style={sh.sectionIcon}>
        <Ionicons name={icon} size={16} color={Colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={sh.sectionTitle}>{title}</Text>
        <Text style={sh.sectionSub}>{sub}</Text>
      </View>
    </View>
  )
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <>
      <Text style={sh.label}>{label}</Text>
      {hint && <Text style={sh.hint}>{hint}</Text>}
    </>
  )
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={sh.readRow}>
      <Text style={sh.readLabel}>{label}</Text>
      <Text style={sh.readValue}>{value || <Text style={{ color: Colors.textMuted, fontStyle: 'italic' }}>Not set</Text>}</Text>
    </View>
  )
}

function ResultBanner({ error, success }: { error?: string; success?: string }) {
  if (error) return (
    <View style={[sh.banner, { backgroundColor: Colors.dangerLight, borderColor: Colors.danger }]}>
      <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
      <Text style={[sh.bannerText, { color: Colors.danger }]}>{error}</Text>
    </View>
  )
  if (success) return (
    <View style={[sh.banner, { backgroundColor: Colors.successLight, borderColor: Colors.success }]}>
      <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
      <Text style={[sh.bannerText, { color: Colors.success }]}>{success}</Text>
    </View>
  )
  return null
}

function PasswordInput({
  label, hint, value, onChangeText, placeholder,
}: {
  label: string; hint?: string; value: string; onChangeText: (v: string) => void; placeholder?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <View style={sh.fieldGap}>
      <FieldLabel label={label} hint={hint} />
      <View style={sh.pwRow}>
        <TextInput
          style={[sh.input, { flex: 1, borderRightWidth: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? '••••••••'}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={sh.eyeBtn} onPress={() => setVisible((v) => !v)}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter()
  const { user, importer } = useImporterSession()

  // ── Profile state ──────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [profileData, setProfileData] = useState({
    business_name: importer?.business_name || '',
    full_name:     importer?.full_name     || '',
    phone:         importer?.phone         || '',
    location:      importer?.location      || '',
    store_slug:    importer?.store_slug    || '',
  })
  const [profileForm, setProfileForm] = useState({ ...profileData })

  // Sync when importer loads from session (it may be null on first render)
  useEffect(() => {
    if (!importer) return
    const data = {
      business_name: importer.business_name || '',
      full_name:     importer.full_name     || '',
      phone:         importer.phone         || '',
      location:      importer.location      || '',
      store_slug:    importer.store_slug    || '',
    }
    setProfileData(data)
    setProfileForm(data)
  }, [importer])
  const [profileResult, setProfileResult] = useState<{ error?: string; success?: string }>({})
  const [savingProfile, setSavingProfile] = useState(false)

  // ── Password state ─────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwResult, setPwResult] = useState<{ error?: string; success?: string }>({})
  const [savingPw, setSavingPw] = useState(false)

  // ── Copy ───────────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false)

  const storeUrl = profileData.store_slug ? `/store/${profileData.store_slug}` : null

  const memberSince = importer?.created_at
    ? new Date(importer.created_at).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  function copyLink() {
    if (!storeUrl) return
    Clipboard.setString(`https://import-roan.vercel.app${storeUrl}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Save profile ───────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!user) return
    if (!profileForm.business_name.trim()) { setProfileResult({ error: 'Business name is required' }); return }
    if (!profileForm.store_slug.trim()) { setProfileResult({ error: 'Store URL is required' }); return }

    setSavingProfile(true)
    setProfileResult({})
    try {
      const { error } = await createImporterClient()
        .from('importers')
        .update({
          business_name: profileForm.business_name.trim(),
          full_name:     profileForm.full_name.trim() || null,
          phone:         profileForm.phone.trim()     || null,
          location:      profileForm.location.trim()  || null,
          store_slug:    profileForm.store_slug.trim(),
        })
        .eq('id', user.id)

      if (error) {
        setProfileResult({ error: error.message })
        return
      }

      setProfileData({ ...profileForm })
      setEditing(false)
      setProfileResult({})
    } catch (e: any) {
      setProfileResult({ error: e?.message ?? 'Something went wrong.' })
    } finally {
      setSavingProfile(false)
    }
  }

  function cancelEdit() {
    setProfileForm({ ...profileData })
    setEditing(false)
    setProfileResult({})
  }

  // ── Change password ────────────────────────────────────────────────────────
  async function changePassword() {
    if (!currentPw) { setPwResult({ error: 'Current password is required' }); return }
    if (!newPw || newPw.length < 8) { setPwResult({ error: 'New password must be at least 8 characters' }); return }
    if (newPw !== confirmPw) { setPwResult({ error: 'New passwords do not match' }); return }
    if (currentPw === newPw) { setPwResult({ error: 'New password must be different from current password' }); return }

    setSavingPw(true)
    setPwResult({})
    try {
      const supabase = createImporterClient()

      // Verify current password by re-authenticating
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPw,
      })
      if (verifyErr) { setPwResult({ error: 'Current password is incorrect' }); return }

      // Set new password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw })
      if (updateErr) { setPwResult({ error: updateErr.message }); return }

      setPwResult({ success: 'Password changed successfully' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (e: any) {
      setPwResult({ error: e?.message ?? 'Something went wrong.' })
    } finally {
      setSavingPw(false)
    }
  }

  const avatarLetter = (profileData.business_name || profileData.full_name || user?.email || 'I')[0].toUpperCase()

  return (
    <SafeAreaView style={s.root}>
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.brand} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.navTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Account Overview ──────────────────────────────────────── */}
          <View style={s.overviewCard}>
            <View style={s.overviewTop}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{avatarLetter}</Text>
              </View>
              <View style={s.overviewInfo}>
                <Text style={s.bizName} numberOfLines={1}>{profileData.business_name || 'My Business'}</Text>
                <Text style={s.overviewEmail} numberOfLines={1}>{user?.email}</Text>
                {!!memberSince && <Text style={s.memberSince}>Member since {memberSince}</Text>}
              </View>
            </View>
            {storeUrl && (
              <View style={s.storeUrlRow}>
                <Ionicons name="storefront-outline" size={13} color={Colors.textMuted} />
                <Text style={s.storeUrlText} numberOfLines={1}>
                  /store/<Text style={s.storeSlug}>{profileData.store_slug}</Text>
                </Text>
                <TouchableOpacity onPress={copyLink} style={s.copyBtn}>
                  {copied
                    ? <><Ionicons name="checkmark" size={13} color={Colors.success} /><Text style={[s.copyText, { color: Colors.success }]}>Copied</Text></>
                    : <><Ionicons name="copy-outline" size={13} color={Colors.textMuted} /><Text style={s.copyText}>Copy</Text></>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Business Profile ──────────────────────────────────────── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <SectionHeader
                icon="person-outline"
                title="Business Profile"
                sub="Your storefront name, contact details, and store URL"
              />
            </View>
            <View style={s.sectionBody}>
              {!editing ? (
                /* Read-only view */
                <>
                  <View style={s.readGrid}>
                    <ReadRow label="Business Name" value={profileData.business_name} />
                    <ReadRow label="Full Name"     value={profileData.full_name}     />
                    <ReadRow label="Phone"         value={profileData.phone}         />
                    <ReadRow label="Location"      value={profileData.location}      />
                    <ReadRow label="Store URL"     value={`/store/${profileData.store_slug}`} />
                    <ReadRow label="Email"         value={user?.email ?? ''}         />
                  </View>
                  <TouchableOpacity style={s.editBtn} onPress={() => { setEditing(true); setProfileResult({}) }}>
                    <Ionicons name="create-outline" size={15} color={Colors.textPrimary} />
                    <Text style={s.editBtnText}>Edit Profile</Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* Edit form */
                <>
                  <View style={sh.fieldGap}>
                    <FieldLabel label="Business Name *" hint="Shown as your store's display name" />
                    <TextInput
                      style={sh.input}
                      value={profileForm.business_name}
                      onChangeText={(v) => setProfileForm((p) => ({ ...p, business_name: v }))}
                      placeholder="Alby Imports"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <View style={sh.fieldGap}>
                    <FieldLabel label="Full Name" />
                    <TextInput
                      style={sh.input}
                      value={profileForm.full_name}
                      onChangeText={(v) => setProfileForm((p) => ({ ...p, full_name: v }))}
                      placeholder="John Doe"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <View style={sh.fieldGap}>
                    <FieldLabel label="Phone Number" hint="May appear on order communications" />
                    <TextInput
                      style={sh.input}
                      value={profileForm.phone}
                      onChangeText={(v) => setProfileForm((p) => ({ ...p, phone: v }))}
                      placeholder="+233 24 000 0000"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View style={sh.fieldGap}>
                    <FieldLabel label="Location" />
                    <TextInput
                      style={sh.input}
                      value={profileForm.location}
                      onChangeText={(v) => setProfileForm((p) => ({ ...p, location: v }))}
                      placeholder="Accra, Ghana"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <View style={sh.fieldGap}>
                    <FieldLabel
                      label="Store URL *"
                      hint="Lowercase letters, numbers and hyphens only. Changing this breaks existing shared links."
                    />
                    <View style={sh.slugRow}>
                      <View style={sh.slugPrefix}>
                        <Text style={sh.slugPrefixText}>/store/</Text>
                      </View>
                      <TextInput
                        style={[sh.input, { flex: 1, borderLeftWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                        value={profileForm.store_slug}
                        onChangeText={(v) => setProfileForm((p) => ({ ...p, store_slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                        placeholder="my-store"
                        placeholderTextColor={Colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                  <View style={sh.fieldGap}>
                    <FieldLabel label="Email Address" hint="Contact support to change your email address" />
                    <TextInput
                      style={[sh.input, { opacity: 0.5 }]}
                      value={user?.email ?? ''}
                      editable={false}
                    />
                  </View>
                  <ResultBanner {...profileResult} />
                  <View style={s.editActions}>
                    <TouchableOpacity style={s.cancelBtn} onPress={cancelEdit} disabled={savingProfile}>
                      <Ionicons name="close" size={15} color={Colors.textMuted} />
                      <Text style={s.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.saveBtn, savingProfile && { opacity: 0.6 }]}
                      onPress={saveProfile}
                      disabled={savingProfile}
                    >
                      <Ionicons name="save-outline" size={15} color="#fff" />
                      <Text style={s.saveBtnText}>{savingProfile ? 'Saving…' : 'Save Changes'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── Change Password ───────────────────────────────────────── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <SectionHeader
                icon="lock-closed-outline"
                title="Change Password"
                sub="Verify your current password before setting a new one"
              />
            </View>
            <View style={s.sectionBody}>
              <PasswordInput
                label="Current Password"
                value={currentPw}
                onChangeText={setCurrentPw}
                placeholder="Enter your current password"
              />

              {/* Divider */}
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>New password</Text>
                <View style={s.dividerLine} />
              </View>

              <PasswordInput
                label="New Password"
                hint="Minimum 8 characters"
                value={newPw}
                onChangeText={setNewPw}
                placeholder="Enter new password"
              />
              <PasswordInput
                label="Confirm New Password"
                value={confirmPw}
                onChangeText={setConfirmPw}
                placeholder="Repeat new password"
              />

              <ResultBanner {...pwResult} />

              <TouchableOpacity
                style={[s.saveBtn, savingPw && { opacity: 0.6 }, { alignSelf: 'flex-end' }]}
                onPress={changePassword}
                disabled={savingPw}
              >
                <Ionicons name="lock-closed-outline" size={15} color="#fff" />
                <Text style={s.saveBtnText}>{savingPw ? 'Updating…' : 'Update Password'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Danger Zone ───────────────────────────────────────────── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <SectionHeader
                icon="warning-outline"
                title="Danger Zone"
                sub="Irreversible actions — proceed with caution"
              />
            </View>
            <View style={s.sectionBody}>
              <View style={s.dangerBox}>
                <View style={{ flex: 1 }}>
                  <Text style={s.dangerTitle}>Delete Account</Text>
                  <Text style={s.dangerSub}>
                    Permanently deletes your account, store, products and all customer data.
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => Alert.alert('Delete Account', 'To delete your account please contact support.')}
                >
                  <Text style={s.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── shared field styles (used within this file) ──────────────────────────────
const sh = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.brandLight, alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textPrimary },
  sectionSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  fieldGap: { gap: Spacing.xs },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 11,
    fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  slugRow: { flexDirection: 'row', alignItems: 'stretch' },
  slugPrefix: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderTopLeftRadius: Radius.md, borderBottomLeftRadius: Radius.md,
    paddingHorizontal: Spacing.md, justifyContent: 'center',
  },
  slugPrefixText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  pwRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderTopRightRadius: Radius.md, borderBottomRightRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
    borderLeftWidth: 0,
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  bannerText: { fontSize: FontSize.xs, fontWeight: '500', flex: 1 },
})

// ─── screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 60 },
  backText: { fontSize: FontSize.sm, color: Colors.brand, fontWeight: '500' },
  navTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 48 },

  // Account overview
  overviewCard: {
    backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, padding: Spacing.xl, gap: Spacing.md,
  },
  overviewTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: Colors.brandLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.brand },
  overviewInfo: { flex: 1, gap: 2 },
  bizName: { fontSize: FontSize.base, fontWeight: '800', color: Colors.textPrimary },
  overviewEmail: { fontSize: FontSize.xs, color: Colors.textMuted },
  memberSince: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  storeUrlRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  storeUrlText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted },
  storeSlug: { color: Colors.brand, fontWeight: '600' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  copyText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted },

  // Section card
  section: {
    backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden',
  },
  sectionHeader: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sectionBody: { padding: Spacing.xl, gap: Spacing.lg },

  // Profile read-only
  readGrid: { gap: Spacing.md },
  readRow: { gap: 2 },
  readLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  readValue: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textPrimary },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    alignSelf: 'flex-end', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  editBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },

  // Profile edit actions
  editActions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end', marginTop: Spacing.xs },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  cancelBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.brand, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  saveBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },

  // Password divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Danger zone
  dangerBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.dangerLight, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.danger, padding: Spacing.lg,
  },
  dangerTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.danger },
  dangerSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 3 },
  deleteBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.danger,
  },
  deleteBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.danger },
})
