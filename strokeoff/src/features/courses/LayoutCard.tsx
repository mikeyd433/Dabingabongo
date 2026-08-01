import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { Field, NumberField } from '@/features/courses/CourseFields'
import { LayoutStatusChip } from '@/features/courses/CourseChips'
import { HoleParEditor } from '@/features/courses/HoleParEditor'
import { formatPar } from '@/features/courses/parMath'
import type { HoleDraft } from '@/features/courses/parMath'
import { errorMessage } from '@/lib/validation'
import type { LayoutDraft } from '@/lib/courseDirectory'
import type { CourseHole, CourseLayout } from '@/types'

interface LayoutCardProps {
  layout: CourseLayout
  holes: CourseHole[]
  canEdit: boolean
  canDelete: boolean
  onSave: (patch: Partial<LayoutDraft>) => Promise<void>
  onDelete: () => Promise<void>
  onSaveHoles: (holes: HoleDraft[]) => Promise<void>
  onClearHoles: () => Promise<void>
}

/**
 * One configuration of a course. Par sits here rather than on the course,
 * because a course with blue and white tees genuinely plays to two pars.
 */
export function LayoutCard({
  layout,
  holes,
  canEdit,
  canDelete,
  onSave,
  onDelete,
  onSaveHoles,
  onClearHoles,
}: LayoutCardProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'holes'>('view')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const derived = holes.length > 0

  if (mode === 'holes') {
    return (
      <HoleParEditor
        layout={layout}
        holes={holes}
        onSave={async (next) => {
          await onSaveHoles(next)
          setMode('view')
        }}
        onClear={async () => {
          await onClearHoles()
          setMode('view')
        }}
        onCancel={() => setMode('view')}
      />
    )
  }

  if (mode === 'edit') {
    return (
      <LayoutEditor
        layout={layout}
        derived={derived}
        onSave={async (patch) => {
          await onSave(patch)
          setMode('view')
        }}
        onCancel={() => setMode('view')}
      />
    )
  }

  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
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
              layout.length_ft
                ? `${layout.length_ft.toLocaleString()} ft`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {derived ? (
            <p className="mt-0.5 font-label text-xs text-muted">
              Total comes from {holes.length} hole pars.
            </p>
          ) : null}
          {layout.note ? (
            <p className="mt-1 font-label text-xs text-muted">{layout.note}</p>
          ) : null}
          {layout.source ? (
            <p className="mt-0.5 font-label text-xs text-muted">
              Source: {layout.source}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex shrink-0 flex-col gap-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode('edit')}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode('holes')}
            >
              {derived ? 'Hole pars' : 'Add holes'}
            </Button>
            {canDelete ? (
              confirmDelete ? (
                <Button type="button" onClick={() => void onDelete()}>
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
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function LayoutEditor({
  layout,
  derived,
  onSave,
  onCancel,
}: {
  layout: CourseLayout
  derived: boolean
  onSave: (patch: Partial<LayoutDraft>) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<LayoutDraft>({
    name: layout.name,
    hole_count: layout.hole_count,
    total_par: layout.total_par,
    length_ft: layout.length_ft,
    source: layout.source,
    note: layout.note,
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function set<K extends keyof LayoutDraft>(key: K, value: LayoutDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (draft.name.trim().length === 0) {
      setError('Give the layout a name.')
      return
    }
    setPending(true)
    setError(null)
    try {
      // A layout with hole detail derives its total from the holes; sending a
      // total here would just be overwritten by the database.
      const { total_par, ...rest } = draft
      await onSave(
        derived
          ? { ...rest, name: draft.name.trim() }
          : { ...rest, total_par, name: draft.name.trim() },
      )
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-card border border-border bg-surface-alt p-3"
    >
      <Field label="Layout" htmlFor={`layout-name-${layout.id}`}>
        <TextInput
          id={`layout-name-${layout.id}`}
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Blue tees"
        />
      </Field>

      <div className="flex gap-3">
        <NumberField
          label="Holes"
          htmlFor={`layout-holes-${layout.id}`}
          className="flex-1"
          value={draft.hole_count}
          onChange={(v) => set('hole_count', v)}
        />
        {derived ? (
          <div className="flex-1">
            <span className="font-label text-sm text-text">Total par</span>
            <p className="mt-2 font-numeral text-sm text-muted">
              {formatPar(layout.total_par)} — set by the hole pars.
            </p>
          </div>
        ) : (
          <NumberField
            label="Total par"
            htmlFor={`layout-par-${layout.id}`}
            className="flex-1"
            value={draft.total_par}
            onChange={(v) => set('total_par', v)}
          />
        )}
      </div>

      <NumberField
        label="Length (ft)"
        htmlFor={`layout-length-${layout.id}`}
        value={draft.length_ft}
        onChange={(v) => set('length_ft', v)}
      />

      <Field label="Note" htmlFor={`layout-note-${layout.id}`}>
        <TextInput
          id={`layout-note-${layout.id}`}
          value={draft.note ?? ''}
          onChange={(e) => set('note', e.target.value)}
          placeholder="Anything worth flagging about this layout"
        />
      </Field>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save layout'}
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
