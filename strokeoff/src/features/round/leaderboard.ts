import type { PointEvent, RoundPlayer } from '@/types'

/**
 * Live scoring is *derived from events*, never a stored counter (architecture
 * principle 4). These helpers are pure so the live leaderboard, the event feed,
 * and the Phase 6 end-of-round math all agree on one source of truth.
 */

/** Points a single event contributes: count × snapshotted value, voided = 0. */
export function eventValue(event: PointEvent): number {
  if (event.voided) return 0
  return event.count * event.points_snapshot
}

/**
 * Total side-game points per subject player id, summing live (non-voided) events.
 * Players with no events simply don't appear — callers default them to 0.
 */
export function tallyPoints(events: PointEvent[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const ev of events) {
    if (ev.voided) continue
    const prev = totals.get(ev.subject_player_id) ?? 0
    totals.set(ev.subject_player_id, prev + eventValue(ev))
  }
  return totals
}

export interface LeaderboardRow {
  player: RoundPlayer
  points: number
  /** 1-based rank; tied players share a rank (standard "1224" ranking). */
  rank: number
}

/**
 * Rank active roster players by points, highest first. Ties share a rank and are
 * ordered by join time then name for a stable display (the *real* tie-break that
 * decides a winner is Phase 6 — this is presentation only). Players who left the
 * round are excluded from the live board but keep their points for a rejoin.
 */
export function buildLeaderboard(
  players: RoundPlayer[],
  events: PointEvent[],
): LeaderboardRow[] {
  const totals = tallyPoints(events)

  const rows = players
    .filter((p) => p.roster_status === 'active')
    .map((player) => ({ player, points: totals.get(player.id) ?? 0 }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (a.player.joined_at !== b.player.joined_at) {
        return a.player.joined_at < b.player.joined_at ? -1 : 1
      }
      return a.player.display_name.localeCompare(b.player.display_name)
    })

  let lastPoints: number | null = null
  let lastRank = 0
  return rows.map((row, index) => {
    const rank = row.points === lastPoints ? lastRank : index + 1
    lastPoints = row.points
    lastRank = rank
    return { ...row, rank }
  })
}
