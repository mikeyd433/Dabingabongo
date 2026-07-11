import { useEffect, useMemo, useRef } from 'react'
import { celebrate } from '@/features/animations/celebrate'
import { showPointsPop } from '@/features/animations/pointsPop'
import { haptic } from '@/lib/haptics'
import type { PointEvent, RoundRule } from '@/types'

/**
 * A point that landed on *me*, awarded by someone else, that this device should
 * celebrate (multi-player / everyone rules — spec §6, §12). The logger's own
 * subject event is celebrated locally at log time, so it's excluded here.
 */
export interface AwardCelebration {
  eventId: string
  ruleId: string | null
  /** Points awarded by this event = count × points snapshot. */
  amount: number
}

/**
 * Pick the newly-arrived award events this device should celebrate.
 *
 * `seen` is mutated to remember every event id we've considered. The first pass
 * (`ready = false`) only *seeds* `seen` with the existing ledger and returns
 * nothing — so mounting into a round mid-play never replays its whole history.
 * After that, an event qualifies when it: is new, isn't voided, has *me* as its
 * subject, was logged by someone else, and belongs to a multi/everyone rule.
 */
export function collectNewAwards(
  events: PointEvent[],
  seen: Set<string>,
  ready: boolean,
  opts: {
    myPlayerId: string | undefined
    myUserId: string | undefined
    isMultiplayerRule: (ruleId: string | null) => boolean
  },
): AwardCelebration[] {
  if (!ready) {
    for (const e of events) seen.add(e.id)
    return []
  }

  const out: AwardCelebration[] = []
  for (const e of events) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    if (e.voided) continue
    if (!opts.myPlayerId || e.subject_player_id !== opts.myPlayerId) continue
    if (e.logged_by === opts.myUserId) continue
    if (!opts.isMultiplayerRule(e.rule_id)) continue
    out.push({
      eventId: e.id,
      ruleId: e.rule_id,
      amount: e.count * e.points_snapshot,
    })
  }
  return out
}

/**
 * Fire the rule's celebration + a "+N" pop on *my* device whenever another
 * player scores me on a multi-player or everyone rule — so everyone involved in
 * a shared point sees it land, not just the logger (who celebrates locally). The
 * round's Realtime channel keeps `events` fresh, so this runs as awards arrive.
 */
export function useAwardCelebrations(
  events: PointEvent[],
  myPlayerId: string | undefined,
  myUserId: string | undefined,
  rules: RoundRule[],
  animationsEnabled: boolean,
): void {
  const seen = useRef<Set<string>>(new Set())
  const ready = useRef(false)

  const ruleById = useMemo(() => {
    const m = new Map<string, RoundRule>()
    for (const r of rules) m.set(r.rule_id, r)
    return m
  }, [rules])

  useEffect(() => {
    const isMultiplayerRule = (ruleId: string | null) => {
      const rule = ruleId ? ruleById.get(ruleId) : undefined
      return rule?.player_scope === 'multi' || rule?.player_scope === 'everyone'
    }

    if (!ready.current) {
      collectNewAwards(events, seen.current, false, {
        myPlayerId,
        myUserId,
        isMultiplayerRule,
      })
      ready.current = true
      return
    }

    const awards = collectNewAwards(events, seen.current, true, {
      myPlayerId,
      myUserId,
      isMultiplayerRule,
    })
    for (const a of awards) {
      haptic('success')
      const rule = a.ruleId ? ruleById.get(a.ruleId) : undefined
      if (animationsEnabled && rule) celebrate(rule.animation_config)
      showPointsPop(a.amount)
    }
  }, [events, myPlayerId, myUserId, ruleById, animationsEnabled])
}
