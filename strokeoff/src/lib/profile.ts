import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env'
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
      // The avatars bucket is write-scoped to your own {uid}/ folder via RLS, so
      // the request MUST run as the signed-in user. supabase-js only auto-attaches
      // the session token when getSession() returns one at request time; on an
      // idle/backgrounded device (common on mobile) it can momentarily return
      // none and silently fall back to the anon key, making auth.uid() null and
      // the upload fail its own-folder check ("new row violates row-level security
      // policy"). So resolve a fresh token here and pin it explicitly.
      let {
        data: { session },
      } = await supabase.auth.getSession()
      const nowSec = Math.floor(Date.now() / 1000)
      if (session?.expires_at && session.expires_at - nowSec < 60) {
        const { data: refreshed } = await supabase.auth.refreshSession()
        if (refreshed.session) session = refreshed.session
      }
      const token = session?.access_token
      const uid = session?.user?.id ?? user?.id
      if (!token || !uid) {
        throw new Error(
          'Your session expired — reload the app and try again.',
        )
      }

      // A short-lived client whose Authorization header is pinned to the user's
      // token. supabase-js won't overwrite an Authorization it's already given,
      // so both the Storage upload and the profiles update below run AS the user
      // — never the anon key — regardless of the main client's session timing.
      const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { headers: { Authorization: `Bearer ${token}` } },
      })

      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `${uid}/avatar-${Date.now()}.${ext}`
      const { error: uploadError } = await authed.storage
        .from('avatars')
        .upload(path, file, {
          upsert: true,
          contentType: file.type || undefined,
        })
      if (uploadError) throw uploadError

      const { data } = authed.storage.from('avatars').getPublicUrl(path)
      const { error } = await authed
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
