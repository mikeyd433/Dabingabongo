-- Phase 23 — Round-scoped pars; the directory becomes backend-maintained
--
-- Two changes that belong together. They split "what a course's par is" from
-- "what par we're playing today", and put each in the right hands.
--
--  1. The shared course directory (0021/0022) is reference data now, not a
--     wiki. Player-facing writes are withdrawn: the tables stay world-readable,
--     but corrections come from the backend — either the admin_* helpers below
--     (service_role only, same shape as the 0020 moderation valves) or by
--     regenerating the seed migration from supabase/seed/ma-courses.json.
--
--  2. A round gets its own hole-by-hole par card, editable by ANY participant
--     while the round is in play. Baskets move, a hole plays long, you agree on
--     the tee that today hole 7 is a 4 — that's a fact about this round, not a
--     correction to the course. Round pars never touch the directory, and the
--     directory never rewrites a round.
--
-- `rounds.par` remains the single number results read for over/under-par
-- finals. When a hole card exists it drives that number; when it doesn't, par
-- stays directly editable exactly as before.

-- ---------------------------------------------------------------------------
-- 1. Directory: withdraw client writes
-- ---------------------------------------------------------------------------

drop policy if exists course_directory_insert on public.course_directory;
drop policy if exists course_directory_update on public.course_directory;
drop policy if exists course_directory_delete on public.course_directory;
drop policy if exists course_layouts_insert on public.course_layouts;
drop policy if exists course_layouts_update on public.course_layouts;
drop policy if exists course_layouts_delete on public.course_layouts;
drop policy if exists course_holes_insert on public.course_holes;
drop policy if exists course_holes_update on public.course_holes;
drop policy if exists course_holes_delete on public.course_holes;

-- The select policies from 0021 stay: the directory is still world-readable, so
-- anyone can look a course up. With RLS on and no write policy left, no client
-- role can change it; service_role and the definer functions below still can.

-- Backend maintenance (service_role only). Not exposed to any client role —
-- call from the Supabase SQL editor:
--     select public.admin_set_course_par('<course-id>', 54, 'Measured 2026-08');
--     select public.admin_set_layout_par('<layout-id>', 56);
--     select public.admin_set_layout_holes('<layout-id>', array[3,4,3,5,...]);
--     select public.admin_add_course('Backyard Basket', 'Franklin', 9, 27);
-- Bulk changes are better made in supabase/seed/ma-courses.json and re-imported.

create or replace function public.admin_set_course_par(
  p_course_id uuid,
  p_total_par integer,
  p_source text default null
)
returns public.course_directory
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.course_directory;
begin
  update public.course_directory
  set total_par = p_total_par,
      par_source = coalesce(p_source, par_source),
      par_confidence = 'verified'
  where id = p_course_id
  returning * into c;
  if c.id is null then raise exception 'Course not found'; end if;
  return c;
end;
$$;

create or replace function public.admin_set_layout_par(
  p_layout_id uuid,
  p_total_par integer
)
returns public.course_layouts
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.course_layouts;
begin
  if exists (select 1 from public.course_holes where layout_id = p_layout_id) then
    raise exception 'This layout has hole pars; use admin_set_layout_holes instead';
  end if;

  update public.course_layouts
  set total_par = p_total_par
  where id = p_layout_id
  returning * into l;
  if l.id is null then raise exception 'Layout not found'; end if;
  return l;
end;
$$;

-- Replace a layout's hole-by-hole card. The 0021 trigger re-derives the
-- layout's total par from what lands here.
create or replace function public.admin_set_layout_holes(
  p_layout_id uuid,
  p_pars integer[],
  p_distances integer[] default null
)
returns public.course_layouts
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.course_layouts;
  n integer := coalesce(array_length(p_pars, 1), 0);
  i integer;
begin
  if n < 1 or n > 36 then
    raise exception 'A layout must have between 1 and 36 holes';
  end if;

  delete from public.course_holes
    where layout_id = p_layout_id and hole_number > n;

  for i in 1..n loop
    insert into public.course_holes (layout_id, hole_number, par, distance_ft)
    values (p_layout_id, i, p_pars[i],
            case when p_distances is null then null else p_distances[i] end)
    on conflict (layout_id, hole_number) do update
      set par = excluded.par,
          distance_ft = coalesce(excluded.distance_ft, public.course_holes.distance_ft);
  end loop;

  select * into l from public.course_layouts where id = p_layout_id;
  if l.id is null then raise exception 'Layout not found'; end if;
  return l;
end;
$$;

create or replace function public.admin_add_course(
  p_name text,
  p_city text default null,
  p_hole_count integer default null,
  p_total_par integer default null
)
returns public.course_directory
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.course_directory;
begin
  if exists (
    select 1 from public.course_directory
    where lower(trim(name)) = lower(trim(p_name))
      and lower(coalesce(trim(city), '')) = lower(coalesce(trim(p_city), ''))
  ) then
    raise exception 'A course called % is already listed in %',
      p_name, coalesce(p_city, 'no town');
  end if;

  insert into public.course_directory
    (name, city, hole_count, total_par, par_low, par_high,
     par_confidence, par_source, is_seed)
  values
    (p_name, p_city, p_hole_count, p_total_par, p_total_par, p_total_par,
     case when p_total_par is null then 'unverified' else 'verified' end,
     case when p_total_par is null then null else 'Added from the backend' end,
     true)
  returning * into c;
  return c;
end;
$$;

revoke all on function public.admin_set_course_par(uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.admin_set_layout_par(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.admin_set_layout_holes(uuid, integer[], integer[])
  from public, anon, authenticated;
revoke all on function public.admin_add_course(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_set_course_par(uuid, integer, text) to service_role;
grant execute on function public.admin_set_layout_par(uuid, integer) to service_role;
grant execute on function public.admin_set_layout_holes(uuid, integer[], integer[]) to service_role;
grant execute on function public.admin_add_course(text, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Round-scoped hole pars
-- ---------------------------------------------------------------------------

create table if not exists public.round_holes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 36),
  par integer not null check (par between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists round_holes_round_hole_idx
  on public.round_holes (round_id, hole_number);
create index if not exists round_holes_round_idx
  on public.round_holes (round_id);

-- The round's card drives the round's par. Same rule as a directory layout:
-- where hole detail exists, the total is the sum of it and can't drift.
create or replace function public.sync_round_par()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  rid := coalesce(new.round_id, old.round_id);

  update public.rounds r
  set par = agg.par_sum
  from (
    select count(*)::int as hole_total, sum(par)::int as par_sum
    from public.round_holes
    where round_id = rid
  ) agg
  where r.id = rid and agg.hole_total > 0;

  return coalesce(new, old);
end;
$$;

drop trigger if exists round_holes_sync_par on public.round_holes;
create trigger round_holes_sync_par
  after insert or update or delete on public.round_holes
  for each row execute function public.sync_round_par();

revoke execute on function public.sync_round_par() from public, anon, authenticated;

alter table public.round_holes enable row level security;

-- Readable by participants; every write goes through the participant-checked
-- RPCs below, matching how the rest of a round is written.
create policy round_holes_select on public.round_holes
  for select using (public.is_round_participant(round_id));

-- Replace this round's hole card. Any participant, any time — agreeing that
-- hole 7 is playing as a 4 today is a call the card makes, not the host.
create or replace function public.set_round_hole_pars(
  p_round_id uuid,
  p_pars integer[]
)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rounds;
  n integer := coalesce(array_length(p_pars, 1), 0);
  i integer;
begin
  if not public.is_round_participant(p_round_id) then
    raise exception 'Not a participant';
  end if;
  if n < 1 or n > 36 then
    raise exception 'A round must have between 1 and 36 holes';
  end if;
  for i in 1..n loop
    if p_pars[i] is null or p_pars[i] < 1 or p_pars[i] > 10 then
      raise exception 'Hole % needs a par between 1 and 10', i;
    end if;
  end loop;

  delete from public.round_holes
    where round_id = p_round_id and hole_number > n;

  for i in 1..n loop
    insert into public.round_holes (round_id, hole_number, par)
    values (p_round_id, i, p_pars[i])
    on conflict (round_id, hole_number) do update
      set par = excluded.par, updated_at = now();
  end loop;

  select * into r from public.rounds where id = p_round_id;
  return r;
end;
$$;

-- Drop the hole card and hand par back to direct editing. The total it last
-- produced is left on the round — clearing the breakdown isn't the same as
-- saying you no longer know the par.
create or replace function public.clear_round_hole_pars(p_round_id uuid)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rounds;
begin
  if not public.is_round_participant(p_round_id) then
    raise exception 'Not a participant';
  end if;

  delete from public.round_holes where round_id = p_round_id;

  select * into r from public.rounds where id = p_round_id;
  if r.id is null then raise exception 'Round not found'; end if;
  return r;
end;
$$;

-- Pull a directory layout's card into this round as a starting point. It's a
-- copy: editing the round's holes afterwards never touches the directory.
create or replace function public.load_round_hole_pars(
  p_round_id uuid,
  p_layout_id uuid
)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rounds;
  n integer;
begin
  if not public.is_round_participant(p_round_id) then
    raise exception 'Not a participant';
  end if;

  select count(*) into n from public.course_holes where layout_id = p_layout_id;
  if n = 0 then
    raise exception 'That layout has no hole pars to copy';
  end if;

  delete from public.round_holes
    where round_id = p_round_id
      and hole_number > (
        select max(hole_number) from public.course_holes where layout_id = p_layout_id
      );

  insert into public.round_holes (round_id, hole_number, par)
  select p_round_id, h.hole_number, h.par
  from public.course_holes h
  where h.layout_id = p_layout_id
  on conflict (round_id, hole_number) do update
    set par = excluded.par, updated_at = now();

  select * into r from public.rounds where id = p_round_id;
  return r;
end;
$$;

revoke all on function public.set_round_hole_pars(uuid, integer[])
  from public, anon, authenticated;
revoke all on function public.clear_round_hole_pars(uuid)
  from public, anon, authenticated;
revoke all on function public.load_round_hole_pars(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.set_round_hole_pars(uuid, integer[]) to authenticated;
grant execute on function public.clear_round_hole_pars(uuid) to authenticated;
grant execute on function public.load_round_hole_pars(uuid, uuid) to authenticated;

-- Setting the total directly is refused while a hole card exists, so the two
-- can't silently disagree — clear the card first, or edit the holes.
create or replace function public.set_round_par(p_round_id uuid, p_par integer)
returns public.rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rounds;
begin
  if not public.is_round_participant(p_round_id) then
    raise exception 'Not a participant';
  end if;
  if p_par is not null and p_par < 0 then
    raise exception 'Par cannot be negative';
  end if;
  if exists (select 1 from public.round_holes where round_id = p_round_id) then
    raise exception 'This round has hole pars — edit those, or clear them first';
  end if;

  update public.rounds set par = p_par where id = p_round_id returning * into r;
  if r.id is null then raise exception 'Round not found'; end if;
  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: par changes reach every phone in the round
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'round_holes'
  ) then
    alter publication supabase_realtime add table public.round_holes;
  end if;
end $$;
