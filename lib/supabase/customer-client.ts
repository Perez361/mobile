import { createClient, SupabaseClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Separate instance per store slug to isolate customer sessions
const instances = new Map<string, SupabaseClient>()

export function createCustomerClient(slug: string): SupabaseClient {
  if (!instances.has(slug)) {
    instances.set(
      slug,
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: AsyncStorage,
          storageKey: `importflow-customer-auth-${slug}`,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    )
  }
  return instances.get(slug)!
}
