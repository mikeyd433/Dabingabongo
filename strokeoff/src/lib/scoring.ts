import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { PointEvent, RoundPlayer, RoundRule } from '@/types'

/**
 * Phase 4 live-scoring data layer. Reads (round rules palette, point-event
 * ledger, my pending confirmations) are TanStack queries kept fresh by the
 * round Realtime channel; writes go through the SECURITY DEFINER RPCs from
 * migration 0004, which enforce permission-on-writes server-side.
 */

const eventsKey = (roundId?: string) => ['point-events', roundId]
const confirmationsKey = (roundId?: string, playerId?: string) => [
  'event-confirmations',
  roundId,
  playerId,
]

/** The round's frozen rule palette (snapshotted on Start; spec §5, §7). */
export function useRoundRules(roundId: string | undefined) {
  return useQuery({
    queryKey: ['round-rules', roundId],
    enabled: Boolean(roundId),
    queryFn: async (): Promise<RoundRule[]> => {
      const { data, error } = await supabase
        .from('round_rules')
        .select('*')
        .eq('round_id', roundId!)
        .order('name_snapshot', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

/** The full point-event ledger for the round, newest first (feed + leaderboard). */
export function usePointEvents(roundId: string | undefined) {
  return useQuery({
    queryKey: eventsKey(roundId),
    enabled: Boolean(roundId),
    queryFn: async (): Promise<PointEvent[]> => {
      const { data, error } = await supabase
        .from('point_events')
        .select('*')
        .eq('round_id', roundId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

/** The caller's own roster row in this round (the subject they self-score). */
export function useMyRoundPlayer(roundId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-round-player', roundId, user?.id],
    enabled: Boolean(roundId && user),
    queryFn: async (): Promise<RoundPlayer | null> => {
      const { data, error } = await supabase
        .from('round_players')
        .select('*')
        .eq('round_id', roundId!)
        .eq('profile_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export interface PendingConfirmation {
  event_id: string
  player_id: string
  status: string
  point_events: Pick<
    PointEvent,
    | 'id'
    | 'round_id'
    | 'subject_player_id'
    | 'rule_name_snapshot'
    | 'points_snapshot'
    | 'count'
    | 'logged_by'
    | 'voided'
  >
}

/**
 * Multi-player confirmation prompts addressed to me and still pending (spec §6).
 * Points already stand — responding is acknowledgement, not gating.
 */
export function useMyPendingConfirmations(
  roundId: string | undefined,
  myPlayerId: string | undefined,
) {
  return useQuery({
    queryKey: confirmationsKey(roundId, myPlayerId),
    enabled: Boolean(roundId && myPlayerId),
    queryFn: async (): Promise<PendingConfirmation[]> => {
      const { data, error } = await supabase
        .from('event_confirmations')
        .select(
          'event_id, player_id, status, point_events!inner(id, round_id, subject_player_id, rule_name_snapshot, points_snapshot, count, logged_by, voided)',
        )
        .eq('player_id', myPlayerId!)
        .eq('status', 'pending')
        .eq('point_events.round_id', roundId!)
      if (error) throw error
      return (data ?? []) as unknown as PendingConfirmation[]
    },
  })
}

export interface LogPointVars {
  /** Client-generated so an optimistic write reconciles idempotently (principle 6). */
  eventId: string
  subjectPlayerId: string
  rule: RoundRule
  count?: number
  /** Other involved players for a multi-player rule (excludes the subject). */
  involvedPlayerIds?: string[]
}

/** Log a point for a subject you control, with an optimistic feed/leaderboard bump. */
export function useLogPoint(roundId: string | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: LogPointVars): Promise<void> => {
      const { error } = await supabase.rpc('log_point', {
        p_round_id: roundId!,
        p_subject_player_id: vars.subjectPlayerId,
        p_rule_id: vars.rule.rule_id,
        p_count: vars.count ?? 1,
        p_involved_player_ids: vars.involvedPlayerIds ?? [],
        p_event_id: vars.eventId,
      })
      if (error) throw error
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: eventsKey(roundId) })
      const previous = qc.getQueryData<PointEvent[]>(eventsKey(roundId))
      const optimistic: PointEvent = {
        id: vars.eventId,
        round_id: roundId!,
        subject_player_id: vars.subjectPlayerId,
        rule_id: vars.rule.rule_id,
        rule_name_snapshot: vars.rule.name_snapshot,
        points_snapshot: vars.rule.points_snapshot,
        count: vars.count ?? 1,
        logged_by: user?.id ?? '',
        edited_at: null,
        voided: false,
        void_reason: null,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<PointEvent[]>(eventsKey(roundId), (old) => [
        optimistic,
        ...(old ?? []),
      ])
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(eventsKey(roundId), context.previous)
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: eventsKey(roundId) })
    },
  })
}

export function useEditPointEvent(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ eventId, count }: { eventId: string; count: number }) => {
      const { error } = await supabase.rpc('edit_point_event', {
        p_event_id: eventId,
        p_count: count,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventsKey(roundId) })
    },
  })
}

export function useVoidPointEvent(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      eventId,
      reason,
    }: {
      eventId: string
      reason?: string
    }) => {
      const { error } = await supabase.rpc('void_point_event', {
        p_event_id: eventId,
        p_reason: reason ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventsKey(roundId) })
    },
  })
}

export function useRespondToConfirmation(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      eventId,
      status,
    }: {
      eventId: string
      status: 'confirmed' | 'declined'
    }) => {
      const { error } = await supabase.rpc('respond_to_confirmation', {
        p_event_id: eventId,
        p_status: status,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['event-confirmations', roundId] })
    },
  })
}

/** Reassign a guest to a new manager (spec §6 — e.g. the manager's phone died). */
export function useReassignGuest(roundId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      guestId,
      newManagerId,
    }: {
      guestId: string
      newManagerId: string
    }) => {
      const { error } = await supabase.rpc('reassign_guest', {
        p_guest_id: guestId,
        p_new_manager_id: newManagerId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['round-players', roundId] })
    },
  })
}

/** Leave or rejoin the round (persistent roster; spec §5). */
export function useSetRosterStatus(roundId: string | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (status: 'active' | 'left') => {
      const { error } = await supabase.rpc('set_my_roster_status', {
        p_round_id: roundId!,
        p_status: status,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['round-players', roundId] })
      void qc.invalidateQueries({ queryKey: ['my-round-player', roundId, user?.id] })
    },
  })
}
