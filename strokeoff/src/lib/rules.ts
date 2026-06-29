import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Rule } from '@/types'

/** Fields a user can author/edit on a rule (spec §7, §12). */
export type RuleDraft = Pick<
  Rule,
  | 'name'
  | 'display_name'
  | 'description'
  | 'points'
  | 'player_scope'
  | 'min_players'
  | 'max_players'
  | 'is_repeatable'
  | 'active'
  | 'animation_config'
>

export function useRules(groupId: string | undefined) {
  return useQuery({
    queryKey: ['rules', groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<Rule[]> => {
      const { data, error } = await supabase
        .from('rules')
        .select('*')
        .eq('group_id', groupId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

function useInvalidateRules(groupId: string | undefined) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['rules', groupId] })
}

export function useCreateRule(groupId: string | undefined) {
  const { user } = useAuth()
  const invalidate = useInvalidateRules(groupId)
  return useMutation({
    mutationFn: async (draft: RuleDraft): Promise<Rule> => {
      const { data, error } = await supabase
        .from('rules')
        .insert({ ...draft, group_id: groupId!, created_by: user!.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void invalidate(),
  })
}

export function useUpdateRule(groupId: string | undefined) {
  const invalidate = useInvalidateRules(groupId)
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<RuleDraft>
    }): Promise<Rule> => {
      const { data, error } = await supabase
        .from('rules')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void invalidate(),
  })
}

export function useDeleteRule(groupId: string | undefined) {
  const invalidate = useInvalidateRules(groupId)
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('rules').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void invalidate(),
  })
}
