-- Wayfarer vehicle photo storage. Run once in the Supabase SQL Editor.
-- Photos are public to display on renter listings; only lister accounts may
-- write inside their own folder: <user-id>/<random-file-name>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-images',
  'vehicle-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view vehicle photos" on storage.objects;
create policy "Public can view vehicle photos" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'vehicle-images');

drop policy if exists "Listers can upload their own vehicle photos" on storage.objects;
create policy "Listers can upload their own vehicle photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vehicle-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'lister'
    )
  );

drop policy if exists "Listers can update their own vehicle photos" on storage.objects;
create policy "Listers can update their own vehicle photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vehicle-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'lister'
    )
  )
  with check (
    bucket_id = 'vehicle-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'lister'
    )
  );

drop policy if exists "Listers can delete their own vehicle photos" on storage.objects;
create policy "Listers can delete their own vehicle photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vehicle-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'lister'
    )
  );
