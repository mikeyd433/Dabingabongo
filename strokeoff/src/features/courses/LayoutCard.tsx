import { LayoutStatusChip } from '@/features/courses/CourseChips'
import { formatPar } from '@/features/courses/parMath'
import type { CourseHole, CourseLayout } from '@/types'

/**
 * One configuration of a directory course. Par sits here rather than on the
 * course, because a course with blue and white tees genuinely plays to two pars.
 *
 * Read-only: the directory is reference data. If today's card differs — a basket
 * has moved, a hole is playing long — that belongs on the round, not here.
 */
export function LayoutCard({
  layout,
  holes,
}: {
  layout: CourseLayout
  holes: CourseHole[]
}) {
  const sorted = holes.slice().sort((a, b) => a.hole_number - b.hole_number)

  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-label text-sm font-semibold text-text">
          {layout.name}
        </span>
        <LayoutStatusChip status={layout.status} />
      </div>

      <p className="mt-1 font-numeral text-xs text-muted">
        {[
          formatPar(layout.total_par),
          layout.hole_count ? `${layout.hole_count} holes` : null,
          layout.length_ft ? `${layout.length_ft.toLocaleString()} ft` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {layout.note ? (
        <p className="mt-1 font-label text-xs text-muted">{layout.note}</p>
      ) : null}
      {layout.source ? (
        <p className="mt-0.5 font-label text-xs text-muted">
          Source: {layout.source}
        </p>
      ) : null}

      {sorted.length > 0 ? (
        <div className="mt-2">
          <p className="font-label text-xs text-muted">
            Hole pars — total {sorted.reduce((n, h) => n + h.par, 0)}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {sorted.map((h) => (
              <li
                key={h.id}
                className="rounded border border-border px-1.5 py-0.5 font-numeral text-xs text-text"
                title={h.distance_ft ? `${h.distance_ft} ft` : undefined}
              >
                <span className="text-muted">{h.hole_number}</span> {h.par}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
