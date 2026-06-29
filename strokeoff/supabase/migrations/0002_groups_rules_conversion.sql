-- Phase 2 — Groups & Rules library
--
-- Adds the shared, group-scoped rule library, conversion tables, and group
-- invites, plus SECURITY DEFINER RPCs for the privileged group operations
-- (create/join/leave/invite) so membership writes can't be forged from the
-- client. RLS ships on every new table here.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.conversion_tables (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,
  name text not null default 'Conversion',
  mode text not null default 'tier' check (mode in ('tier', 'ratio')),
  config jsonb not null default '{}'::jsonb
);

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  display_name text not null default '',
  description text,
  points integer not null default 1,
  player_scope text not null default 'single'
    check (player_scope in ('single', 'multi')),
  min_players integer,
  max_players integer,
  per_role_points jsonb,
  is_repeatable boolean not null default true,
  active boolean not null default true,
  animation_config jsonb,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists rules_group_idx on public.rules (group_id);

create table if not exists public.group_invites (
  group_id uuid not null references public.groups (id) on delete cascade,
  code text not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (group_id, code)
);

-- Now that conversion_tables exists, wire up the group default FK (column was
-- created nullable in 0001).
alter table public.groups
  drop constraint if exists groups_default_conversion_fk;
alter table public.groups
  add constraint groups_default_conversion_fk
  foreign key (default_conversion_id)
  references public.conversion_tables (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True when `other` shares any group with the current user. Used to widen
-- profile visibility to co-members. SECURITY DEFINER to avoid RLS recursion.
create or replace function public.shares_group(other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.profile_id = auth.uid()
      and b.profile_id = other
  );
$$;

-- Seed a new group with a default conversion + a few example (editable) rules
-- (spec §3 starter content). Used by signup provisioning and create_group.
create or replace function public.seed_group_defaults(p_group_id uuid, p_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
begin
  insert into public.conversion_tables (group_id, name, mode, config)
  values (
    p_group_id,
    'House conversion',
    'tier',
    '{"tiers":[{"minPoints":0,"strokes":0},{"minPoints":5,"strokes":1},{"minPoints":10,"strokes":2},{"minPoints":15,"strokes":3}]}'::jsonb
  )
  returning id into conv_id;

  update public.groups set default_conversion_id = conv_id where id = p_group_id;

  insert into public.rules
    (group_id, name, display_name, description, points, player_scope, is_repeatable, active, created_by)
  values
    (p_group_id, 'Birdie', 'Birdie', 'Score a birdie on any hole.', 1, 'single', true, true, p_owner),
    (p_group_id, 'Parked', 'Parked', 'Land your drive within a putter''s reach of the basket.', 1, 'single', true, true, p_owner),
    (p_group_id, 'Longest drive', 'Longest drive', 'Longest measured drive on a hole.', 1, 'single', true, true, p_owner),
    (p_group_id, 'Group ace', 'Group ace', 'Two or more players ace the same hole.', 2, 'multi', true, true, p_owner);
end;
$$;

-- ---------------------------------------------------------------------------
-- Group RPCs (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  insert into public.groups (name, owner_id, is_personal, default_theme_id)
  values (coalesce(nullif(trim(p_name), ''), 'New group'), auth.uid(), false, 'stat-sheet')
  returning * into g;

  insert into public.group_members (group_id, profile_id, role)
  values (g.id, auth.uid(), 'owner');

  perform public.seed_group_defaults(g.id, auth.uid());

  select * into g from public.groups where id = g.id;
  return g;
end;
$$;

create or replace function public.join_group_with_code(p_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.group_invites;
  g public.groups;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into inv from public.group_invites where code = upper(trim(p_code));
  if inv.group_id is null then raise exception 'Invalid invite code'; end if;
  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'This invite has expired';
  end if;

  insert into public.group_members (group_id, profile_id, role)
  values (inv.group_id, auth.uid(), 'member')
  on conflict (group_id, profile_id) do nothing;

  select * into g from public.groups where id = inv.group_id;
  return g;
end;
$$;

create or replace function public.create_group_invite(
  p_group_id uuid,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  is_free boolean;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a group member';
  end if;

  loop
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    select not exists (select 1 from public.group_invites where code = new_code)
      into is_free;
    exit when is_free;
  end loop;

  insert into public.group_invites (group_id, code, expires_at)
  values (p_group_id, new_code, p_expires_at);
  return new_code;
end;
$$;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  personal boolean;
  owner boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select is_personal, (owner_id = auth.uid())
    into personal, owner
    from public.groups where id = p_group_id;

  if personal then raise exception 'You can''t leave your personal group'; end if;
  if owner then
    raise exception 'Owners must delete or hand off the group before leaving';
  end if;

  delete from public.group_members
    where group_id = p_group_id and profile_id = auth.uid();
end;
$$;

revoke all on function public.create_group(text) from public;
revoke all on function public.join_group_with_code(text) from public;
revoke all on function public.create_group_invite(uuid, timestamptz) from public;
revoke all on function public.leave_group(uuid) from public;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group_with_code(text) to authenticated;
grant execute on function public.create_group_invite(uuid, timestamptz) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Evolve signup provisioning to also seed starter content
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group_id uuid;
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    'Player'
  );

  insert into public.profiles (id, display_name, is_anonymous)
  values (new.id, resolved_name, coalesce(new.is_anonymous, false));

  insert into public.groups (name, owner_id, is_personal, default_theme_id)
  values (resolved_name || '''s group', new.id, true, 'stat-sheet')
  returning id into new_group_id;

  insert into public.group_members (group_id, profile_id, role)
  values (new_group_id, new.id, 'owner');

  perform public.seed_group_defaults(new_group_id, new.id);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.conversion_tables enable row level security;
alter table public.rules enable row level security;
alter table public.group_invites enable row level security;

-- Widen profile reads to co-members (spec §11: visible to people you share a
-- group/round with). Self stays covered (you share your own groups with you).
create policy profiles_select_comember on public.profiles
  for select using (public.shares_group(id));

-- group_members: replace Phase 1's self-only policies. Reads are co-member
-- scoped; all writes go through the SECURITY DEFINER RPCs above.
drop policy if exists group_members_select_own on public.group_members;
drop policy if exists group_members_insert_own on public.group_members;
drop policy if exists group_members_delete_own on public.group_members;
create policy group_members_select_comember on public.group_members
  for select using (public.is_group_member(group_id));

-- groups: creation now flows through create_group(); drop the direct-insert
-- policy. Reads/updates/deletes stay as in Phase 1.
drop policy if exists groups_insert_owner on public.groups;

-- Rules: any group member can fully use and edit the shared library (spec §7).
create policy rules_select_member on public.rules
  for select using (public.is_group_member(group_id));
create policy rules_insert_member on public.rules
  for insert with check (
    public.is_group_member(group_id) and created_by = auth.uid()
  );
create policy rules_update_member on public.rules
  for update using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));
create policy rules_delete_member on public.rules
  for delete using (public.is_group_member(group_id));

-- Conversion tables: members manage their group's tables; null group_id rows
-- (built-in templates) are world-readable.
create policy conversion_select on public.conversion_tables
  for select using (group_id is null or public.is_group_member(group_id));
create policy conversion_insert on public.conversion_tables
  for insert with check (public.is_group_member(group_id));
create policy conversion_update on public.conversion_tables
  for update using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));
create policy conversion_delete on public.conversion_tables
  for delete using (public.is_group_member(group_id));

-- Group invites: members can view their group's codes; creation via RPC only.
create policy group_invites_select_member on public.group_invites
  for select using (public.is_group_member(group_id));
