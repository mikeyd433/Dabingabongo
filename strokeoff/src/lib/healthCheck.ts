import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env'

export type HealthStatus = 'checking' | 'ok' | 'unconfigured' | 'error'

export interface HealthResult {
  status: HealthStatus
  detail: string
}

/**
 * Minimal Supabase connectivity check (Phase 0 only — no auth, no tables).
 *
 * Hits GoTrue's public health endpoint, which needs no session and no schema, so
 * it confirms the project URL + anon key reach a live Supabase instance without
 * touching any business logic.
 */
export async function checkSupabaseHealth(
  signal?: AbortSignal,
): Promise<HealthResult> {
  if (!isSupabaseConfigured) {
    return {
      status: 'unconfigured',
      detail: 'Supabase env vars are not set.',
    }
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal,
    })
    if (!res.ok) {
      return {
        status: 'error',
        detail: `Health endpoint returned ${res.status}.`,
      }
    }
    return { status: 'ok', detail: 'Connected to Supabase.' }
  } catch (err) {
    return {
      status: 'error',
      detail: err instanceof Error ? err.message : 'Network error.',
    }
  }
}
