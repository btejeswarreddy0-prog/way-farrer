-- Safe integration check for the overlap trigger. Every inserted row is rolled back.
-- Replace both test emails before running. Use separate, confirmed test accounts.
begin;

do $$
declare
  test_lister uuid;
  test_renter uuid;
  test_vehicle uuid;
  request_one uuid;
  request_two uuid;
  request_overlap uuid;
  rejected_overlap boolean := false;
begin
  select p.id into test_lister
  from public.profiles p join auth.users u on u.id = p.id
  where p.role = 'lister' and lower(u.email) = lower('REPLACE-WITH-LISTER-EMAIL');
  select p.id into test_renter
  from public.profiles p join auth.users u on u.id = p.id
  where p.role = 'renter' and lower(u.email) = lower('REPLACE-WITH-RENTER-EMAIL');

  if test_lister is null or test_renter is null then
    raise exception 'Replace both emails with confirmed test accounts whose profiles have the expected roles.';
  end if;

  insert into public.vehicles (owner_id, title, vehicle_type, city, price_per_day, description, is_active)
  values (test_lister, 'Wayfarer overlap QA ' || gen_random_uuid()::text, 'Car', 'Visakhapatnam', 1, 'Temporary QA record, rolled back.', true)
  returning id into test_vehicle;

  insert into public.rental_requests (vehicle_id, renter_id, lister_id, renter_name, pickup_date, return_date, pickup_location, destination)
  values (test_vehicle, test_renter, test_lister, 'QA renter', date '2030-01-10', date '2030-01-12', 'QA pickup one', 'QA destination one')
  returning id into request_one;
  insert into public.rental_requests (vehicle_id, renter_id, lister_id, renter_name, pickup_date, return_date, pickup_location, destination)
  values (test_vehicle, test_renter, test_lister, 'QA renter', date '2030-01-13', date '2030-01-15', 'QA pickup two', 'QA destination two')
  returning id into request_two;
  insert into public.rental_requests (vehicle_id, renter_id, lister_id, renter_name, pickup_date, return_date, pickup_location, destination)
  values (test_vehicle, test_renter, test_lister, 'QA renter', date '2030-01-12', date '2030-01-14', 'QA pickup overlap', 'QA destination overlap')
  returning id into request_overlap;

  update public.rental_requests set status = 'accepted' where id = request_one;
  update public.rental_requests set status = 'accepted' where id = request_two;
  begin
    update public.rental_requests set status = 'accepted' where id = request_overlap;
  exception when sqlstate '23P01' then
    rejected_overlap := true;
  end;

  if not rejected_overlap then
    raise exception 'FAIL: the overlapping request was accepted; the safety trigger is missing or incorrect.';
  end if;

  raise notice 'PASS: overlapping accepted dates were rejected; non-overlapping dates were accepted.';
end;
$$;

rollback;
