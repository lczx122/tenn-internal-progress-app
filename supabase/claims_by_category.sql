-- ============================================================================
--  Per-trade collection detail
--  Adds:
--    1. claims.work_category  — the trade (work category) a collection is for.
--                               NULL = "Unallocated" (whole-unit / untagged).
--    2. jobs.order_by_category — per-trade order amounts (work category -> RM),
--                               seeded from a Sales Order's payload.category_totals
--                               (see so_auto_unit.sql) and/or entered per trade on
--                               the unit's collection card.
--  Idempotent: safe to run more than once. RLS is unchanged (authenticated
--  read/write jobs + claims; admin-only deletes).
--  After this, also re-run supabase/so_auto_unit.sql to pick up the trigger that
--  populates order_by_category for new Sales Orders.
-- ============================================================================

alter table public.claims
  add column if not exists work_category text;

alter table public.jobs
  add column if not exists order_by_category jsonb not null default '{}'::jsonb;
