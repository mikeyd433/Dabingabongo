/**
 * Client environment. Only `VITE_`-prefixed vars are bundled into the app and are
 * safe to expose. Server-only secrets (RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY)
 * are never read here — they belong to Supabase Edge Functions in a later phase.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** True only when both client vars are present. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
