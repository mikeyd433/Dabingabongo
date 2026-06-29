-- Owner group management (spec §11)
--
-- Owner-only lifecycle for a non-personal group: rename, remove a member, hand
-- off ownership, and delete the group. RLS already lets owners update/delete
-- their group rows, but these SECURITY DEFINER RPCs keep the checks in one place
-- (owner-only, never the personal group, role bookkeeping on hand-off) so the
-- client can't get it half-right. No new tables.

create or replace function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.groups
    where id = p_group_id and owner_id = auth.uid()
  );
$$;

-- Rename a group (owner only).
create or replace function public.rename_group(p_group_id uuid, p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  trimmed text := btrim(coalesce(p_name, ''));
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Only the owner can rename this group';
  end if;
  if length(trimmed) = 0 then
    raise exception 'Enter a group name';
  end if;
  update public.groups set name = trimmed where id = p_group_id
  returning * into g;
  return g;
end;
$$;

-- Remove a member (owner only; can't remove the owner; not the personal group).
create or replace function public.remove_group_member(
  p_group_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  personal boolean;
  owner uuid;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Only the owner can remove members';
  end if;
  select is_personal, owner_id into personal, owner
    from public.groups where id = p_group_id;
  if personal then
    raise exception 'The personal group has no other members';
  end if;
  if p_profile_id = owner then
    raise exception 'Hand off ownership before removing the owner';
  end if;
  delete from public.group_members
  where group_id = p_group_id and profile_id = p_profile_id;
end;
$$;

-- Hand off ownership to another member (owner only; not the personal group).
create or replace function public.transfer_group_ownership(
  p_group_id uuid,
  p_new_owner_id uuid
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  personal boolean;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Only the owner can hand off ownership';
  end if;
  select is_personal into personal from public.groups where id = p_group_id;
  if personal then
    raise exception 'The personal group cannot change hands';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and profile_id = p_new_owner_id
  ) then
    raise exception 'New owner must be a member of this group';
  end if;

  update public.groups set owner_id = p_new_owner_id where id = p_group_id
  returning * into g;
  update public.group_members set role = 'owner'
    where group_id = p_group_id and profile_id = p_new_owner_id;
  update public.group_members set role = 'member'
    where group_id = p_group_id and profile_id = auth.uid();
  return g;
end;
$$;

-- Delete a group (owner only; not the personal group). Members, rules,
-- conversion tables, and invites cascade via their group_id foreign keys.
create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  personal boolean;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Only the owner can delete this group';
  end if;
  select is_personal into personal from public.groups where id = p_group_id;
  if personal then
    raise exception 'The personal group cannot be deleted';
  end if;
  delete from public.groups where id = p_group_id;
end;
$$;

revoke all on function public.is_group_owner(uuid) from public;
revoke all on function public.rename_group(uuid, text) from public;
revoke all on function public.remove_group_member(uuid, uuid) from public;
revoke all on function public.transfer_group_ownership(uuid, uuid) from public;
revoke all on function public.delete_group(uuid) from public;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.rename_group(uuid, text) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
