-- Costing ↔ Unit link.
-- Lets a costing reference a Unit (work card). When set, the app derives the
-- costing's progress/status live from that unit's work-card stages instead of a
-- hand-set status. Safe to run multiple times.

alter table public.costings
  add column if not exists job_id uuid references public.jobs (id) on delete set null;

create index if not exists costings_job_idx on public.costings (job_id);
