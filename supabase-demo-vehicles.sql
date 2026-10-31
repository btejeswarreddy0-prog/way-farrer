-- Wayfarer demo listings. Create and confirm a lister account first.
-- Replace the email below with that lister account's email before running.
-- This inserts three sample vehicles once per lister; it does not create bookings.

select p.id, p.full_name, u.email
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'lister'
order by p.created_at;

with demo_lister as (
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'lister'
    and lower(u.email) = lower('REPLACE-WITH-LISTER-EMAIL')
),
sample_vehicles(title, vehicle_type, city, price_per_day, description, vehicle_year) as (
  values
    ('Royal Enfield Hunter 350', 'Bike', 'Visakhapatnam', 900, 'Easy city rides with a comfortable upright position.', 2024),
    ('Hyundai i20', 'Car', 'Visakhapatnam', 2400, 'Compact hatchback with air conditioning and room for five.', 2023),
    ('Tata Ace mini truck', 'Small Truck', 'Visakhapatnam', 3200, 'A practical mini truck for local moves and deliveries.', 2022)
)
insert into public.vehicles (owner_id, title, vehicle_type, city, price_per_day, description, vehicle_year, is_active)
select demo_lister.id, sample_vehicles.title, sample_vehicles.vehicle_type, sample_vehicles.city,
       sample_vehicles.price_per_day, sample_vehicles.description, sample_vehicles.vehicle_year, true
from demo_lister
cross join sample_vehicles
where not exists (
  select 1 from public.vehicles existing
  where existing.owner_id = demo_lister.id and existing.title = sample_vehicles.title
)
returning id, title, city;
