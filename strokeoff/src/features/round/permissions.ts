import type { RoundPlayer, ScoringMode } from '@/types'

export interface ScoringContext {
  mode: ScoringMode
  /** Caller is the round's controller (the creator), relevant in Single Phone. */
  isController: boolean
}

/**
 * The active roster players a caller may log/edit/void points for — the client
 * mirror of the server's `controls_round_player` check (principle 5):
 *
 * - **Multi Phone:** yourself, plus any guests you manage.
 * - **Single Phone:** the controller controls everyone; a spectator controls no
 *   one (read-only) beyond a guest they happen to manage.
 *
 * Players who have left are never controllable until they rejoin.
 */
export function controllablePlayers(
  players: RoundPlayer[],
  userId: string | undefined,
  ctx: ScoringContext,
): RoundPlayer[] {
  if (!userId) return []
  return players.filter((p) => {
    if (p.roster_status !== 'active') return false
    if (ctx.mode === 'single_phone' && ctx.isController) return true
    return p.profile_id === userId || p.managed_by === userId
  })
}
