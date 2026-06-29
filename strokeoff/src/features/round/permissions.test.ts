import { describe, expect, it } from 'vitest'
import { controllablePlayers } from './permissions'
import type { RoundPlayer } from '@/types'

function player(partial: Partial<RoundPlayer> & { id: string }): RoundPlayer {
  return {
    round_id: 'r',
    profile_id: null,
    display_name: partial.id,
    is_guest: false,
    managed_by: null,
    roster_status: 'active',
    joined_at: '2026-06-29T00:00:00Z',
    regular_strokes: null,
    claim_token: null,
    claim_token_expires_at: null,
    claimed: false,
    ...partial,
  }
}

const me = player({ id: 'me', profile_id: 'u1' })
const other = player({ id: 'other', profile_id: 'u2' })
const myGuest = player({ id: 'g1', is_guest: true, managed_by: 'u1' })
const theirGuest = player({ id: 'g2', is_guest: true, managed_by: 'u2' })
const left = player({ id: 'gone', profile_id: 'u3', roster_status: 'left' })
const roster = [me, other, myGuest, theirGuest, left]

describe('controllablePlayers', () => {
  it('returns nobody when there is no user', () => {
    expect(
      controllablePlayers(roster, undefined, { mode: 'multi_phone', isController: false }),
    ).toEqual([])
  })

  it('Multi Phone: yourself and guests you manage only', () => {
    const ids = controllablePlayers(roster, 'u1', {
      mode: 'multi_phone',
      isController: false,
    }).map((p) => p.id)
    expect(ids).toEqual(['me', 'g1'])
  })

  it('Single Phone controller: everyone active (excludes players who left)', () => {
    const ids = controllablePlayers(roster, 'u1', {
      mode: 'single_phone',
      isController: true,
    }).map((p) => p.id)
    expect(ids).toEqual(['me', 'other', 'g1', 'g2'])
    expect(ids).not.toContain('gone')
  })

  it('Single Phone spectator: only own/managed, never other players', () => {
    const ids = controllablePlayers(roster, 'u2', {
      mode: 'single_phone',
      isController: false,
    }).map((p) => p.id)
    expect(ids).toEqual(['other', 'g2'])
  })
})
