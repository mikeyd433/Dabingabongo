import { describe, expect, it } from 'vitest'
import {
  addableGroups,
  lastPlayedLabel,
  personSubtitle,
  sharedRoundsLabel,
} from './people'
import type { Group, PersonSummary } from '@/types'

function person(overrides: Partial<PersonSummary> = {}): PersonSummary {
  return {
    profile_id: 'p1',
    display_name: 'Casey',
    avatar_url: null,
    custom_message: null,
    is_anonymous: false,
    shared_rounds: 3,
    last_played_on: '2026-06-20',
    ...overrides,
  }
}

function group(id: string, name: string): Group {
  return {
    id,
    name,
    owner_id: 'me',
    is_personal: false,
    default_conversion_id: null,
    default_theme_id: 'stat-sheet',
    created_at: '2026-01-01T00:00:00Z',
  } as Group
}

describe('sharedRoundsLabel', () => {
  it('singularizes one round', () => {
    expect(sharedRoundsLabel(1)).toBe('1 round together')
  })
  it('pluralizes otherwise', () => {
    expect(sharedRoundsLabel(0)).toBe('0 rounds together')
    expect(sharedRoundsLabel(4)).toBe('4 rounds together')
  })
})

describe('lastPlayedLabel', () => {
  it('formats a date and tolerates null', () => {
    expect(lastPlayedLabel('2026-06-20')).toBe('Last played 2026-06-20')
    expect(lastPlayedLabel(null)).toBe('')
  })
})

describe('personSubtitle', () => {
  it('joins shared rounds and last played', () => {
    expect(personSubtitle(person())).toBe(
      '3 rounds together · Last played 2026-06-20',
    )
  })
  it('drops the last-played part when unknown', () => {
    expect(personSubtitle(person({ last_played_on: null }))).toBe(
      '3 rounds together',
    )
  })
})

describe('addableGroups', () => {
  const groups = [group('g1', 'Weekend crew'), group('g2', 'Work league')]

  it('excludes groups the player is already in', () => {
    const result = addableGroups(person(), groups, new Set(['g1']))
    expect(result.map((g) => g.id)).toEqual(['g2'])
  })
  it('returns nothing for an anonymous player (login-only membership)', () => {
    expect(addableGroups(person({ is_anonymous: true }), groups)).toEqual([])
  })
  it('returns all groups when no memberships are known', () => {
    expect(addableGroups(person(), groups).map((g) => g.id)).toEqual([
      'g1',
      'g2',
    ])
  })
})
