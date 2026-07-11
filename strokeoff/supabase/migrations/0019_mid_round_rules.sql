-- Mid-round rule changes (host-only)
--
-- Until now a round's active-rule set (round_rules) was a frozen snapshot built
-- once inside create_round (see 0003/0007/0017/0018) and never touched again —
-- conversion and theme lock on Start, and rules were effectively locked too.
--
-- This migration lets the round's HOST add and remove active rules while the
-- round is in the lobby or live, via SECURITY DEFINER RPCs that enforce the
-- host-only check server-side (mirroring how every other round write flows
-- through a definer RPC rather than a client-side table policy). round_rules is
-- published to Realtime so a host's change reaches every participant's device
-- live.
--
-- Snapshot integrity (architecture principle 2) is preserved: each round_rules
-- row still FREEZES the library rule's fields at the moment it is added, and
-- point_events keep their own log-time snapshot (rule_name_snapshot /
-- points_snapshot), so no completed history is ever rewritten by a later change.
--
-- The insert mirrors the latest create_round snapshot column set (0018):
--   name_snapshot, display_name_snapshot, description_snapshot, points_snapshot,
--   player_scope, is_repeatable, animation_config, is_scalable, quantity_label.

-- ---------------------------------------------------------------------------
-- Add an active rule to a round (host only; lobby or active rounds).
-- Snapshots the group rule's fields exactly as create_round does. Idempotent:
-- re-adding an already-active rule refreshes its snapshot from the library.
-- ---------------------------------------------------------------------------
create or replace function public.add_round_rule(
  p_round_id uuid,
  p_rule_id uuid
)
returns public.round_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rounds;
  ru public.rules;
  rr public.round_rules;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into r from public.rounds where id = p_round_id;
  if r.id is null then
    raise exception 'Round not found';
  end if;
  if r.created_by <> auth.uid() then
    raise exception 'Only the host can change this round''s rules';
  end if;
  if r.status not in ('lobby', 'active') then
    raise exception 'Rules can only be changed while the round is live';
  end if;

  select * into ru from public.rules where id = p_rule_id;
  if ru.id is null then
    raise exception 'Rule not found';
  end if;
  if ru.group_id <> r.group_id then
    raise exception 'Rule belongs to a different group';
  end if;

  insert into public.round_rules
    (round_id, rule_id, name_snapshot, display_name_snapshot,
     description_snapshot, points_snapshot, player_scope, is_repeatable,
     animation_config, is_scalable, quantity_label)
  values
    (r.id, ru.id, ru.name, ru.display_name, ru.description,
     ru.points, ru.player_scope, ru.is_repeatable, ru.animation_config,
     ru.is_scalable, ru.quantity_label)
  on conflict (round_id, rule_id) do update set
    name_snapshot = excluded.name_snapshot,
    display_name_snapshot = excluded.display_name_snapshot,
    description_snapshot = excluded.description_snapshot,
    points_snapshot = excluded.points_snapshot,
    player_scope = excluded.player_scope,
    is_repeatable = excluded.is_repeatable,
    animation_config = excluded.animation_config,
    is_scalable = excluded.is_scalable,
    quantity_label = excluded.quantity_label
  returning * into rr;

  return rr;
end;
$$;

-- ---------------------------------------------------------------------------
-- Remove an active rule from a round (host only; lobby or active rounds).
-- Already-logged point_events keep their own snapshot, so removing a rule only
-- pulls it from the live palette — it never rewrites history.
-- ---------------------------------------------------------------------------
create or replace function public.remove_round_rule(
  p_round_id uuid,
  p_rule_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rounds;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into r from public.rounds where id = p_round_id;
  if r.id is null then
    raise exception 'Round not found';
  end if;
  if r.created_by <> auth.uid() then
    raise exception 'Only the host can change this round''s rules';
  end if;
  if r.status not in ('lobby', 'active') then
    raise exception 'Rules can only be changed while the round is live';
  end if;

  delete from public.round_rules
  where round_id = p_round_id and rule_id = p_rule_id;
end;
$$;

revoke all on function public.add_round_rule(uuid, uuid) from public;
revoke all on function public.remove_round_rule(uuid, uuid) from public;
grant execute on function public.add_round_rule(uuid, uuid) to authenticated;
grant execute on function public.remove_round_rule(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: publish round_rules so a host's mid-round change reaches every
-- participant's device live (mirrors round_players / rounds in 0003).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'round_rules'
  ) then
    alter publication supabase_realtime add table public.round_rules;
  end if;
end $$;
