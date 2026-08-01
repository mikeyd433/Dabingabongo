import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TextInput } from '@/components/TextInput'
import { Select } from '@/components/Select'
import { EmptyState } from '@/components/EmptyState'
import { FormMessage } from '@/components/FormMessage'
import { Chip, ConfidenceChip } from '@/features/courses/CourseChips'
import { formatPar, formatParRange } from '@/features/courses/parMath'
import { useDirectoryCourses } from '@/lib/courseDirectory'
import type { DirectoryCourse } from '@/types'

type ParFilter = 'all' | 'with-par' | 'needs-par'

/**
 * The course directory — the shared reference library behind a group's
 * saved-course bank. Look a course up here; change what you're playing to on
 * the round itself.
 */
export function DirectoryScreen() {
  const { data: courses, isLoading, error } = useDirectoryCourses()

  const [search, setSearch] = useState('')
  const [parFilter, setParFilter] = useState<ParFilter>('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (courses ?? []).filter((c) => {
      if (parFilter === 'with-par' && c.total_par == null) return false
      if (parFilter === 'needs-par' && c.total_par != null) return false
      if (q && !`${c.name} ${c.city ?? ''}`.toLowerCase().includes(q))
        return false
      return true
    })
  }, [courses, search, parFilter])

  const withPar = (courses ?? []).filter((c) => c.total_par != null).length

  if (error) {
    return (
      <FormMessage tone="error">
        Couldn't load the course directory.
      </FormMessage>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <h1 className="font-display text-lg font-bold text-text">
        Course directory
      </h1>

      {courses?.length ? (
        <p className="font-label text-xs text-muted">
          {courses.length} courses · {withPar} with a sourced par, from
          tournament and course records. Starting a round autofills par from
          here — and you can change it on the round without touching this list.
        </p>
      ) : null}

      <TextInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by course or town"
        aria-label="Search courses"
      />
      <Select
        value={parFilter}
        onChange={(e) => setParFilter(e.target.value as ParFilter)}
        aria-label="Filter by par"
        className="w-full"
      >
        <option value="all">All courses</option>
        <option value="with-par">Par listed</option>
        <option value="needs-par">No par listed</option>
      </Select>

      {isLoading ? (
        <Centered>Loading courses…</Centered>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={courses?.length ? 'No matches' : 'Directory is empty'}
          message={
            courses?.length
              ? 'Try a different search or filter.'
              : "The course list hasn't been imported yet."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((course) => (
            <li key={course.id}>
              <CourseRow course={course} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CourseRow({ course }: { course: DirectoryCourse }) {
  const range = formatParRange(course)
  return (
    <Link
      to={`/courses/directory/${course.id}`}
      className="flex min-h-[44px] items-center justify-between gap-3 rounded-card border border-border bg-surface p-3"
    >
      <div className="min-w-0">
        <span className="font-label text-sm font-semibold text-text">
          {course.name}
        </span>
        <p className="mt-0.5 font-label text-xs text-muted">
          {[
            course.city,
            course.hole_count ? `${course.hole_count} holes` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Town unknown'}
        </p>
        {range ? (
          <p className="mt-0.5 font-numeral text-xs text-muted">{range}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-numeral text-sm text-text">
          {formatPar(course.total_par)}
        </span>
        {course.total_par == null ? (
          <Chip tone="accent">No par</Chip>
        ) : (
          <ConfidenceChip confidence={course.par_confidence} />
        )}
      </div>
    </Link>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-10 text-center font-label text-sm text-muted">
      {children}
    </div>
  )
}
