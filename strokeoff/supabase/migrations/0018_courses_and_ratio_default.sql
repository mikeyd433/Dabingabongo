-- Phase 18 — Saved courses + ratio as the default conversion
--
--  1. A per-group `courses` library: when a round is created with a course name,
--     it's remembered (with its total par) so it can be picked again next time
--     and the par auto-fills. Snapshotting is unchanged — a round still freezes
--     its own par, so editing a saved course never rewrites past rounds.
--  2. Make the ratio conversion the default: new groups seed a ratio house
--     conversion, and existing *untouched* seeded tier defaults are converted to
--     ratio. Customized conversions are left alone.

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  par integer,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One row per course name within a group (case-insensitive), so repeats update.
create unique index if not exists courses_group_name_idx
  on public.courses (group_id, lower(name));
create index if not exists courses_group_idx on public.courses (group_id);

alter table public.courses enable row level security;

create policy courses_select_member on public.courses
  for select using (public.is_group_member(group_id));
create policy courses_insert_member on public.courses
  for insert with check (
    public.is_group_member(group_id) and created_by = auth.uid()
  );
create policy courses_update_member on public.courses
  for update using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));
create policy courses_delete_member on public.courses
  for delete using (public.is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- Ratio is the new default conversion
-- ---------------------------------------------------------------------------

-- New groups: seed a ratio house conversion (keep the example rules from 0002).
create or replace function public.seed_group_defaults(p_group_id uuid, p_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
begin
  insert into public.conversion_tables (group_id, name, mode, config)
  values (
    p_group_id,
    'House conversion',
    'ratio',
    '{"pointsPerStroke":5}'::jsonb
  )
  returning id into conv_id;

  update public.groups set default_conversion_id = conv_id where id = p_group_id;

  insert into public.rules
    (group_id, name, display_name, description, points, player_scope, is_repeatable, active, created_by)
  values
    (p_group_id, 'Birdie', 'Birdie', 'Score a birdie on any hole.', 1, 'single', true, true, p_owner),
    (p_group_id, 'Parked', 'Parked', 'Land your drive within a putter''s reach of the basket.', 1, 'single', true, true, p_owner),
    (p_group_id, 'Longest drive', 'Longest drive', 'Longest measured drive on a hole.', 1, 'single', true, true, p_owner),
    (p_group_id, 'Group ace', 'Group ace', 'Two or more players ace the same hole.', 2, 'multi', true, true, p_owner);
end;
$$;
revoke execute on function public.seed_group_defaults(uuid, uuid)
  from public, anon, authenticated;

-- Existing groups: convert only the *untouched* seeded tier default to ratio, so
-- any conversion a group actually customized is preserved as-is.
update public.conversion_tables
set mode = 'ratio', config = '{"pointsPerStroke":5}'::jsonb
where mode = 'tier'
  and config = '{"tiers":[{"minPoints":0,"strokes":0},{"minPoints":5,"strokes":1},{"minPoints":10,"strokes":2},{"minPoints":15,"strokes":3}]}'::jsonb;

-- ---------------------------------------------------------------------------
-- create_round — remember the course (name + par) on creation (based on 0017).
-- ---------------------------------------------------------------------------

create or replace function public.create_round(
  p_group_id uuid,
  p_course text,
  p_played_on date,
  p_scoring_mode text,
  p_conversion jsonb,
  p_theme jsonb,
  p_animations boolean,
  p_rule_ids uuid[],
  p_par integer default null
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
     status, conversion_snapshot, theme_snapshot, animations_enabled, par,
     created_by)
  values
    (p_group_id, new_code, coalesce(p_course, ''),
     coalesce(p_played_on, current_date),
     coalesce(p_scoring_mode, 'multi_phone'),
     'lobby', p_conversion, p_theme, coalesce(p_animations, true), p_par,
     auth.uid())
  returning * into r;

  select display_name into creator_name
    from public.profiles where id = auth.uid();

  insert into public.round_players (round_id, profile_id, display_name, is_guest)
  values (r.id, auth.uid(), coalesce(creator_name, 'Player'), false);

  insert into public.round_rules
    (round_id, rule_id, name_snapshot, display_name_snapshot,
     description_snapshot, points_snapshot, player_scope, is_repeatable,
     animation_config, is_scalable, quantity_label)
  select r.id, ru.id, ru.name, ru.display_name, ru.description,
         ru.points, ru.player_scope, ru.is_repeatable, ru.animation_config,
         ru.is_scalable, ru.quantity_label
  from public.rules ru
  where ru.group_id = p_group_id
    and ru.id = any(p_rule_ids);

  -- Remember the course for next time (par updates if a value is supplied).
  if coalesce(trim(p_course), '') <> '' then
    insert into public.courses (group_id, name, par, created_by)
    values (p_group_id, trim(p_course), p_par, auth.uid())
    on conflict (group_id, lower(name)) do update
      set par = coalesce(excluded.par, public.courses.par);
  end if;

  return r;
end;
$$;

revoke all on function public.create_round(
  uuid, text, date, text, jsonb, jsonb, boolean, uuid[], integer
) from public;
grant execute on function public.create_round(
  uuid, text, date, text, jsonb, jsonb, boolean, uuid[], integer
) to authenticated;
