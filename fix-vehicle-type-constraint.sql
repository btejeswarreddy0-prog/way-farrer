-- Update the allowed vehicle types for the current lister form.
-- Run this in the Supabase SQL Editor if publishing returns
-- "violates check constraint vehicles_vehicle_type_check".

alter table public.vehicles
  drop constraint if exists vehicles_vehicle_type_check;

alter table public.vehicles
  add constraint vehicles_vehicle_type_check
  check (vehicle_type in (
    'Car', 'Bike', 'Lorry', 'Small Truck',
    'Motorcycle', 'Van', 'Other'
  ));
