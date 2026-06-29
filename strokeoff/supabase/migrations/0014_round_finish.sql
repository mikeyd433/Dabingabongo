-- Persisted round finishes + player stats (spec §11 "optional stats")
--
-- The adjusted-final / rank / winner math lives on the client (the tested
-- conversion + tie-break logic). When a round's finals are in and confirmed, the
-- client records the outcome here so a player's history can show wins / best
-- finish without recomputing every round. Columns default to "no finish yet".

alter table public.round_players
  add column if not exists final_adjusted integer,
  add column if not exists final_rank integer,
  add column if not exists is_winner boolean not null default false;

-- Record the computed finishes for a completed round (idempotent overwrite).
-- Any participant may write — the values are deterministic from the shared round
-- data, so concurrent writers converge. p_finishes is a JSON array of
-- { player_id, adjusted, rank, is_winner }.
create or replace function public.record_round_finish(
  p_round_id uuid,
  p_finishes jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb;
begin
  if not public.is_round_participant(p_round_id) then
    raise exception 'Not a participant';
  end if;
  if (select status from public.rounds where id = p_round_id) <> 'complete' then
    raise exception 'Round is not complete';
  end if;

  for rec in
    select * from jsonb_array_elements(coalesce(p_finishes, '[]'::jsonb))
  loop
    update public.round_players
      set final_adjusted = nullif(rec->>'adjusted', '')::integer,
          final_rank = nullif(rec->>'rank', '')::integer,
          is_winner = coalesce((rec->>'is_winner')::boolean, false)
    where id = (rec->>'player_id')::uuid
      and round_id = p_round_id;
  end loop;
end;
$$;

-- Rounds played / wins / best finish for a player, across the completed rounds
-- the caller can see (mirrors rounds_with_player's visibility, migration 0009).
create or replace function public.player_round_stats(p_other uuid)
returns table (rounds_played integer, wins integer, best_rank integer)
language sql
security definer
stable
set search_path = public
as $$
  select
    count(*)::integer as rounds_played,
    count(*) filter (where them.is_winner)::integer as wins,
    min(them.final_rank)::integer as best_rank
  from public.rounds r
  join public.round_players them
    on them.round_id = r.id and them.profile_id = p_other
  where r.status = 'complete'
    and (
      public.is_round_participant(r.id)
      or public.is_group_member(r.group_id)
    );
$$;

revoke all on function public.record_round_finish(uuid, jsonb) from public;
revoke all on function public.player_round_stats(uuid) from public;
grant execute on function public.record_round_finish(uuid, jsonb) to authenticated;
grant execute on function public.player_round_stats(uuid) to authenticated;
