-- Phase 4 — Live scoring (Multi Phone)
--
-- Point events (the append-only ledger the live leaderboard is *derived* from —
-- never a stored counter, architecture principle 4) and the per-event
-- confirmations used by best-effort multi-player rules (spec §6). All writes go
-- through SECURITY DEFINER RPCs that enforce permission-on-writes (principle 5):
-- in Multi Phone you may only log/edit/void points for a subject you control
-- (yourself, or a guest you manage). Multi-player rules are the sanctioned
-- exception — the logger awards the other involved players, who then confirm;
-- if they're offline/backgrounded the prompt is skipped and the points still
-- stand. RLS on every new table; both tables published for Realtime.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.point_events (
  -- id is client-generatable (crypto.randomUUID) so optimistic/offline writes
  -- reconcile idempotently on reconnect (principle 6); defaults server-side too.
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  subject_player_id uuid not null
    references public.round_players (id) on delete cascade,
  -- rule_id may go null if the group rule is later deleted; the snapshot columns
  -- preserve the event's meaning regardless (principle 2).
  rule_id uuid references public.rules (id) on delete set null,
  rule_name_snapshot text not null,
  points_snapshot integer not null,
  count integer not null default 1 check (count >= 1),
  logged_by uuid not null references public.profiles (id) on delete cascade,
  edited_at timestamptz,
  voided boolean not null default false,
  void_reason text,
  created_at timestamptz not null default now()
);

create index if not exists point_events_round_idx
  on public.point_events (round_id);
create index if not exists point_events_subject_idx
  on public.point_events (subject_player_id);

create table if not exists public.event_confirmations (
  event_id uuid not null references public.point_events (id) on delete cascade,
  player_id uuid not null references public.round_players (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'skipped')),
  created_at timestamptz not null default now(),
  primary key (event_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Helper: does the caller control this subject (round_player)?
-- True for your own roster row, or a guest you manage. SECURITY DEFINER so it
-- can read round_players without tripping that table's RLS.
-- ---------------------------------------------------------------------------

create or replace function public.controls_round_player(p_player_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.round_players rp
    where rp.id = p_player_id
      and (rp.profile_id = auth.uid() or rp.managed_by = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

-- Log a point. For a single-player rule this records one event for the subject.
-- For a multi-player rule, p_involved_player_ids names the *other* involved
-- players; each gets their own flat-points event plus a pending confirmation.
-- Returns the subject's event. Idempotent on the subject event when the client
-- supplies p_event_id (safe to retry after a flaky connection).
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

  -- You may only log for a subject you control (principle 5).
  if not public.controls_round_player(p_subject_player_id) then
    raise exception 'You can only log points for yourself';
  end if;

  -- The rule must be part of this round's frozen palette (principle 2).
  select * into rr from public.round_rules
  where round_id = p_round_id and rule_id = p_rule_id;
  if rr.rule_id is null then
    raise exception 'Rule is not active in this round';
  end if;

  if rr.player_scope = 'single'
     and coalesce(array_length(p_involved_player_ids, 1), 0) > 0 then
    raise exception 'This rule is single-player';
  end if;

  -- Non-repeatable rules: at most one live (non-voided) event per subject.
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

  -- Idempotent retry: the event already exists, hand it back unchanged.
  if ev.id is null then
    select * into ev from public.point_events where id = p_event_id;
    return ev;
  end if;

  -- Multi-player: award each other involved player (flat points) + ask them to
  -- confirm. They must be active roster members of this round.
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

        insert into public.event_confirmations (event_id, player_id, status)
        values (other_ev.id, involved, 'pending');
      end;
    end loop;
  end if;

  return ev;
end;
$$;

-- Edit the count on an event you control (spec §6 "go back and correct").
create or replace function public.edit_point_event(
  p_event_id uuid,
  p_count integer
)
returns public.point_events
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.point_events;
begin
  select * into ev from public.point_events where id = p_event_id;
  if ev.id is null then raise exception 'Event not found'; end if;
  if not public.controls_round_player(ev.subject_player_id) then
    raise exception 'You can only edit your own points';
  end if;

  update public.point_events
    set count = greatest(1, coalesce(p_count, 1)), edited_at = now()
  where id = p_event_id
  returning * into ev;
  return ev;
end;
$$;

-- Void (undo) an event you control. Kept in the audit trail rather than deleted
-- so corrections never silently rewrite history (spec §6).
create or replace function public.void_point_event(
  p_event_id uuid,
  p_reason text default null
)
returns public.point_events
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.point_events;
begin
  select * into ev from public.point_events where id = p_event_id;
  if ev.id is null then raise exception 'Event not found'; end if;
  if not public.controls_round_player(ev.subject_player_id) then
    raise exception 'You can only undo your own points';
  end if;

  update public.point_events
    set voided = true, void_reason = p_reason, edited_at = now()
  where id = p_event_id
  returning * into ev;
  return ev;
end;
$$;

-- Respond to a multi-player confirmation prompt addressed to you. Points already
-- stand either way (best-effort, spec §6); this just records your acknowledgement.
create or replace function public.respond_to_confirmation(
  p_event_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('confirmed', 'declined') then
    raise exception 'Invalid confirmation status';
  end if;

  update public.event_confirmations ec
    set status = p_status
  where ec.event_id = p_event_id
    and exists (
      select 1 from public.round_players rp
      where rp.id = ec.player_id and rp.profile_id = auth.uid()
    );

  if not found then raise exception 'No confirmation to respond to'; end if;
end;
$$;

-- Leave (or rejoin) a round you're in. The roster is persistent: leaving keeps
-- your row and points intact so you can rejoin (spec §5 join/leave mid-round).
create or replace function public.set_my_roster_status(
  p_round_id uuid,
  p_status text
)
returns public.round_players
language plpgsql
security definer
set search_path = public
as $$
declare
  rp public.round_players;
begin
  if p_status not in ('active', 'left') then
    raise exception 'Invalid roster status';
  end if;

  update public.round_players
    set roster_status = p_status
  where round_id = p_round_id and profile_id = auth.uid()
  returning * into rp;

  if rp.id is null then raise exception 'You are not in this round'; end if;
  return rp;
end;
$$;

revoke all on function public.log_point(uuid, uuid, uuid, integer, uuid[], uuid) from public;
revoke all on function public.edit_point_event(uuid, integer) from public;
revoke all on function public.void_point_event(uuid, text) from public;
revoke all on function public.respond_to_confirmation(uuid, text) from public;
revoke all on function public.set_my_roster_status(uuid, text) from public;
grant execute on function public.log_point(uuid, uuid, uuid, integer, uuid[], uuid) to authenticated;
grant execute on function public.edit_point_event(uuid, integer) to authenticated;
grant execute on function public.void_point_event(uuid, text) to authenticated;
grant execute on function public.respond_to_confirmation(uuid, text) to authenticated;
grant execute on function public.set_my_roster_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — read for participants; all writes flow through the RPCs above
-- ---------------------------------------------------------------------------

alter table public.point_events enable row level security;
alter table public.event_confirmations enable row level security;

create policy point_events_select on public.point_events
  for select using (public.is_round_participant(round_id));

create policy event_confirmations_select on public.event_confirmations
  for select using (
    exists (
      select 1 from public.point_events pe
      where pe.id = event_confirmations.event_id
        and public.is_round_participant(pe.round_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime: publish so the leaderboard, feed, and confirmations update live
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'point_events'
  ) then
    alter publication supabase_realtime add table public.point_events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'event_confirmations'
  ) then
    alter publication supabase_realtime add table public.event_confirmations;
  end if;
end $$;
