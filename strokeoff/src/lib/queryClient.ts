import { QueryClient } from '@tanstack/react-query'

/**
 * Shared TanStack Query client for server state. Realtime round data will layer
 * Supabase subscriptions on top in later phases; this just establishes the provider.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
