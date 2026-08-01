import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { CourseHole, CourseLayout, DirectoryCourse } from '@/types'

/**
 * Read-only access to the shared course directory. It's reference data
 * maintained from the backend (migration 0023) — players change par on their
 * own round, not on the course, so there are no mutations here.
 */

/**
 * The whole directory. It's small reference data (a couple of hundred rows) that
 * changes rarely, so it's fetched once and searched on the device — the course
 * picker stays instant on a phone with patchy signal at the first tee.
 */
export function useDirectoryCourses() {
  return useQuery({
    queryKey: ['course-directory'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DirectoryCourse[]> => {
      const { data, error } = await supabase
        .from('course_directory')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useDirectoryCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: ['directory-course', courseId],
    enabled: Boolean(courseId),
    queryFn: async (): Promise<DirectoryCourse | null> => {
      const { data, error } = await supabase
        .from('course_directory')
        .select('*')
        .eq('id', courseId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useCourseLayouts(courseId: string | undefined) {
  return useQuery({
    queryKey: ['course-layouts', courseId],
    enabled: Boolean(courseId),
    queryFn: async (): Promise<CourseLayout[]> => {
      const { data, error } = await supabase
        .from('course_layouts')
        .select('*')
        .eq('course_id', courseId!)
        .order('name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

/** Every hole record for a course's layouts, keyed by layout in the component. */
export function useCourseHoles(
  courseId: string | undefined,
  layoutIds: string[],
) {
  return useQuery({
    queryKey: ['course-holes', courseId, layoutIds.join(',')],
    enabled: layoutIds.length > 0,
    queryFn: async (): Promise<CourseHole[]> => {
      const { data, error } = await supabase
        .from('course_holes')
        .select('*')
        .in('layout_id', layoutIds)
        .order('hole_number', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}
