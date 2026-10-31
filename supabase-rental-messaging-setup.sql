-- Run once in the Supabase SQL Editor to enable private chat for accepted rentals.
create table if not exists public.rental_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.rental_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists rental_messages_request_created_idx
  on public.rental_messages(request_id, created_at);

alter table public.rental_messages enable row level security;
revoke all on public.rental_messages from anon, authenticated;
grant select, insert on public.rental_messages to authenticated;

drop policy if exists "Participants can read accepted rental messages" on public.rental_messages;
create policy "Participants can read accepted rental messages"
  on public.rental_messages for select to authenticated
  using (exists (
    select 1 from public.rental_requests r
    where r.id = request_id and r.status = 'accepted'
      and (r.renter_id = (select auth.uid()) or r.lister_id = (select auth.uid()))
  ));

drop policy if exists "Participants can send accepted rental messages" on public.rental_messages;
create policy "Participants can send accepted rental messages"
  on public.rental_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and exists (
    select 1 from public.rental_requests r
    where r.id = request_id and r.status = 'accepted'
      and (r.renter_id = (select auth.uid()) or r.lister_id = (select auth.uid()))
  ));

-- Refresh the PostgREST schema cache so the app can see the new table immediately.
notify pgrst, 'reload schema';
