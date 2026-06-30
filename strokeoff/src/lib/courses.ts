import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
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
