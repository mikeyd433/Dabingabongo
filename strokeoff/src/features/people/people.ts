import type { Group, PersonSummary, Round } from '@/types'

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

/** A few light stats for a player's profile, derived from the rounds you can see. */
export interface PlayerStats {
  visibleRounds: number
  multiPhone: number
  singlePhone: number
  lastPlayedOn: string | null
}

export function playerStats(rounds: Round[]): PlayerStats {
  let multiPhone = 0
  let singlePhone = 0
  let lastPlayedOn: string | null = null
  for (const r of rounds) {
    if (r.scoring_mode === 'single_phone') singlePhone += 1
    else multiPhone += 1
    if (r.played_on && (!lastPlayedOn || r.played_on > lastPlayedOn)) {
      lastPlayedOn = r.played_on
    }
  }
  return { visibleRounds: rounds.length, multiPhone, singlePhone, lastPlayedOn }
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
