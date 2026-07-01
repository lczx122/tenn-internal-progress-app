-- ============================================================================
--  Fix Collection: merge the stray "Aluminium" trade into "Aluminium Work"
-- ----------------------------------------------------------------------------
--  The Collection page lists trades from the data (jobs.order_by_category keys,
--  claims.work_category). A legacy "Aluminium" category (from an older quote-tool
--  mapping) shows up alongside the correct "Aluminium Work" and "Aluminium
--  Cabinet". The quote tool no longer produces it, but it persists in old rows
--  and the trade picker keeps re-offering it. This migration folds "Aluminium"
--  into "Aluminium Work" everywhere, preserving any amounts.
--
--  Run ONCE in the SQL Editor. Idempotent (a no-op once clean).
-- ============================================================================

-- 1. Per-trade order amounts: add the "Aluminium" amount onto "Aluminium Work",
--    then drop the "Aluminium" key.
update public.jobs
   set order_by_category =
        (order_by_category - 'Aluminium')
        || jsonb_build_object(
             'Aluminium Work',
             round( coalesce((order_by_category->>'Aluminium Work')::numeric, 0)
                  + coalesce((order_by_category->>'Aluminium')::numeric, 0), 2))
 where order_by_category ? 'Aluminium';

-- 2. Collections tagged to the old category.
update public.claims
   set work_category = 'Aluminium Work'
 where work_category = 'Aluminium';

-- 3. Work cards on the old category: rename where the unit has no "Aluminium
--    Work" card yet; otherwise drop the duplicate stray card.
update public.job_works w
   set category = 'Aluminium Work'
 where w.category = 'Aluminium'
   and not exists (
     select 1 from public.job_works w2
      where w2.job_id = w.job_id and w2.category = 'Aluminium Work');

delete from public.job_works w
 where w.category = 'Aluminium'
   and exists (
     select 1 from public.job_works w2
      where w2.job_id = w.job_id and w2.category = 'Aluminium Work');
