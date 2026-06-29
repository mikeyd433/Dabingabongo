import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  /** True until the initial session has been resolved. */
  loading: boolean
  /** Live anonymous flag from the auth user (spec §4). */
  isAnonymous: boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
