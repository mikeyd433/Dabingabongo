-- Phase 5 — Single Phone & guests
--
-- Single Phone (spec §6): one controller logs for everyone; others are read-only
-- spectators. Guests work in both modes, managed by one player and reassignable
-- if that phone dies. This migration widens the write-permission helper so the
-- same Phase 4 RPCs serve both modes, makes multi-player awards skip the
-- confirmation prompts in Single Phone (the controller assigns directly), and
-- adds guest reassignment. No new tables — RLS from 0004 still applies.

-- ---------------------------------------------------------------------------
-- Widen "can the caller control this subject?" to include the Single Phone
-- controller. log_point / edit_point_event / void_point_event all gate on this
-- helper, so redefining it here widens all three at once (principle 5).
--   * your own roster row, or a guest you manage (Phase 4), OR
--   * you are the controller (creator) of a single-phone round.
-- ---------------------------------------------------------------------------

create or replace function public.controls_round_player(p_player_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.round_players rp
    join public.rounds r on r.id = rp.round_id
    where rp.id = p_player_id
      and (
        rp.profile_id = auth.uid()
        or rp.managed_by = auth.uid()
        or (r.scoring_mode = 'single_phone' and r.created_by = auth.uid())
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Re-declare log_point: identical to 0004 except multi-player awards only raise
-- confirmation prompts in Multi Phone. In Single Phone the controller assigns
-- directly, "no prompts at all" (spec §6).
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
  end if;

  return ev;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reassign a guest to a new manager (spec §6 — "reassignable if that manager's
-- phone dies"). Allowed for the current manager, the single-phone controller,
-- or — when the current manager is no longer an active player — any participant
-- (the rescue path). The new manager must be an active, signed-in player.
-- ---------------------------------------------------------------------------

create or replace function public.reassign_guest(
  p_guest_id uuid,
  p_new_manager_id uuid
)
returns public.round_players
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.round_players;
  r public.rounds;
  manager_active boolean;
begin
  select * into g from public.round_players where id = p_guest_id;
  if g.id is null or not g.is_guest then
    raise exception 'Not a guest';
  end if;

  select * into r from public.rounds where id = g.round_id;

  if not exists (
    select 1 from public.round_players
    where round_id = g.round_id and profile_id = p_new_manager_id
      and not is_guest and roster_status = 'active'
  ) then
    raise exception 'New manager must be an active player in this round';
  end if;

  manager_active := exists (
    select 1 from public.round_players
    where round_id = g.round_id and profile_id = g.managed_by
      and roster_status = 'active'
  );

  if not (
    g.managed_by = auth.uid()
    or (r.scoring_mode = 'single_phone' and r.created_by = auth.uid())
    or (not manager_active and public.is_round_participant(g.round_id))
  ) then
    raise exception 'Not allowed to reassign this guest';
  end if;

  update public.round_players
    set managed_by = p_new_manager_id
  where id = p_guest_id
  returning * into g;
  return g;
end;
$$;

revoke all on function public.reassign_guest(uuid, uuid) from public;
grant execute on function public.reassign_guest(uuid, uuid) to authenticated;
