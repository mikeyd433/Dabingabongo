import { useMutation } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'

/**
 * Upload a custom celebration particle image (spec §12, Tier 2) to the public
 * `animation-assets` bucket and return its public URL to store on the rule's
 * `animation_config.imageUrl`. Path is scoped to the uploader's folder to match
 * the bucket's write policy (migration 0015).
 */
export function useUploadAnimationAsset() {
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const path = `${user!.id}/particle-${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('animation-assets')
        .upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage
        .from('animation-assets')
        .getPublicUrl(path)
      return data.publicUrl
    },
  })
}
