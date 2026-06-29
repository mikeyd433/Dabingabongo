import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { ConversionTable } from '@/types'
import type { ConversionConfig } from '@/features/conversion/types'
import type { ConversionMode } from '@/types'

/** The group's default conversion table (spec §8), referenced by the group. */
export function useGroupConversion(conversionId: string | null | undefined) {
  return useQuery({
    queryKey: ['conversion', conversionId],
    enabled: Boolean(conversionId),
    queryFn: async (): Promise<ConversionTable | null> => {
      const { data, error } = await supabase
        .from('conversion_tables')
        .select('*')
        .eq('id', conversionId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateConversion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      mode,
      config,
    }: {
      id: string
      mode: ConversionMode
      config: ConversionConfig
    }): Promise<ConversionTable> => {
      const { data, error } = await supabase
        .from('conversion_tables')
        .update({ mode, config })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ['conversion', row.id] })
    },
  })
}
