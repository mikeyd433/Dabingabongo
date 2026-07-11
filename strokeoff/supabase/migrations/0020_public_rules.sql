-- Global (public) rule library + moderation
--
-- Rules have always been group-scoped (readable only by group members). This
-- adds an opt-in GLOBAL library: an author can mark a rule `is_public`, which
-- makes it world-readable so any player can browse it in the "Global" tab and
-- **copy it into their own group** as an editable copy (copy_public_rule_to_group).
--
-- Publishing is signed-in-only (accountability): the restrictive policy below
-- blocks anonymous sessions from setting is_public = true. Anonymous players can
-- still browse and copy public rules.
--
-- Moderation: two service-role-only functions (moderate_delete_rule /
-- moderate_unpublish_rule) give a backend safety valve to pull anything from the
-- global library. They're revoked from all client roles; call them from the
-- Supabase SQL editor (runs as postgres) or an edge function with the service key.

-- ---------------------------------------------------------------------------
-- Column + index
-- ---------------------------------------------------------------------------
alter table public.rules
  add column if not exists is_public boolean not null default false;

-- Partial index: the Global tab only ever queries where is_public.
create index if not exists rules_public_idx
  on public.rules (is_public) where is_public;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Public rules are world-readable (in addition to the existing group-member
-- select policy). Permissive policies OR together, so a rule is visible if it's
-- yours-by-group OR public.
drop policy if exists rules_select_public on public.rules;
create policy rules_select_public on public.rules
  for select using (is_public = true);

-- Signed-in-only publishing, enforced by a trigger that fires only on the
-- false -> true transition. A trigger (not a restrictive policy) is used on
-- purpose: it guards *publishing* specifically, so an anonymous member of a
-- shared group can still edit an already-public rule's other fields — a
-- with-check policy couldn't tell "becoming public" from "already public".
-- The `is_anonymous` claim is present (true) on Supabase anonymous-auth JWTs.
create or replace function public.rules_guard_publish()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_public and not coalesce(old.is_public, false) then
    if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
      raise exception 'Sign in to publish a rule to the global library';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rules_guard_publish on public.rules;
create trigger rules_guard_publish
  before insert or update on public.rules
  for each row execute function public.rules_guard_publish();

-- ---------------------------------------------------------------------------
-- Copy a public rule into one of your groups as a fresh, editable copy.
-- The copy is private (is_public = false) and owned by the caller; the snapshot
-- architecture means rounds that already used the original are untouched either
-- way. Host/group membership is enforced; the source must be public.
-- ---------------------------------------------------------------------------
create or replace function public.copy_public_rule_to_group(
  p_rule_id uuid,
  p_group_id uuid
)
returns public.rules
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.rules;
  copy public.rules;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a group member';
  end if;

  select * into src from public.rules
  where id = p_rule_id and is_public = true;
  if src.id is null then
    raise exception 'Public rule not found';
  end if;

  insert into public.rules
    (group_id, name, display_name, description, points, player_scope,
     min_players, max_players, per_role_points, is_scalable, quantity_label,
     is_repeatable, active, animation_config, created_by, is_public)
  values
    (p_group_id, src.name, src.display_name, src.description, src.points,
     src.player_scope, src.min_players, src.max_players, src.per_role_points,
     src.is_scalable, src.quantity_label, src.is_repeatable, true,
     src.animation_config, auth.uid(), false)
  returning * into copy;

  return copy;
end;
$$;

revoke all on function public.copy_public_rule_to_group(uuid, uuid) from public;
grant execute on function public.copy_public_rule_to_group(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Moderation (backend only). Not exposed to any client role — call from the
-- Supabase SQL editor or a service-role context:
--     select public.moderate_unpublish_rule('<rule-id>');  -- pull from global
--     select public.moderate_delete_rule('<rule-id>');     -- delete outright
-- Deleting a rule cascades to round_rules (FK on delete cascade), so it also
-- drops from any in-progress round's palette; already-logged point_events keep
-- their own name/points snapshot, so completed history is never rewritten.
-- ---------------------------------------------------------------------------
create or replace function public.moderate_delete_rule(p_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.rules where id = p_rule_id;
end;
$$;

create or replace function public.moderate_unpublish_rule(p_rule_id uuid)
returns public.rules
language plpgsql
security definer
set search_path = public
as $$
declare
  out_rule public.rules;
begin
  update public.rules set is_public = false
  where id = p_rule_id
  returning * into out_rule;
  return out_rule;
end;
$$;

revoke all on function public.moderate_delete_rule(uuid) from public, anon, authenticated;
revoke all on function public.moderate_unpublish_rule(uuid) from public, anon, authenticated;
grant execute on function public.moderate_delete_rule(uuid) to service_role;
grant execute on function public.moderate_unpublish_rule(uuid) to service_role;
