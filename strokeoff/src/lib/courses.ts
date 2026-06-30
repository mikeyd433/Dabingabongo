import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Course } from '@/types'

/**
 * The group's saved courses (spec §5). Remembered automatically when a round is
 * created (see the create_round RPC), so a course + its total par can be picked
 * again next time. RLS limits the result to the caller's group.
 */
export function useCourses(groupId: string | undefined) {
  return useQuery({
    queryKey: ['courses', groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<Course[]> => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('group_id', groupId!)
        .order('name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export interface CourseDraft {
  name: string
  par: number | null
}

export function useCreateCourse(groupId: string | undefined) {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: CourseDraft): Promise<Course> => {
      const { data, error } = await supabase
        .from('courses')
        .insert({ ...draft, group_id: groupId!, created_by: user!.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['courses', groupId] }),
  })
}

export function useUpdateCourse(groupId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<CourseDraft>
    }): Promise<Course> => {
      const { data, error } = await supabase
        .from('courses')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['courses', groupId] }),
  })
}

export function useDeleteCourse(groupId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('courses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['courses', groupId] }),
  })
}
