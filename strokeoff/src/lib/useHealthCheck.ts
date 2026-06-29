import { useQuery } from '@tanstack/react-query'
import { checkSupabaseHealth } from './healthCheck'

/** Runs the Supabase connectivity check via TanStack Query. */
export function useHealthCheck() {
  return useQuery({
    queryKey: ['supabase-health'],
    queryFn: ({ signal }) => checkSupabaseHealth(signal),
    staleTime: 60_000,
  })
}
