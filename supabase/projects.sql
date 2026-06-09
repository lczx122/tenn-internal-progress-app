-- ============================================================================
--  Projects — group units (jobs) by development/project
-- ----------------------------------------------------------------------------
--  Adds a free-text project name to each unit. Existing units are backfilled to
--  'Ambience Pulau Gadong'. New projects are created simply by typing a new name
--  when adding a unit. Run ONCE in the SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.jobs
  add column if not exists project text not null default 'Ambience Pulau Gadong';

create index if not exists jobs_project_idx on public.jobs (project);
