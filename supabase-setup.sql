-- Wayfarer profile setup: paste this entire file into Supabase SQL Editor and run it.
-- This stores app profile data separately from Supabase Auth passwords.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  mobile text not null default '',
  role text not null default 'renter' check (role in ('renter', 'lister')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_wayfarer_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, mobile, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'mobile', ''),
    case when new.raw_user_meta_data ->> 'role' = 'lister' then 'lister' else 'renter' end
  );
  return new;
end;
$$;

revoke all on function public.handle_new_wayfarer_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_wayfarer on auth.users;
create trigger on_auth_user_created_wayfarer
after insert on auth.users
for each row execute procedure public.handle_new_wayfarer_user();

notify pgrst, 'reload schema';
