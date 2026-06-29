-- Phase 9 — Guest claim flow (spec §10, Option B)
--
-- A guest can be emailed a one-time, expiring link that, after they sign in,
-- reassigns that round's guest slot (and its points) to their account. Tokens
-- reuse the existing round_players claim columns, but only the **md5 hash** of the
-- token is stored — the raw token lives only in the emailed link — so the fact
-- that participants can read round_players can't leak a usable token. Minting is
-- service-role-only (the Edge Function); redeeming is for the signing-in user.

-- ---------------------------------------------------------------------------
-- Mint a claim token for a guest slot. Returns the RAW token (caller is the
-- trusted Edge Function running as service_role; never exposed to the browser).
-- ---------------------------------------------------------------------------

create or replace function public.issue_guest_claim(p_guest_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.round_players;
  raw_token text;
begin
  select * into g from public.round_players where id = p_guest_id;
  if g.id is null or not g.is_guest then
    raise exception 'Not a guest';
  end if;

  -- High-entropy random token; store only its hash.
  raw_token := replace(gen_random_uuid()::text, '-', '')
            || replace(gen_random_uuid()::text, '-', '');

  update public.round_players
    set claim_token = md5(raw_token),
        claim_token_expires_at = now() + interval '7 days',
        claimed = false
  where id = p_guest_id;

  return raw_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- Redeem a claim token: bind the guest slot to the signed-in account. Safe-fail
-- on invalid / already-claimed / expired, and refuse if the claimer is already a
-- player in that round (one profile per round). One-time use.
-- ---------------------------------------------------------------------------

create or replace function public.redeem_guest_claim(p_token text)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.round_players;
  r public.rounds;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if coalesce(trim(p_token), '') = '' then
    raise exception 'This claim link is invalid';
  end if;

  select * into g from public.round_players
  where claim_token = md5(p_token) and is_guest and not claimed;
  if g.id is null then
    raise exception 'This claim link is invalid or has already been used';
  end if;

  if g.claim_token_expires_at is not null
     and g.claim_token_expires_at < now() then
    raise exception 'This claim link has expired';
  end if;

  if exists (
    select 1 from public.round_players
    where round_id = g.round_id and profile_id = auth.uid()
  ) then
    raise exception 'You are already a player in this round';
  end if;

  update public.round_players
    set profile_id = auth.uid(),
        is_guest = false,
        managed_by = null,
        claimed = true,
        claim_token = null,
        claim_token_expires_at = null
  where id = g.id;

  select * into r from public.rounds where id = g.round_id;
  return r;
end;
$$;

-- Minting is callable only by the trusted server (service_role); redeeming is for
-- the signed-in user claiming their slot.
revoke all on function public.issue_guest_claim(uuid) from public;
revoke all on function public.redeem_guest_claim(text) from public;
grant execute on function public.issue_guest_claim(uuid) to service_role;
grant execute on function public.redeem_guest_claim(text) to authenticated;
