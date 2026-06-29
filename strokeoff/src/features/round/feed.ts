import type { PointEvent } from '@/types'

/**
 * Live event feed grouping (spec §6). Logging is append-only — one point event
 * per tap (principle 6) — so the leaderboard and offline queue stay race-free.
 * The live feed, though, should read like a scorecard: repeated scoring of the
 * same rule for the same player **stacks** into one "Birdie ×3" row rather than a
 * separate row per tap. This pure helper does that aggregation for display only.
 */
export interface FeedGroup {
  key: string
  subjectId: string
  ruleName: string
  pointsSnapshot: number
  /** Sum of counts across this group's live events (matches the leaderboard). */
  count: number
  /** The most recent live event in the group — what the +/− controls act on. */
  latestId: string
  latestCount: number
  latestAt: string
  edited: boolean
}

/**
 * Aggregate live (non-voided) events by player + rule. Voided events are dropped
 * from the live feed (the full audit log lives on the results screen). Expects
 * `events` newest-first (as the ledger query returns them), so the first event
 * seen per key is the latest and group order reflects newest activity.
 */
export function groupLiveEvents(events: PointEvent[]): FeedGroup[] {
  const groups: FeedGroup[] = []
  const byKey = new Map<string, FeedGroup>()
  for (const ev of events) {
    if (ev.voided) continue
    const key = `${ev.subject_player_id}:${ev.rule_id ?? ev.rule_name_snapshot}`
    const existing = byKey.get(key)
    if (existing) {
      existing.count += ev.count
      existing.edited = existing.edited || Boolean(ev.edited_at)
    } else {
      const group: FeedGroup = {
        key,
        subjectId: ev.subject_player_id,
        ruleName: ev.rule_name_snapshot,
        pointsSnapshot: ev.points_snapshot,
        count: ev.count,
        latestId: ev.id,
        latestCount: ev.count,
        latestAt: ev.created_at,
        edited: Boolean(ev.edited_at),
      }
      byKey.set(key, group)
      groups.push(group)
    }
  }
  return groups
}
