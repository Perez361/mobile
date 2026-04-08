import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import type { Customer } from '@/types'

export function useCustomerSession(slug: string) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    const supabase = createCustomerClient(slug)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchCustomer(session.user.id, slug)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchCustomer(session.user.id, slug)
      } else {
        setCustomer(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [slug])

  async function fetchCustomer(userId: string, storeSlug: string) {
    const supabase = createCustomerClient(storeSlug)
    // Get importer id by slug first
    const { data: imp } = await supabase
      .from('importers')
      .select('id')
      .ilike('store_slug', storeSlug)
      .single()

    if (!imp) { setLoading(false); return }

    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .eq('store_id', imp.id)
      .single()

    setCustomer(data ?? null)
    setLoading(false)
  }

  async function signOut() {
    const supabase = createCustomerClient(slug)
    await supabase.auth.signOut()
  }

  return { user, session, customer, loading, signOut }
}
