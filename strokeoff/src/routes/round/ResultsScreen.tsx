import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { CoachMark } from '@/components/CoachMark'
import { useRoundPlayers } from '@/lib/rounds'
import { useAuth } from '@/lib/auth'
import { usePointEvents, useRoundRules } from '@/lib/scoring'
import {
  useRecordRoundFinish,
  useSetRegularStrokes,
  useSetRoundPar,
  useSetScoreConfirmed,
  useSetTiebreak,
} from '@/lib/endRound'
import { useSendClaimEmail } from '@/lib/claim'
import { exportNodeToPng } from '@/lib/exportImage'
import {
  closestToTarget,
  computeResults,
  formatToPar,
  randomPick,
  scoreConfirmation,
  type ResultRow,
  type ScoreConfirmation,
} from '@/features/round/results'
import { errorMessage } from '@/lib/validation'
import { useTheme, winnerTreatment, type WinnerTreatment } from '@/themes'
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

  const gate = useMemo(() => scoreConfirmation(players), [players])
  const { theme } = useTheme()
  const treatment = winnerTreatment(theme)

  const results = useMemo(
    () =>
      computeResults(
        players,
        events,
        round.conversion_snapshot,
        round.tiebreak_winner_id,
        round.par,
      ),
    [
      players,
      events,
      round.conversion_snapshot,
      round.tiebreak_winner_id,
      round.par,
    ],
  )

  const needsTiebreak =
    results.finalsReady &&
    results.tiedForWin.length > 1 &&
    !round.tiebreak_winner_id

  // Persist the finishes once finals are in and confirmed, so player history +
  // stats (spec §11) don't recompute. Idempotent + deterministic, so it writes
  // once and stops when the stored values already match (incl. after a tie-break).
  const recordFinish = useRecordRoundFinish(round.id)
  useEffect(() => {
    if (!gate.allConfirmed || !results.finalsReady || recordFinish.isPending) {
      return
    }
    const stale = results.rows.some(
      (r) =>
        r.player.final_rank !== r.rank ||
        r.player.is_winner !== r.isWinner ||
        r.player.final_adjusted !== r.adjusted,
    )
    if (!stale) return
    recordFinish.mutate(
      results.rows.map((r) => ({
        player_id: r.player.id,
        adjusted: r.adjusted,
        rank: r.rank,
        is_winner: r.isWinner,
      })),
    )
  }, [gate.allConfirmed, results, recordFinish])

  // End-of-round step 2 (spec §10): a dedicated enter-&-confirm-scores screen
  // sits before the final standings. In Multi Phone the finals stay locked until
  // every active player has confirmed their own regular score.
  if (!gate.allConfirmed) {
    return <ScoreConfirmScreen round={round} players={players} gate={gate} />
  }

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

      <ReopenScores round={round} players={players} />

      <ParEditor roundId={round.id} par={round.par} />

      {needsTiebreak ? (
        <TiebreakTool roundId={round.id} tied={results.tiedForWin} />
      ) : null}

      <ResultsBoard results={results} treatment={treatment} />

      {results.finalsReady ? (
        <ScorecardGallery
          round={round}
          rows={results.rows}
          events={events}
          rules={rules}
          winnerId={results.winner?.player.id}
          treatment={treatment}
        />
      ) : (
        <p className="rounded-card border border-border bg-surface-alt p-4 font-label text-xs text-muted">
          Enter every player's regular score to unlock final standings and
          shareable scorecards.
        </p>
      )}

      <GuestClaims rows={results.rows} />

      <EventLog events={events} players={players} />
    </div>
  )
}

/**
 * "Send email" for any guest (spec §10): emails them a one-time link to claim
 * their score onto their own account. A light consent confirm guards sending to
 * someone else's address.
 */
function GuestClaims({ rows }: { rows: ResultRow[] }) {
  const guests = rows.filter((r) => r.player.is_guest)
  if (guests.length === 0) return null
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">
        Claim a score
      </h2>
      <p className="mt-1 font-label text-xs text-muted">
        Email a guest a one-time link so they can keep their score on their own
        account.
      </p>
      <ul className="mt-2 flex flex-col gap-3">
        {guests.map((row) => (
          <ClaimRow key={row.player.id} playerId={row.player.id} name={row.player.display_name} />
        ))}
      </ul>
    </section>
  )
}

function ClaimRow({ playerId, name }: { playerId: string; name: string }) {
  const send = useSendClaimEmail()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (sent) {
    return (
      <li>
        <span className="font-label text-sm text-text">{name}</span>
        <FormMessage tone="success">Claim email sent to {email}.</FormMessage>
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-1">
      <span className="font-label text-sm text-text">{name}</span>
      <div className="flex gap-2">
        <TextInput
          type="email"
          inputMode="email"
          value={email}
          placeholder="guest@email.com"
          aria-label={`${name} email`}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={send.isPending || !email.includes('@')}
          onClick={() => {
            const ok = window.confirm(
              `Send ${name} a claim link at ${email.trim()}? This sends them one email.`,
            )
            if (!ok) return
            setError(null)
            send.mutate(
              { roundPlayerId: playerId, email: email.trim() },
              {
                onSuccess: () => setSent(true),
                onError: (e) => setError(errorMessage(e)),
              },
            )
          }}
        >
          {send.isPending ? 'Sending…' : 'Send email'}
        </Button>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </li>
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

/** Set or correct the course par so finals show as over/under par. */
function ParEditor({ roundId, par }: { roundId: string; par: number | null }) {
  const setPar = useSetRoundPar(roundId)
  const [value, setValue] = useState(par?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValue(par?.toString() ?? '')
  }, [par])

  function commit() {
    const trimmed = value.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    if (next !== null && (!Number.isInteger(next) || next < 0)) {
      setError('Enter a whole number for par.')
      return
    }
    if (next === par) return
    setError(null)
    setPar.mutate(next, { onError: (e) => setError(errorMessage(e)) })
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-label text-sm font-semibold text-text">
            Course par
          </h2>
          <p className="mt-1 font-label text-xs text-muted">
            Set it to see each final as over/under par.
          </p>
        </div>
        <div className="w-24">
          <TextInput
            value={value}
            inputMode="numeric"
            placeholder="—"
            aria-label="Course par"
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
        </div>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </section>
  )
}

/**
 * End-of-round step 2 (spec §10): enter & confirm regular scores before the final
 * standings. Each active player confirms their own score; in Multi Phone the
 * final screen waits until everyone has. In Single Phone the controller enters
 * everyone's and confirms in one tap. A confirmed score is locked until reopened.
 */
function ScoreConfirmScreen({
  round,
  players,
  gate,
}: {
  round: Round
  players: RoundPlayer[]
  gate: ScoreConfirmation
}) {
  const { user } = useAuth()
  const isController = round.created_by === user?.id
  const isSinglePhone = round.scoring_mode === 'single_phone'
  const singlePhoneController = isSinglePhone && isController
  const active = players.filter((p) => p.roster_status === 'active')

  // Who the caller may enter/confirm. Single Phone is controller-driven: the
  // controller manages everyone, spectators nothing. Multi Phone: your own slot,
  // plus any guest (guests have no device of their own). Mirrors migration 0012.
  const canManage = (p: RoundPlayer): boolean => {
    if (isSinglePhone) return singlePhoneController
    if (p.is_guest) return true
    return p.profile_id === user?.id
  }

  const intro = singlePhoneController
    ? "Enter everyone's total strokes, then confirm to see the final standings."
    : isSinglePhone
      ? 'The host is entering and confirming scores. Standings unlock once they do.'
      : 'Enter your total strokes and confirm. Final standings unlock once everyone confirms.'

  const waiting = active.filter((p) => !p.score_confirmed)

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="font-display text-xl font-bold text-text">
          {round.course_name || 'Round'} — scores
        </h1>
        <p className="font-label text-xs text-muted">
          {round.played_on} · Scoring locked
        </p>
      </div>

      {!singlePhoneController && !isSinglePhone ? (
        <CoachMark id="score-confirm">
          Enter your strokes and tap confirm. The final standings unlock once
          everyone has confirmed their score.
        </CoachMark>
      ) : null}

      <section className="rounded-card border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-label text-sm font-semibold text-text">
            Enter &amp; confirm scores
          </h2>
          <span className="font-numeral text-xs text-muted">
            {gate.confirmedCount}/{gate.total} confirmed
          </span>
        </div>
        <p className="mt-1 font-label text-xs text-muted">{intro}</p>

        <ul className="mt-3 flex flex-col gap-2">
          {active.map((player) =>
            singlePhoneController ? (
              <StrokeInputRow
                key={player.id}
                roundId={round.id}
                player={player}
              />
            ) : (
              <ConfirmRow
                key={player.id}
                roundId={round.id}
                player={player}
                canManage={canManage(player)}
              />
            ),
          )}
        </ul>

        {singlePhoneController ? (
          <ConfirmAllButton roundId={round.id} players={active} gate={gate} />
        ) : waiting.length > 0 ? (
          <p className="mt-3 font-label text-xs text-muted">
            Waiting on {waiting.map((p) => p.display_name).join(', ')}.
          </p>
        ) : null}
      </section>
    </div>
  )
}

/** One confirm button for Single Phone: confirm every player's score at once. */
function ConfirmAllButton({
  roundId,
  players,
  gate,
}: {
  roundId: string
  players: RoundPlayer[]
  gate: ScoreConfirmation
}) {
  const setConfirmed = useSetScoreConfirmed(roundId)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const ready = gate.missingScore.length === 0 && gate.total > 0

  async function confirmAll() {
    setError(null)
    setSubmitting(true)
    try {
      // Confirm every player together and await all of them. A single mutation
      // hook .mutate()'d in a loop only retains the last call's state, so one
      // player's failure could be silently clobbered by a later success.
      await Promise.all(
        players
          .filter((p) => !p.score_confirmed)
          .map((p) =>
            setConfirmed.mutateAsync({ playerId: p.id, confirmed: true }),
          ),
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3">
      <Button
        type="button"
        haptic="success"
        disabled={!ready || submitting}
        onClick={confirmAll}
      >
        Confirm scores &amp; view results
      </Button>
      {!ready ? (
        <p className="mt-1 font-label text-xs text-muted">
          Enter every player's score first.
        </p>
      ) : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  )
}

/** A bare strokes input (Single Phone controller fills these, confirms via the
 * single button below). Commits on blur / Enter, kept in sync across devices. */
function StrokeInputRow({
  roundId,
  player,
}: {
  roundId: string
  player: RoundPlayer
}) {
  const setStrokes = useSetRegularStrokes(roundId)
  const [value, setValue] = useState(player.regular_strokes?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

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

/**
 * A score row in the per-player confirm flow (Multi Phone, and Single Phone
 * spectators). If the caller manages this slot they can enter + confirm it, and
 * a confirmed score shows locked with an Edit (reopen) button; otherwise it's a
 * read-only live status (confirmed / waiting).
 */
function ConfirmRow({
  roundId,
  player,
  canManage,
}: {
  roundId: string
  player: RoundPlayer
  canManage: boolean
}) {
  const setStrokes = useSetRegularStrokes(roundId)
  const setConfirmed = useSetScoreConfirmed(roundId)
  const [value, setValue] = useState(player.regular_strokes?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setValue(player.regular_strokes?.toString() ?? '')
  }, [player.regular_strokes])

  const busy = setStrokes.isPending || setConfirmed.isPending

  function confirm() {
    const trimmed = value.trim()
    if (trimmed === '') {
      setError('Enter a score before confirming.')
      return
    }
    const next = Number(trimmed)
    if (!Number.isInteger(next) || next < 0) {
      setError('Enter a whole number of strokes.')
      return
    }
    setError(null)
    const doConfirm = () =>
      setConfirmed.mutate(
        { playerId: player.id, confirmed: true },
        { onError: (e) => setError(errorMessage(e)) },
      )
    // Persist a freshly typed value before locking it in.
    if (next !== player.regular_strokes) {
      setStrokes.mutate(
        { playerId: player.id, strokes: next },
        { onSuccess: doConfirm, onError: (e) => setError(errorMessage(e)) },
      )
    } else {
      doConfirm()
    }
  }

  function reopen() {
    setError(null)
    setConfirmed.mutate(
      { playerId: player.id, confirmed: false },
      { onError: (e) => setError(errorMessage(e)) },
    )
  }

  const name = (
    <span className="font-label text-sm text-text">
      {player.display_name}
      {player.is_guest ? (
        <span className="ml-1 font-label text-xs text-muted">Guest</span>
      ) : null}
    </span>
  )

  if (!canManage) {
    return (
      <li className="flex items-center justify-between gap-2">
        {name}
        <span className="font-label text-xs">
          {player.score_confirmed ? (
            <span style={{ color: 'var(--color-winner)' }}>
              Confirmed · {player.regular_strokes}
            </span>
          ) : player.regular_strokes != null ? (
            <span className="text-muted">Entered, not confirmed</span>
          ) : (
            <span className="text-muted">Waiting</span>
          )}
        </span>
      </li>
    )
  }

  if (player.score_confirmed) {
    return (
      <li className="flex items-center justify-between gap-2">
        {name}
        <span className="flex items-center gap-2">
          <span
            className="font-numeral text-sm font-bold"
            style={{ color: 'var(--color-winner)' }}
          >
            {player.regular_strokes} ✓
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={reopen}
          >
            Edit
          </Button>
        </span>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between gap-2">
      {name}
      <div className="flex items-start gap-2">
        <div className="w-20">
          <TextInput
            value={value}
            inputMode="numeric"
            placeholder="—"
            aria-label={`${player.display_name} total strokes`}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirm()
            }}
          />
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        </div>
        <Button type="button" haptic="success" disabled={busy} onClick={confirm}>
          Confirm
        </Button>
      </div>
    </li>
  )
}

/**
 * On the final screen, reopen the (locked) scores for correction — unconfirms the
 * slots the caller manages, which sends the round back to the confirm step. In
 * Multi Phone that's your own slot (everyone then waits on you again); the
 * single-phone controller reopens all.
 */
function ReopenScores({
  round,
  players,
}: {
  round: Round
  players: RoundPlayer[]
}) {
  const { user } = useAuth()
  const setConfirmed = useSetScoreConfirmed(round.id)
  const [submitting, setSubmitting] = useState(false)
  const isController = round.created_by === user?.id
  const singlePhoneController =
    round.scoring_mode === 'single_phone' && isController

  const mine = players.filter((p) => {
    if (p.roster_status !== 'active') return false
    if (singlePhoneController) return true
    return p.profile_id === user?.id
  })
  if (mine.length === 0) return null

  async function reopenAll() {
    setSubmitting(true)
    try {
      // Await all reopens together — looping .mutate() only tracks the last call.
      await Promise.all(
        mine.map((p) =>
          setConfirmed.mutateAsync({ playerId: p.id, confirmed: false }),
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-card border border-border bg-surface-alt px-4 py-2">
      <span className="font-label text-xs text-muted">Scores confirmed.</span>
      <Button
        type="button"
        variant="secondary"
        disabled={submitting}
        onClick={reopenAll}
      >
        Edit scores
      </Button>
    </div>
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

function ResultsBoard({
  results,
  treatment,
}: {
  results: ReturnType<typeof computeResults>
  treatment: WinnerTreatment
}) {
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
                  {treatment.emoji ? `${treatment.emoji} ` : ''}
                  {treatment.label}
                  {row.byTiebreak ? ' · by tie-break' : ''}
                </span>
              ) : null}
            </span>
            <span className="font-numeral text-xs text-muted">
              {row.points} pt · −{row.strokesOff} ·{' '}
              {row.regularStrokes ?? '—'} →{' '}
              <span className="text-base font-bold text-text">
                {row.adjusted ?? '—'}
              </span>
              {row.toPar != null ? (
                <span className="ml-1 font-semibold text-text">
                  ({formatToPar(row.toPar)})
                </span>
              ) : null}
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
  treatment,
}: {
  round: Round
  rows: ResultRow[]
  events: PointEvent[]
  rules: RoundRule[]
  winnerId: string | undefined
  treatment: WinnerTreatment
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
            treatment={treatment}
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
              treatment={treatment}
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
  treatment,
}: {
  round: Round
  rows: ResultRow[]
  ruleOrder: { key: string; display: string }[]
  countFor: (playerId: string, key: string) => number
  winnerId: string | undefined
  treatment: WinnerTreatment
}) {
  const winStyle = (id: string) =>
    id === winnerId
      ? { backgroundColor: 'var(--color-surface-alt)' }
      : undefined
  const winnerName = rows.find((r) => r.player.id === winnerId)?.player
    .display_name
  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <p className="font-display text-sm font-bold text-text">
        {round.course_name || 'Round'}
      </p>
      <p className="font-label text-[10px] text-muted">{round.played_on}</p>
      {winnerName ? (
        <p
          className="mt-0.5 font-label text-[10px] font-semibold"
          style={{ color: 'var(--color-winner)' }}
        >
          {treatment.emoji ? `${treatment.emoji} ` : ''}
          {treatment.label}: {winnerName}
        </p>
      ) : null}
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
          {round.par != null ? (
            <SummaryRow
              label="To par"
              rows={rows}
              winnerId={winnerId}
              pick={(r) => (r.toPar != null ? formatToPar(r.toPar) : '—')}
              bold
            />
          ) : null}
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
  treatment,
}: {
  round: Round
  row: ResultRow
  ruleOrder: { key: string; display: string }[]
  countFor: (playerId: string, key: string) => number
  treatment: WinnerTreatment
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
            {treatment.emoji ? `${treatment.emoji} ` : ''}
            {treatment.label}
            {row.byTiebreak ? ' · tie-break' : ''}
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
        {round.par != null ? (
          <Line
            label="To par"
            value={row.toPar != null ? formatToPar(row.toPar) : '—'}
            bold
          />
        ) : null}
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
