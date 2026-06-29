import type { Group, PersonSummary } from '@/types'

/**
 * Phase 11 — Community → People (Option B). Pure presentation helpers for the
 * people-you've-played-with list and a player's profile. No data fetching here so
 * the labels/derivations stay unit-testable; the IO lives in `lib/people.ts`.
 */

/** "1 round together" / "5 rounds together" — the shared-history subtitle. */
export function sharedRoundsLabel(count: number): string {
  const n = Math.max(0, Math.trunc(count))
  return n === 1 ? '1 round together' : `${n} rounds together`
}

/** "Last played 2026-06-20", or empty if never recorded. */
export function lastPlayedLabel(date: string | null): string {
  return date ? `Last played ${date}` : ''
}

/** Combined one-line summary for a person card (drops empty parts). */
export function personSubtitle(person: PersonSummary): string {
  return [sharedRoundsLabel(person.shared_rounds), lastPlayedLabel(person.last_played_on)]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Groups a player can be quick-added to: your groups they're not already in.
 * Membership is login-only, so an anonymous player gets an empty list (the UI
 * explains they need an account). `existingGroupIds` is the player's memberships
 * among *your* groups, when known — otherwise pass none and rely on the
 * idempotent RPC.
 */
export function addableGroups(
  person: PersonSummary,
  groups: Group[],
  existingGroupIds: ReadonlySet<string> = new Set(),
): Group[] {
  if (person.is_anonymous) return []
  return groups.filter((g) => !existingGroupIds.has(g.id))
}
