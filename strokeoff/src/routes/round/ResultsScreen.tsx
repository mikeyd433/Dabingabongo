import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { useRoundPlayers } from '@/lib/rounds'
import { usePointEvents, useRoundRules } from '@/lib/scoring'
import { useSetRegularStrokes, useSetTiebreak } from '@/lib/endRound'
import { exportNodeToPng } from '@/lib/exportImage'
import {
  closestToTarget,
  computeResults,
  randomPick,
  type ResultRow,
} from '@/features/round/results'
import { errorMessage } from '@/lib/validation'
import type { PointEvent, Round, RoundPlayer, RoundRule } from '@/types'

/**
 * Phase 6 — end-of-round flow (spec §10). Enter regular scores, settle a tie if
 * the lowest adjusted final is shared, then show the results board and a swipeable
 * gallery of scorecards (full matrix + one per player), each exportable as a PNG.
 */
export function ResultsScreen({ round }: { round: Round }) {
  const { data: players = [] } = useRoundPlayers(round.id)
  const { data: events = [] } = usePointEvents(round.id)
  const { data: rules = [] } = useRoundRules(round.id)

  const results = useMemo(
    () =>
      computeResults(
        players,
        events,
        round.conversion_snapshot,
        round.tiebreak_winner_id,
      ),
    [players, events, round.conversion_snapshot, round.tiebreak_winner_id],
  )

  const needsTiebreak =
    results.finalsReady &&
    results.tiedForWin.length > 1 &&
    !round.tiebreak_winner_id

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-xl font-bold text-text">
          {round.course_name || 'Round'} — final
        </h1>
        <p className="font-label text-xs text-muted">
          {round.played_on} · Scoring locked
        </p>
      </div>

      <ScoreEntry roundId={round.id} players={results.rows} />

      {needsTiebreak ? (
        <TiebreakTool roundId={round.id} tied={results.tiedForWin} />
      ) : null}

      <ResultsBoard results={results} />

      {results.finalsReady ? (
        <ScorecardGallery
          round={round}
          rows={results.rows}
          events={events}
          rules={rules}
          winnerId={results.winner?.player.id}
        />
      ) : (
        <p className="rounded-card border border-border bg-surface-alt p-4 font-label text-xs text-muted">
          Enter every player's regular score to unlock final standings and
          shareable scorecards.
        </p>
      )}

      <EventLog events={events} players={players} />
    </div>
  )
}

function EventLog({
  events,
  players,
}: {
  events: PointEvent[]
  players: RoundPlayer[]
}) {
  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.display_name ?? 'Player'
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">Event log</h2>
      {events.length === 0 ? (
        <p className="mt-2 font-label text-xs text-muted">
          No points were logged.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {events.map((ev) => (
            <li
              key={ev.id}
              className={`flex justify-between font-label text-xs ${ev.voided ? 'text-muted line-through' : 'text-text'}`}
            >
              <span>
                {nameOf(ev.subject_player_id)} · {ev.rule_name_snapshot}
              </span>
              <span className="font-numeral text-muted">
                ×{ev.count} · +{ev.count * ev.points_snapshot}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ScoreEntry({
  roundId,
  players,
}: {
  roundId: string
  players: ResultRow[]
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">
        Regular scores
      </h2>
      <p className="mt-1 font-label text-xs text-muted">
        Enter each player's total strokes for the round.
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {players.map((row) => (
          <ScoreRow key={row.player.id} roundId={roundId} player={row.player} />
        ))}
      </ul>
    </section>
  )
}

function ScoreRow({
  roundId,
  player,
}: {
  roundId: string
  player: RoundPlayer
}) {
  const setStrokes = useSetRegularStrokes(roundId)
  const [value, setValue] = useState(player.regular_strokes?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  // Keep the field in sync when another device enters this player's score.
  useEffect(() => {
    setValue(player.regular_strokes?.toString() ?? '')
  }, [player.regular_strokes])

  function commit() {
    const trimmed = value.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    if (next !== null && (!Number.isInteger(next) || next < 0)) {
      setError('Enter a whole number of strokes.')
      return
    }
    if (next === player.regular_strokes) return
    setError(null)
    setStrokes.mutate(
      { playerId: player.id, strokes: next },
      { onError: (e) => setError(errorMessage(e)) },
    )
  }

  return (
    <li className="flex items-center justify-between gap-2">
      <span className="font-label text-sm text-text">
        {player.display_name}
        {player.is_guest ? (
          <span className="ml-1 font-label text-xs text-muted">Guest</span>
        ) : null}
      </span>
      <div className="w-24">
        <TextInput
          value={value}
          inputMode="numeric"
          placeholder="—"
          aria-label={`${player.display_name} total strokes`}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      </div>
    </li>
  )
}

function TiebreakTool({
  roundId,
  tied,
}: {
  roundId: string
  tied: ResultRow[]
}) {
  const setTiebreak = useSetTiebreak(roundId)
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [target, setTarget] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ids = tied.map((r) => r.player.id)
  const nameOf = (id: string) =>
    tied.find((r) => r.player.id === id)?.player.display_name ?? 'Player'

  function record(winnerId: string | null, method: string) {
    if (!winnerId) return
    setError(null)
    setTiebreak.mutate(
      { winnerId, method },
      { onError: (e) => setError(errorMessage(e)) },
    )
  }

  function numberPicker() {
    const t = Math.floor(Math.random() * 100) + 1
    setTarget(t)
    const entries = ids
      .map((id) => ({ playerId: id, value: Number(picks[id]) }))
      .filter((p) => Number.isFinite(p.value))
    if (entries.length !== ids.length) {
      setError('Every tied player needs to pick a number first.')
      return
    }
    record(closestToTarget(entries, t), 'number_picker')
  }

  return (
    <section className="rounded-card border border-accent bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">
        Tie for the win
      </h2>
      <p className="mt-1 font-label text-xs text-muted">
        {tied.map((r) => r.player.display_name).join(' & ')} share the lowest
        final. Pick a method to settle it.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {ids.length === 2 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={setTiebreak.isPending}
            onClick={() => record(randomPick(ids, Math.random()), 'coin_flip')}
          >
            Coin flip
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={setTiebreak.isPending}
          onClick={() => record(randomPick(ids, Math.random()), 'random_draw')}
        >
          Random draw
        </Button>
      </div>

      <div className="mt-4">
        <p className="font-label text-xs text-muted">
          Or each player picks a number (1–100); closest wins.
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          {ids.map((id) => (
            <li key={id} className="flex items-center justify-between gap-2">
              <span className="font-label text-sm text-text">{nameOf(id)}</span>
              <div className="w-24">
                <TextInput
                  value={picks[id] ?? ''}
                  inputMode="numeric"
                  placeholder="1–100"
                  aria-label={`${nameOf(id)} pick`}
                  onChange={(e) =>
                    setPicks((prev) => ({ ...prev, [id]: e.target.value }))
                  }
                />
              </div>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          className="mt-2"
          disabled={setTiebreak.isPending}
          onClick={numberPicker}
        >
          Reveal target & settle
        </Button>
        {target !== null ? (
          <p className="mt-2 font-numeral text-xs text-muted">
            Target was {target}.
          </p>
        ) : null}
      </div>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </section>
  )
}

function ResultsBoard({ results }: { results: ReturnType<typeof computeResults> }) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">
        {results.finalsReady ? 'Final standings' : 'Standings (in progress)'}
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {results.rows.map((row) => (
          <li
            key={row.player.id}
            className="flex items-center justify-between gap-2 rounded-card px-2 py-1.5"
            style={
              row.isWinner
                ? { backgroundColor: 'var(--color-surface-alt)' }
                : undefined
            }
          >
            <span className="flex items-center gap-2 font-label text-sm text-text">
              {row.rank !== null ? (
                <span className="w-5 font-numeral text-muted">{row.rank}</span>
              ) : null}
              <span>{row.player.display_name}</span>
              {row.isWinner ? (
                <span
                  className="font-label text-xs font-semibold"
                  style={{ color: 'var(--color-winner)' }}
                >
                  Winner{row.byTiebreak ? ' · by tie-break' : ''}
                </span>
              ) : null}
            </span>
            <span className="font-numeral text-xs text-muted">
              {row.points} pt · −{row.strokesOff} ·{' '}
              {row.regularStrokes ?? '—'} →{' '}
              <span className="text-base font-bold text-text">
                {row.adjusted ?? '—'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// --- Scorecards (swipeable gallery, each exportable) --------------------------

interface MatrixCell {
  count: number
}

function useMatrix(events: PointEvent[], rules: RoundRule[]) {
  return useMemo(() => {
    const displayFor = (event: PointEvent): string => {
      const rule = rules.find((r) => r.rule_id === event.rule_id)
      return (
        rule?.display_name_snapshot ||
        rule?.name_snapshot ||
        event.rule_name_snapshot
      )
    }
    const ruleOrder: { key: string; display: string }[] = []
    const seen = new Set<string>()
    const counts = new Map<string, MatrixCell>()
    for (const ev of events) {
      if (ev.voided) continue
      const key = ev.rule_id ?? `name:${ev.rule_name_snapshot}`
      if (!seen.has(key)) {
        seen.add(key)
        ruleOrder.push({ key, display: displayFor(ev) })
      }
      const cellKey = `${ev.subject_player_id}|${key}`
      const cell = counts.get(cellKey) ?? { count: 0 }
      cell.count += ev.count
      counts.set(cellKey, cell)
    }
    const countFor = (playerId: string, key: string) =>
      counts.get(`${playerId}|${key}`)?.count ?? 0
    return { ruleOrder, countFor }
  }, [events, rules])
}

function ScorecardGallery({
  round,
  rows,
  events,
  rules,
  winnerId,
}: {
  round: Round
  rows: ResultRow[]
  events: PointEvent[]
  rules: RoundRule[]
  winnerId: string | undefined
}) {
  const matrix = useMatrix(events, rules)

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-label text-sm font-semibold text-text">Scorecards</h2>
      <p className="font-label text-xs text-muted">
        Swipe between the full card and each player's. Export any as an image.
      </p>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
        <ExportCard filename={fileName(round, 'scorecard')}>
          <MatrixCard
            round={round}
            rows={rows}
            ruleOrder={matrix.ruleOrder}
            countFor={matrix.countFor}
            winnerId={winnerId}
          />
        </ExportCard>
        {rows.map((row) => (
          <ExportCard
            key={row.player.id}
            filename={fileName(round, row.player.display_name)}
          >
            <PlayerCard
              round={round}
              row={row}
              ruleOrder={matrix.ruleOrder}
              countFor={matrix.countFor}
            />
          </ExportCard>
        ))}
      </div>
    </section>
  )
}

function ExportCard({
  filename,
  children,
}: {
  filename: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function exportPng() {
    if (!ref.current) return
    setBusy(true)
    setError(null)
    try {
      await exportNodeToPng(ref.current, filename)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-[18rem] shrink-0 snap-start flex-col gap-2">
      <div ref={ref}>{children}</div>
      <Button
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={exportPng}
      >
        {busy ? 'Exporting…' : 'Export PNG'}
      </Button>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  )
}

function MatrixCard({
  round,
  rows,
  ruleOrder,
  countFor,
  winnerId,
}: {
  round: Round
  rows: ResultRow[]
  ruleOrder: { key: string; display: string }[]
  countFor: (playerId: string, key: string) => number
  winnerId: string | undefined
}) {
  const winStyle = (id: string) =>
    id === winnerId
      ? { backgroundColor: 'var(--color-surface-alt)' }
      : undefined
  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <p className="font-display text-sm font-bold text-text">
        {round.course_name || 'Round'}
      </p>
      <p className="font-label text-[10px] text-muted">{round.played_on}</p>
      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left font-label text-[10px] text-muted"> </th>
            {rows.map((row) => (
              <th
                key={row.player.id}
                className="px-1 text-center font-label text-[10px] text-text"
                style={winStyle(row.player.id)}
              >
                {row.player.display_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ruleOrder.map((rule) => (
            <tr key={rule.key} className="border-t border-border">
              <td className="py-0.5 font-label text-[10px] text-muted">
                {rule.display}
              </td>
              {rows.map((row) => {
                const c = countFor(row.player.id, rule.key)
                return (
                  <td
                    key={row.player.id}
                    className="px-1 text-center font-numeral text-[10px] text-text"
                    style={winStyle(row.player.id)}
                  >
                    {c > 0 ? `×${c}` : ''}
                  </td>
                )
              })}
            </tr>
          ))}
          <SummaryRow label="Points" rows={rows} winnerId={winnerId} pick={(r) => r.points} />
          <SummaryRow label="Off" rows={rows} winnerId={winnerId} pick={(r) => `−${r.strokesOff}`} />
          <SummaryRow label="Score" rows={rows} winnerId={winnerId} pick={(r) => r.regularStrokes ?? '—'} />
          <SummaryRow label="Final" rows={rows} winnerId={winnerId} pick={(r) => r.adjusted ?? '—'} bold />
        </tbody>
      </table>
    </div>
  )
}

function SummaryRow({
  label,
  rows,
  winnerId,
  pick,
  bold,
}: {
  label: string
  rows: ResultRow[]
  winnerId: string | undefined
  pick: (row: ResultRow) => string | number
  bold?: boolean
}) {
  return (
    <tr className="border-t border-border">
      <td className="py-0.5 font-label text-[10px] font-semibold text-muted">
        {label}
      </td>
      {rows.map((row) => (
        <td
          key={row.player.id}
          className={`px-1 text-center font-numeral text-[10px] ${bold ? 'font-bold text-text' : 'text-muted'}`}
          style={
            row.player.id === winnerId
              ? { backgroundColor: 'var(--color-surface-alt)' }
              : undefined
          }
        >
          {pick(row)}
        </td>
      ))}
    </tr>
  )
}

function PlayerCard({
  round,
  row,
  ruleOrder,
  countFor,
}: {
  round: Round
  row: ResultRow
  ruleOrder: { key: string; display: string }[]
  countFor: (playerId: string, key: string) => number
}) {
  const scored = ruleOrder
    .map((rule) => ({ ...rule, count: countFor(row.player.id, rule.key) }))
    .filter((r) => r.count > 0)
  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-bold text-text">
          {row.player.display_name}
        </p>
        {row.isWinner ? (
          <span
            className="font-label text-[10px] font-semibold"
            style={{ color: 'var(--color-winner)' }}
          >
            Winner{row.byTiebreak ? ' · tie-break' : ''}
          </span>
        ) : row.rank !== null ? (
          <span className="font-numeral text-[10px] text-muted">
            #{row.rank}
          </span>
        ) : null}
      </div>
      <p className="font-label text-[10px] text-muted">
        {round.course_name || 'Round'} · {round.played_on}
      </p>
      <ul className="mt-2 flex flex-col gap-0.5">
        {scored.length === 0 ? (
          <li className="font-label text-[10px] text-muted">No points scored.</li>
        ) : (
          scored.map((r) => (
            <li
              key={r.key}
              className="flex justify-between font-label text-[10px] text-text"
            >
              <span>{r.display}</span>
              <span className="font-numeral text-muted">×{r.count}</span>
            </li>
          ))
        )}
      </ul>
      <dl className="mt-2 border-t border-border pt-2 font-numeral text-[10px] text-text">
        <Line label="Points" value={row.points} />
        <Line label="Strokes off" value={`−${row.strokesOff}`} />
        <Line label="Regular" value={row.regularStrokes ?? '—'} />
        <Line label="Final" value={row.adjusted ?? '—'} bold />
      </dl>
    </div>
  )
}

function Line({
  label,
  value,
  bold,
}: {
  label: string
  value: string | number
  bold?: boolean
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={bold ? 'font-bold text-text' : 'text-text'}>{value}</dd>
    </div>
  )
}

function fileName(round: Round, label: string): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  return `${slug(round.course_name || 'round')}-${slug(label)}.png`
}
