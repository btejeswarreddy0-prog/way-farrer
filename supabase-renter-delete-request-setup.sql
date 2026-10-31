-- Enable renters to delete their own pending, declined, or cancelled rental requests.
-- Run once in the Supabase SQL Editor for an existing project.

grant delete on public.rental_requests to authenticated;

drop policy if exists "Renters can delete their own unaccepted requests" on public.rental_requests;
create policy "Renters can delete their own unaccepted requests" on public.rental_requests
  for delete to authenticated
  using (
    renter_id = (select auth.uid())
    and status in ('pending', 'declined', 'cancelled')
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'renter'
    )
  );
