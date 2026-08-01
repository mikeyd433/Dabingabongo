import { useState } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { defaultHoles, sumHolePars } from '@/features/courses/parMath'
import type { HoleDraft } from '@/features/courses/parMath'
import { errorMessage } from '@/lib/validation'
import type { CourseHole, CourseLayout } from '@/types'

const MAX_HOLES = 36

interface HoleParEditorProps {
  layout: CourseLayout
  holes: CourseHole[]
  onSave: (holes: HoleDraft[]) => Promise<void>
  onClear: () => Promise<void>
  onCancel: () => void
}

function toDrafts(layout: CourseLayout, holes: CourseHole[]): HoleDraft[] {
  if (holes.length > 0) {
    return holes
      .slice()
      .sort((a, b) => a.hole_number - b.hole_number)
      .map((h) => ({
        hole_number: h.hole_number,
        par: h.par,
        distance_ft: h.distance_ft,
      }))
  }
  return defaultHoles(layout.hole_count ?? 18)
}

/**
 * Hole-by-hole par for one layout. While hole detail exists the layout's total
 * is the sum of these — the two can't drift apart — so this is also how you set
 * a layout's par precisely rather than as a single number.
 */
export function HoleParEditor({
  layout,
  holes,
  onSave,
  onClear,
  onCancel,
}: HoleParEditorProps) {
  const [drafts, setDrafts] = useState<HoleDraft[]>(() =>
    toDrafts(layout, holes),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const total = sumHolePars(drafts)

  function setHole(index: number, patch: Partial<HoleDraft>) {
    setDrafts((current) =>
      current.map((h, i) => (i === index ? { ...h, ...patch } : h)),
    )
  }

  function resize(count: number) {
    const next = Math.min(MAX_HOLES, Math.max(0, count))
    setDrafts((current) =>
      next <= current.length
        ? current.slice(0, next)
        : [
            ...current,
            ...defaultHoles(next - current.length).map((h, i) => ({
              ...h,
              hole_number: current.length + i + 1,
            })),
          ],
    )
  }

  async function run(action: () => Promise<void>) {
    setPending(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-alt p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-label text-sm font-semibold text-text">
          Hole pars — {layout.name}
        </span>
        <span className="font-numeral text-sm text-text">
          Par {total} · {drafts.length} holes
        </span>
      </div>

      <label className="flex items-center gap-2">
        <span className="font-label text-sm text-text">Holes</span>
        <TextInput
          type="number"
          inputMode="numeric"
          className="w-24"
          value={String(drafts.length)}
          onChange={(e) => resize(Number(e.target.value) || 0)}
          aria-label="Number of holes"
        />
      </label>

      {drafts.length === 0 ? (
        <FormMessage>
          Set a hole count to start the card, or cancel and edit the layout's
          total par directly.
        </FormMessage>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {drafts.map((hole, i) => (
            <li key={hole.hole_number} className="flex items-center gap-2">
              <span className="w-14 shrink-0 font-numeral text-sm text-muted">
                Hole {hole.hole_number}
              </span>
              <label className="flex flex-1 items-center gap-1.5">
                <span className="font-label text-xs text-muted">Par</span>
                <TextInput
                  type="number"
                  inputMode="numeric"
                  className="w-16"
                  value={String(hole.par)}
                  onChange={(e) =>
                    setHole(i, { par: Number(e.target.value) || 0 })
                  }
                  aria-label={`Par for hole ${hole.hole_number}`}
                />
              </label>
              <label className="flex flex-1 items-center gap-1.5">
                <span className="font-label text-xs text-muted">Feet</span>
                <TextInput
                  type="number"
                  inputMode="numeric"
                  className="w-20"
                  placeholder="—"
                  value={
                    hole.distance_ft == null ? '' : String(hole.distance_ft)
                  }
                  onChange={(e) =>
                    setHole(i, {
                      distance_ft:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  aria-label={`Distance for hole ${hole.hole_number}`}
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending || drafts.some((h) => h.par < 1)}
          onClick={() => void run(() => onSave(drafts))}
        >
          {pending ? 'Saving…' : 'Save hole pars'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        {holes.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => void run(onClear)}
          >
            Remove hole detail
          </Button>
        ) : null}
      </div>
      {drafts.some((h) => h.par < 1) ? (
        <FormMessage tone="error">
          Every hole needs a par of at least 1.
        </FormMessage>
      ) : null}
    </div>
  )
}
