/**
 * ImagePickerField — pick from library or camera, upload to Supabase Storage
 * bucket: 'product-images', path: '{userId}/{uuid}.{ext}'
 */
import { useState } from 'react'
import {
  View, Text, Image, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { createImporterClient } from '@/lib/supabase/importer-client'
import { Colors, FontSize, Spacing, Radius } from '@/constants/theme'

interface Props {
  value: string | null
  userId: string
  onUpload: (url: string | null) => void
  error?: string
}

export function ImagePickerField({ value, userId, onUpload, error }: Props) {
  const [uploading, setUploading] = useState(false)

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
      Alert.alert('Permission needed', `Allow access to your ${source === 'camera' ? 'camera' : 'photo library'} in Settings.`)
      return
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [4, 3] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] })

    if (result.canceled || !result.assets?.[0]) return

    const asset = result.assets[0]
    setUploading(true)
    try {
      await uploadImage(asset.uri, asset.mimeType ?? 'image/jpeg')
    } finally {
      setUploading(false)
    }
  }

  async function uploadImage(uri: string, mimeType: string) {
    const supabase = createImporterClient()

    // Generate file path: userId/uuid.ext
    const ext = mimeType.split('/')[1] || 'jpg'
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Read the image as a blob
    const response = await fetch(uri)
    const blob = await response.blob()

    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, blob, { contentType: mimeType, upsert: false })

    if (error) {
      Alert.alert('Upload failed', error.message)
      return
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(fileName)
    onUpload(data.publicUrl)
  }

  async function removeImage() {
    if (!value) return
    Alert.alert('Remove image', 'Remove the current product image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          // Extract path from URL and delete from storage
          const pathMatch = value.split('/product-images/')[1]
          if (pathMatch) {
            const supabase = createImporterClient()
            await supabase.storage.from('product-images').remove([decodeURIComponent(pathMatch)])
          }
          onUpload(null)
        },
      },
    ])
  }

  function showPicker() {
    Alert.alert('Product Image', 'Choose a source', [
      { text: 'Camera', onPress: () => pick('camera') },
      { text: 'Photo Library', onPress: () => pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <View style={s.root}>
      <Text style={s.label}>Product Image</Text>

      {value ? (
        <View style={s.preview}>
          <Image source={{ uri: value }} style={s.image} resizeMode="cover" />
          <View style={s.previewActions}>
            <TouchableOpacity style={s.changeBtn} onPress={showPicker} disabled={uploading}>
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
          onPress={showPicker}
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

      {uploading && !value && null /* spinner already in placeholder */}
      {uploading && value && (
        <View style={s.uploadingOverlay}>
          <ActivityIndicator color={Colors.brand} />
          <Text style={s.uploadingText}>Uploading…</Text>
        </View>
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

  uploadingOverlay: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  uploadingText: { fontSize: FontSize.xs, color: Colors.textMuted },

  error: { fontSize: FontSize.xs, color: Colors.danger },
})
