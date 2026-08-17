-- ============================================================================
--  DATABASE HEALTH CHECK — run after accidentally pasting foreign SQL.
--  One paste (Cmd/Ctrl+A → Run), ONE result table. Rows are sorted worst-first:
--    ✖  broken / missing — needs fixing
--    ⚠  unexpected — probably left behind by the foreign script; review
--    ✔  key safety checks that passed
--    ℹ  row counts for eyeballing (do these look like your real data?)
--  Read-only: this script changes nothing.
-- ============================================================================

with expected_tables(t) as (values
  ('app_settings'),('appointment_pins'),('appointments'),('claims'),('costings'),
  ('job_events'),('job_works'),('jobs'),('notification_prefs'),('profiles'),
  ('projects'),('push_subscriptions'),('quotations'),('sent_reminders'),
  ('suppliers'),('sync_config'),('unit_suppliers')
),
expected_functions(f) as (values
  ('archive_completed_units'),('create_document'),('create_quotation'),
  ('detach_sales_orders'),('get_sheet_sync'),('guard_job_archive'),
  ('guard_profile_role'),('handle_new_user'),('is_admin'),('is_boss'),
  ('recompute_job_completed'),('relink_costings'),('set_full_name'),
  ('set_role'),('set_staff_pic'),('sync_costings'),('sync_unit_totals'),
  ('tg_job_works_completed'),('tg_jobs_unarchive_reset'),('tg_so_create_unit'),
  ('tg_so_delete_unit'),('touch_job'),('touch_updated_at'),('update_document')
),
expected_triggers(tbl, trg) as (values
  ('appointments','appointments_touch'),
  ('costings','costings_touch'),
  ('job_works','job_works_completed'),('job_works','job_works_touch'),
  ('jobs','jobs_guard_archive'),('jobs','jobs_touch'),('jobs','jobs_unarchive_reset'),
  ('profiles','profiles_guard_role'),
  ('quotations','trg_so_create_unit'),('quotations','trg_so_delete_unit'),
  ('unit_suppliers','unit_suppliers_touch')
),
live_tables as (
  select tablename as t, rowsecurity from pg_tables where schemaname = 'public'
),
live_functions as (
  select p.proname as f from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
),
live_triggers as (
  select c.relname as tbl, t.tgname as trg
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
),
critical_columns(tbl, col) as (values
  ('jobs','unit_code'),('jobs','order_total'),('jobs','order_by_category'),
  ('jobs','pics'),('jobs','is_archived'),
  ('quotations','unit_id'),('quotations','doc_type'),('quotations','payload'),
  ('quotations','number'),
  ('claims','work_category'),('claims','amount'),
  ('profiles','role'),
  ('job_works','stage'),('job_works','category')
),
report as (
  -- ✖ expected table missing entirely (a foreign DROP hit us)
  select 1 as sev, '✖ TABLE MISSING' as status, e.t as object,
         'This app''s table is gone — restore needed' as detail
  from expected_tables e left join live_tables l on l.t = e.t where l.t is null
  union all
  -- ✖ RLS switched off on one of our tables
  select 1, '✖ RLS DISABLED', l.t, 'Row security is off — anyone with the anon key can read/write'
  from live_tables l join expected_tables e on e.t = l.t where not l.rowsecurity
  union all
  -- ✖ RLS on but no policies at all → the app would be locked out
  select 1, '✖ NO POLICIES', l.t, 'RLS is on but has zero policies — the app cannot read this table'
  from live_tables l join expected_tables e on e.t = l.t
  where l.rowsecurity
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = l.t)
  union all
  -- ✖ load-bearing column missing (foreign ALTER/DROP COLUMN on a name-collision table)
  select 1, '✖ COLUMN MISSING', cc.tbl || '.' || cc.col, 'A column the app depends on is gone'
  from critical_columns cc
  where exists (select 1 from live_tables lt where lt.t = cc.tbl)
    and not exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = cc.tbl and c.column_name = cc.col)
  union all
  -- ✖ expected function missing
  select 1, '✖ FUNCTION MISSING', e.f, 'Recreate from the matching supabase/*.sql file'
  from expected_functions e left join live_functions l on l.f = e.f where l.f is null
  union all
  -- ✖ expected trigger missing
  select 1, '✖ TRIGGER MISSING', e.tbl || ' → ' || e.trg, 'Recreate from the matching supabase/*.sql file'
  from expected_triggers e left join live_triggers l on l.tbl = e.tbl and l.trg = e.trg
  where not exists (select 1 from live_triggers x where x.tbl = e.tbl and x.trg = e.trg)
    and exists (select 1 from live_tables lt where lt.t = e.tbl)
  union all
  -- ⚠ table we don't recognise (probably created by the foreign script)
  select 2, '⚠ UNEXPECTED TABLE', l.t, 'Not part of this app — likely from the pasted script; safe to review then drop'
  from live_tables l left join expected_tables e on e.t = l.t where e.t is null
  union all
  -- ⚠ function we don't recognise
  select 2, '⚠ UNEXPECTED FUNCTION', l.f, 'Not part of this app — review; may be from the pasted script'
  from live_functions l
  left join expected_functions e on e.f = l.f
  where e.f is null and l.f not like 'pgrst_%'
  union all
  -- ⚠ foreign trigger attached to OUR tables (most dangerous silent damage)
  select 2, '⚠ UNEXPECTED TRIGGER', l.tbl || ' → ' || l.trg,
         'A trigger this app never created is running on this app''s table'
  from live_triggers l
  join expected_tables et on et.t = l.tbl
  left join expected_triggers e on e.tbl = l.tbl and e.trg = l.trg
  where e.trg is null
  union all
  -- ✔ the SO→unit matcher is the fixed letter-safe version
  select 3, case when pg_get_functiondef(p.oid) like '%regexp_replace(lower(%' then '✔ SO MATCHER OK'
                 else '✖ SO MATCHER OLD/CHANGED' end,
         'tg_so_create_unit',
         case when pg_get_functiondef(p.oid) like '%regexp_replace(lower(%' then 'Letter-safe exact matching in place'
              else 'Re-run supabase/fix_so_mislinks.sql' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'tg_so_create_unit'
  union all
  -- ✔/ℹ lucas role wiring
  select 3, case when pg_get_functiondef(p.oid) like '%lucas%' then '✔ LUCAS ROLE OK' else 'ℹ LUCAS ROLE ABSENT' end,
         'is_boss',
         case when pg_get_functiondef(p.oid) like '%lucas%' then 'is_boss includes the lucas role'
              else 'supabase/lucas_role.sql not applied (fine if intentional)' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'is_boss'
  union all
  -- ℹ approximate row counts (from the stats catalog, so a dropped table can
  -- never crash this report) — do these look like your real data?
  select 4, 'ℹ ROWS (approx)', s.relname, greatest(s.n_live_tup, 0)::text || ' rows'
  from pg_stat_user_tables s
  join expected_tables e on e.t = s.relname
  where s.schemaname = 'public'
)
select status, object, detail from report order by sev, status, object;
