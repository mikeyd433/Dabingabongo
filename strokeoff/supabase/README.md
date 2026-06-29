# Supabase

Database migrations and (later) edge functions for Stroke Off. Every table ships
with Row Level Security in the migration that creates it (architecture principle 3).

## Migrations

- `migrations/0001_identity_and_groups.sql` — Phase 1. Profiles, groups,
  group_members, signup provisioning trigger (auto-creates a profile + personal
  group), a secure `delete_account()` RPC, and a public `avatars` storage bucket.

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

No Resend/service-role configuration is needed until the email/claim phase.
