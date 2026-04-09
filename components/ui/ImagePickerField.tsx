/**
 * ImagePickerField — pick from library or camera, upload to Supabase Storage
 * bucket: 'product-images', path: '{userId}/{uuid}.{ext}'
 */
import { useState } from 'react'
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
  const { showAlert } = useAlert()

  // Show localPreview while uploading for instant feedback.
  // Once upload succeeds we clear it and fall through to the remote `value`.
  const displayValue = localPreview ?? value ?? undefined

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

    // Show the original picker URI as an optimistic preview while upload runs
    setLocalPreview(asset.uri)
    setUploading(true)

    try {
      await uploadImage(asset.uri, asset.mimeType ?? 'image/jpeg')
    } catch {
      // Upload failed — clear the optimistic preview so we don't show a dead URI
      setLocalPreview(null)
    } finally {
      setUploading(false)
    }
  }

  async function uploadImage(uri: string, mimeType: string) {
    const supabase = createImporterClient()

    // Compress: resize to max 1200px wide, JPEG at 80% quality.
    // This typically cuts file size by 60–80% vs the raw picker output.
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    )

    const response = await fetch(compressed.uri)
    if (!response.ok) throw new Error('Failed to read compressed image')
    const blob = await response.blob()

    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, blob, { contentType: 'image/jpeg' })

    if (uploadError) {
      showAlert({ type: 'error', title: 'Upload failed', message: uploadError.message })
      throw uploadError
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)

    // Clear local preview BEFORE calling onUpload so that when the parent
    // sets `value` to the public URL, displayValue immediately shows the
    // remote URL with no stale local URI in the way.
    setLocalPreview(null)
    onUpload(data.publicUrl)
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
            source={{ uri: displayValue }}
            style={s.image}
            contentFit="cover"
            transition={200}
            cachePolicy="none"
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