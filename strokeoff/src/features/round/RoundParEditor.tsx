import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { Select } from '@/components/Select'
import { FormMessage } from '@/components/FormMessage'
import { HoleParEditor } from '@/features/courses/HoleParEditor'
import { useCourseLayouts, useDirectoryCourses } from '@/lib/courseDirectory'
import { useSetRoundPar } from '@/lib/endRound'
import {
  useClearRoundHolePars,
  useLoadRoundHolePars,
  useRoundHoles,
  useSetRoundHolePars,
} from '@/lib/roundPars'
import { errorMessage } from '@/lib/validation'
import type { Round } from '@/types'

/**
 * Par for THIS round — the total, or hole by hole. Any participant can change
 * it at any point, because par is something a group agrees on at the tee: a
 * basket has been moved short, hole 12 is playing as a 4 today. None of it
 * touches the shared course directory, which stays a reference list.
 *
 * While a hole card exists the total is the sum of it and can't be edited
 * directly — the two can never disagree.
 */
export function RoundParEditor({
  round,
}: {
  round: Pick<Round, 'id' | 'par' | 'course_name'>
}) {
  const { data: holes } = useRoundHoles(round.id)
  const [editingHoles, setEditingHoles] = useState(false)

  const hasCard = (holes?.length ?? 0) > 0

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-label text-sm font-semibold text-text">
          Course par
        </h2>
        <span className="font-numeral text-sm text-text">
          {round.par == null ? 'Not set' : round.par}
        </span>
      </div>

      {editingHoles ? (
        <div className="mt-3">
          <HoleCard
            round={round}
            holes={holes ?? []}
            onDone={() => setEditingHoles(false)}
          />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {hasCard ? (
            <HoleSummary holes={holes ?? []} />
          ) : (
            <TotalParField round={round} />
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingHoles(true)}
            >
              {hasCard ? 'Edit hole pars' : 'Set hole pars'}
            </Button>
            {!hasCard ? <LoadFromDirectory round={round} /> : null}
          </div>
        </div>
      )}
    </section>
  )
}

/* ----------------------------------------------------------------- total par */

function TotalParField({ round }: { round: Pick<Round, 'id' | 'par'> }) {
  const setPar = useSetRoundPar(round.id)
  const [value, setValue] = useState(round.par?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValue(round.par?.toString() ?? '')
  }, [round.par])

  function commit() {
    const trimmed = value.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    if (next !== null && (!Number.isInteger(next) || next < 0)) {
      setError('Enter a whole number for par.')
      return
    }
    setError(null)
    if (next === round.par) return
    setPar.mutate(next, { onError: (e) => setError(errorMessage(e)) })
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="round-par-total"
        className="font-label text-xs text-muted"
      >
        Total par for this round — set it to see each final as over/under par.
      </label>
      <TextInput
        id="round-par-total"
        className="w-28"
        inputMode="numeric"
        placeholder="e.g. 54"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        aria-label="Total course par"
      />
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  )
}

/* ---------------------------------------------------------------- hole cards */

function HoleSummary({
  holes,
}: {
  holes: { id: string; hole_number: number; par: number }[]
}) {
  const sorted = holes.slice().sort((a, b) => a.hole_number - b.hole_number)
  return (
    <div>
      <p className="font-label text-xs text-muted">
        Set hole by hole — {sorted.length} holes, total{' '}
        {sorted.reduce((n, h) => n + h.par, 0)}.
      </p>
      <ul className="mt-1 flex flex-wrap gap-1">
        {sorted.map((h) => (
          <li
            key={h.id}
            className="rounded border border-border px-1.5 py-0.5 font-numeral text-xs text-text"
          >
            <span className="text-muted">{h.hole_number}</span> {h.par}
          </li>
        ))}
      </ul>
    </div>
  )
}

function HoleCard({
  round,
  holes,
  onDone,
}: {
  round: Pick<Round, 'id'>
  holes: { hole_number: number; par: number }[]
  onDone: () => void
}) {
  const save = useSetRoundHolePars(round.id)
  const clear = useClearRoundHolePars(round.id)

  return (
    <HoleParEditor
      title="Par for this round"
      holes={holes.map((h) => ({
        hole_number: h.hole_number,
        par: h.par,
        distance_ft: null,
      }))}
      onSave={async (next) => {
        await save.mutateAsync(next)
        onDone()
      }}
      onClear={
        holes.length > 0
          ? async () => {
              await clear.mutateAsync()
              onDone()
            }
          : undefined
      }
      clearLabel="Back to a single total"
      onCancel={onDone}
    />
  )
}

/* ------------------------------------------------------ pull from the listing */

/**
 * Offers the directory's card for the course this round names. Matching is by
 * name — the same way round setup already finds a course's par.
 */
function LoadFromDirectory({
  round,
}: {
  round: Pick<Round, 'id' | 'course_name'>
}) {
  const { data: courses } = useDirectoryCourses()
  const match = useMemo(() => {
    const needle = round.course_name.trim().toLowerCase()
    if (!needle) return null
    return courses?.find((c) => c.name.toLowerCase() === needle) ?? null
  }, [courses, round.course_name])

  const { data: layouts } = useCourseLayouts(match?.id)
  const withHoles = (layouts ?? []).filter(
    (l) => l.hole_count != null && l.total_par != null,
  )

  const load = useLoadRoundHolePars(round.id)
  const [layoutId, setLayoutId] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!match || withHoles.length === 0) return null

  return (
    <div className="flex w-full flex-col gap-1">
      <span className="font-label text-xs text-muted">
        Or start from the listing for {match.name}:
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={layoutId}
          onChange={(e) => setLayoutId(e.target.value)}
          aria-label="Layout to copy hole pars from"
        >
          <option value="">Pick a layout</option>
          {withHoles.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.total_par ? ` — par ${l.total_par}` : ''}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          disabled={!layoutId || load.isPending}
          onClick={() => {
            setError(null)
            load.mutate(layoutId, {
              onError: (e) => setError(errorMessage(e)),
            })
          }}
        >
          {load.isPending ? 'Copying…' : 'Copy hole pars'}
        </Button>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  )
}
