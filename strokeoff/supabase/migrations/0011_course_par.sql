-- Course par + over/under-par finals
--
-- Adds an optional course `par` to a round so the results screen can show each
-- adjusted final relative to par (−2 / E / +3). Par is plain course metadata, not
-- a frozen snapshot like conversion/theme, so it's editable any time via
-- set_round_par. create_round is extended to accept it at setup.

alter table public.rounds add column if not exists par integer;

-- Set/fix the course par on a round — any participant, any time.
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

  update public.rounds set par = p_par where id = p_round_id returning * into r;
  if r.id is null then raise exception 'Round not found'; end if;
  return r;
end;
$$;

revoke all on function public.set_round_par(uuid, integer) from public;
grant execute on function public.set_round_par(uuid, integer) to authenticated;

-- Thread par through round creation. Drop the prior 8-arg signature first so the
-- new optional arg doesn't create an ambiguous overload, then recreate (body
-- unchanged from migration 0007 plus the par column).
drop function if exists public.create_round(
  uuid, text, date, text, jsonb, jsonb, boolean, uuid[]
);

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
     animation_config)
  select r.id, ru.id, ru.name, ru.display_name, ru.description,
         ru.points, ru.player_scope, ru.is_repeatable, ru.animation_config
  from public.rules ru
  where ru.group_id = p_group_id
    and ru.id = any(p_rule_ids);

  return r;
end;
$$;

revoke all on function public.create_round(
  uuid, text, date, text, jsonb, jsonb, boolean, uuid[], integer
) from public;
grant execute on function public.create_round(
  uuid, text, date, text, jsonb, jsonb, boolean, uuid[], integer
) to authenticated;
