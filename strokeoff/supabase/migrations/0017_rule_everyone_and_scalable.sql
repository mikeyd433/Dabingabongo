-- Phase 17 — Two new rule capabilities (spec §7 extension)
--
--  1. `everyone` player scope — a rule that, when logged, scores *every* active
--     player in the round at once (e.g. a group-wide bonus), not just the subject
--     or a hand-picked set. It's the auto-include-all sibling of `multi`.
--  2. Scalable rules — a rule whose points scale by a counted condition (e.g. one
--     point per time a disc bounces between trees). The points value is "points
--     per unit" and the logger enters the quantity, which rides on the existing
--     `point_events.count` column (value = count × points_snapshot), so no event
--     schema change is needed. `quantity_label` names the unit ("bounces").
--
-- Both are snapshotted into round_rules on round creation (principle 2), so editing
-- the library later never rewrites a live or completed round.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

-- Widen the rules scope check to include 'everyone'.
alter table public.rules drop constraint if exists rules_player_scope_check;
alter table public.rules
  add constraint rules_player_scope_check
  check (player_scope in ('single', 'multi', 'everyone'));

alter table public.rules
  add column if not exists is_scalable boolean not null default false;
alter table public.rules
  add column if not exists quantity_label text;

-- Frozen per-round copies of the two new fields.
alter table public.round_rules
  add column if not exists is_scalable boolean not null default false;
alter table public.round_rules
  add column if not exists quantity_label text;

-- ---------------------------------------------------------------------------
-- create_round — snapshot the two new fields alongside the rest (based on 0011).
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

  return r;
end;
$$;

revoke all on function public.create_round(
  uuid, text, date, text, jsonb, jsonb, boolean, uuid[], integer
) from public;
grant execute on function public.create_round(
  uuid, text, date, text, jsonb, jsonb, boolean, uuid[], integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- log_point — add the `everyone` branch (based on 0005).
--
-- `everyone`: the subject event is the anchor (idempotent on p_event_id); every
-- *other* active player then gets their own flat event for the same rule. Unlike
-- `multi`, this is a deliberate round-wide award, so it does not raise per-player
-- confirmations. `count` (the scalable quantity) applies uniformly to all.
-- ---------------------------------------------------------------------------

create or replace function public.log_point(
  p_round_id uuid,
  p_subject_player_id uuid,
  p_rule_id uuid,
  p_count integer default 1,
  p_involved_player_ids uuid[] default '{}',
  p_event_id uuid default null
)
returns public.point_events
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rounds;
  rr public.round_rules;
  ev public.point_events;
  n integer := greatest(1, coalesce(p_count, 1));
  involved uuid;
  coplayer record;
begin
  select * into r from public.rounds where id = p_round_id;
  if r.id is null then raise exception 'Round not found'; end if;
  if r.status <> 'active' then
    raise exception 'Round is not live';
  end if;

  if not public.controls_round_player(p_subject_player_id) then
    raise exception 'You can only log points for players you control';
  end if;

  select * into rr from public.round_rules
  where round_id = p_round_id and rule_id = p_rule_id;
  if rr.rule_id is null then
    raise exception 'Rule is not active in this round';
  end if;

  if rr.player_scope = 'single'
     and coalesce(array_length(p_involved_player_ids, 1), 0) > 0 then
    raise exception 'This rule is single-player';
  end if;

  if not rr.is_repeatable and exists (
    select 1 from public.point_events
    where round_id = p_round_id and subject_player_id = p_subject_player_id
      and rule_id = p_rule_id and not voided
  ) then
    raise exception 'This rule can only be logged once per player';
  end if;

  insert into public.point_events
    (id, round_id, subject_player_id, rule_id, rule_name_snapshot,
     points_snapshot, count, logged_by)
  values
    (coalesce(p_event_id, gen_random_uuid()), p_round_id, p_subject_player_id,
     p_rule_id, rr.name_snapshot, rr.points_snapshot, n, auth.uid())
  on conflict (id) do nothing
  returning * into ev;

  if ev.id is null then
    select * into ev from public.point_events where id = p_event_id;
    return ev;
  end if;

  if rr.player_scope = 'multi' then
    foreach involved in array coalesce(p_involved_player_ids, '{}') loop
      if involved = p_subject_player_id then continue; end if;
      if not exists (
        select 1 from public.round_players
        where id = involved and round_id = p_round_id
          and roster_status = 'active'
      ) then
        raise exception 'Involved player is not in this round';
      end if;

      declare
        other_ev public.point_events;
      begin
        insert into public.point_events
          (round_id, subject_player_id, rule_id, rule_name_snapshot,
           points_snapshot, count, logged_by)
        values
          (p_round_id, involved, p_rule_id, rr.name_snapshot,
           rr.points_snapshot, n, auth.uid())
        returning * into other_ev;

        -- Multi Phone asks the awarded player to confirm; Single Phone doesn't.
        if r.scoring_mode = 'multi_phone' then
          insert into public.event_confirmations (event_id, player_id, status)
          values (other_ev.id, involved, 'pending');
        end if;
      end;
    end loop;
  elsif rr.player_scope = 'everyone' then
    -- Award every other active player the same rule (no confirmation prompt —
    -- this is a deliberate round-wide score, not a best-effort multi-award).
    for coplayer in
      select id from public.round_players
      where round_id = p_round_id
        and roster_status = 'active'
        and id <> p_subject_player_id
    loop
      insert into public.point_events
        (round_id, subject_player_id, rule_id, rule_name_snapshot,
         points_snapshot, count, logged_by)
      values
        (p_round_id, coplayer.id, p_rule_id, rr.name_snapshot,
         rr.points_snapshot, n, auth.uid());
    end loop;
  end if;

  return ev;
end;
$$;

revoke all on function public.log_point(uuid, uuid, uuid, integer, uuid[], uuid) from public;
grant execute on function public.log_point(uuid, uuid, uuid, integer, uuid[], uuid) to authenticated;
