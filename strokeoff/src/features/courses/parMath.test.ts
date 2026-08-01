import { describe, expect, it } from 'vitest'
import {
  defaultHoles,
  deriveCoursePar,
  formatPar,
  formatParRange,
  relativeToPar,
  sumHolePars,
  usableLayouts,
} from './parMath'
import type { CourseLayout, DirectoryCourse, LayoutStatus } from '@/types'

function layout(
  name: string,
  total_par: number | null,
  hole_count: number | null = 18,
  status: LayoutStatus = 'ok',
): CourseLayout {
  return {
    id: name,
    course_id: 'c',
    name,
    hole_count,
    total_par,
    length_ft: null,
    source: null,
    status,
    note: null,
    is_seed: true,
    created_by: null,
    updated_by: null,
    created_at: '',
    updated_at: '',
  }
}

function course(patch: Partial<DirectoryCourse>): DirectoryCourse {
  return {
    id: 'c',
    name: 'Test',
    city: null,
    state: 'MA',
    hole_count: 18,
    total_par: null,
    par_low: null,
    par_high: null,
    par_source: null,
    par_confidence: 'unverified',
    sourced_on: null,
    external_url: null,
    duplicate_note: null,
    notes: null,
    is_seed: false,
    created_by: null,
    updated_by: null,
    created_at: '',
    updated_at: '',
    ...patch,
  }
}

describe('sumHolePars', () => {
  it('totals a card', () => {
    // World War 1 Memorial Park, White 9 — every hole a par 3.
    expect(sumHolePars(defaultHoles(9))).toBe(27)
  })

  it('counts the par 4s and 5s', () => {
    // Jewelry City, Sapphire: 13 × 3 + 4 × 4 + 1 × 5 = 60.
    const holes = [
      ...Array(13).fill({ par: 3 }),
      ...Array(4).fill({ par: 4 }),
      { par: 5 },
    ]
    expect(sumHolePars(holes)).toBe(60)
  })

  it('is zero for an empty card', () => {
    expect(sumHolePars([])).toBe(0)
  })
})

describe('defaultHoles', () => {
  it('numbers holes from one', () => {
    expect(defaultHoles(3)).toEqual([
      { hole_number: 1, par: 3, distance_ft: null },
      { hole_number: 2, par: 3, distance_ft: null },
      { hole_number: 3, par: 3, distance_ft: null },
    ])
  })

  it('refuses to generate a negative card', () => {
    expect(defaultHoles(-4)).toEqual([])
  })
})

describe('usableLayouts', () => {
  const layouts = [
    layout('Default', 58),
    layout('Regular', 58, 18, 'conflict'),
    layout('Old', 60, 18, 'superseded'),
    layout('Unknown par', null),
    layout('General plus Hill', 110, 36),
  ]

  it('drops flagged, unsourced, and different-length layouts', () => {
    expect(usableLayouts(layouts, 18).map((l) => l.name)).toEqual(['Default'])
  })

  it('keeps every sourced layout when the hole count is unknown', () => {
    expect(usableLayouts(layouts, null).map((l) => l.name)).toEqual([
      'Default',
      'General plus Hill',
    ])
  })
})

describe('deriveCoursePar', () => {
  it('is null when nothing is sourced — par is never invented', () => {
    expect(deriveCoursePar([], 18)).toBeNull()
    expect(deriveCoursePar([layout('Blues', null)], 18)).toBeNull()
  })

  it('prefers a layout named as the course default', () => {
    // Barre Falls: Default 58 wins over the June 2022 re-cut at 56.
    const result = deriveCoursePar(
      [
        layout('Default / Barre Falls Dam', 58),
        layout('June 2022 Layout Update', 56),
      ],
      18,
    )
    expect(result).toEqual({
      par: 58,
      basis: 'Default / Barre Falls Dam layout',
    })
  })

  it('lets a lone usable layout speak for the course', () => {
    expect(deriveCoursePar([layout('Green', 55)], 18)).toEqual({
      par: 55,
      basis: 'Green layout',
    })
  })

  it('takes the median rather than the easiest card', () => {
    // Maple Hill: 3 × 55, 1 × 56, 3 × 60. The shortest layout is not the course.
    const result = deriveCoursePar(
      [
        layout('Blues', 60),
        layout('Diamonds', 60),
        layout('Golds', 60),
        layout('Old Glory', 55),
        layout('Reds', 55),
        layout('White 2021', 55),
        layout('Whites', 56),
      ],
      18,
    )
    expect(result).toEqual({ par: 56, basis: 'median of 7 sourced layouts' })
  })

  it('takes the lower median on an even split', () => {
    // Borderland: White to White 54, White to Blue 56.
    const result = deriveCoursePar(
      [layout('White to Blue', 56), layout('White to White', 54)],
      18,
    )
    expect(result?.par).toBe(54)
  })

  it('ignores layouts at a different hole count', () => {
    // Devens: the 36-hole General-plus-Hill card must not set an 18-hole par.
    const result = deriveCoursePar(
      [
        layout('The General - General standard', 56),
        layout('General plus Hill', 110, 36),
      ],
      18,
    )
    expect(result?.par).toBe(56)
  })

  it("doesn't double the word layout", () => {
    expect(deriveCoursePar([layout('Default Layout', 60)], 18)?.basis).toBe(
      'Default Layout',
    )
  })
})

describe('formatPar', () => {
  it('names a missing par instead of showing a zero', () => {
    expect(formatPar(null)).toBe('Par not set')
    expect(formatPar(undefined)).toBe('Par not set')
    expect(formatPar(54)).toBe('Par 54')
  })
})

describe('formatParRange', () => {
  it('shows the spread when layouts disagree', () => {
    expect(formatParRange(course({ par_low: 55, par_high: 64 }))).toBe(
      '55–64 across layouts',
    )
  })

  it('stays quiet when there is nothing extra to say', () => {
    expect(formatParRange(course({ par_low: 54, par_high: 54 }))).toBeNull()
    expect(formatParRange(course({}))).toBeNull()
  })
})

describe('relativeToPar', () => {
  it('reads like a scorecard', () => {
    expect(relativeToPar(58, 54)).toBe('+4')
    expect(relativeToPar(54, 54)).toBe('E')
    expect(relativeToPar(52, 54)).toBe('-2')
  })

  it('has nothing to say without both numbers', () => {
    expect(relativeToPar(null, 54)).toBeNull()
    expect(relativeToPar(58, null)).toBeNull()
  })
})
