-- Prevent two accepted rentals for the same vehicle from overlapping.
-- Return dates count as occupied days; e.g. a second booking cannot start
-- on the first booking's return date.

create or replace function public.prevent_overlapping_accepted_rentals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' then
    -- Serialize confirmations per vehicle so simultaneous accepts cannot race.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.vehicle_id::text, 0)
    );

    if exists (
      select 1
      from public.rental_requests existing
      where existing.vehicle_id = new.vehicle_id
        and existing.status = 'accepted'
        and existing.id <> new.id
        and pg_catalog.daterange(existing.pickup_date, existing.return_date, '[]')
            && pg_catalog.daterange(new.pickup_date, new.return_date, '[]')
    ) then
      raise exception using
        errcode = '23P01',
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
for each row
when (new.status = 'accepted')
execute function public.prevent_overlapping_accepted_rentals();

notify pgrst, 'reload schema';
