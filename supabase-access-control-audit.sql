-- Read-only audit of the access-control setup in the connected Supabase project.
-- Run in the Supabase SQL Editor after applying the setup scripts.

-- Row-level security must be enabled on every user-owned application table.
select n.nspname as schema_name,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'public' and c.relname in (
         'profiles', 'vehicles', 'rental_requests', 'rental_messages', 'payments'
       ))
   or (n.nspname = 'storage' and c.relname = 'objects')
order by n.nspname, c.relname;

-- Review the active policies. Check the policy names and expressions against
-- the role and ownership rules documented in README.md.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where (schemaname = 'public' and tablename in (
         'profiles', 'vehicles', 'rental_requests', 'rental_messages', 'payments'
       ))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- The trigger and public photo bucket should exist after setup.
select t.tgname as trigger_name,
       pg_catalog.pg_get_triggerdef(t.oid) as trigger_definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'rental_requests'
  and not t.tgisinternal
  and t.tgname = 'prevent_overlapping_accepted_rentals';

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'vehicle-images';
