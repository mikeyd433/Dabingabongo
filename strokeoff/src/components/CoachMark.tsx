import { useCoachMark } from '@/lib/coachmarks'

/**
 * A one-time, dismissible hint (spec §3). Renders nothing once dismissed (and
 * stays gone on future visits, remembered per device). Token-driven so it sits
 * in any theme. Give each placement a stable `id`.
 */
export function CoachMark({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  const [show, dismiss] = useCoachMark(id)
  if (!show) return null
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border border-accent bg-surface-alt p-3">
      <p className="font-label text-xs text-text">{children}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss hint"
        className="shrink-0 font-label text-xs font-semibold text-accent underline"
      >
        Got it
      </button>
    </div>
  )
}
