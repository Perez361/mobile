import React, { createContext, useContext, ReactNode, PropsWithChildren } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import type { Customer } from '@/types'
import { useCustomerSession } from './useCustomerSession'

interface CustomerContextType {
  user: User | null
  session: Session | null
  customer: Customer | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
}

const CustomerContext = createContext<CustomerContextType | null>(null)

export function useCustomerContext(): CustomerContextType {
  const context = useContext(CustomerContext)
  if (!context) {
    throw new Error('useCustomerContext must be used within CustomerProvider')
  }
  return context
}

interface CustomerProviderProps {
  slug: string
  children: ReactNode
}

export function CustomerProvider({ slug, children }: PropsWithChildren<CustomerProviderProps>) {
  const sessionData = useCustomerSession(slug)

  return (
    <CustomerContext.Provider value={sessionData}>
      {children}
    </CustomerContext.Provider>
  )
}

