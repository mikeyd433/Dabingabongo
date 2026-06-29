-- Per-rule stat breakdown for a player (spec §11 "optional stats")
--
-- How often a player has scored each rule, across the completed rounds the caller
-- can see (mirrors rounds_with_player / player_round_stats visibility, 0009/0014).
-- Reads the point-event ledger by the rule's snapshot name so renamed/deleted
-- rules still tally under the name they were scored as (principle 2).

create or replace function public.player_rule_stats(p_other uuid)
returns table (rule_name text, total integer)
language sql
security definer
stable
set search_path = public
as $$
  select pe.rule_name_snapshot as rule_name, sum(pe.count)::integer as total
  from public.rounds r
  join public.round_players them
    on them.round_id = r.id and them.profile_id = p_other
  join public.point_events pe
    on pe.subject_player_id = them.id and not pe.voided
  where r.status = 'complete'
    and (
      public.is_round_participant(r.id)
      or public.is_group_member(r.group_id)
    )
  group by pe.rule_name_snapshot
  order by total desc, rule_name asc;
$$;

revoke all on function public.player_rule_stats(uuid) from public;
grant execute on function public.player_rule_stats(uuid) to authenticated;
