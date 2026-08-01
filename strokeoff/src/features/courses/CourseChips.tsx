import type { LayoutStatus, ParConfidence } from '@/types'

const CONFIDENCE_LABEL: Record<ParConfidence, string> = {
  verified: 'Sourced',
  community: 'Community',
  unverified: 'Unsourced',
  user: 'Edited here',
}

const STATUS_LABEL: Record<LayoutStatus, string> = {
  ok: '',
  conflict: 'Sources disagree',
  superseded: 'Superseded',
  uncertain: 'Uncertain',
}

/** Small token-driven label. Accented when it wants a second look. */
export function Chip({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode
  tone?: 'muted' | 'accent'
}) {
  return (
    <span
      className="shrink-0 rounded border px-1.5 py-0.5 font-label text-xs"
      style={{
        borderColor:
          tone === 'accent' ? 'var(--color-accent)' : 'var(--color-border)',
        color: tone === 'accent' ? 'var(--color-accent)' : 'var(--color-muted)',
      }}
    >
      {children}
    </span>
  )
}

/** Where a course's par came from — provenance stays visible, not buried. */
export function ConfidenceChip({ confidence }: { confidence: ParConfidence }) {
  return (
    <Chip tone={confidence === 'unverified' ? 'accent' : 'muted'}>
      {CONFIDENCE_LABEL[confidence]}
    </Chip>
  )
}

/** Only rendered when a layout carries a data-quality flag worth reading. */
export function LayoutStatusChip({ status }: { status: LayoutStatus }) {
  if (status === 'ok') return null
  return <Chip tone="accent">{STATUS_LABEL[status]}</Chip>
}
