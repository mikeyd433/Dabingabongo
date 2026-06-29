import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { useAuth } from '@/lib/auth'
import { useAddGuest, useRoundPlayers } from '@/lib/rounds'
import { useEndRound } from '@/lib/endRound'
import {
  useEditPointEvent,
  useLogPoint,
  useMyPendingConfirmations,
  useMyRoundPlayer,
  usePointEvents,
  useReassignGuest,
  useRespondToConfirmation,
  useRoundRules,
  useSetRosterStatus,
  useVoidPointEvent,
  type PendingConfirmation,
} from '@/lib/scoring'
import { buildLeaderboard } from '@/features/round/leaderboard'
import { groupLiveEvents, type FeedGroup } from '@/features/round/feed'
import { controllablePlayers } from '@/features/round/permissions'
import { celebrate } from '@/features/animations/celebrate'
import { haptic } from '@/lib/haptics'
import { errorMessage } from '@/lib/validation'
import type { PointEvent, Round, RoundPlayer, RoundRule } from '@/types'

/**
 * Phases 4–5 — Live scoring. Multi Phone: each player self-scores. Single Phone:
 * the controller scores for everyone (with a subject picker) and others are
 * read-only spectators. Guests work in both modes (managed by a player, with
 * reassignment). The leaderboard + feed derive from the point-event ledger;
 * what a caller may log/edit/undo mirrors the server permission check.
 */
export function LiveRoundScreen({ round }: { round: Round }) {
  const { user } = useAuth()
  const { data: players = [] } = useRoundPlayers(round.id)
  const { data: rules = [] } = useRoundRules(round.id)
  const { data: events = [] } = usePointEvents(round.id)
  const { data: me } = useMyRoundPlayer(round.id)
  const { data: pending = [] } = useMyPendingConfirmations(round.id, me?.id)

  const isController = round.created_by === user?.id
  const isSinglePhone = round.scoring_mode === 'single_phone'

  const controllable = useMemo(
    () =>
      controllablePlayers(players, user?.id, {
        mode: round.scoring_mode,
        isController,
      }),
    [players, user?.id, round.scoring_mode, isController],
  )
  const controllableIds = useMemo(
    () => new Set(controllable.map((p) => p.id)),
    [controllable],
  )

  const leaderboard = useMemo(
    () => buildLeaderboard(players, events),
    [players, events],
  )
  const playerName = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of players) map.set(p.id, p.display_name)
    return map
  }, [players])

  const hasLeft = me?.roster_status === 'left'
  const canScore = !hasLeft && controllable.length > 0
  const isSpectator = Boolean(me) && !hasLeft && isSinglePhone && !canScore

  return (
    <div className="flex flex-col gap-4 p-4">
      <Header round={round} me={me} />

      {pending.length > 0 ? (
        <ConfirmationPrompts
          roundId={round.id}
          pending={pending}
          playerName={playerName}
        />
      ) : null}

      {hasLeft ? <LeftBanner roundId={round.id} /> : null}

      {isSpectator ? (
        <p className="rounded-card border border-border bg-surface-alt p-4 font-label text-sm text-muted">
          Single phone — the host is scoring this round. You're watching live.
        </p>
      ) : null}

      <Leaderboard rows={leaderboard} meId={me?.id} />

      {canScore ? (
        <RulePalette
          roundId={round.id}
          subjects={controllable}
          players={players}
          rules={rules}
          animationsEnabled={round.animations_enabled}
        />
      ) : null}

      {canScore ? (
        <GuestManager
          roundId={round.id}
          players={players}
          userId={user?.id}
          canReassignAll={isSinglePhone && isController}
        />
      ) : null}

      <EventFeed
        roundId={round.id}
        events={events}
        playerName={playerName}
        controllableIds={controllableIds}
        canScore={canScore}
      />

      {me && !hasLeft ? <EndRoundControl roundId={round.id} /> : null}
    </div>
  )
}

/**
 * End the round — any participant can (spec §9), behind friction so it can't be a
 * mis-tap: tucked away, a confirm dialog, then a press-and-hold to commit.
 */
function EndRoundControl({ roundId }: { roundId: string }) {
  const end = useEndRound(roundId)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <div className="pt-2 text-center">
        <button
          type="button"
          className="font-label text-xs text-muted underline"
          onClick={() => setOpen(true)}
        >
          End round…
        </button>
      </div>
    )
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <p className="font-label text-sm text-text">
        End the round for everyone? This locks scoring.
      </p>
      <div className="mt-3 flex gap-2">
        <HoldToConfirm
          label={end.isPending ? 'Ending…' : 'Hold to end'}
          disabled={end.isPending}
          onConfirm={() =>
            end.mutate(undefined, { onError: (e) => setError(errorMessage(e)) })
          }
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </section>
  )
}

const HOLD_MS = 1000

function HoldToConfirm({
  label,
  disabled,
  onConfirm,
}: {
  label: string
  disabled: boolean
  onConfirm: () => void
}) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | null>(null)

  function clear() {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }
  function start(e: PointerEvent<HTMLButtonElement>) {
    if (disabled) return
    // Keep the gesture bound to this button: on touch devices a tiny finger
    // drift (pointerleave) or the browser starting a scroll (pointercancel)
    // would otherwise kill the hold before it completes.
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setHolding(true)
    timer.current = window.setTimeout(() => {
      setHolding(false)
      haptic('success') // the hold committed — confirm it in the hand
      onConfirm()
    }, HOLD_MS)
  }
  function cancel() {
    setHolding(false)
    clear()
  }
  useEffect(() => clear, [])

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      // touch-none = `touch-action: none`, so the browser won't hijack the hold
      // for scrolling/zoom; select-none stops the long-press text/callout menu.
      className="relative min-h-[44px] flex-1 touch-none select-none overflow-hidden rounded-card bg-accent px-5 font-label text-sm font-semibold text-accent-contrast disabled:opacity-50"
    >
      <span
        className="absolute inset-0 origin-left opacity-40"
        style={{
          backgroundColor: 'var(--color-winner)',
          transform: `scaleX(${holding ? 1 : 0})`,
          transition: holding ? `transform ${HOLD_MS}ms linear` : 'none',
        }}
      />
      <span className="relative">{label}</span>
    </button>
  )
}

function Header({
  round,
  me,
}: {
  round: Round
  me: RoundPlayer | null | undefined
}) {
  const leave = useSetRosterStatus(round.id)
  const hasLeft = me?.roster_status === 'left'
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-xl font-bold text-text">
          {round.course_name || 'Live round'}
        </h1>
        <p className="font-label text-xs text-muted">
          {round.played_on} ·{' '}
          {round.scoring_mode === 'single_phone' ? 'Single phone' : 'Multi phone'}{' '}
          · Code{' '}
          <span className="font-numeral tracking-widest text-accent">
            {round.code}
          </span>
        </p>
      </div>
      {me && !hasLeft ? (
        <button
          type="button"
          className="font-label text-xs text-muted underline disabled:opacity-50"
          disabled={leave.isPending}
          onClick={() => leave.mutate('left')}
        >
          Leave
        </button>
      ) : null}
    </div>
  )
}

function LeftBanner({ roundId }: { roundId: string }) {
  const rejoin = useSetRosterStatus(roundId)
  return (
    <section className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-alt p-4">
      <p className="font-label text-sm text-text">
        You've left this round. Your points are kept.
      </p>
      <Button
        type="button"
        variant="secondary"
        disabled={rejoin.isPending}
        onClick={() => rejoin.mutate('active')}
      >
        Rejoin
      </Button>
    </section>
  )
}

function Leaderboard({
  rows,
  meId,
}: {
  rows: ReturnType<typeof buildLeaderboard>
  meId: string | undefined
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">Leaderboard</h2>
      {rows.length === 0 ? (
        <p className="mt-2 font-label text-xs text-muted">No players yet.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1">
          {rows.map((row) => {
            const isMe = row.player.id === meId
            return (
              <li
                key={row.player.id}
                className="flex items-center justify-between gap-2 rounded-card px-2 py-1.5"
                style={
                  isMe
                    ? { backgroundColor: 'var(--color-surface-alt)' }
                    : undefined
                }
              >
                <span className="flex items-center gap-2 font-label text-sm text-text">
                  <span className="w-5 font-numeral text-muted">{row.rank}</span>
                  <span>{row.player.display_name}</span>
                  {row.player.is_guest ? (
                    <span className="font-label text-xs text-muted">Guest</span>
                  ) : null}
                </span>
                <span className="font-numeral text-base font-bold text-text">
                  {row.points}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function RulePalette({
  roundId,
  subjects,
  players,
  rules,
  animationsEnabled,
}: {
  roundId: string
  subjects: RoundPlayer[]
  players: RoundPlayer[]
  rules: RoundRule[]
  animationsEnabled: boolean
}) {
  const logPoint = useLogPoint(roundId)
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined)
  const [multiRule, setMultiRule] = useState<RoundRule | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep a valid subject even as the roster changes (guest added, player left).
  const subject = subjects.find((s) => s.id === subjectId) ?? subjects[0]
  const choosesSubject = subjects.length > 1

  // Mark a landed point: a success haptic (always, separate from the visual
  // toggle) plus the rule's celebration (spec §12) when animations are enabled.
  function celebrateFor(rule: RoundRule) {
    haptic('success')
    if (animationsEnabled) celebrate(rule.animation_config)
  }

  function logSingle(rule: RoundRule) {
    if (!subject) return
    setError(null)
    logPoint.mutate(
      { eventId: crypto.randomUUID(), subjectPlayerId: subject.id, rule },
      {
        onSuccess: () => celebrateFor(rule),
        onError: (e) => setError(errorMessage(e)),
      },
    )
  }

  if (rules.length === 0) {
    return (
      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="font-label text-sm font-semibold text-text">
          Log a point
        </h2>
        <p className="mt-2 font-label text-xs text-muted">
          No rules are active in this round.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">Log a point</h2>

      {choosesSubject ? (
        <label className="mt-2 flex items-center gap-2 font-label text-xs text-muted">
          Scoring for
          <Select
            value={subject?.id}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
                {s.is_guest ? ' (guest)' : ''}
              </option>
            ))}
          </Select>
        </label>
      ) : (
        <p className="mt-1 font-label text-xs text-muted">
          Tap a rule to score it for yourself.
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {rules.map((rule) => (
          <button
            key={rule.rule_id}
            type="button"
            disabled={logPoint.isPending}
            onClick={() =>
              rule.player_scope === 'multi'
                ? setMultiRule(rule)
                : logSingle(rule)
            }
            className="flex min-h-[44px] flex-col items-start rounded-card border border-border bg-surface-alt px-3 py-2 text-left transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <span className="font-label text-sm font-semibold text-text">
              {rule.name_snapshot}
            </span>
            <span className="font-numeral text-xs text-muted">
              +{rule.points_snapshot}
              {rule.player_scope === 'multi' ? ' · group' : ''}
            </span>
          </button>
        ))}
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {multiRule && subject ? (
        <MultiPlayerPicker
          rule={multiRule}
          subjectId={subject.id}
          subjectName={subject.display_name}
          players={players}
          pending={logPoint.isPending}
          onCancel={() => setMultiRule(null)}
          onConfirm={(involvedPlayerIds) => {
            setError(null)
            logPoint.mutate(
              {
                eventId: crypto.randomUUID(),
                subjectPlayerId: subject.id,
                rule: multiRule,
                involvedPlayerIds,
              },
              {
                onSuccess: () => {
                  setMultiRule(null)
                  celebrateFor(multiRule)
                },
                onError: (e) => setError(errorMessage(e)),
              },
            )
          }}
        />
      ) : null}
    </section>
  )
}

function MultiPlayerPicker({
  rule,
  subjectId,
  subjectName,
  players,
  pending,
  onCancel,
  onConfirm,
}: {
  rule: RoundRule
  subjectId: string
  subjectName: string
  players: RoundPlayer[]
  pending: boolean
  onCancel: () => void
  onConfirm: (involvedPlayerIds: string[]) => void
}) {
  const others = players.filter(
    (p) => p.id !== subjectId && p.roster_status === 'active',
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mt-3 rounded-card border border-border bg-surface-alt p-3">
      <p className="font-label text-sm font-semibold text-text">
        {rule.name_snapshot} — who else was involved with {subjectName}?
      </p>
      <p className="mt-1 font-label text-xs text-muted">
        Everyone selected also gets +{rule.points_snapshot}.
      </p>
      {others.length === 0 ? (
        <p className="mt-2 font-label text-xs text-muted">
          No other active players to involve.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {others.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-[44px] items-center gap-2 font-label text-sm text-text">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                {p.display_name}
                {p.is_guest ? (
                  <span className="font-label text-xs text-muted">Guest</span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          disabled={pending || selected.size === 0}
          onClick={() => onConfirm([...selected])}
        >
          {pending ? 'Logging…' : 'Log for all'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function GuestManager({
  roundId,
  players,
  userId,
  canReassignAll,
}: {
  roundId: string
  players: RoundPlayer[]
  userId: string | undefined
  canReassignAll: boolean
}) {
  const addGuest = useAddGuest(roundId)
  const reassign = useReassignGuest(roundId)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const guests = players.filter((p) => p.is_guest && p.roster_status === 'active')
  const managers = players.filter(
    (p) => !p.is_guest && p.roster_status === 'active' && p.profile_id,
  )

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">Guests</h2>
      <p className="mt-1 font-label text-xs text-muted">
        Add a player without a phone — you'll log points for them.
      </p>

      <div className="mt-2 flex gap-2">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Guest name"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={addGuest.isPending || name.trim().length === 0}
          onClick={() => {
            setError(null)
            addGuest.mutate(name.trim(), {
              onSuccess: () => setName(''),
              onError: (e) => setError(errorMessage(e)),
            })
          }}
        >
          Add
        </Button>
      </div>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {guests.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {guests.map((g) => {
            const canReassign = canReassignAll || g.managed_by === userId
            return (
              <li
                key={g.id}
                className="flex items-center justify-between gap-2 font-label text-sm text-text"
              >
                <span>{g.display_name}</span>
                {canReassign && managers.length > 0 ? (
                  <label className="flex items-center gap-1 font-label text-xs text-muted">
                    Managed by
                    <Select
                      value={g.managed_by ?? ''}
                      onChange={(e) =>
                        reassign.mutate({
                          guestId: g.id,
                          newManagerId: e.target.value,
                        })
                      }
                    >
                      {managers.map((m) => (
                        <option key={m.id} value={m.profile_id ?? ''}>
                          {m.display_name}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

function ConfirmationPrompts({
  roundId,
  pending,
  playerName,
}: {
  roundId: string
  pending: PendingConfirmation[]
  playerName: Map<string, string>
}) {
  const respond = useRespondToConfirmation(roundId)
  return (
    <section className="rounded-card border border-accent bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">
        Confirm points
      </h2>
      <ul className="mt-2 flex flex-col gap-3">
        {pending.map((c) => (
          <li key={c.event_id} className="flex flex-col gap-2">
            <p className="font-label text-sm text-text">
              {playerName.get(c.point_events.logged_by) ?? 'Someone'} logged{' '}
              <span className="font-semibold">
                {c.point_events.rule_name_snapshot}
              </span>{' '}
              (+{c.point_events.points_snapshot}) with you.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={respond.isPending}
                onClick={() =>
                  respond.mutate({ eventId: c.event_id, status: 'confirmed' })
                }
              >
                Confirm
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={respond.isPending}
                onClick={() =>
                  respond.mutate({ eventId: c.event_id, status: 'declined' })
                }
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function EventFeed({
  roundId,
  events,
  playerName,
  controllableIds,
  canScore,
}: {
  roundId: string
  events: PointEvent[]
  playerName: Map<string, string>
  controllableIds: Set<string>
  canScore: boolean
}) {
  const groups = useMemo(() => groupLiveEvents(events), [events])
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">Event feed</h2>
      {groups.length === 0 ? (
        <p className="mt-2 font-label text-xs text-muted">
          No points logged yet.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {groups.map((group) => (
            <FeedRow
              key={group.key}
              roundId={roundId}
              group={group}
              subjectName={playerName.get(group.subjectId) ?? 'Player'}
              // You manage points for any subject you control (spec §6): in Multi
              // Phone that's yourself + your guests; in Single Phone, everyone.
              canManage={canScore && controllableIds.has(group.subjectId)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function FeedRow({
  roundId,
  group,
  subjectName,
  canManage,
}: {
  roundId: string
  group: FeedGroup
  subjectName: string
  canManage: boolean
}) {
  const voidEvent = useVoidPointEvent(roundId)
  const editEvent = useEditPointEvent(roundId)
  const busy = editEvent.isPending || voidEvent.isPending

  const total = group.count * group.pointsSnapshot
  const time = new Date(group.latestAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  // +/− peel the stack via the group's latest event: a multi-event stack drops
  // one event at a time; a single edited-count event steps its count down.
  function removeOne() {
    if (group.latestCount > 1) {
      editEvent.mutate({ eventId: group.latestId, count: group.latestCount - 1 })
    } else {
      voidEvent.mutate({ eventId: group.latestId })
    }
  }

  return (
    <li className="flex items-center justify-between gap-2">
      <div>
        <p className="font-label text-sm text-text">
          <span className="font-semibold">{subjectName}</span> {group.ruleName}
        </p>
        <p className="font-numeral text-xs text-muted">
          ×{group.count} · +{total}
          {group.edited ? ' · edited' : ''} · {time}
        </p>
      </div>
      {canManage ? (
        <div className="flex shrink-0 items-center gap-1">
          <StepperButton label="−" disabled={busy} onClick={removeOne} />
          <StepperButton
            label="+"
            disabled={busy}
            onClick={() =>
              editEvent.mutate({
                eventId: group.latestId,
                count: group.latestCount + 1,
              })
            }
          />
        </div>
      ) : null}
    </li>
  )
}

function StepperButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-card border border-border bg-surface-alt font-numeral text-text disabled:opacity-50"
      aria-label={label === '−' ? 'Decrease count' : 'Increase count'}
    >
      {label}
    </button>
  )
}
