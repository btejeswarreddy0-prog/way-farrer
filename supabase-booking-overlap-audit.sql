-- Find already-accepted requests for the same vehicle with overlapping dates.
-- The safety trigger prevents new collisions but does not change existing data.
select
  v.id as vehicle_id,
  v.title as vehicle,
  first_request.id as first_request_id,
  first_request.pickup_date as first_pickup,
  first_request.return_date as first_return,
  second_request.id as second_request_id,
  second_request.pickup_date as second_pickup,
  second_request.return_date as second_return
from public.rental_requests first_request
join public.rental_requests second_request
  on second_request.vehicle_id = first_request.vehicle_id
 and second_request.id > first_request.id
 and second_request.status = 'accepted'
 and pg_catalog.daterange(first_request.pickup_date, first_request.return_date, '[]')
     && pg_catalog.daterange(second_request.pickup_date, second_request.return_date, '[]')
join public.vehicles v on v.id = first_request.vehicle_id
where first_request.status = 'accepted'
order by v.title, first_request.pickup_date;
