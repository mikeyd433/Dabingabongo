import { useHealthCheck } from '@/lib/useHealthCheck'
import { useConnection } from '@/lib/useConnection'
import { connectionLabel } from '@/features/offline/pending'
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
 * Connectivity indicator. Browser offline / queued offline-writes take precedence
 * (spec §4) — they're what matters on a patchy course; otherwise it falls back to
 * the Supabase health check. Fully token-driven.
 */
export function HealthIndicator() {
  const { online, queued } = useConnection()
  const { data, isLoading } = useHealthCheck()

  // Device offline, or writes are parked/syncing: surface that first.
  if (!online || queued > 0) {
    const color = !online ? 'var(--color-accent)' : 'var(--color-muted)'
    const label = connectionLabel({ online, queued })
    return (
      <span
        className="flex items-center gap-1.5 font-label text-xs text-muted"
        title={
          queued > 0
            ? `${queued} point ${queued === 1 ? 'write' : 'writes'} waiting to sync.`
            : 'No connection — points will queue and sync when you reconnect.'
        }
      >
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        {label}
      </span>
    )
  }

  const status: HealthStatus = isLoading ? 'checking' : (data?.status ?? 'error')

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
