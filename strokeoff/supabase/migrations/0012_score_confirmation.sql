-- Score entry & confirmation gate (end-of-round flow, spec §10 step 2)
--
-- Splits the end-of-round flow into a dedicated "enter & confirm scores" step
-- before the final standings. Each active player confirms their own regular
-- score; in Multi Phone the final screen waits until everyone has confirmed.
-- A confirmed score is locked — it must be explicitly unconfirmed to edit.
--
-- No new tables: one flag on round_players plus a confirm/unconfirm RPC, and a
-- guard added to set_regular_strokes. The flag rides the existing round_players
-- RLS + Realtime, so confirmations propagate live across phones.

alter table public.round_players
  add column if not exists score_confirmed boolean not null default false;

-- Already-completed rounds predate the gate — treat their scores as confirmed so
-- reopening one never strands it behind the new "waiting to confirm" screen.
update public.round_players rp
  set score_confirmed = true
  from public.rounds r
  where r.id = rp.round_id and r.status = 'complete';

-- ---------------------------------------------------------------------------
-- Confirm / unconfirm a player's regular score.
--   * A real player confirms their own slot (controls_round_player covers the
--     own-slot and single-phone-controller cases, principle 5).
--   * A guest has no device of their own, so any participant may confirm theirs.
-- Confirming requires a score to be entered first.
-- ---------------------------------------------------------------------------
create or replace function public.set_score_confirmed(
  p_player_id uuid,
  p_confirmed boolean
)
returns public.round_players
language plpgsql
security definer
set search_path = public
as $$
declare
  rp public.round_players;
  rid uuid;
  guest boolean;
  strokes integer;
begin
  select round_id, is_guest, regular_strokes
    into rid, guest, strokes
  from public.round_players where id = p_player_id;
  if rid is null then raise exception 'Player not found'; end if;

  if not (
    public.controls_round_player(p_player_id)
    or (guest and public.is_round_participant(rid))
  ) then
    raise exception 'Not allowed to confirm this score';
  end if;

  if coalesce(p_confirmed, false) and strokes is null then
    raise exception 'Enter a score before confirming';
  end if;

  update public.round_players
    set score_confirmed = coalesce(p_confirmed, false)
  where id = p_player_id
  returning * into rp;
  return rp;
end;
$$;

-- Re-declare set_regular_strokes (unchanged from 0006) plus a guard: a confirmed
-- score is locked, so it must be unconfirmed before it can be edited.
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
  confirmed boolean;
begin
  select round_id, score_confirmed into rid, confirmed
    from public.round_players where id = p_player_id;
  if rid is null then raise exception 'Player not found'; end if;
  if not public.is_round_participant(rid) then
    raise exception 'Not a participant';
  end if;
  if confirmed then
    raise exception 'Score is confirmed — unconfirm to edit';
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

revoke all on function public.set_score_confirmed(uuid, boolean) from public;
grant execute on function public.set_score_confirmed(uuid, boolean) to authenticated;
revoke all on function public.set_regular_strokes(uuid, integer) from public;
grant execute on function public.set_regular_strokes(uuid, integer) to authenticated;
