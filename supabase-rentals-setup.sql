-- Wayfarer rental data. Run after supabase-setup.sql in the Supabase SQL Editor.
-- This script creates listing, rental request, and payment records with row-level security.

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  vehicle_type text not null check (vehicle_type in ('Car', 'Bike', 'Lorry', 'Small Truck', 'Motorcycle', 'Van', 'Other')),
  city text not null check (char_length(city) between 2 and 100),
  price_per_day numeric(10,2) not null check (price_per_day > 0),
  description text not null default '',
  image_url text,
  vehicle_year integer check (vehicle_year is null or vehicle_year between 1950 and 2100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rental_requests (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  renter_id uuid not null references public.profiles(id) on delete cascade,
  lister_id uuid not null references public.profiles(id) on delete cascade,
  renter_name text not null default '',
  renter_message text not null default '',
  pickup_date date not null,
  return_date date not null,
  pickup_location text not null,
  destination text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  check (return_date > pickup_date),
  check (char_length(pickup_location) between 2 and 200),
  check (char_length(renter_message) <= 2000)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.rental_requests(id) on delete restrict,
  renter_id uuid not null references public.profiles(id) on delete restrict,
  lister_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'failed')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Private message threads are available only after a lister accepts a rental request.
create table if not exists public.rental_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.rental_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists vehicles_owner_created_idx on public.vehicles(owner_id, created_at desc);
create index if not exists vehicles_active_city_idx on public.vehicles(is_active, city);
create index if not exists rental_requests_lister_created_idx on public.rental_requests(lister_id, created_at desc);
create index if not exists rental_requests_renter_created_idx on public.rental_requests(renter_id, created_at desc);
create index if not exists rental_requests_vehicle_dates_idx on public.rental_requests(vehicle_id, pickup_date, return_date);
create index if not exists payments_lister_paid_idx on public.payments(lister_id, paid_at desc) where status = 'paid';
create index if not exists rental_messages_request_created_idx on public.rental_messages(request_id, created_at);

alter table public.rental_requests add column if not exists destination text not null default '';
alter table public.vehicles drop constraint if exists vehicles_vehicle_type_check;
alter table public.vehicles add constraint vehicles_vehicle_type_check check (vehicle_type in ('Car', 'Bike', 'Lorry', 'Small Truck', 'Motorcycle', 'Van', 'Other'));
alter table public.vehicles enable row level security;
alter table public.rental_requests enable row level security;
alter table public.payments enable row level security;
alter table public.rental_messages enable row level security;

revoke all on public.vehicles, public.rental_requests, public.payments from anon, authenticated;
revoke all on public.rental_messages from anon, authenticated;
grant select on public.vehicles to anon, authenticated;
grant insert, update, delete on public.vehicles to authenticated;
grant select, insert, delete on public.rental_requests to authenticated;
grant update (status) on public.rental_requests to authenticated;
grant select on public.payments to authenticated;
grant select, insert on public.rental_messages to authenticated;

-- Anyone can browse active listings. A lister can also see their own inactive listing.
drop policy if exists "Public can browse active vehicles" on public.vehicles;
create policy "Public can browse active vehicles" on public.vehicles for select to anon, authenticated
  using (is_active = true or owner_id = (select auth.uid()));
drop policy if exists "Listers can create their own vehicles" on public.vehicles;
create policy "Listers can create their own vehicles" on public.vehicles for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'lister'
  ));
drop policy if exists "Listers can update their own vehicles" on public.vehicles;
create policy "Listers can update their own vehicles" on public.vehicles for update to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'lister'
  ))
  with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'lister'
  ));
drop policy if exists "Listers can delete their own vehicles" on public.vehicles;
create policy "Listers can delete their own vehicles" on public.vehicles for delete to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'lister'
  ));

-- Requests are private to the renter and the lister who owns the requested vehicle.
drop policy if exists "Renters can read their own rental requests" on public.rental_requests;
create policy "Renters can read their own rental requests" on public.rental_requests for select to authenticated
  using (renter_id = (select auth.uid()));
drop policy if exists "Listers can read requests for their vehicles" on public.rental_requests;
create policy "Listers can read requests for their vehicles" on public.rental_requests for select to authenticated
  using (lister_id = (select auth.uid()));
drop policy if exists "Renters can request active vehicles" on public.rental_requests;
create policy "Renters can request active vehicles" on public.rental_requests for insert to authenticated
  with check (
    renter_id = (select auth.uid()) and status = 'pending' and renter_id <> lister_id and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'renter'
    ) and exists (
      select 1 from public.vehicles v where v.id = vehicle_id and v.owner_id = lister_id and v.is_active = true
    )
  );
-- Renters can delete their own pending, declined, or cancelled requests.
drop policy if exists "Renters can delete their own unaccepted requests" on public.rental_requests;
create policy "Renters can delete their own unaccepted requests" on public.rental_requests for delete to authenticated
  using (renter_id = (select auth.uid()) and status in ('pending', 'declined', 'cancelled') and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'renter'
  ));
drop policy if exists "Listers can decide pending requests" on public.rental_requests;
create policy "Listers can decide pending requests" on public.rental_requests for update to authenticated
  using (lister_id = (select auth.uid()) and status = 'pending' and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'lister'
  ))
  with check (lister_id = (select auth.uid()) and status in ('accepted', 'declined') and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'lister'
  ));

-- Only the renter and lister in an accepted request may read or send its messages.
drop policy if exists "Participants can read accepted rental messages" on public.rental_messages;
create policy "Participants can read accepted rental messages" on public.rental_messages for select to authenticated
  using (exists (
    select 1 from public.rental_requests r
    where r.id = request_id and r.status = 'accepted'
      and (r.renter_id = (select auth.uid()) or r.lister_id = (select auth.uid()))
  ));
drop policy if exists "Participants can send accepted rental messages" on public.rental_messages;
create policy "Participants can send accepted rental messages" on public.rental_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and exists (
    select 1 from public.rental_requests r
    where r.id = request_id and r.status = 'accepted'
      and (r.renter_id = (select auth.uid()) or r.lister_id = (select auth.uid()))
  ));

-- Prevent two accepted rentals for the same vehicle from overlapping.
-- Return dates count as occupied days.
create or replace function public.prevent_overlapping_accepted_rentals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.vehicle_id::text, 0));
    if exists (
      select 1 from public.rental_requests existing
      where existing.vehicle_id = new.vehicle_id
        and existing.status = 'accepted'
        and existing.id <> new.id
        and pg_catalog.daterange(existing.pickup_date, existing.return_date, '[]')
            && pg_catalog.daterange(new.pickup_date, new.return_date, '[]')
    ) then
      raise exception using errcode = '23P01',
        message = 'This vehicle already has an accepted rental for overlapping dates.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_overlapping_accepted_rentals() from public, anon, authenticated;
drop trigger if exists prevent_overlapping_accepted_rentals on public.rental_requests;
create trigger prevent_overlapping_accepted_rentals
before insert or update of status, vehicle_id, pickup_date, return_date
on public.rental_requests
for each row when (new.status = 'accepted')
execute function public.prevent_overlapping_accepted_rentals();

-- Payment rows are written only by a trusted backend or payment webhook using the service role.
drop policy if exists "Renters can read their payment records" on public.payments;
create policy "Renters can read their payment records" on public.payments for select to authenticated
  using (renter_id = (select auth.uid()));
drop policy if exists "Listers can read their payment records" on public.payments;
create policy "Listers can read their payment records" on public.payments for select to authenticated
  using (lister_id = (select auth.uid()));

notify pgrst, 'reload schema';

