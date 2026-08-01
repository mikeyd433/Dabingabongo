import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { HoleDraft } from '@/features/courses/parMath'
import type { CourseHole, CourseLayout, DirectoryCourse } from '@/types'

/** Course fields a player can author or correct. */
export type DirectoryCourseDraft = Pick<
  DirectoryCourse,
  | 'name'
  | 'city'
  | 'state'
  | 'hole_count'
  | 'total_par'
  | 'par_source'
  | 'par_confidence'
  | 'notes'
>

export type LayoutDraft = Pick<
  CourseLayout,
  'name' | 'hole_count' | 'total_par' | 'length_ft' | 'source' | 'note'
>

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

function useInvalidateCourse(courseId: string | undefined) {
  const qc = useQueryClient()
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['course-directory'] }),
      qc.invalidateQueries({ queryKey: ['directory-course', courseId] }),
      qc.invalidateQueries({ queryKey: ['course-layouts', courseId] }),
      qc.invalidateQueries({ queryKey: ['course-holes', courseId] }),
    ])
  }
}

export function useCreateDirectoryCourse() {
  const { user } = useAuth()
  const invalidate = useInvalidateCourse(undefined)
  return useMutation({
    mutationFn: async (
      draft: DirectoryCourseDraft,
    ): Promise<DirectoryCourse> => {
      const { data, error } = await supabase
        .from('course_directory')
        .insert({ ...draft, created_by: user!.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void invalidate(),
  })
}

export function useUpdateDirectoryCourse(courseId: string | undefined) {
  const invalidate = useInvalidateCourse(courseId)
  return useMutation({
    mutationFn: async (
      patch: Partial<DirectoryCourseDraft>,
    ): Promise<DirectoryCourse> => {
      const { data, error } = await supabase
        .from('course_directory')
        .update(patch)
        .eq('id', courseId!)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void invalidate(),
  })
}

export function useDeleteDirectoryCourse() {
  const invalidate = useInvalidateCourse(undefined)
  return useMutation({
    mutationFn: async (courseId: string): Promise<void> => {
      const { error } = await supabase
        .from('course_directory')
        .delete()
        .eq('id', courseId)
      if (error) throw error
    },
    onSuccess: () => void invalidate(),
  })
}

export function useCreateLayout(courseId: string | undefined) {
  const { user } = useAuth()
  const invalidate = useInvalidateCourse(courseId)
  return useMutation({
    mutationFn: async (draft: LayoutDraft): Promise<CourseLayout> => {
      const { data, error } = await supabase
        .from('course_layouts')
        .insert({ ...draft, course_id: courseId!, created_by: user!.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => void invalidate(),
  })
}

export function useUpdateLayout(courseId: string | undefined) {
  const invalidate = useInvalidateCourse(courseId)
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<LayoutDraft>
    }): Promise<CourseLayout> => {
      const { data, error } = await supabase
        .from('course_layouts')
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

export function useDeleteLayout(courseId: string | undefined) {
  const invalidate = useInvalidateCourse(courseId)
  return useMutation({
    mutationFn: async (layoutId: string): Promise<void> => {
      const { error } = await supabase
        .from('course_layouts')
        .delete()
        .eq('id', layoutId)
      if (error) throw error
    },
    onSuccess: () => void invalidate(),
  })
}

/**
 * Save a layout's hole-by-hole card. Holes beyond the new length are removed
 * first so shrinking a card can't leave orphans behind; the database trigger
 * re-derives the layout's total par from whatever survives.
 */
export function useSaveHoles(courseId: string | undefined) {
  const invalidate = useInvalidateCourse(courseId)
  return useMutation({
    mutationFn: async ({
      layoutId,
      holes,
    }: {
      layoutId: string
      holes: HoleDraft[]
    }): Promise<void> => {
      const { error: deleteError } = await supabase
        .from('course_holes')
        .delete()
        .eq('layout_id', layoutId)
        .gt('hole_number', holes.length)
      if (deleteError) throw deleteError

      if (holes.length === 0) return

      const { error } = await supabase.from('course_holes').upsert(
        holes.map((h) => ({ ...h, layout_id: layoutId })),
        { onConflict: 'layout_id,hole_number' },
      )
      if (error) throw error
    },
    onSuccess: () => void invalidate(),
  })
}

/** Remove a layout's hole detail, handing its total par back to direct editing. */
export function useClearHoles(courseId: string | undefined) {
  const invalidate = useInvalidateCourse(courseId)
  return useMutation({
    mutationFn: async (layoutId: string): Promise<void> => {
      const { error } = await supabase
        .from('course_holes')
        .delete()
        .eq('layout_id', layoutId)
      if (error) throw error
    },
    onSuccess: () => void invalidate(),
  })
}
