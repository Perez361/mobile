import { useState, useEffect, useRef } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { createCustomerClient } from '@/lib/supabase/customer-client'
import type { Customer } from '@/types'

export function useCustomerSession(slug: string) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const importerCache = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createCustomerClient(slug)
    let settled = false

    // Timeout promise
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Session timeout')), 5000)
    )

    // Get session with timeout
    Promise.race([
      supabase.auth.getSession(),
      timeout
    ]).then(async ({ data: { session } }) => {
      if (settled) return
      if (!slug) { setLoading(false); return }
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user && slug) {
        await fetchCustomer(session.user.id, slug)
      } else {
        setLoading(false)
      }
    }).catch(async (err: any) => {
      if (settled) return
      if (!slug) { setLoading(false); return }

      // Handle invalid refresh token by clearing stored session
      if (err instanceof Error && (
        err.message?.includes('Invalid Refresh Token') ||
        err.message?.includes('Refresh Token Not Found') ||
        (err as AuthError)?.status === 400
      )) {
        console.warn('Invalid refresh token detected, clearing session')
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch (signOutErr) {
          console.warn('Failed to sign out locally:', signOutErr)
        }
        setSession(null)
        setUser(null)
        setCustomer(null)
        setError(null) // Don't show error for expired tokens
        setLoading(false)
        return
      }

      console.error('Customer session error:', err)
      setError(err.message || 'Authentication error')
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user && slug) {
        try {
          await fetchCustomer(session.user.id, slug)
        } catch (err: any) {
          console.error('Auth state change customer fetch error:', err)
          // If token is invalid, clear everything
          if (err instanceof Error && (
            err.message?.includes('Invalid Refresh Token') ||
            err.message?.includes('Refresh Token Not Found')
          )) {
            setSession(null)
            setUser(null)
            setCustomer(null)
          }
        }
      } else {
        setCustomer(null)
        setLoading(false)
      }
    })

    return () => {
      settled = true
      subscription.unsubscribe()
    }
  }, [slug])

  async function fetchCustomer(userId: string, storeSlug: string): Promise<void> {
    if (!storeSlug) { setLoading(false); return }
    const safeSlug = storeSlug as string
    try {
      setLoading(true)

      // Cache importer ID
      let importerId = importerCache.current.get(safeSlug)
      if (!importerId) {
        // Define timeout promise for lookup
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Store lookup timeout')), 3000)
        )

        const supabase = createCustomerClient(safeSlug)
        const { data: imp, error } = await Promise.race([
          supabase
            .from('importers')
            .select('id')
            .ilike('store_slug', safeSlug)
            .single(),
          timeoutPromise
        ])

        if (error) throw error
        if (!imp) throw new Error('Store not found')
        
        importerId = imp.id as string
        importerCache.current.set(safeSlug, importerId)
      }

      // Fetch customer
      const supabase = createCustomerClient(safeSlug)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .eq('store_id', importerId as string)
        .single()

      if (error) throw error
      setCustomer(data ?? null)
    } catch (err: any) {
      console.error('fetchCustomer error:', err)
      setError(err.message)
      setCustomer(null)
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    try {
      const supabase = createCustomerClient(slug)
      await supabase.auth.signOut()
      importerCache.current.clear()
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  return { user, session, customer, loading, error, signOut }
}
