import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FormMessage } from '@/components/FormMessage'
import { Chip, ConfidenceChip } from '@/features/courses/CourseChips'
import { LayoutCard } from '@/features/courses/LayoutCard'
import { formatPar, formatParRange } from '@/features/courses/parMath'
import {
  useCourseHoles,
  useCourseLayouts,
  useDirectoryCourse,
} from '@/lib/courseDirectory'

/**
 * One directory course: its headline par, the layouts it plays as, and the
 * hole-by-hole pars behind them. Reference only — par you're actually playing
 * today is set on the round.
 */
export function DirectoryCourseScreen() {
  const { courseId } = useParams()
  const { data: course, isLoading, error } = useDirectoryCourse(courseId)
  const { data: layouts } = useCourseLayouts(courseId)
  const layoutIds = useMemo(() => (layouts ?? []).map((l) => l.id), [layouts])
  const { data: holes } = useCourseHoles(courseId, layoutIds)

  if (isLoading) return <Centered>Loading course…</Centered>
  if (error)
    return <FormMessage tone="error">Couldn't load that course.</FormMessage>
  if (!course) {
    return (
      <div className="p-4">
        <FormMessage>That course isn't in the directory.</FormMessage>
        <Link
          to="/courses/directory"
          className="font-label text-sm text-accent"
        >
          Back to the directory
        </Link>
      </div>
    )
  }

  const range = formatParRange(course)
  const holesFor = (layoutId: string) =>
    (holes ?? []).filter((h) => h.layout_id === layoutId)

  return (
    <div className="flex flex-col gap-4 p-4">
      <Link to="/courses/directory" className="font-label text-sm text-accent">
        ← Course directory
      </Link>

      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold text-text">
              {course.name}
            </h1>
            <p className="mt-0.5 font-label text-xs text-muted">
              {[
                course.city,
                course.state,
                course.hole_count ? `${course.hole_count} holes` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="font-numeral text-lg text-text">
              {formatPar(course.total_par)}
            </span>
            <ConfidenceChip confidence={course.par_confidence} />
          </div>
        </div>

        {range ? (
          <p className="font-numeral text-xs text-muted">{range}</p>
        ) : null}
        {course.par_source ? (
          <p className="font-label text-xs text-muted">
            Par source: {course.par_source}
          </p>
        ) : null}
        {course.notes ? (
          <p className="font-label text-xs text-muted">{course.notes}</p>
        ) : null}
        {course.duplicate_note ? (
          <p className="font-label text-xs text-muted">
            Possible duplicate listing — {course.duplicate_note}
          </p>
        ) : null}
        {course.external_url ? (
          <a
            href={course.external_url}
            target="_blank"
            rel="noreferrer"
            className="font-label text-xs text-accent"
          >
            Course listing ↗
          </a>
        ) : null}

        <p className="font-label text-xs text-muted">
          Playing it differently today? Set the par — total or hole by hole — on
          the round itself. It won't change this listing.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-text">
            Layouts
          </h2>
          {layouts?.length ? <Chip>{layouts.length}</Chip> : null}
        </div>

        {layouts?.length ? (
          <ul className="flex flex-col gap-2">
            {layouts.map((layout) => (
              <li key={layout.id}>
                <LayoutCard layout={layout} holes={holesFor(layout.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-label text-sm text-muted">
            No layouts have been recorded for this course.
          </p>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-10 text-center font-label text-sm text-muted">
      {children}
    </div>
  )
}
