-- Animation assets bucket (spec §12, Tier 2)
--
-- Uploaded particle images for the custom "image burst" celebration. Public read
-- so everyone in the round sees the effect; writes are scoped to the uploader's
-- own folder, exactly like the avatars bucket from migration 0001.

insert into storage.buckets (id, name, public)
values ('animation-assets', 'animation-assets', true)
on conflict (id) do nothing;

drop policy if exists anim_assets_read_public on storage.objects;
drop policy if exists anim_assets_insert_own on storage.objects;
drop policy if exists anim_assets_update_own on storage.objects;
drop policy if exists anim_assets_delete_own on storage.objects;

create policy anim_assets_read_public on storage.objects
  for select using (bucket_id = 'animation-assets');
create policy anim_assets_insert_own on storage.objects
  for insert with check (
    bucket_id = 'animation-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy anim_assets_update_own on storage.objects
  for update using (
    bucket_id = 'animation-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy anim_assets_delete_own on storage.objects
  for delete using (
    bucket_id = 'animation-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
