-- ============================================================================
--  Costing v2 — align to the real workbook
-- ----------------------------------------------------------------------------
--  Adds a business category to each costing. Commission is now a cost (stored
--  in the costs/commissions JSON), gross profit = selling - total costing, and
--  profit sharing is a % of gross profit — all handled in the app. Run AFTER
--  costing.sql. Safe to re-run.
-- ============================================================================

alter table public.costings add column if not exists category text not null default '';
create index if not exists costings_category_idx on public.costings (category);
