-- Phase 1 — Identity & personal group
--
-- Creates profiles, groups, group_members; a trigger that auto-provisions a
-- profile + personal group on signup; a secure self-delete RPC; and an avatars
-- storage bucket. RLS is enabled on every table in this same migration
-- (architecture principle 3: never ship a table open).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  custom_message text,
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  is_personal boolean not null default false,
  -- FKs to conversion_tables/themes are added in later phases; nullable for now.
  default_conversion_id uuid,
  default_theme_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  primary key (group_id, profile_id)
);

create index if not exists group_members_profile_idx
  on public.group_members (profile_id);

-- ---------------------------------------------------------------------------
-- Helper: membership check as SECURITY DEFINER to avoid RLS recursion between
-- groups and group_members policies.
-- ---------------------------------------------------------------------------

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = gid
      and profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Signup provisioning: profile + auto-created personal group (spec §3, §11)
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.is_anonymous in sync when an anonymous user upgrades in place
-- (email attached via auth.updateUser; spec §4 "save-later").
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set is_anonymous = coalesce(new.is_anonymous, false)
    where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------------
-- Account deletion (spec §4, §11). SECURITY DEFINER so a user can erase their
-- own auth row; cascades remove profile, owned personal group, and memberships.
-- ---------------------------------------------------------------------------

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Profiles: Phase 1 restricts reads to self. Broader "visible to people you've
-- shared a round with" (spec §14) is added alongside rounds in later phases.
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete_own on public.profiles
  for delete using (id = auth.uid());

-- Groups: members can read; logged-in users can create groups they own; owners
-- can rename/update; owners can delete non-personal groups.
create policy groups_select_member on public.groups
  for select using (public.is_group_member(id));
create policy groups_insert_owner on public.groups
  for insert with check (owner_id = auth.uid());
create policy groups_update_owner on public.groups
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy groups_delete_owner on public.groups
  for delete using (owner_id = auth.uid() and is_personal = false);

-- Group members: Phase 1 lets you read/insert/delete your own membership rows
-- (join/leave). Co-member listing & owner management land in Phase 2.
create policy group_members_select_own on public.group_members
  for select using (profile_id = auth.uid());
create policy group_members_insert_own on public.group_members
  for insert with check (profile_id = auth.uid());
create policy group_members_delete_own on public.group_members
  for delete using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: public avatars bucket, write-scoped to the owner's folder (spec §11)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_read_public on storage.objects
  for select using (bucket_id = 'avatars');
create policy avatars_insert_own on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_update_own on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_delete_own on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
