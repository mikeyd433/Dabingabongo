// Supabase Edge Function (Deno) — sends a guest their results + a one-time claim
// link (spec §10). Runs server-side so the Resend key and service-role key never
// reach the browser. Deploy: `supabase functions deploy send-claim-email`.
//
// Required secrets (set with `supabase secrets set …`, never committed):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY  (injected by Supabase)
//   RESEND_API_KEY        — Resend API key
//   CLAIM_FROM            — verified Resend sender, e.g. "Stroke Off <noreply@dabingabongo.com>"
//   APP_URL              — public app base, e.g. "https://dabingabongo.com/strokeoff"
//
// NOTE: this is Deno, not part of the Vite/tsc build (it lives outside `src`), so
// it isn't type-checked by `pnpm typecheck` and is ignored by eslint.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
  const CLAIM_FROM =
    Deno.env.get('CLAIM_FROM') ?? 'Stroke Off <noreply@dabingabongo.com>'
  const APP_URL =
    Deno.env.get('APP_URL') ?? 'https://dabingabongo.com/strokeoff'

  try {
    const { roundPlayerId, email } = await req.json()
    if (!roundPlayerId || !email) {
      return json(400, { error: 'Missing roundPlayerId or email' })
    }

    // Verify the requester is a participant of the guest's round, as themselves
    // (RLS-scoped), before minting anything.
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json(401, { error: 'Not signed in' })

    const { data: guest } = await userClient
      .from('round_players')
      .select('id, round_id, is_guest, display_name, rounds(course_name)')
      .eq('id', roundPlayerId)
      .maybeSingle()
    if (!guest || !guest.is_guest) {
      return json(404, { error: 'Guest not found' })
    }
    const { data: me } = await userClient
      .from('round_players')
      .select('id')
      .eq('round_id', guest.round_id)
      .eq('profile_id', user.id)
      .maybeSingle()
    if (!me) return json(403, { error: 'Not a participant of this round' })

    // Mint the token as service_role (bypasses RLS; returns the raw token).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: token, error: mintError } = await admin.rpc(
      'issue_guest_claim',
      { p_guest_id: roundPlayerId },
    )
    if (mintError || !token) {
      return json(500, { error: mintError?.message ?? 'Could not issue claim' })
    }

    const course =
      (guest as { rounds?: { course_name?: string } }).rounds?.course_name ||
      'your round'
    const link = `${APP_URL}/round?claim=${token}`
    const html = `
      <p>Hi ${escapeHtml(guest.display_name)},</p>
      <p>You played in <strong>${escapeHtml(course)}</strong> on Stroke Off.
      Claim your score to keep it on your own account:</p>
      <p><a href="${link}">Claim my score</a></p>
      <p>This link works once and expires in 7 days.</p>
    `

    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: CLAIM_FROM,
        to: email,
        subject: 'Claim your Stroke Off score',
        html,
      }),
    })
    if (!sent.ok) {
      return json(502, { error: 'Email failed to send' })
    }

    return json(200, { ok: true })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] ?? c,
  )
}
