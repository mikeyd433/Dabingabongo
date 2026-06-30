import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Group, Profile } from '@/types'

type ProfilePatch = Partial<
  Pick<Profile, 'display_name' | 'custom_message' | 'avatar_url'>
>

/** The current user's profile row (spec §11 "Me"). Null until provisioned. */
export function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: ProfilePatch): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user!.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })
}

/** Upload an avatar to the user's folder and store its public URL (spec §11). */
export function useUploadAvatar() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      // Resolve (and refresh if needed) the session up front. The avatars bucket
      // is write-scoped to your own folder via RLS; if the storage request goes
      // out without a live user token it falls back to the anon key, auth.uid()
      // is null, and the upload is rejected with a row-level-security error.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? user?.id
      if (!session || !uid) {
        throw new Error('You need to be signed in to change your avatar.')
      }

      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `${uid}/avatar-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, {
          upsert: true,
          contentType: file.type || undefined,
        })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', uid)
      if (error) throw error
      return data.publicUrl
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile', user?.id] })
    },
  })
}

/**
 * Groups the current user belongs to. RLS limits the result to the user's groups,
 * so a plain select is enough. Always includes the auto-created personal group.
 */
export function useMyGroups() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['groups', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<Group[]> => {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('is_personal', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}
