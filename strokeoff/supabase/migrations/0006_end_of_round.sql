-- Phase 6 — End of round & history
--
-- Ending a round (any participant, spec §9), final regular-score entry, the
-- tie-breaker result, and a per-user "hide from my history" flag (spec §10, §11).
-- No new tables — one column on round_players plus lifecycle RPCs. Reads still
-- ride the existing RLS: a completed round is visible to its participants and the
-- group's members (rounds_select from 0003).

-- Per-user history hiding: deleting a round from History removes it from *your*
-- view only, not from other participants' (spec §11).
alter table public.round_players
  add column if not exists hidden boolean not null default false;

-- ---------------------------------------------------------------------------
-- End the round — ANY participant, so a dead/out-of-signal creator can't strand
-- everyone (spec §9). The UI layers the friction (menu + hold + dialog).
-- ---------------------------------------------------------------------------

create or replace function public.end_round(p_round_id uuid)
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

  update public.rounds
    set status = 'complete', ended_at = now()
  where id = p_round_id and status = 'active'
  returning * into r;

  if r.id is null then raise exception 'Round is not live'; end if;
  return r;
end;
$$;

-- Final regular-score entry (spec §10). Any participant may set any player's
-- strokes — Multi Phone lets anyone fill gaps; Single Phone is the controller.
create or replace function public.set_regular_strokes(
  p_player_id uuid,
  p_strokes integer
)
returns public.round_players
language plpgsql
security definer
set search_path = public
as $$
declare
  rp public.round_players;
  rid uuid;
begin
  select round_id into rid from public.round_players where id = p_player_id;
  if rid is null then raise exception 'Player not found'; end if;
  if not public.is_round_participant(rid) then
    raise exception 'Not a participant';
  end if;
  if p_strokes is not null and p_strokes < 0 then
    raise exception 'Strokes cannot be negative';
  end if;

  update public.round_players
    set regular_strokes = p_strokes
  where id = p_player_id
  returning * into rp;
  return rp;
end;
$$;

-- Record the tie-breaker outcome (spec §10): the chosen winner is flagged
-- "by tie-breaker" on the scorecard via these columns.
create or replace function public.set_round_tiebreak(
  p_round_id uuid,
  p_winner_id uuid,
  p_method text
)
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
  if p_winner_id is not null and not exists (
    select 1 from public.round_players
    where id = p_winner_id and round_id = p_round_id
  ) then
    raise exception 'Tie-break winner is not in this round';
  end if;

  update public.rounds
    set tiebreak_winner_id = p_winner_id, tiebreak_method = p_method
  where id = p_round_id
  returning * into r;
  if r.id is null then raise exception 'Round not found'; end if;
  return r;
end;
$$;

-- Hide a completed round from *my* history (spec §11). Other participants keep it.
create or replace function public.hide_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.round_players
    set hidden = true
  where round_id = p_round_id and profile_id = auth.uid();
end;
$$;

revoke all on function public.end_round(uuid) from public;
revoke all on function public.set_regular_strokes(uuid, integer) from public;
revoke all on function public.set_round_tiebreak(uuid, uuid, text) from public;
revoke all on function public.hide_round(uuid) from public;
grant execute on function public.end_round(uuid) to authenticated;
grant execute on function public.set_regular_strokes(uuid, integer) to authenticated;
grant execute on function public.set_round_tiebreak(uuid, uuid, text) to authenticated;
grant execute on function public.hide_round(uuid) to authenticated;
