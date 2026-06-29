-- Phase 11 — Community → People (Option B)
--
-- "People" is built from users you've actually shared a round with — no global
-- directory (spec §11). This migration adds the access layer: a round-sharing
-- predicate, widened profile visibility so people you've played with are
-- readable, and three SECURITY DEFINER RPCs (people list, a player's visible
-- rounds, quick-add to a group). No new tables; RLS-first stays intact.

-- ---------------------------------------------------------------------------
-- Helper: do I share a completed-or-live round with `other`? (spec §11)
-- SECURITY DEFINER to avoid RLS recursion, mirrors shares_group from 0002.
-- ---------------------------------------------------------------------------

create or replace function public.shares_round(other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.round_players me
    join public.round_players them on them.round_id = me.round_id
    where me.profile_id = auth.uid()
      and them.profile_id = other
  );
$$;

-- Widen profile reads: visible to people you share a group OR a round with, so a
-- player's avatar/message shows wherever they appear and in the People list
-- (spec §11). Replaces the group-only policy from migration 0002.
drop policy if exists profiles_select_comember on public.profiles;
create policy profiles_select_visible on public.profiles
  for select using (
    public.shares_group(id) or public.shares_round(id)
  );

-- ---------------------------------------------------------------------------
-- People I've played with (Option B). Distinct real (non-guest) profiles who
-- appear in a round I'm also in, with how many rounds we've shared and when we
-- last played. Scoped to auth.uid()'s rounds; SECURITY DEFINER so it can
-- aggregate across rounds without tripping per-row RLS.
-- ---------------------------------------------------------------------------

create or replace function public.people_i_played_with()
returns table (
  profile_id uuid,
  display_name text,
  avatar_url text,
  custom_message text,
  is_anonymous boolean,
  shared_rounds integer,
  last_played_on date
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.custom_message,
    p.is_anonymous,
    count(distinct me.round_id)::int as shared_rounds,
    max(r.played_on) as last_played_on
  from public.round_players me
  join public.round_players them
    on them.round_id = me.round_id
   and them.profile_id is distinct from me.profile_id
  join public.profiles p on p.id = them.profile_id
  join public.rounds r on r.id = me.round_id
  where me.profile_id = auth.uid()
    and them.profile_id is not null
    and them.is_guest = false
  group by p.id, p.display_name, p.avatar_url, p.custom_message, p.is_anonymous
  order by max(r.played_on) desc nulls last, p.display_name asc;
$$;

revoke all on function public.people_i_played_with() from public;
grant execute on function public.people_i_played_with() to authenticated;

-- ---------------------------------------------------------------------------
-- A player's rounds I'm allowed to see: completed rounds they played that I
-- either played too, or that belong to a group I'm in (spec §11 round
-- visibility). is_round_participant / is_group_member resolve against auth.uid().
-- ---------------------------------------------------------------------------

create or replace function public.rounds_with_player(p_other uuid)
returns setof public.rounds
language sql
security definer
stable
set search_path = public
as $$
  select distinct r.*
  from public.rounds r
  join public.round_players them
    on them.round_id = r.id and them.profile_id = p_other
  where r.status = 'complete'
    and (
      public.is_round_participant(r.id)
      or public.is_group_member(r.group_id)
    )
  order by r.played_on desc;
$$;

revoke all on function public.rounds_with_player(uuid) from public;
grant execute on function public.rounds_with_player(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Quick-add a player you've played with to one of your groups (spec §11). The
-- caller must be a member of the target group; the player must have shared a
-- round/group with you (consent — no adding strangers) and have an account
-- (group membership is login-only). Idempotent.
-- ---------------------------------------------------------------------------

create or replace function public.quick_add_to_group(
  p_group_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'You are not a member of this group';
  end if;
  if not (public.shares_round(p_profile_id) or public.shares_group(p_profile_id)) then
    raise exception 'You can only add people you have played with';
  end if;
  if exists (
    select 1 from public.profiles
    where id = p_profile_id and is_anonymous = true
  ) then
    raise exception 'That player needs an account before joining a group';
  end if;

  insert into public.group_members (group_id, profile_id, role)
  values (p_group_id, p_profile_id, 'member')
  on conflict (group_id, profile_id) do nothing;
end;
$$;

revoke all on function public.quick_add_to_group(uuid, uuid) from public;
grant execute on function public.quick_add_to_group(uuid, uuid) to authenticated;
