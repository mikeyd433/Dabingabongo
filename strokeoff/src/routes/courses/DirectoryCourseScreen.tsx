import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { Chip, ConfidenceChip } from '@/features/courses/CourseChips'
import { CourseEditor } from '@/features/courses/CourseEditor'
import { LayoutCard } from '@/features/courses/LayoutCard'
import {
  deriveCoursePar,
  formatPar,
  formatParRange,
} from '@/features/courses/parMath'
import { useAuth } from '@/lib/auth'
import {
  useClearHoles,
  useDirectoryCourse,
  useCourseHoles,
  useCourseLayouts,
  useCreateLayout,
  useDeleteDirectoryCourse,
  useDeleteLayout,
  useSaveHoles,
  useUpdateDirectoryCourse,
  useUpdateLayout,
} from '@/lib/courseDirectory'
import { errorMessage } from '@/lib/validation'

/**
 * One course: its headline par, the layouts it plays as, and the hole-by-hole
 * pars behind them. Every par on this screen is editable — the imported data is
 * a starting point, not a fixed record.
 */
export function DirectoryCourseScreen() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: course, isLoading, error } = useDirectoryCourse(courseId)
  const { data: layouts } = useCourseLayouts(courseId)
  const layoutIds = useMemo(() => (layouts ?? []).map((l) => l.id), [layouts])
  const { data: holes } = useCourseHoles(courseId, layoutIds)

  const updateCourse = useUpdateDirectoryCourse(courseId)
  const deleteCourse = useDeleteDirectoryCourse()
  const createLayout = useCreateLayout(courseId)
  const updateLayout = useUpdateLayout(courseId)
  const deleteLayout = useDeleteLayout(courseId)
  const saveHoles = useSaveHoles(courseId)
  const clearHoles = useClearHoles(courseId)

  const [editing, setEditing] = useState(false)
  const [newLayout, setNewLayout] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const derived = useMemo(
    () => deriveCoursePar(layouts ?? [], course?.hole_count ?? null),
    [layouts, course?.hole_count],
  )

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

  const canEdit = Boolean(user)
  const holesFor = (layoutId: string) =>
    (holes ?? []).filter((h) => h.layout_id === layoutId)
  const range = formatParRange(course)
  const parMatchesDerived = derived != null && derived.par === course.total_par

  async function run(action: () => Promise<unknown>) {
    setActionError(null)
    try {
      await action()
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Link to="/courses/directory" className="font-label text-sm text-accent">
        ← Course directory
      </Link>

      {editing ? (
        <CourseEditor
          initial={course}
          onSave={async (draft) => {
            await updateCourse.mutateAsync(draft)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
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

          {canEdit ? (
            <div className="mt-1 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(true)}
              >
                Edit course par
              </Button>
              {derived && !parMatchesDerived ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    void run(() =>
                      updateCourse.mutateAsync({
                        total_par: derived.par,
                        par_source: `${derived.basis} — recalculated in Stroke Off`,
                        par_confidence: 'user',
                      }),
                    )
                  }
                >
                  Use par {derived.par} from layouts
                </Button>
              ) : null}
              {!course.is_seed && course.created_by === user?.id ? (
                confirmDelete ? (
                  <Button
                    type="button"
                    onClick={() =>
                      void run(async () => {
                        await deleteCourse.mutateAsync(course.id)
                        navigate('/courses/directory')
                      })
                    }
                  >
                    Confirm delete
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete course
                  </Button>
                )
              ) : null}
            </div>
          ) : (
            <p className="font-label text-xs text-muted">
              Pick a display name on Home to correct a par.
            </p>
          )}
        </div>
      )}

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
                <LayoutCard
                  layout={layout}
                  holes={holesFor(layout.id)}
                  canEdit={canEdit}
                  canDelete={!layout.is_seed && layout.created_by === user?.id}
                  onSave={(patch) =>
                    updateLayout
                      .mutateAsync({ id: layout.id, patch })
                      .then(() => {})
                  }
                  onDelete={() =>
                    run(() => deleteLayout.mutateAsync(layout.id))
                  }
                  onSaveHoles={(next) =>
                    saveHoles
                      .mutateAsync({ layoutId: layout.id, holes: next })
                      .then(() => {})
                  }
                  onClearHoles={() =>
                    clearHoles.mutateAsync(layout.id).then(() => {})
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-label text-sm text-muted">
            No layouts recorded yet. Add the tees you play and set their par.
          </p>
        )}

        {canEdit ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const name = newLayout.trim()
              if (!name) return
              void run(async () => {
                await createLayout.mutateAsync({
                  name,
                  hole_count: course.hole_count,
                  total_par: null,
                  length_ft: null,
                  source: 'Entered in Stroke Off',
                  note: null,
                })
                setNewLayout('')
              })
            }}
          >
            <TextInput
              value={newLayout}
              onChange={(e) => setNewLayout(e.target.value)}
              placeholder="Add a layout — e.g. Blue tees"
              aria-label="New layout name"
            />
            <Button type="submit">Add</Button>
          </form>
        ) : null}
      </div>

      {actionError ? (
        <FormMessage tone="error">{actionError}</FormMessage>
      ) : null}
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
