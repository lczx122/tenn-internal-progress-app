-- ============================================================================
--  Multiple persons-in-charge (PIC) per unit
-- ----------------------------------------------------------------------------
--  Adds jobs.pics (text[]) alongside the existing single jobs.pic. The app and
--  the SO->unit trigger now read/write pics[]; pic is kept as the first PIC for
--  back-compat and display fallback.
--
--  Run this, THEN re-run supabase/so_auto_unit.sql to update the trigger that
--  fills pics from a Sales Order's payload. Safe to re-run.
-- ============================================================================

alter table public.jobs
  add column if not exists pics text[] not null default '{}';

-- Backfill from the single pic wherever pics is still empty.
update public.jobs
   set pics = array[pic]
 where coalesce(pic, '') <> ''
   and cardinality(coalesce(pics, '{}')) = 0;
