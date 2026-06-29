import { useHealthCheck } from '@/lib/useHealthCheck'
import type { HealthStatus } from '@/lib/healthCheck'

const DOT: Record<HealthStatus, string> = {
  checking: 'var(--color-muted)',
  ok: 'var(--color-winner)',
  unconfigured: 'var(--color-muted)',
  error: 'var(--color-accent)',
}

const LABEL: Record<HealthStatus, string> = {
  checking: 'Checking…',
  ok: 'Online',
  unconfigured: 'No backend',
  error: 'Offline',
}

/**
 * Tiny Supabase connectivity indicator (Phase 0 health check). No business logic —
 * just surfaces whether the client reached the backend.
 */
export function HealthIndicator() {
  const { data, isLoading } = useHealthCheck()
  const status: HealthStatus = isLoading
    ? 'checking'
    : (data?.status ?? 'error')

  return (
    <span
      className="flex items-center gap-1.5 font-label text-xs text-muted"
      title={data?.detail ?? 'Checking Supabase connectivity…'}
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: DOT[status] }}
      />
      {LABEL[status]}
    </span>
  )
}
