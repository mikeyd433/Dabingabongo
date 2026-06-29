-- Phase 3 — Round setup & lobby
--
-- Rounds, the round roster, and the per-round active-rule snapshot, plus the
-- RPCs that create/join/start a round. A round's conversion + theme + active
-- rules are snapshotted onto the round so later edits to the group library never
-- rewrite it (architecture principle 2). RLS on every new table; round_players
-- is published for Realtime so lobbies populate live.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  code text not null,
  course_name text not null default '',
  played_on date not null default current_date,
  scoring_mode text not null default 'multi_phone'
    check (scoring_mode in ('multi_phone', 'single_phone')),
  status text not null default 'lobby'
    check (status in ('setup', 'lobby', 'active', 'complete')),
  conversion_snapshot jsonb,
  theme_snapshot jsonb,
  animations_enabled boolean not null default true,
  tiebreak_winner_id uuid,
  tiebreak_method text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rounds_code_idx on public.rounds (code);

create table if not exists public.round_players (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  display_name text not null,
  is_guest boolean not null default false,
  managed_by uuid references public.profiles (id) on delete set null,
  roster_status text not null default 'active'
    check (roster_status in ('active', 'left')),
  joined_at timestamptz not null default now(),
  regular_strokes integer,
  claim_token text,
  claim_token_expires_at timestamptz,
  claimed boolean not null default false
);

-- One roster row per real (non-guest) player per round; guests have null profile.
create unique index if not exists round_players_unique_profile
  on public.round_players (round_id, profile_id)
  where profile_id is not null;
create index if not exists round_players_round_idx
  on public.round_players (round_id);

-- Per-round active-rule snapshot (spec §5, §7). Frozen copy so editing the group
-- rule later never changes a started round's palette/history.
create table if not exists public.round_rules (
  round_id uuid not null references public.rounds (id) on delete cascade,
  rule_id uuid not null references public.rules (id) on delete cascade,
  name_snapshot text not null,
  display_name_snapshot text not null default '',
  description_snapshot text,
  points_snapshot integer not null default 1,
  player_scope text not null default 'single',
  is_repeatable boolean not null default true,
  primary key (round_id, rule_id)
);

-- ---------------------------------------------------------------------------
-- Helper: participant check (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_round_participant(rid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.round_players
    where round_id = rid and profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

-- Create a round in the lobby and snapshot its config + active rules. The
-- creator is added to the roster so they immediately satisfy participant RLS.
create or replace function public.create_round(
  p_group_id uuid,
  p_course text,
  p_played_on date,
  p_scoring_mode text,
  p_conversion jsonb,
  p_theme jsonb,
  p_animations boolean,
  p_rule_ids uuid[]
)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rounds;
  new_code text;
  is_free boolean;
  creator_name text;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a group member';
  end if;

  loop
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 5));
    select not exists (
      select 1 from public.rounds
      where code = new_code and status <> 'complete'
    ) into is_free;
    exit when is_free;
  end loop;

  insert into public.rounds
    (group_id, code, course_name, played_on, scoring_mode,
     status, conversion_snapshot, theme_snapshot, animations_enabled, created_by)
  values
    (p_group_id, new_code, coalesce(p_course, ''),
     coalesce(p_played_on, current_date),
     coalesce(p_scoring_mode, 'multi_phone'),
     'lobby', p_conversion, p_theme, coalesce(p_animations, true), auth.uid())
  returning * into r;

  select display_name into creator_name
    from public.profiles where id = auth.uid();

  insert into public.round_players (round_id, profile_id, display_name, is_guest)
  values (r.id, auth.uid(), coalesce(creator_name, 'Player'), false);

  insert into public.round_rules
    (round_id, rule_id, name_snapshot, display_name_snapshot,
     description_snapshot, points_snapshot, player_scope, is_repeatable)
  select r.id, ru.id, ru.name, ru.display_name, ru.description,
         ru.points, ru.player_scope, ru.is_repeatable
  from public.rules ru
  where ru.group_id = p_group_id
    and ru.id = any(p_rule_ids);

  return r;
end;
$$;

-- Join a round by code (anonymous players welcome; rejoin reactivates the row).
create or replace function public.join_round_with_code(p_code text)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rounds;
  existing uuid;
  joiner_name text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into r from public.rounds
  where code = upper(trim(p_code)) and status in ('lobby', 'active')
  order by created_at desc
  limit 1;
  if r.id is null then raise exception 'Round not found'; end if;

  select id into existing from public.round_players
  where round_id = r.id and profile_id = auth.uid();

  if existing is not null then
    update public.round_players set roster_status = 'active' where id = existing;
  else
    select display_name into joiner_name
      from public.profiles where id = auth.uid();
    insert into public.round_players (round_id, profile_id, display_name, is_guest)
    values (r.id, auth.uid(), coalesce(joiner_name, 'Player'), false);
  end if;

  return r;
end;
$$;

-- Pre-add a guest (e.g. a phoneless player in Single Phone; spec §5, §6).
create or replace function public.add_round_guest(
  p_round_id uuid,
  p_display_name text
)
returns public.round_players
language plpgsql
security definer
set search_path = public
as $$
declare
  rp public.round_players;
begin
  if not public.is_round_participant(p_round_id) then
    raise exception 'Not a participant';
  end if;

  insert into public.round_players
    (round_id, profile_id, display_name, is_guest, managed_by)
  values
    (p_round_id, null, coalesce(nullif(trim(p_display_name), ''), 'Guest'),
     true, auth.uid())
  returning * into rp;
  return rp;
end;
$$;

-- Lock the round and go live. Only the creator can start (spec §5).
create or replace function public.start_round(p_round_id uuid)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rounds;
begin
  update public.rounds
    set status = 'active', started_at = now()
  where id = p_round_id and created_by = auth.uid() and status = 'lobby'
  returning * into r;

  if r.id is null then
    raise exception 'Only the creator can start this round';
  end if;
  return r;
end;
$$;

revoke all on function public.create_round(uuid, text, date, text, jsonb, jsonb, boolean, uuid[]) from public;
revoke all on function public.join_round_with_code(text) from public;
revoke all on function public.add_round_guest(uuid, text) from public;
revoke all on function public.start_round(uuid) from public;
grant execute on function public.create_round(uuid, text, date, text, jsonb, jsonb, boolean, uuid[]) to authenticated;
grant execute on function public.join_round_with_code(text) to authenticated;
grant execute on function public.add_round_guest(uuid, text) to authenticated;
grant execute on function public.start_round(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.rounds enable row level security;
alter table public.round_players enable row level security;
alter table public.round_rules enable row level security;

-- Rounds: visible to participants and to members of the round's group (spec §11,
-- §14). Creates/starts flow through the RPCs above.
create policy rounds_select on public.rounds
  for select using (
    public.is_round_participant(id) or public.is_group_member(group_id)
  );

-- Round players: visible to participants. Writes are via RPC; a player may
-- update their own roster row (e.g. leave/rejoin in later phases).
create policy round_players_select on public.round_players
  for select using (public.is_round_participant(round_id));
create policy round_players_update_self on public.round_players
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Round rules snapshot: readable by participants.
create policy round_rules_select on public.round_rules
  for select using (public.is_round_participant(round_id));

-- ---------------------------------------------------------------------------
-- Realtime: publish round tables so lobbies/leaderboards update live
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'round_players'
  ) then
    alter publication supabase_realtime add table public.round_players;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'rounds'
  ) then
    alter publication supabase_realtime add table public.rounds;
  end if;
end $$;
