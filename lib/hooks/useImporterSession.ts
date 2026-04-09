import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createImporterClient } from '@/lib/supabase/importer-client'
import type { Importer } from '@/types'

export function useImporterSession() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [importer, setImporter] = useState<Importer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createImporterClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchImporter(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchImporter(session.user.id)
      else { setImporter(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchImporter(userId: string) {
    const supabase = createImporterClient()
    const { data } = await supabase.from('importers').select('*').eq('id', userId).single()
    setImporter(data ?? null)
    setLoading(false)
  }

  async function signOut() {
    const supabase = createImporterClient()
    // Sign out from Supabase first so the session is cleared before any navigation happens.
    // onAuthStateChange will fire and clear local state; we don't set it manually to avoid
    // a race where the welcome screen's getSession() still finds the old live session.
    await supabase.auth.signOut()
  }

  return { user, session, importer, loading, signOut }
}
