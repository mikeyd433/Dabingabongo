-- Phase 11 follow-up — security hardening (from Supabase advisors)
--
-- The app intentionally routes all writes through SECURITY DEFINER RPCs that
-- each check auth.uid()/membership, so the advisor's generic "SECURITY DEFINER
-- function is executable" notices on those RPCs are by design. Two findings are
-- real and fixed here:
--
-- 1. Internal-only helpers were left executable by clients. `seed_group_defaults`
--    is the dangerous one: it mutates (inserts rules/conversion, updates a group)
--    with no caller check, and is only ever invoked internally by create_group()
--    and the signup trigger (both run as the definer/owner, so they keep access
--    regardless of these revokes). The trigger functions can't meaningfully be
--    called over PostgREST, but we lock them down for hygiene too.
-- 2. The public `avatars` bucket had a broad SELECT policy that let clients list
--    every file. Public buckets serve object URLs without it (the app uses
--    getPublicUrl), so dropping it removes the enumeration surface.

revoke execute on function public.seed_group_defaults(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_updated() from public, anon, authenticated;

drop policy if exists avatars_read_public on storage.objects;
