import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { SupabaseClient } from '@supabase/supabase-js'

const EAS_PROJECT_ID = '66537040-2868-4129-bb34-d6c462332352'

// Controls how notifications are presented when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function requestAndGetPushToken(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync()
  const { status } = existing !== 'granted'
    ? await Notifications.requestPermissionsAsync()
    : { status: existing }

  if (status !== 'granted') return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ImportFlow PRO',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    })
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })
    return data
  } catch {
    return null
  }
}

export async function savePushToken(supabase: SupabaseClient, token: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('push_tokens').upsert(
    {
      user_id: user.id,
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' }
  )
}
