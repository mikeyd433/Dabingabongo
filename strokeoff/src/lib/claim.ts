import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Round } from '@/types'

/**
 * Phase 9 — guest claim flow (spec §10). Sending the claim email goes through the
 * `send-claim-email` Edge Function (Resend + service-role minting, server-side);
 * redeeming a token is a SECURITY DEFINER RPC that binds the guest slot to the
 * signed-in account.
 */

export function useSendClaimEmail() {
  return useMutation({
    mutationFn: async ({
      roundPlayerId,
      email,
    }: {
      roundPlayerId: string
      email: string
    }) => {
      const { data, error } = await supabase.functions.invoke(
        'send-claim-email',
        { body: { roundPlayerId, email } },
      )
      if (error) throw error
      // The function returns { error } in its body on handled failures.
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String((data as { error: unknown }).error))
      }
    },
  })
}

export function useRedeemClaim() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (token: string): Promise<Round> => {
      const { data, error } = await supabase.rpc('redeem_guest_claim', {
        p_token: token,
      })
      if (error) throw error
      return data as Round
    },
    onSuccess: (round) => {
      void qc.invalidateQueries({ queryKey: ['current-round', user?.id] })
      void qc.invalidateQueries({ queryKey: ['round-players', round.id] })
      void qc.invalidateQueries({ queryKey: ['history-rounds', user?.id] })
    },
  })
}
