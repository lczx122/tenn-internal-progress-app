-- ============================================================================
--  Auto-archive completed units after 2 months
-- ----------------------------------------------------------------------------
--  A unit is "completed" when it has work cards and ALL of them are at stage
--  'completed'. This migration:
--    1. Tracks jobs.completed_at — stamped the moment a unit first becomes fully
--       completed (and cleared if it ever stops being complete, or is manually
--       unarchived, so the clock restarts).
--    2. archive_completed_units() — archives every active unit whose completed_at
--       is more than 2 months old. Run it on a schedule (pg_cron below); the app
--       also calls it opportunistically when an admin opens the dashboard, so it
--       works even without cron.
--
--  Run ONCE in the SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.jobs
  add column if not exists completed_at timestamptz;

create index if not exists jobs_completed_at_idx on public.jobs (completed_at);

-- ---------------------------------------------------------------------------
--  Maintain jobs.completed_at from the unit's work-card stages.
--  Fully completed → stamp now() the first time (kept stable afterwards).
--  Not fully completed (or no cards) → clear, so re-completing restarts the 2mo.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_job_completed(p_job uuid)
returns void
language plpgsql
as $$
declare
  v_total int;
  v_done  int;
begin
  if p_job is null then return; end if;

  select count(*), count(*) filter (where stage = 'completed')
    into v_total, v_done
    from public.job_works
   where job_id = p_job;

  if v_total > 0 and v_done = v_total then
    update public.jobs set completed_at = now()
      where id = p_job and completed_at is null;
  else
    update public.jobs set completed_at = null
      where id = p_job and completed_at is not null;
  end if;
end;
$$;

create or replace function public.tg_job_works_completed()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_job_completed(old.job_id);
    return old;
  end if;
  perform public.recompute_job_completed(new.job_id);
  if tg_op = 'UPDATE' and new.job_id is distinct from old.job_id then
    perform public.recompute_job_completed(old.job_id);
  end if;
  return new;
end;
$$;

drop trigger if exists job_works_completed on public.job_works;
create trigger job_works_completed
  after insert or update or delete on public.job_works
  for each row execute function public.tg_job_works_completed();

-- Manually unarchiving a unit stops the auto-archive clock (so it isn't
-- immediately re-archived). It re-arms only if the unit re-completes.
create or replace function public.tg_jobs_unarchive_reset()
returns trigger
language plpgsql
as $$
begin
  if old.is_archived = true and new.is_archived = false then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_unarchive_reset on public.jobs;
create trigger jobs_unarchive_reset
  before update on public.jobs
  for each row
  when (old.is_archived is distinct from new.is_archived)
  execute function public.tg_jobs_unarchive_reset();

-- Backfill: units already fully completed get a completed_at approximated by the
-- last time any of their work cards changed (≈ when the unit was finished).
update public.jobs j
   set completed_at = sub.last_change
  from (
    select job_id,
           max(updated_at) as last_change,
           count(*) as total,
           count(*) filter (where stage = 'completed') as done
      from public.job_works
     group by job_id
  ) sub
 where j.id = sub.job_id
   and j.completed_at is null
   and j.is_archived = false
   and sub.total > 0
   and sub.done = sub.total;

-- ---------------------------------------------------------------------------
--  Archive every active unit completed more than 2 months ago. Returns the
--  number archived. Idempotent — already-archived units are skipped.
-- ---------------------------------------------------------------------------
create or replace function public.archive_completed_units()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    select id from public.jobs
     where is_archived = false
       and completed_at is not null
       and completed_at < now() - interval '2 months'
  loop
    update public.jobs
       set is_archived = true, updated_by = 'Auto-archive'
     where id = r.id;
    insert into public.job_events (job_id, type, body, author_name)
      values (r.id, 'note', 'Unit auto-archived — completed over 2 months ago', 'System');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.archive_completed_units() to authenticated, service_role;

-- ---------------------------------------------------------------------------
--  Optional: run it server-side every day (recommended). Enable pg_cron once,
--  then schedule. The app also runs it when an admin opens the dashboard, so
--  this is a backstop for when no one signs in for a while.
-- ---------------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- select cron.schedule('auto-archive-completed', '0 3 * * *',
--   $$ select public.archive_completed_units(); $$);
-- To stop:  select cron.unschedule('auto-archive-completed');
