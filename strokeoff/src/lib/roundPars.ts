import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { HoleDraft } from '@/features/courses/parMath'
import type { Round, RoundHole } from '@/types'

/**
 * A round's own hole-by-hole par card (migration 0023). Separate from the
 * course directory on purpose: baskets move and a hole plays long, and that's a
 * fact about today's round, not a correction to the course. Any participant can
 * edit it mid-round, and it drives `rounds.par`.
 */
export function useRoundHoles(roundId: string | undefined) {
  return useQuery({
    queryKey: ['round-holes', roundId],
    enabled: Boolean(roundId),
    queryFn: async (): Promise<RoundHole[]> => {
      const { data, error } = await supabase
        .from('round_holes')
        .select('*')
        .eq('round_id', roundId!)
        .order('hole_number', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

function useInvalidateRoundPar(roundId: string | undefined) {
  const qc = useQueryClient()
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['round', roundId] }),
      qc.invalidateQueries({ queryKey: ['round-holes', roundId] }),
    ])
  }
}

/** Replace this round's hole card. The round's total par follows from it. */
export function useSetRoundHolePars(roundId: string | undefined) {
  const invalidate = useInvalidateRoundPar(roundId)
  return useMutation({
    mutationFn: async (holes: HoleDraft[]): Promise<Round> => {
      const pars = holes
        .slice()
        .sort((a, b) => a.hole_number - b.hole_number)
        .map((h) => h.par)
      const { data, error } = await supabase.rpc('set_round_hole_pars', {
        p_round_id: roundId!,
        p_pars: pars,
      })
      if (error) throw error
      return data as Round
    },
    onSuccess: () => void invalidate(),
  })
}

/** Drop the card and hand the total back to direct editing. */
export function useClearRoundHolePars(roundId: string | undefined) {
  const invalidate = useInvalidateRoundPar(roundId)
  return useMutation({
    mutationFn: async (): Promise<Round> => {
      const { data, error } = await supabase.rpc('clear_round_hole_pars', {
        p_round_id: roundId!,
      })
      if (error) throw error
      return data as Round
    },
    onSuccess: () => void invalidate(),
  })
}

/** Copy a directory layout's card into this round as a starting point. */
export function useLoadRoundHolePars(roundId: string | undefined) {
  const invalidate = useInvalidateRoundPar(roundId)
  return useMutation({
    mutationFn: async (layoutId: string): Promise<Round> => {
      const { data, error } = await supabase.rpc('load_round_hole_pars', {
        p_round_id: roundId!,
        p_layout_id: layoutId,
      })
      if (error) throw error
      return data as Round
    },
    onSuccess: () => void invalidate(),
  })
}
