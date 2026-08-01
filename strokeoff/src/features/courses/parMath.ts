import type { CourseHole, CourseLayout, DirectoryCourse } from '@/types'

/** Layout names that identify a course's everyday configuration. */
const DEFAULT_NAME_RE = /\b(default|standard|regular|main)\b/i

/** Fallback par for a freshly generated hole. */
export const DEFAULT_HOLE_PAR = 3

export type HoleDraft = Pick<CourseHole, 'hole_number' | 'par' | 'distance_ft'>

/** A layout's par is the sum of its holes whenever hole detail exists. */
export function sumHolePars(holes: Pick<CourseHole, 'par'>[]): number {
  return holes.reduce((total, hole) => total + hole.par, 0)
}

/** Blank hole-by-hole card for a layout that has none yet. */
export function defaultHoles(
  count: number,
  par = DEFAULT_HOLE_PAR,
): HoleDraft[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({
    hole_number: i + 1,
    par,
    distance_ft: null,
  }))
}

/**
 * Layouts trustworthy enough to speak for the course: sourced par, no
 * data-quality flag, and playing the same number of holes as the course.
 * Conflicting and superseded records stay in the directory but stay out of the
 * arithmetic.
 */
export function usableLayouts(
  layouts: CourseLayout[],
  holeCount: number | null,
): CourseLayout[] {
  return layouts.filter(
    (l) =>
      l.status === 'ok' &&
      l.total_par != null &&
      (holeCount == null || l.hole_count === holeCount),
  )
}

export interface DerivedPar {
  par: number
  basis: string
}

/**
 * The course's headline par, derived from its layouts. A layout explicitly
 * named Default/Standard/Regular/Main wins; a lone usable layout speaks for
 * itself; otherwise the median (lower median on ties), which keeps a course
 * that plays several ways from being represented by its easiest card.
 *
 * Mirrors the rule the directory import used, so recalculating in-app and
 * re-importing agree. Returns null when nothing is sourced — par is never
 * invented from the hole count.
 */
export function deriveCoursePar(
  layouts: CourseLayout[],
  holeCount: number | null,
): DerivedPar | null {
  const usable = usableLayouts(layouts, holeCount)
  if (usable.length === 0) return null

  const label = (l: CourseLayout) =>
    /layout$/i.test(l.name) ? l.name : `${l.name} layout`

  const named = usable.filter((l) => DEFAULT_NAME_RE.test(l.name))
  if (named.length > 0) {
    const pick = named.reduce((a, b) => (a.total_par! <= b.total_par! ? a : b))
    return { par: pick.total_par!, basis: label(pick) }
  }
  if (usable.length === 1) {
    return { par: usable[0].total_par!, basis: label(usable[0]) }
  }

  const pars = usable.map((l) => l.total_par!).sort((a, b) => a - b)
  return {
    par: pars[Math.floor((pars.length - 1) / 2)],
    basis: `median of ${pars.length} sourced layouts`,
  }
}

/** Headline par for display. */
export function formatPar(par: number | null | undefined): string {
  return par == null ? 'Par not set' : `Par ${par}`
}

/**
 * The spread across a course's layouts, shown only when it adds something the
 * headline par doesn't already say.
 */
export function formatParRange(course: DirectoryCourse): string | null {
  const { par_low: low, par_high: high } = course
  if (low == null || high == null || low === high) return null
  return `${low}–${high} across layouts`
}

/** Score relative to par, the way a scorecard reads it. */
export function relativeToPar(
  strokes: number | null | undefined,
  par: number | null | undefined,
): string | null {
  if (strokes == null || par == null) return null
  const diff = strokes - par
  if (diff === 0) return 'E'
  return diff > 0 ? `+${diff}` : `${diff}`
}
