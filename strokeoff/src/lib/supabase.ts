import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env'

/**
 * The shared Supabase client. Phase 0 only initializes it from env and runs a
 * connectivity check (see healthCheck.ts) — no auth, tables, or business logic yet.
 *
 * If env vars are missing we still construct a client against placeholder values so
 * the app boots in dev without crashing; the connectivity check will report the
 * misconfiguration instead.
 */
if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[Stroke Off] Supabase env vars missing. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env.local (see .env.example).',
  )
}

export const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY || 'public-anon-key',
)
