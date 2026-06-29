import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import { selectCurrentRound } from '@/features/round/currentRound'
import type { ConversionConfig } from '@/features/conversion/types'
import type { ConversionMode, Round, RoundPlayer, ScoringMode } from '@/types'

export interface ConversionSnapshot {
  mode: ConversionMode
  config: ConversionConfig
}

export interface ThemeSnapshot {
  id: string
  name: string
  mode: string
  tokens: Record<string, string>
}

export interface CreateRoundInput {
  groupId: string
  course: string
  playedOn: string
  scoringMode: ScoringMode
  conversion: ConversionSnapshot
  theme: ThemeSnapshot
  animationsEnabled: boolean
  ruleIds: string[]
  /** Optional course par (null = not set). */
  par: number | null
}

/** The user's current joinable round (lobby or active), if any. */
export function useCurrentRound() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['current-round', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Round | null> => {
      const { data, error } = await supabase
        .from('round_players')
        .select('rounds(*)')
        .eq('profile_id', user!.id)
      if (error) throw error

      const rounds = (
        (data ?? []) as unknown as { rounds: Round | null }[]
      ).map((row) => row.rounds)
      return selectCurrentRound(rounds)
    },
  })
}

export function useRound(roundId: string | undefined) {
  return useQuery({
    queryKey: ['round', roundId],
    enabled: Boolean(roundId),
    queryFn: async (): Promise<Round | null> => {
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('id', roundId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useRoundPlayers(roundId: string | undefined) {
  return useQuery({
    queryKey: ['round-players', roundId],
    enabled: Boolean(roundId),
    queryFn: async (): Promise<RoundPlayer[]> => {
      const { data, error } = await supabase
        .from('round_players')
        .select('*')
        .eq('round_id', roundId!)
        .order('joined_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

/**
 * Live round channel (spec §5, §6): subscribe to Postgres changes on the round,
 * its roster, the point-event ledger, and confirmations — refreshing the cached
 * queries so the lobby populates and the live leaderboard / feed update in real
 * time. One channel per round (`round:{id}`), reused across lobby and scoring.
 */
export function useRoundRealtime(roundId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!roundId) return
    const channel = supabase
      .channel(`round:${roundId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_players',
          filter: `round_id=eq.${roundId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['round-players', roundId] })
          void qc.invalidateQueries({ queryKey: ['my-round-player', roundId] })
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rounds',
          filter: `id=eq.${roundId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['round', roundId] })
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'point_events',
          filter: `round_id=eq.${roundId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['point-events', roundId] })
          // A multi-player award also creates confirmations addressed to others.
          void qc.invalidateQueries({
            queryKey: ['event-confirmations', roundId],
          })
        },
      )
      // event_confirmations has no round_id column to filter on; it's low-volume,
      // so refresh the round's confirmation queries on any change.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_confirmations' },
        () => {
          void qc.invalidateQueries({
            queryKey: ['event-confirmations', roundId],
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [roundId, qc])
}

export function useCreateRound() {
  return useMutation({
    mutationFn: async (input: CreateRoundInput): Promise<Round> => {
      const { data, error } = await supabase.rpc('create_round', {
        p_group_id: input.groupId,
        p_course: input.course,
        p_played_on: input.playedOn,
        p_scoring_mode: input.scoringMode,
        p_conversion: input.conversion,
        p_theme: input.theme,
        p_animations: input.animationsEnabled,
        p_rule_ids: input.ruleIds,
        p_par: input.par,
      })
      if (error) throw error
      return data as Round
    },
  })
}

export function useJoinRound() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code: string): Promise<Round> => {
      const { data, error } = await supabase.rpc('join_round_with_code', {
        p_code: code,
      })
      if (error) throw error
      return data as Round
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['current-round', user?.id] })
    },
  })
}

export function useAddGuest(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (displayName: string): Promise<void> => {
      const { error } = await supabase.rpc('add_round_guest', {
        p_round_id: roundId!,
        p_display_name: displayName,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['round-players', roundId] })
    },
  })
}

export function useStartRound() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (roundId: string): Promise<Round> => {
      const { data, error } = await supabase.rpc('start_round', {
        p_round_id: roundId,
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
