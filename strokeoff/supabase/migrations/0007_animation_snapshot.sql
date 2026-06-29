-- Phase 8 — Animations
--
-- Snapshot each active rule's animation_config onto round_rules at Start, the same
-- way the rule's name/points are frozen (architecture principle 2), so the live
-- screen's palette carries everything a celebration needs. No new tables; this
-- adds one column and re-declares create_round (from 0003) to populate it.

alter table public.round_rules
  add column if not exists animation_config jsonb;

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
