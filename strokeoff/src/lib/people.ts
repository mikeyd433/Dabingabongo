import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { PersonSummary, Round } from '@/types'

/**
 * Phase 11 — Community → People (Option B; spec §11). Reads go through the
 * SECURITY DEFINER RPCs from migration 0009, which enforce the "only people
 * you've shared a round with" and round-visibility rules server-side.
 */

/** Players you've shared a round with, newest-played first. */
export function usePeople() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['people', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<PersonSummary[]> => {
      const { data, error } = await supabase.rpc('people_i_played_with')
      if (error) throw error
      return (data ?? []) as PersonSummary[]
    },
  })
}

/** A single person from the cached list (used by the profile screen). */
export function usePerson(profileId: string | undefined) {
  const people = usePeople()
  return {
    ...people,
    data: profileId
      ? people.data?.find((p) => p.profile_id === profileId)
      : undefined,
  }
}

/** The player's rounds you're allowed to see (both played, or a shared group). */
export function usePlayerRounds(profileId: string | undefined) {
  return useQuery({
    queryKey: ['player-rounds', profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<Round[]> => {
      const { data, error } = await supabase.rpc('rounds_with_player', {
        p_other: profileId!,
      })
      if (error) throw error
      return (data ?? []) as Round[]
    },
  })
}

export interface PlayerRoundStats {
  rounds_played: number
  wins: number
  best_rank: number | null
}

/** Wins / rounds played / best finish for a player, across rounds you can see. */
export function usePlayerStats(profileId: string | undefined) {
  return useQuery({
    queryKey: ['player-stats', profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<PlayerRoundStats> => {
      const { data, error } = await supabase.rpc('player_round_stats', {
        p_other: profileId!,
      })
      if (error) throw error
      const row = (data ?? [])[0] as PlayerRoundStats | undefined
      return row ?? { rounds_played: 0, wins: 0, best_rank: null }
    },
  })
}

/** Quick-add a player you've played with to one of your groups (spec §11). */
export function useQuickAddToGroup() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      profileId,
    }: {
      groupId: string
      profileId: string
    }): Promise<void> => {
      const { error } = await supabase.rpc('quick_add_to_group', {
        p_group_id: groupId,
        p_profile_id: profileId,
      })
      if (error) throw error
    },
    onSuccess: (_data, { groupId }) => {
      void qc.invalidateQueries({ queryKey: ['groups', user?.id] })
      void qc.invalidateQueries({ queryKey: ['group-members', groupId] })
    },
  })
}
