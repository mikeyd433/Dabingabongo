import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Group, GroupRole } from '@/types'

export interface GroupMemberView {
  profile_id: string
  role: GroupRole
  display_name: string
  avatar_url: string | null
  custom_message: string | null
}

function useInvalidateGroups() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['groups', user?.id] })
}

export function useCreateGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: async (name: string): Promise<Group> => {
      const { data, error } = await supabase.rpc('create_group', {
        p_name: name,
      })
      if (error) throw error
      return data as Group
    },
    onSuccess: () => void invalidate(),
  })
}

export function useJoinGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: async (code: string): Promise<Group> => {
      const { data, error } = await supabase.rpc('join_group_with_code', {
        p_code: code,
      })
      if (error) throw error
      return data as Group
    },
    onSuccess: () => void invalidate(),
  })
}

export function useLeaveGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: async (groupId: string): Promise<void> => {
      const { error } = await supabase.rpc('leave_group', {
        p_group_id: groupId,
      })
      if (error) throw error
    },
    onSuccess: () => void invalidate(),
  })
}

/** Owner-only: rename a group (spec §11). */
export function useRenameGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: async ({
      groupId,
      name,
    }: {
      groupId: string
      name: string
    }): Promise<Group> => {
      const { data, error } = await supabase.rpc('rename_group', {
        p_group_id: groupId,
        p_name: name,
      })
      if (error) throw error
      return data as Group
    },
    onSuccess: () => void invalidate(),
  })
}

/** Owner-only: remove a member from a group (spec §11). */
export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      profileId,
    }: {
      groupId: string
      profileId: string
    }): Promise<void> => {
      const { error } = await supabase.rpc('remove_group_member', {
        p_group_id: groupId,
        p_profile_id: profileId,
      })
      if (error) throw error
    },
    onSuccess: (_data, { groupId }) =>
      void qc.invalidateQueries({ queryKey: ['group-members', groupId] }),
  })
}

/** Owner-only: hand off ownership to another member (spec §11). */
export function useTransferOwnership() {
  const invalidate = useInvalidateGroups()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      groupId,
      newOwnerId,
    }: {
      groupId: string
      newOwnerId: string
    }): Promise<Group> => {
      const { data, error } = await supabase.rpc('transfer_group_ownership', {
        p_group_id: groupId,
        p_new_owner_id: newOwnerId,
      })
      if (error) throw error
      return data as Group
    },
    onSuccess: (_data, { groupId }) => {
      void invalidate()
      void qc.invalidateQueries({ queryKey: ['group-members', groupId] })
    },
  })
}

/** Owner-only: delete a group (spec §11). */
export function useDeleteGroup() {
  const invalidate = useInvalidateGroups()
  return useMutation({
    mutationFn: async (groupId: string): Promise<void> => {
      const { error } = await supabase.rpc('delete_group', {
        p_group_id: groupId,
      })
      if (error) throw error
    },
    onSuccess: () => void invalidate(),
  })
}

export function useCreateInvite() {
  return useMutation({
    mutationFn: async (groupId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('create_group_invite', {
        p_group_id: groupId,
      })
      if (error) throw error
      return data as string
    },
  })
}

/** Members of a group, with public profile fields (spec §11). */
export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-members', groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<GroupMemberView[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select(
          'role, profile_id, profiles(display_name, avatar_url, custom_message)',
        )
        .eq('group_id', groupId!)
      if (error) throw error

      type Row = {
        role: GroupRole
        profile_id: string
        profiles: {
          display_name: string
          avatar_url: string | null
          custom_message: string | null
        } | null
      }
      return ((data ?? []) as unknown as Row[]).map((row) => ({
        profile_id: row.profile_id,
        role: row.role,
        display_name: row.profiles?.display_name ?? 'Player',
        avatar_url: row.profiles?.avatar_url ?? null,
        custom_message: row.profiles?.custom_message ?? null,
      }))
    },
  })
}
