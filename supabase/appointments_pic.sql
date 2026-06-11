-- ============================================================================
--  Appointments — person in charge (PIC)
-- ----------------------------------------------------------------------------
--  Links each appointment to the staff member responsible, so the app can show
--  a personal schedule. Run ONCE in the SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.appointments
  add column if not exists assigned_to uuid references public.profiles (id);

create index if not exists appointments_assigned_idx on public.appointments (assigned_to);
