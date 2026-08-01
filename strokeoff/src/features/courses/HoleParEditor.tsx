import { useState } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { defaultHoles, sumHolePars } from '@/features/courses/parMath'
import type { HoleDraft } from '@/features/courses/parMath'
import { errorMessage } from '@/lib/validation'

const MAX_HOLES = 36

interface HoleParEditorProps {
  /** What this card belongs to — a round, or a course layout. */
  title: string
  holes: HoleDraft[]
  /** Sizes a blank card when there are no holes yet. */
  fallbackHoleCount?: number
  /** Distances matter for a course layout, not for a round's card. */
  showDistance?: boolean
  onSave: (holes: HoleDraft[]) => Promise<void>
  /** Omitted when there's no existing card to remove. */
  onClear?: () => Promise<void>
  clearLabel?: string
  onCancel: () => void
}

/**
 * Hole-by-hole par. While a card exists its total is the sum of these — the two
 * can't drift apart — so this is also how a par gets set precisely rather than
 * as a single number.
 */
export function HoleParEditor({
  title,
  holes,
  fallbackHoleCount = 18,
  showDistance = false,
  onSave,
  onClear,
  clearLabel = 'Remove hole pars',
  onCancel,
}: HoleParEditorProps) {
  const [drafts, setDrafts] = useState<HoleDraft[]>(() =>
    holes.length > 0
      ? holes
          .slice()
          .sort((a, b) => a.hole_number - b.hole_number)
          .map((h) => ({ ...h }))
      : defaultHoles(fallbackHoleCount),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const total = sumHolePars(drafts)
  const invalid = drafts.some((h) => h.par < 1 || h.par > 10)

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
          {title}
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
          Set a hole count to start the card, or cancel and set the total par
          directly.
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
              {showDistance ? (
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
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending || invalid || drafts.length === 0}
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
        {onClear && holes.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => void run(onClear)}
          >
            {clearLabel}
          </Button>
        ) : null}
      </div>
      {invalid ? (
        <FormMessage tone="error">
          Every hole needs a par between 1 and 10.
        </FormMessage>
      ) : null}
    </div>
  )
}
