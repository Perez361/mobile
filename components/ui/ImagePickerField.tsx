/**
 * ImagePickerField — pick from library or camera, upload to Supabase Storage
 * bucket: 'product-images', path: '{userId}/{uuid}.{ext}'
 */
import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { Ionicons } from '@expo/vector-icons'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { useAlert } from '@/components/ui/AlertModal'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

interface Props {
  value: string | null
  userId: string
  onUpload: (url: string | null) => void
  error?: string
}

export function ImagePickerField({ value, userId, onUpload, error }: Props) {
  const [uploading, setUploading] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [uploadUrl, setUploadUrl] = useState<string | null>(null)
  const [cacheKey, setCacheKey] = useState<string>('')
  const { showAlert } = useAlert()

  useEffect(() => {
    if (value) setCacheKey(Date.now().toString() + '-' + Math.random().toString(36).slice(2))
  }, [value])

  // While uploading: show the local URI for instant feedback.
  // Once upload finishes: onUpload() is called first (parent gets the URL),
  // then localPreview is cleared — so there's never a blank frame.
  // FIX: Delay clear until parent value or uploadUrl is set
  useEffect(() => {
    if (!uploading && uploadUrl && value) {
      console.log('✅ ImagePicker: Clearing localPreview, value now:', value)
      setLocalPreview(null)
      setUploadUrl(null)
    }
  }, [uploading, value, uploadUrl])

  const displayValue = localPreview ?? value ?? uploadUrl ?? undefined

  const imageLogValue = displayValue ?? undefined

  async function requestPermission(source: 'library' | 'camera') {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      return status === 'granted'
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    return status === 'granted'
  }

  async function pick(source: 'library' | 'camera') {
    const granted = await requestPermission(source)
    if (!granted) {
      showAlert({
        type: 'error',
        title: 'Permission needed',
        message: `Allow access to your ${source === 'camera' ? 'camera' : 'photo library'} in Settings.`,
      })
      return
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] })

    if (result.canceled || !result.assets?.[0]) return

    const asset = result.assets[0]

    // Show the local picker URI as an optimistic preview while upload runs
    setLocalPreview(asset.uri)
    setUploading(true)

    try {
      await uploadImage(asset.uri, asset.mimeType ?? 'image/jpeg')
    } catch {
      // Upload failed — clear the optimistic preview
      setLocalPreview(null)
    } finally {
      setUploading(false)
    }
  }

  async function uploadImage(uri: string, mimeType: string) {
    const supabase = createImporterClient()

    // Compress: resize to max 1200px wide, JPEG at 80% quality
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    )

    if (!compressed.base64) {
      throw new Error('Failed to compress image')
    }

    const base64Data = compressed.base64
    console.log('📤 Compressed base64 size:', base64Data.length)

    // Decode base64 to binary
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

    // Try upload with Uint8Array first
    let uploadResult = await supabase.storage
      .from('product-images')
      .upload(fileName, bytes, { contentType: 'image/jpeg' })

    // Fallback to FormData if Uint8Array fails
    if (uploadResult.error) {
      console.log('📤 Uint8Array upload failed, trying FormData...')
      const supabaseUrl = (supabase as any).supabaseUrl ?? 'https://mhlkxsncvohiuquthcum.supabase.co'

      const formData = new FormData()
      formData.append('file', { uri: `data:image/jpeg;base64,${base64Data}`, type: 'image/jpeg', name: fileName } as any, fileName)

      // Use fetch directly for FormData upload
      const response = await fetch(
        `${supabaseUrl}/storage/v1/object/product-images/${fileName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: formData,
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Upload failed: ${response.status} - ${errorText}`)
      }
      uploadResult = { data: { id: '', path: fileName, fullPath: fileName }, error: null }
    }

    // Check for final error
    const uploadError = (uploadResult as any).error
    if (uploadError != null) {
      showAlert({ type: 'error', title: 'Upload failed', message: uploadError.message })
      throw uploadError
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)
    console.log('📤 ImagePicker: Upload success, publicUrl:', data.publicUrl)

    // Call onUpload FIRST so parent receives URL and updates value
    // This triggers the useEffect to update cacheKey for the Image component
    onUpload(data.publicUrl)
    
    // Store uploadUrl for local fallback, clear happens via useEffect when value updates
    setUploadUrl(data.publicUrl)
  }

  async function removeImage() {
    if (!value && !localPreview) return
    showAlert({
      type: 'confirm',
      title: 'Remove image',
      message: 'Remove the current product image?',
      confirmText: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        if (value) {
          const pathMatch = value.split('/product-images/')[1]
          if (pathMatch) {
            const supabase = createImporterClient()
            await supabase.storage.from('product-images').remove([decodeURIComponent(pathMatch)])
          }
        }
        setLocalPreview(null)
        onUpload(null)
      },
    })
  }

  return (
    <View style={s.root}>
      <Text style={s.label}>Product Image</Text>

      {displayValue ? (
        <View style={s.preview}>
          <Image
            source={{
              uri: displayValue,
              cacheKey: displayValue.startsWith('http')
                ? `${displayValue}?t=${cacheKey}`
                : displayValue
            }}
            style={s.image}
            contentFit="cover"
            transition={200}
            cachePolicy={displayValue.startsWith('http') ? 'disk' : 'memory'}
            onError={(e) => console.error('❌ Image load ERROR:', imageLogValue, e)}
            onLoadEnd={() => console.log('✅ Image load END:', imageLogValue)}
          />
          {uploading && (
            <View style={s.imageOverlay}>
              <ActivityIndicator color={Colors.brand} />
              <Text style={s.uploadingText}>Uploading…</Text>
            </View>
          )}
          <View style={s.previewActions}>
            <TouchableOpacity style={s.changeBtn} onPress={() => pick('library')} disabled={uploading}>
              <Ionicons name="camera-outline" size={14} color={Colors.brand} />
              <Text style={s.changeBtnText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.removeBtn} onPress={removeImage} disabled={uploading}>
              <Ionicons name="trash-outline" size={14} color={Colors.danger} />
              <Text style={s.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[s.placeholder, error ? s.placeholderError : null]}
          onPress={() => pick('library')}
          disabled={uploading}
          activeOpacity={0.7}
        >
          {uploading ? (
            <ActivityIndicator color={Colors.brand} />
          ) : (
            <>
              <View style={s.uploadIcon}>
                <Ionicons name="cloud-upload-outline" size={28} color={Colors.brand} />
              </View>
              <Text style={s.uploadText}>Tap to upload photo</Text>
              <Text style={s.uploadHint}>Camera or photo library · PNG, JPG, WebP</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: Spacing.xs },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },

  placeholder: {
    height: 160, borderRadius: Radius.lg, borderWidth: 1.5,
    borderColor: Colors.border, borderStyle: 'dashed',
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
  },
  placeholderError: { borderColor: Colors.danger },
  uploadIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.brandLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  uploadText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  uploadHint: { fontSize: FontSize.xs, color: Colors.textMuted },

  preview: { gap: Spacing.sm },
  image: { width: '100%', height: 200, borderRadius: Radius.lg, backgroundColor: Colors.surface },
  imageOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 200,
    borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
  },
  uploadingText: { fontSize: FontSize.xs, color: Colors.textMuted },
  previewActions: { flexDirection: 'row', gap: Spacing.sm },
  changeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    flex: 1, justifyContent: 'center',
    paddingVertical: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: Colors.brandLight, borderWidth: 1, borderColor: Colors.brand,
  },
  changeBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.brand },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    flex: 1, justifyContent: 'center',
    paddingVertical: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: Colors.danger,
  },
  removeBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.danger },

  error: { fontSize: FontSize.xs, color: Colors.danger },
})