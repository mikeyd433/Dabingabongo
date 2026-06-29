import { strokesForPoints } from '@/features/conversion/convert'
import { tallyPoints } from './leaderboard'
import type { ConversionConfig } from '@/features/conversion/types'
import type { ConversionMode, PointEvent, RoundPlayer } from '@/types'

/**
 * End-of-round math (spec §8, §10). Pure so the results screen, scorecard export,
 * and tests share one definition: side-game points → strokes deducted (against
 * the round's *frozen* conversion snapshot) → adjusted final = regular − deduction.
 * Disc golf scores low, so the lowest adjusted final wins.
 */

export interface ResultRow {
  player: RoundPlayer
  points: number
  strokesOff: number
  regularStrokes: number | null
  /** regular − strokesOff; null until this player's regular score is entered. */
  adjusted: number | null
  /** adjusted − course par; null when par isn't set or the final isn't in yet. */
  toPar: number | null
  /** 1-based finishing rank (ties share); null until every player's score is in. */
  rank: number | null
  isWinner: boolean
  byTiebreak: boolean
}

export interface Results {
  rows: ResultRow[]
  /** Every active player has a regular score entered. */
  finalsReady: boolean
  /** Players sharing the lowest adjusted final — >1 means a tie-break is needed. */
  tiedForWin: ResultRow[]
  /** The resolved winner (sole leader, or the recorded tie-break winner). */
  winner: ResultRow | null
}

interface ConversionSnapshot {
  mode: ConversionMode
  config: ConversionConfig
}

/** Validate the round's `conversion_snapshot` jsonb into a typed shape. */
export function parseConversion(snapshot: unknown): ConversionSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const s = snapshot as Record<string, unknown>
  if (s.mode !== 'tier' && s.mode !== 'ratio') return null
  if (!s.config || typeof s.config !== 'object') return null
  return { mode: s.mode, config: s.config as ConversionConfig }
}

export function computeResults(
  players: RoundPlayer[],
  events: PointEvent[],
  conversionSnapshot: unknown,
  tiebreakWinnerId: string | null = null,
  par: number | null = null,
): Results {
  const totals = tallyPoints(events)
  const conv = parseConversion(conversionSnapshot)
  const active = players.filter((p) => p.roster_status === 'active')

  const rows: ResultRow[] = active.map((player) => {
    const points = totals.get(player.id) ?? 0
    const strokesOff = conv
      ? strokesForPoints(conv.mode, conv.config, points)
      : 0
    const regularStrokes = player.regular_strokes
    const adjusted =
      regularStrokes == null ? null : regularStrokes - strokesOff
    const toPar = adjusted == null || par == null ? null : adjusted - par
    return {
      player,
      points,
      strokesOff,
      regularStrokes,
      adjusted,
      toPar,
      rank: null,
      isWinner: false,
      byTiebreak: false,
    }
  })

  const finalsReady = rows.length > 0 && rows.every((r) => r.adjusted != null)

  if (!finalsReady) {
    // Preliminary view: order by side-game points, highest first.
    rows.sort((a, b) => b.points - a.points)
    return { rows, finalsReady, tiedForWin: [], winner: null }
  }

  // Lowest adjusted final wins; ties share a rank.
  rows.sort((a, b) => (a.adjusted! - b.adjusted!) || b.points - a.points)
  let lastAdjusted: number | null = null
  let lastRank = 0
  rows.forEach((row, index) => {
    const rank = row.adjusted === lastAdjusted ? lastRank : index + 1
    row.rank = rank
    lastAdjusted = row.adjusted
    lastRank = rank
  })

  const best = rows[0].adjusted
  const tiedForWin = rows.filter((r) => r.adjusted === best)

  let winner: ResultRow | null = null
  if (tiedForWin.length === 1) {
    winner = tiedForWin[0]
  } else if (tiebreakWinnerId) {
    winner = tiedForWin.find((r) => r.player.id === tiebreakWinnerId) ?? null
    if (winner) winner.byTiebreak = true
  }
  if (winner) winner.isWinner = true

  return { rows, finalsReady, tiedForWin, winner }
}

/**
 * The end-of-round confirmation gate (spec §10 step 2). Each active player enters
 * and confirms their own regular score; the final standings stay locked until all
 * have confirmed. Pure so the screen and tests share one definition; only active
 * (non-left) players gate, matching `computeResults`.
 */
export interface ScoreConfirmation {
  /** Active players still missing a regular score. */
  missingScore: RoundPlayer[]
  /** Active players with a score entered but not yet confirmed. */
  awaiting: RoundPlayer[]
  confirmedCount: number
  total: number
  /** Every active player has entered and confirmed their score. */
  allConfirmed: boolean
}

export function scoreConfirmation(players: RoundPlayer[]): ScoreConfirmation {
  const active = players.filter((p) => p.roster_status === 'active')
  const missingScore = active.filter((p) => p.regular_strokes == null)
  const awaiting = active.filter(
    (p) => p.regular_strokes != null && !p.score_confirmed,
  )
  const confirmedCount = active.filter((p) => p.score_confirmed).length
  return {
    missingScore,
    awaiting,
    confirmedCount,
    total: active.length,
    allConfirmed: active.length > 0 && active.every((p) => p.score_confirmed),
  }
}

/** Golf-style over/under-par label: 0 → "E", −2 → "−2", +3 → "+3". */
export function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E'
  // Use a real minus glyph for unders, matching the rest of the UI.
  return toPar > 0 ? `+${toPar}` : `−${Math.abs(toPar)}`
}

/** Number-picker tie-break: the pick closest to the target wins (ties → first). */
export function closestToTarget(
  picks: { playerId: string; value: number }[],
  target: number,
): string | null {
  let bestId: string | null = null
  let bestDist = Infinity
  for (const pick of picks) {
    const dist = Math.abs(pick.value - target)
    if (dist < bestDist) {
      bestDist = dist
      bestId = pick.playerId
    }
  }
  return bestId
}

/** Random tie-break (coin flip / draw). `rand` in [0,1) is injected for testing. */
export function randomPick(ids: string[], rand: number): string | null {
  if (ids.length === 0) return null
  const idx = Math.min(ids.length - 1, Math.floor(rand * ids.length))
  return ids[idx]
}
