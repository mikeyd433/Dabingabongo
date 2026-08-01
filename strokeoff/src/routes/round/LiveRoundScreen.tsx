import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { TextInput } from '@/components/TextInput'
import { FormMessage } from '@/components/FormMessage'
import { Avatar } from '@/components/Avatar'
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
import { RoundRulesManager } from '@/features/round/RoundRulesManager'
import { RoundParEditor } from '@/features/round/RoundParEditor'
import { buildLeaderboard } from '@/features/round/leaderboard'
import { groupLiveEvents, type FeedGroup } from '@/features/round/feed'
import { controllablePlayers } from '@/features/round/permissions'
import { parseConversion } from '@/features/round/results'
import { strokesForPoints } from '@/features/conversion/convert'
import { celebrate } from '@/features/animations/celebrate'
import { PointsPop } from '@/features/animations/PointsPop'
import { showPointsPop } from '@/features/animations/pointsPop'
import { useAwardCelebrations } from '@/features/round/awardCelebrations'
import { CoachMark } from '@/components/CoachMark'
import { haptic } from '@/lib/haptics'
import { errorMessage } from '@/lib/validation'
import type { PointEvent, Round, RoundPlayer, RoundRule } from '@/types'

/**
 * Phases 4–5 — Live scoring. Multi Phone: each player self-scores. Single Phone:
 * the controller scores for everyone (with a subject picker) and others are
 * read-only spectators. Guests work in both modes (managed by a player, with
 * reassignment). The leaderboard + feed derive from the point-event ledger;
 * what a caller may log/edit/undo mirrors the server permission check.
 *
 * A rule scores its subject (`single`), the subject plus hand-picked players
 * (`multi`), or every active player at once (`everyone`); a scalable rule prompts
 * for a quantity that multiplies its points (e.g. one point per tree bounce).
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

  // Live preview of how each player's points currently convert to strokes off
  // (spec §8) — against the round's frozen conversion snapshot.
  const conversion = useMemo(
    () => parseConversion(round.conversion_snapshot),
    [round.conversion_snapshot],
  )
  const strokesOffFor = (points: number) =>
    conversion ? strokesForPoints(conversion.mode, conversion.config, points) : 0

  const playerName = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of players) map.set(p.id, p.display_name)
    return map
  }, [players])
  const playerAvatar = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const p of players) map.set(p.id, p.avatar_url)
    return map
  }, [players])

  const hasLeft = me?.roster_status === 'left'
  const canScore = !hasLeft && controllable.length > 0
  const isSpectator = Boolean(me) && !hasLeft && isSinglePhone && !canScore

  // Celebrate on my device when another player scores me on a shared (multi /
  // everyone) rule — the logger already celebrates locally (spec §6, §12).
  useAwardCelebrations(events, me?.id, user?.id, rules, round.animations_enabled)

  return (
    <div className="flex flex-col gap-4 p-4">
      <PointsPop />
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

      <Leaderboard rows={leaderboard} meId={me?.id} strokesOffFor={strokesOffFor} />

      {canScore ? (
        <CoachMark id="live-scoring">
          Tap a rule to log a point. Totals convert to stroke deductions when the
          round ends — lowest adjusted score wins.
        </CoachMark>
      ) : null}

      {canScore ? (
        <RulePalette
          roundId={round.id}
          subjects={controllable}
          players={players}
          rules={rules}
          events={events}
          animationsEnabled={round.animations_enabled}
        />
      ) : null}

      {/* Host can add/change active rules mid-round (spec §7); others see them
          read-only. Shown to spectators too, so it isn't gated behind canScore. */}
      <RoundParEditor round={round} />
      <RoundRulesManager round={round} isHost={isController} />

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
        playerAvatar={playerAvatar}
        controllableIds={controllableIds}
        canScore={canScore}
      />

      {me && !hasLeft ? <EndRoundControl roundId={round.id} /> : null}
    </div>
  )
}

/**
 * FLIP animation for a keyed list: when rows reorder (a player overtakes
 * another), each row slides from its old position to its new one instead of
 * snapping (spec §13 polish). Pure DOM transforms — no animation library.
 */
function useFlipList() {
  const refs = useRef(new Map<string, HTMLElement>())
  const prevRects = useRef(new Map<string, DOMRect>())

  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>()
    refs.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect()
      next.set(id, rect)
      const prev = prevRects.current.get(id)
      if (prev) {
        const dy = prev.top - rect.top
        if (dy) {
          el.style.transform = `translateY(${dy}px)`
          el.style.transition = 'transform 0s'
          requestAnimationFrame(() => {
            el.style.transform = ''
            el.style.transition = 'transform 250ms ease'
          })
        }
      }
    })
    prevRects.current = next
  })

  return (id: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(id, el)
    else refs.current.delete(id)
  }
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
          className="inline-flex min-h-[44px] items-center px-4 font-label text-xs text-muted underline"
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
          className="inline-flex min-h-[44px] items-center px-2 font-label text-xs text-muted underline disabled:opacity-50"
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
  strokesOffFor,
}: {
  rows: ReturnType<typeof buildLeaderboard>
  meId: string | undefined
  strokesOffFor: (points: number) => number
}) {
  const setRef = useFlipList()
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-label text-sm font-semibold text-text">Leaderboard</h2>
      {rows.length === 0 ? (
        <p className="mt-2 font-label text-xs text-muted">No players yet.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1">
          {rows.map((row) => {
            const isMe = row.player.id === meId
            const off = strokesOffFor(row.points)
            return (
              <li
                key={row.player.id}
                ref={setRef(row.player.id)}
                className="flex items-center justify-between gap-2 rounded-card px-2 py-1.5"
                style={
                  isMe
                    ? { backgroundColor: 'var(--color-surface-alt)' }
                    : undefined
                }
              >
                <span className="flex min-w-0 items-center gap-2 font-label text-sm text-text">
                  <span className="w-5 shrink-0 font-numeral text-muted">
                    {row.rank}
                  </span>
                  <Avatar
                    name={row.player.display_name}
                    url={row.player.avatar_url}
                    sizeClass="h-7 w-7 text-sm"
                  />
                  <span className="truncate">{row.player.display_name}</span>
                  {row.player.is_guest ? (
                    <span className="shrink-0 font-label text-xs text-muted">
                      Guest
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {off > 0 ? (
                    <span className="font-numeral text-xs text-muted">
                      −{off} off
                    </span>
                  ) : null}
                  <span className="font-numeral text-base font-bold text-text">
                    {row.points}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/** A live log entry the user can immediately undo (spec §6, mis-tap recovery). */
interface UndoEntry {
  id: string
  label: string
}

function RulePalette({
  roundId,
  subjects,
  players,
  rules,
  events,
  animationsEnabled,
}: {
  roundId: string
  subjects: RoundPlayer[]
  players: RoundPlayer[]
  rules: RoundRule[]
  events: PointEvent[]
  animationsEnabled: boolean
}) {
  const logPoint = useLogPoint(roundId)
  const voidEvent = useVoidPointEvent(roundId)
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined)
  const [modalRule, setModalRule] = useState<RoundRule | null>(null)
  const [infoRule, setInfoRule] = useState<RoundRule | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [undo, setUndo] = useState<UndoEntry | null>(null)
  const undoTimer = useRef<number | null>(null)

  // Keep a valid subject even as the roster changes (guest added, player left).
  const subject = subjects.find((s) => s.id === subjectId) ?? subjects[0]
  const choosesSubject = subjects.length > 1

  // Per-rule running tally for the current subject (#3) — the count already on
  // the board, shown on each rule so the scorer sees state without the feed.
  const subjectCounts = useMemo(() => {
    const m = new Map<string, number>()
    if (!subject) return m
    for (const ev of events) {
      if (ev.voided || !ev.rule_id) continue
      if (ev.subject_player_id !== subject.id) continue
      m.set(ev.rule_id, (m.get(ev.rule_id) ?? 0) + ev.count)
    }
    return m
  }, [events, subject])

  // Searchable rule menu (matches name + description) so a long palette stays
  // usable mid-round without scrolling past everything.
  const visibleRules = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rules
    return rules.filter((r) =>
      `${r.name_snapshot} ${r.display_name_snapshot ?? ''} ${
        r.description_snapshot ?? ''
      }`
        .toLowerCase()
        .includes(q),
    )
  }, [rules, search])

  useEffect(
    () => () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current)
    },
    [],
  )

  // Mark a landed point: a success haptic (always, separate from the visual
  // toggle) plus the rule's celebration (spec §12) when animations are enabled.
  function celebrateFor(rule: RoundRule) {
    haptic('success')
    if (animationsEnabled) celebrate(rule.animation_config)
  }

  // Offer a brief undo, but only for single-subject logs — reversing a
  // multi/everyone award would leave the others' points dangling, so those
  // stay on the feed's +/− controls instead.
  function offerUndo(rule: RoundRule, eventId: string, count: number) {
    if (rule.player_scope !== 'single') return
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    setUndo({
      id: eventId,
      label: `${rule.name_snapshot} +${count * rule.points_snapshot}`,
    })
    undoTimer.current = window.setTimeout(() => setUndo(null), 5000)
  }

  function doUndo() {
    if (!undo) return
    voidEvent.mutate({ eventId: undo.id })
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    setUndo(null)
  }

  function log(rule: RoundRule, count: number, involvedPlayerIds?: string[]) {
    if (!subject) return
    setError(null)
    const eventId = crypto.randomUUID()
    logPoint.mutate(
      { eventId, subjectPlayerId: subject.id, rule, count, involvedPlayerIds },
      {
        onSuccess: () => {
          setModalRule(null)
          celebrateFor(rule)
          // Show how many points just landed for the subject I scored (spec §12).
          // Co-players on multi/everyone rules get their own "+N" via Realtime.
          showPointsPop(count * rule.points_snapshot)
          offerUndo(rule, eventId, count)
        },
        onError: (e) => setError(errorMessage(e)),
      },
    )
  }

  function onTapRule(rule: RoundRule) {
    // A modal is only needed to collect a quantity (scalable) or pick the other
    // players (multi). Single + everyone log straight away.
    if (rule.is_scalable || rule.player_scope === 'multi') {
      setModalRule(rule)
      return
    }
    log(rule, 1)
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

      <div className="mt-2">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rules"
          aria-label="Search rules"
        />
      </div>

      {visibleRules.length === 0 ? (
        <p className="mt-3 font-label text-xs text-muted">
          No rules match your search.
        </p>
      ) : (
        // A capped, scrolling menu so a long palette doesn't fill the screen.
        <div className="mt-2 max-h-72 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {visibleRules.map((rule) => {
              const scored = subjectCounts.get(rule.rule_id) ?? 0
              return (
                <div key={rule.rule_id} className="relative">
                  <button
                    type="button"
                    disabled={logPoint.isPending}
                    onClick={() => onTapRule(rule)}
                    className="flex min-h-[44px] w-full flex-col items-start rounded-card border border-border bg-surface-alt py-2 pl-3 pr-9 text-left transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <span className="font-label text-sm font-semibold text-text">
                      {rule.name_snapshot}
                    </span>
                    <span className="font-numeral text-xs text-muted">
                      +{rule.points_snapshot}
                      {rule.is_scalable
                        ? `/${rule.quantity_label || 'unit'}`
                        : ''}
                      {rule.player_scope === 'everyone'
                        ? ' · everyone'
                        : rule.player_scope === 'multi'
                          ? ' · group'
                          : ''}
                      {scored > 0 ? ` · ×${scored}` : ''}
                    </span>
                  </button>
                  {rule.description_snapshot ? (
                    <button
                      type="button"
                      onClick={() => setInfoRule(rule)}
                      aria-label={`About ${rule.name_snapshot}`}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface font-display text-xs font-bold italic text-muted"
                    >
                      i
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {infoRule ? (
        <RuleInfo rule={infoRule} onClose={() => setInfoRule(null)} />
      ) : null}

      {modalRule && subject ? (
        <LogModal
          rule={modalRule}
          subject={subject}
          players={players}
          pending={logPoint.isPending}
          onCancel={() => setModalRule(null)}
          onConfirm={({ count, involvedPlayerIds }) =>
            log(modalRule, count, involvedPlayerIds)
          }
        />
      ) : null}

      {undo ? (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4">
          <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-2 shadow-lg">
            <span className="font-label text-sm text-text">
              Logged {undo.label}
            </span>
            <button
              type="button"
              className="min-h-[44px] font-label text-sm font-semibold text-accent underline"
              onClick={doUndo}
            >
              Undo
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/** Read-only detail for a rule mid-round: its meta and full description. */
function RuleInfo({ rule, onClose }: { rule: RoundRule; onClose: () => void }) {
  const scope =
    rule.player_scope === 'everyone'
      ? 'Everyone in the round'
      : rule.player_scope === 'multi'
        ? 'Multi-player'
        : 'Single player'
  return (
    <div className="mt-3 rounded-card border border-border bg-surface-alt p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-label text-sm font-semibold text-text">
          {rule.name_snapshot}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] shrink-0 px-2 font-label text-xs text-muted underline"
        >
          Close
        </button>
      </div>
      <p className="mt-1 font-numeral text-xs text-muted">
        +{rule.points_snapshot}
        {rule.is_scalable ? ` per ${rule.quantity_label || 'unit'}` : ''} ·{' '}
        {scope} ·{' '}
        {rule.is_repeatable ? 'Repeatable' : 'Once per round'}
      </p>
      {rule.description_snapshot ? (
        <p className="mt-2 font-label text-sm text-text">
          {rule.description_snapshot}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Collects whatever a rule needs before logging: a quantity for a scalable rule
 * (its points multiply by this), and/or the other involved players for a
 * multi-player rule. Single non-scalable + everyone rules never open this.
 */
function LogModal({
  rule,
  subject,
  players,
  pending,
  onCancel,
  onConfirm,
}: {
  rule: RoundRule
  subject: RoundPlayer
  players: RoundPlayer[]
  pending: boolean
  onCancel: () => void
  onConfirm: (input: { count: number; involvedPlayerIds?: string[] }) => void
}) {
  const isMulti = rule.player_scope === 'multi'
  const others = players.filter(
    (p) => p.id !== subject.id && p.roster_status === 'active',
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [qty, setQty] = useState('1')

  const unit = rule.quantity_label || 'points'
  const count = rule.is_scalable ? Number(qty) : 1
  const qtyValid = Number.isInteger(count) && count >= 1
  const canConfirm =
    qtyValid && (!isMulti || selected.size > 0) && !pending

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
        {rule.name_snapshot}
        {isMulti ? ` — who else was involved with ${subject.display_name}?` : ''}
      </p>

      {rule.is_scalable ? (
        <div className="mt-2">
          <label className="font-label text-xs text-muted" htmlFor="log-qty">
            How many {unit}? Each is +{rule.points_snapshot}.
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Stepper
              label="−"
              onClick={() =>
                setQty((q) => String(Math.max(1, (Number(q) || 1) - 1)))
              }
            />
            <div className="w-20">
              <TextInput
                id="log-qty"
                value={qty}
                inputMode="numeric"
                aria-label={`How many ${unit}`}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <Stepper
              label="+"
              onClick={() => setQty((q) => String((Number(q) || 0) + 1))}
            />
            {qtyValid ? (
              <span className="font-numeral text-xs text-muted">
                = +{count * rule.points_snapshot}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {isMulti ? (
        <div className="mt-3">
          <p className="font-label text-xs text-muted">
            Everyone selected also gets the same.
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
                      <span className="font-label text-xs text-muted">
                        Guest
                      </span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          disabled={!canConfirm}
          onClick={() =>
            onConfirm({
              count,
              involvedPlayerIds: isMulti ? [...selected] : undefined,
            })
          }
        >
          {pending ? 'Logging…' : isMulti ? 'Log for all' : 'Log'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function Stepper({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label === '−' ? 'Decrease' : 'Increase'}
      className="flex h-11 w-11 items-center justify-center rounded-card border border-border bg-surface font-numeral text-text"
    >
      {label}
    </button>
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
  playerAvatar,
  controllableIds,
  canScore,
}: {
  roundId: string
  events: PointEvent[]
  playerName: Map<string, string>
  playerAvatar: Map<string, string | null>
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
              subjectAvatar={playerAvatar.get(group.subjectId) ?? null}
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
  subjectAvatar,
  canManage,
}: {
  roundId: string
  group: FeedGroup
  subjectName: string
  subjectAvatar: string | null
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
      <div className="flex min-w-0 items-center gap-2">
        <Avatar name={subjectName} url={subjectAvatar} sizeClass="h-7 w-7 text-sm" />
        <div className="min-w-0">
          <p className="truncate font-label text-sm text-text">
            <span className="font-semibold">{subjectName}</span> {group.ruleName}
          </p>
          <p className="font-numeral text-xs text-muted">
            ×{group.count} · +{total}
            {group.edited ? ' · edited' : ''} · {time}
          </p>
        </div>
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
