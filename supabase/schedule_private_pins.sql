-- ============================================================================
--  Schedule — private tasks + personal pins
-- ----------------------------------------------------------------------------
--  Run AFTER supabase/appointments.sql (and its follow-ups). Run ONCE in the
--  SQL Editor. Safe to re-run.
--
--  1. appointments.is_private — a task marked private is visible ONLY to the
--     person who created it. RLS enforces this at the database level, so no one
--     else can read it — not even an admin / the boss.
--  2. appointment_pins — each user can pin appointments to the top of their own
--     schedule. Pins are personal: a user only ever sees (or edits) their own.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Private tasks
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists is_private boolean not null default false;

create index if not exists appointments_private_idx on public.appointments (is_private);

-- Replace the old blanket "any authenticated" policy with per-command policies
-- that keep the shared-team model for public tasks but lock private ones to
-- their creator. created_by is the appointment's owner (auth.uid() at insert).
drop policy if exists "auth all appointments" on public.appointments;

drop policy if exists "appts select" on public.appointments;
create policy "appts select" on public.appointments
  for select using (
    auth.role() = 'authenticated'
    and (is_private = false or created_by = auth.uid())
  );

drop policy if exists "appts insert" on public.appointments;
create policy "appts insert" on public.appointments
  for insert with check (
    auth.role() = 'authenticated'
    and (is_private = false or created_by = auth.uid())
  );

drop policy if exists "appts update" on public.appointments;
create policy "appts update" on public.appointments
  for update using (
    auth.role() = 'authenticated'
    and (is_private = false or created_by = auth.uid())
  ) with check (
    auth.role() = 'authenticated'
    and (is_private = false or created_by = auth.uid())
  );

drop policy if exists "appts delete" on public.appointments;
create policy "appts delete" on public.appointments
  for delete using (
    auth.role() = 'authenticated'
    and (is_private = false or created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
--  2. Personal pins (per-user, private to that user)
-- ---------------------------------------------------------------------------
create table if not exists public.appointment_pins (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, appointment_id)
);

alter table public.appointment_pins enable row level security;

-- A user can only see and change their own pins.
drop policy if exists "own pins" on public.appointment_pins;
create policy "own pins" on public.appointment_pins
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Live updates so pins sync across the user's own devices.
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointment_pins') then
    alter publication supabase_realtime add table public.appointment_pins;
  end if;
end $$;
