import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { Select } from '@/components/Select'
import { EmptyState } from '@/components/EmptyState'
import { FormMessage } from '@/components/FormMessage'
import { useAuth } from '@/lib/auth'
import { useMyGroups } from '@/lib/profile'
import {
  useCourses,
  useCreateCourse,
  useDeleteCourse,
  useUpdateCourse,
} from '@/lib/courses'
import { errorMessage } from '@/lib/validation'
import type { Course } from '@/types'

/**
 * The saved-course bank (spec §5): a group's reusable courses with their total
 * par. Courses are also remembered automatically when a round is created, but
 * here you can add, edit, and remove them directly. Starting a round autofills
 * par from whatever's saved here.
 */
export function CoursesScreen() {
  const { user, loading } = useAuth()
  const { data: groups } = useMyGroups()

  const [groupId, setGroupId] = useState<string | undefined>()
  const activeGroupId =
    groupId ??
    groups?.find((g) => g.is_personal)?.id ??
    groups?.[0]?.id ??
    undefined

  if (loading) return <Centered>Loading…</Centered>

  if (!user) {
    return (
      <EmptyState
        title="Save your courses"
        message="Pick a display name on Home to start — your saved courses live in your group."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {groups && groups.length > 1 ? (
        <label className="flex items-center gap-2">
          <span className="font-label text-sm text-muted">Group</span>
          <Select
            value={activeGroupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="flex-1"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}

      <CourseLibrary groupId={activeGroupId} />

      <p className="font-label text-xs text-muted">
        Don't know a course's par?{' '}
        <Link to="/courses/directory" className="text-accent underline">
          Look it up in the course directory
        </Link>{' '}
        — every course in the area, with the layouts each one plays as.
      </p>
    </div>
  )
}

function parError(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (!Number.isInteger(n) || n < 0) return 'Par must be a whole number.'
  return null
}

function CourseLibrary({ groupId }: { groupId: string | undefined }) {
  const { data: courses, isLoading, error } = useCourses(groupId)
  const createCourse = useCreateCourse(groupId)
  const updateCourse = useUpdateCourse(groupId)
  const deleteCourse = useDeleteCourse(groupId)

  const [name, setName] = useState('')
  const [par, setPar] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Course | null>(null)

  async function add() {
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setAddError('Give the course a name.')
      return
    }
    const pErr = parError(par)
    if (pErr) {
      setAddError(pErr)
      return
    }
    setAddError(null)
    const parValue = par.trim() === '' ? null : Number(par.trim())
    // Saving a name that already exists just updates its par.
    const existing = courses?.find(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase(),
    )
    try {
      if (existing) {
        await updateCourse.mutateAsync({
          id: existing.id,
          patch: { par: parValue },
        })
      } else {
        await createCourse.mutateAsync({ name: trimmedName, par: parValue })
      }
      setName('')
      setPar('')
    } catch (e) {
      setAddError(errorMessage(e))
    }
  }

  if (error) {
    return <FormMessage tone="error">Couldn't load courses.</FormMessage>
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="font-display text-lg font-bold text-text">Saved courses</h1>
      <p className="font-label text-xs text-muted">
        Save the courses you play with their total par. Starting a round fills the
        par in for you.
      </p>

      <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
        <h2 className="font-label text-sm font-semibold text-text">
          Add a course
        </h2>
        <div className="flex gap-2">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Course name"
            aria-label="Course name"
          />
          <div className="w-24 shrink-0">
            <TextInput
              value={par}
              inputMode="numeric"
              placeholder="Par"
              aria-label="Course par"
              onChange={(e) => setPar(e.target.value)}
            />
          </div>
        </div>
        <Button
          type="button"
          disabled={createCourse.isPending || updateCourse.isPending}
          onClick={add}
        >
          Save course
        </Button>
        {addError ? <FormMessage tone="error">{addError}</FormMessage> : null}
      </section>

      {isLoading ? (
        <Centered>Loading courses…</Centered>
      ) : (courses?.length ?? 0) === 0 ? (
        <EmptyState
          title="No saved courses yet"
          message="Add a course above, or it'll be remembered the next time you start a round there."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {courses!.map((course) =>
            editing?.id === course.id ? (
              <li key={course.id}>
                <CourseEditor
                  course={course}
                  onSave={async (patch) => {
                    await updateCourse.mutateAsync({ id: course.id, patch })
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={course.id}>
                <CourseRow
                  course={course}
                  onEdit={() => setEditing(course)}
                  onDelete={() => deleteCourse.mutate(course.id)}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}

function CourseRow({
  course,
  onEdit,
  onDelete,
}: {
  course: Course
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-3">
      <div className="min-w-0">
        <span className="font-label text-sm font-semibold text-text">
          {course.name}
        </span>
        <span className="mt-0.5 block font-numeral text-xs text-muted">
          {course.par != null ? `Par ${course.par}` : 'No par set'}
        </span>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button type="button" variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        {confirmDelete ? (
          <Button type="button" onClick={onDelete}>
            Confirm
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}

function CourseEditor({
  course,
  onSave,
  onCancel,
}: {
  course: Course
  onSave: (patch: { name: string; par: number | null }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(course.name)
  const [par, setPar] = useState(course.par?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save() {
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setError('Give the course a name.')
      return
    }
    const pErr = parError(par)
    if (pErr) {
      setError(pErr)
      return
    }
    setError(null)
    setPending(true)
    try {
      await onSave({
        name: trimmedName,
        par: par.trim() === '' ? null : Number(par.trim()),
      })
    } catch (e) {
      setError(errorMessage(e))
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-alt p-3">
      <div className="flex gap-2">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Course name"
        />
        <div className="w-24 shrink-0">
          <TextInput
            value={par}
            inputMode="numeric"
            placeholder="Par"
            aria-label="Course par"
            onChange={(e) => setPar(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
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
