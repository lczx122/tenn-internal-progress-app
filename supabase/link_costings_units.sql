-- ============================================================================
--  One-time: auto-link costings to Units by unit code, then sync status from
--  the unit's work-card progress.
--
--  Matching: take the costing's customer text before the "—" (e.g.
--  "A-10-06-GES — 2 Room Standard" → "A-10-06-GES"), strip punctuation, and
--  link to the unit whose code (jobs.customer_name, normalised the same way)
--  is a prefix of it — longest match wins, so "A-10-06" beats "A-10".
--  Costings with no matching unit are left unlinked (link them by hand in the
--  costing form). Already-linked costings are not touched.
--
--  Safe to re-run. Run in the SQL Editor (service role bypasses RLS).
-- ============================================================================

-- 1) Link by unit code.
with codes as (
  select c.id as costing_id,
         upper(regexp_replace(split_part(c.customer, '—', 1), '[^a-zA-Z0-9]', '', 'g')) as ccode
  from public.costings c
  where c.job_id is null
),
units as (
  select j.id as job_id,
         upper(regexp_replace(j.customer_name, '[^a-zA-Z0-9]', '', 'g')) as jcode
  from public.jobs j
),
best as (
  select distinct on (codes.costing_id)
         codes.costing_id, units.job_id
  from codes
  join units
    on length(units.jcode) >= 3
   and codes.ccode like units.jcode || '%'
  order by codes.costing_id, length(units.jcode) desc
)
update public.costings c
set job_id = b.job_id
from best b
where c.id = b.costing_id;

-- 2) Sync stored status from work-card progress (the app also derives this
--    live; this keeps the stored column consistent for exports/queries).
--    Stage percents mirror src/lib/stages.ts; thresholds mirror
--    progressToStatus() in src/lib/costing.ts.
with prog as (
  select w.job_id,
         round(avg(case w.stage
           when 'booked'      then 0
           when 'in_progress' then 30
           when 'installing'  then 60
           when 'collecting'  then 85
           when 'completed'   then 100
           else 0 end)) as pct
  from public.job_works w
  group by w.job_id
)
update public.costings c
set status = case
  when p.pct >= 100 then 'Completed'
  when p.pct >= 73  then 'Collecting Money'
  when p.pct >= 45  then 'Installing'
  when p.pct >= 15  then 'In Progress'
  else 'Chatting' end
from prog p
where c.job_id = p.job_id;

-- 3) Report: every costing and what it linked to (unlinked rows first).
select coalesce(j.customer_name, '— NOT LINKED —') as linked_unit,
       c.customer,
       c.category,
       c.status,
       c.cash_sale_no
from public.costings c
left join public.jobs j on j.id = c.job_id
order by (c.job_id is null) desc, j.customer_name, c.category;
