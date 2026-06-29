import type { Round } from '@/types'

/**
 * Picks the round to drop a returning player into: the most recently created
 * round that's still joinable (lobby or active). Pure for testability.
 */
export function selectCurrentRound(
  rounds: (Round | null | undefined)[],
): Round | null {
  const joinable = rounds
    .filter((r): r is Round => Boolean(r))
    .filter((r) => r.status === 'lobby' || r.status === 'active')
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  return joinable[0] ?? null
}
