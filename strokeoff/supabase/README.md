# Supabase

Database migrations and edge functions for Stroke Off. Every table ships with Row
Level Security in the migration that creates it (architecture principle 3).

## Migrations

- `migrations/0001_identity_and_groups.sql` — Phase 1. Profiles, groups,
  group_members, signup provisioning trigger (auto-creates a profile + personal
  group), a secure `delete_account()` RPC, and a public `avatars` storage bucket.
- `migrations/0002`–`0008` — Phases 2–9: rules + conversion (2), rounds/lobby +
  RPCs (3), live scoring `point_events`/`event_confirmations` (4), single-phone +
  guest permission widening (5), end-of-round/tiebreak/history (6), animation
  snapshot (7), and the guest **claim** RPCs (8: `issue_guest_claim` /
  `redeem_guest_claim`).

## Edge Functions

- `functions/send-claim-email` — Phase 9 (spec §10). Verifies the caller is a
  round participant, mints a one-time claim token (service role), and emails the
  guest a claim link via **Resend**. Deploy + configure secrets:

  ```bash
  npx supabase functions deploy send-claim-email
  npx supabase secrets set RESEND_API_KEY=… \
    CLAIM_FROM="Stroke Off <noreply@dabingabongo.com>" \
    APP_URL="https://dabingabongo.com/strokeoff"
  ```

  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected
  by the platform. `CLAIM_FROM` must be a Resend-verified sender.

## Applying

With the Supabase CLI linked to your project:

```bash
npx supabase db push           # apply migrations to the linked project
# or, for a local stack:
npx supabase start
npx supabase db reset          # re-applies all migrations locally
```

## Project settings to enable (Auth)

Phase 1 uses two sign-in methods (spec §4):

- **Anonymous sign-ins** — enable under Authentication → Providers → Anonymous.
- **Magic link / email OTP** — enable the Email provider. Add the app origin to
  Authentication → URL Configuration → Redirect URLs (e.g. your Netlify URL and
  `http://localhost:5173` for local dev).

The guest **claim** phase (9) additionally needs the `send-claim-email` function
deployed and a Resend API key configured (see Edge Functions above). Add the claim
landing URL (`/strokeoff/round`) to the Auth redirect allow-list too, since the
magic-link from the claim email returns there.
