import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { Field, NumberField } from '@/features/courses/CourseFields'
import { errorMessage } from '@/lib/validation'
import type { DirectoryCourseDraft } from '@/lib/courseDirectory'
import type { DirectoryCourse } from '@/types'

interface CourseEditorProps {
  initial?: DirectoryCourse
  onSave: (draft: DirectoryCourseDraft) => Promise<void>
  onCancel: () => void
}

function toDraft(course?: DirectoryCourse): DirectoryCourseDraft {
  return {
    name: course?.name ?? '',
    city: course?.city ?? '',
    state: course?.state ?? 'MA',
    hole_count: course?.hole_count ?? null,
    total_par: course?.total_par ?? null,
    par_source: course?.par_source ?? null,
    par_confidence: course?.par_confidence ?? 'unverified',
    notes: course?.notes ?? null,
  }
}

/**
 * Add or correct a course. Editing the par marks it as edited here, so a
 * hand-entered number is never mistaken for a sourced one.
 */
export function CourseEditor({ initial, onSave, onCancel }: CourseEditorProps) {
  const [draft, setDraft] = useState<DirectoryCourseDraft>(() =>
    toDraft(initial),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function set<K extends keyof DirectoryCourseDraft>(
    key: K,
    value: DirectoryCourseDraft[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const parChanged = draft.total_par !== (initial?.total_par ?? null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (draft.name.trim().length === 0) {
      setError('Give the course a name.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(),
        city: draft.city?.trim() || null,
        notes: draft.notes?.trim() || null,
        par_confidence: parChanged ? 'user' : draft.par_confidence,
        par_source: parChanged ? 'Entered in Stroke Off' : draft.par_source,
      })
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-card border border-border bg-surface-alt p-4"
    >
      <Field label="Course" htmlFor="course-name">
        <TextInput
          id="course-name"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Borderland State Park"
        />
      </Field>

      <Field label="Town" htmlFor="course-city">
        <TextInput
          id="course-city"
          value={draft.city ?? ''}
          onChange={(e) => set('city', e.target.value)}
          placeholder="e.g. Easton"
        />
      </Field>

      <div className="flex gap-3">
        <NumberField
          label="Holes"
          htmlFor="course-holes"
          className="flex-1"
          value={draft.hole_count}
          onChange={(v) => set('hole_count', v)}
        />
        <NumberField
          label="Total par"
          htmlFor="course-par"
          className="flex-1"
          value={draft.total_par}
          onChange={(v) => set('total_par', v)}
        />
      </div>

      <Field
        label="Notes"
        htmlFor="course-notes"
        hint="Anything worth knowing — which tees you play, a hole that's moved."
      >
        <TextInput
          id="course-notes"
          value={draft.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
        />
      </Field>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save course'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
