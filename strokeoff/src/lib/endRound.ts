import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Round } from '@/types'

/**
 * Phase 6 — end-of-round lifecycle. End the round (any participant), enter final
 * regular scores, record a tie-break outcome, and hide a finished round from your
 * own History. All writes go through the SECURITY DEFINER RPCs in migration 0006.
 */

export function useEndRound(roundId: string | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<Round> => {
      const { data, error } = await supabase.rpc('end_round', {
        p_round_id: roundId!,
      })
      if (error) throw error
      return data as Round
    },
    onSuccess: (round) => {
      void qc.invalidateQueries({ queryKey: ['round', round.id] })
      void qc.invalidateQueries({ queryKey: ['current-round', user?.id] })
    },
  })
}

export function useSetRegularStrokes(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      playerId,
      strokes,
    }: {
      playerId: string
      strokes: number | null
    }) => {
      const { error } = await supabase.rpc('set_regular_strokes', {
        p_player_id: playerId,
        p_strokes: strokes,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['round-players', roundId] })
    },
  })
}

/**
 * Confirm (or reopen) a player's regular score in the end-of-round flow. A player
 * confirms their own slot; the single-phone controller confirms anyone; a guest's
 * score may be confirmed by any participant (server-gated in migration 0012). A
 * confirmed score is locked from edits until unconfirmed.
 */
export function useSetScoreConfirmed(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      playerId,
      confirmed,
    }: {
      playerId: string
      confirmed: boolean
    }) => {
      const { error } = await supabase.rpc('set_score_confirmed', {
        p_player_id: playerId,
        p_confirmed: confirmed,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['round-players', roundId] })
    },
  })
}

/** Set or correct the course par (any participant; spec — over/under-par finals). */
export function useSetRoundPar(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (par: number | null): Promise<Round> => {
      const { data, error } = await supabase.rpc('set_round_par', {
        p_round_id: roundId!,
        p_par: par,
      })
      if (error) throw error
      return data as Round
    },
    onSuccess: (round) => {
      void qc.invalidateQueries({ queryKey: ['round', round.id] })
    },
  })
}

export function useSetTiebreak(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      winnerId,
      method,
    }: {
      winnerId: string
      method: string
    }) => {
      const { error } = await supabase.rpc('set_round_tiebreak', {
        p_round_id: roundId!,
        p_winner_id: winnerId,
        p_method: method,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['round', roundId] })
    },
  })
}

/** Completed rounds you were part of and haven't hidden (spec §3, §11). */
export function useHistoryRounds() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['history-rounds', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Round[]> => {
      const { data, error } = await supabase
        .from('round_players')
        .select('hidden, rounds(*)')
        .eq('profile_id', user!.id)
        .eq('hidden', false)
      if (error) throw error
      const rounds = (
        (data ?? []) as unknown as { rounds: Round | null }[]
      )
        .map((row) => row.rounds)
        .filter((r): r is Round => r !== null && r.status === 'complete')
      rounds.sort((a, b) => (a.ended_at ?? '') < (b.ended_at ?? '') ? 1 : -1)
      return rounds
    },
  })
}

export function useHideRound() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (roundId: string) => {
      const { error } = await supabase.rpc('hide_round', { p_round_id: roundId })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['history-rounds', user?.id] })
    },
  })
}
