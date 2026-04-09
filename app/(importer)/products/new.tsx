import { useState } from 'react'
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform,
  TouchableOpacity, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useImporterSession } from '@/lib/hooks/useImporterSession'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ImagePickerField } from '@/components/ui/ImagePickerField'
import { useAlert } from '@/components/ui/AlertModal'
import { slugify } from '@/lib/utils'
import { Colors, FontSize, Spacing } from '@/constants/theme'

const schema = z.object({
  name:            z.string().min(2, 'Product name required'),
  price:           z.string().min(1, 'Price required').refine((v) => !isNaN(Number(v)) && Number(v) > 0, { message: 'Enter a valid price' }),
  description:     z.string().optional(),
  shipping_tag:    z.string().optional(),
  tracking_number: z.string().optional(),
  supplier_name:   z.string().optional(),
  supplier_url:    z.union([z.string().url('Enter a valid URL'), z.literal('')]).optional(),
})
type FormData = z.infer<typeof schema>

export default function NewProductScreen() {
  const router = useRouter()
  const { user, importer } = useImporterSession()
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const { showAlert } = useAlert()

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', price: '', description: '',
      shipping_tag: '', tracking_number: '', supplier_name: '', supplier_url: '',
    },
  })

  async function onSubmit(data: FormData) {
    if (!importer) return
    setLoading(true)
    try {
      const { error } = await createImporterClient().from('products').insert({
        importer_id: importer.id,
        name: data.name,
        slug: slugify(data.name),
        price: Number(data.price),
        description: data.description || null,
        image_url: imageUrl || null,
        shipping_tag: data.shipping_tag || null,
        tracking_number: data.tracking_number || null,
        supplier_name: data.supplier_name || null,
        supplier_url: data.supplier_url || null,
      })
      if (error) { showAlert({ type: 'error', title: 'Error', message: error.message }); return }
      router.back()
    } catch (e: any) {
      showAlert({ type: 'error', title: 'Error', message: e?.message ?? 'Something went wrong.' })
    } finally { setLoading(false) }
  }

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.navTitle}>New Product</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">

          {/* Image upload */}
          <ImagePickerField
            value={imageUrl}
            userId={user?.id ?? ''}
            onUpload={setImageUrl}
          />

          <View style={s.divider} />
          <Text style={s.groupLabel}>Basic Info</Text>

          <Controller control={control} name="name" render={({ field: { onChange, value } }) => (
            <Input
              label="Product Name *"
              placeholder="e.g. Nike Air Max 90"
              onChangeText={onChange} value={value}
              error={errors.name?.message}
            />
          )} />
          <Controller control={control} name="price" render={({ field: { onChange, value } }) => (
            <Input
              label="Price (GH₵) *"
              placeholder="e.g. 5500"
              keyboardType="decimal-pad"
              onChangeText={onChange} value={value}
              error={errors.price?.message}
            />
          )} />
          <Controller control={control} name="description" render={({ field: { onChange, value } }) => (
            <Input
              label="Description"
              placeholder="Product details, sizes, pre-order info..."
              onChangeText={onChange} value={value}
              multiline numberOfLines={3}
              style={{ height: 80, textAlignVertical: 'top' }}
            />
          )} />
          <Controller control={control} name="shipping_tag" render={({ field: { onChange, value } }) => (
            <Input
              label="Shipping Tag"
              placeholder="e.g. Ships in 2 weeks"
              onChangeText={onChange} value={value}
            />
          )} />

          <View style={s.divider} />
          <Text style={s.groupLabel}>Supplier & Tracking</Text>

          <Controller control={control} name="tracking_number" render={({ field: { onChange, value } }) => (
            <Input
              label="Tracking Number"
              placeholder="e.g. 1Z999AA10123456784"
              autoCapitalize="characters"
              onChangeText={onChange} value={value}
            />
          )} />
          <Controller control={control} name="supplier_name" render={({ field: { onChange, value } }) => (
            <Input
              label="Supplier / Store"
              placeholder="e.g. Amazon, Shein, AliExpress"
              onChangeText={onChange} value={value}
            />
          )} />
          <Controller control={control} name="supplier_url" render={({ field: { onChange, value } }) => (
            <Input
              label="Supplier Product URL"
              placeholder="https://amazon.com/dp/..."
              keyboardType="url"
              onChangeText={onChange} value={value}
              error={errors.supplier_url?.message}
            />
          )} />

          <Button onPress={handleSubmit(onSubmit)} loading={loading} style={{ marginTop: Spacing.sm }}>
            Create Product
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.card },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  navTitle: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary },
  form: { padding: Spacing.xxl, gap: Spacing.lg, paddingBottom: 40 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  groupLabel: {
    fontSize: FontSize.xs, fontWeight: '800', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
})
