-- ============================================================================
--  Sheet → App costing sync
--  A Google Apps Script (scripts/AppsScript_SyncCostings.gs) reads a flat
--  "Sync" tab and calls sync_costings() to make the app's costing table match
--  the sheet. The sheet is the source of truth: each sync REPLACES the costings
--  and then RE-DERIVES the unit links (job_id) + live status from the work
--  cards, so the Costing↔Units links you set up survive every sync.
--
--  Security: sync_costings() is callable by the public anon role but is gated
--  by a secret stored in sync_config (which is NOT readable via the API — RLS
--  is on with no policies, so only SECURITY DEFINER functions can read it).
--
--  Run this whole file once in the Supabase SQL editor, then set your secret
--  (see the UPDATE at the bottom). Safe to re-run.
-- ============================================================================

-- 1) Secret store — locked down (no API access; only definer functions read it)
create table if not exists public.sync_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.sync_config enable row level security;
-- intentionally NO policies: PostgREST/anon/authenticated cannot read or write it.

insert into public.sync_config (key, value)
values ('costings_secret', 'CHANGE-ME-set-a-long-random-secret')
on conflict (key) do nothing;

-- 2) Re-derive Costing↔Unit links by unit code, then sync status from progress.
--    (Same logic as link_costings_units.sql, packaged for reuse by the sync.)
create or replace function public.relink_costings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Link each costing to the unit whose code is the longest prefix of the
  -- costing's unit code (text before the "—"), ignoring punctuation/case.
  with codes as (
    select c.id as costing_id,
           upper(regexp_replace(split_part(c.customer, '—', 1), '[^a-zA-Z0-9]', '', 'g')) as ccode
    from public.costings c
  ),
  units as (
    select j.id as job_id,
           upper(regexp_replace(j.customer_name, '[^a-zA-Z0-9]', '', 'g')) as jcode
    from public.jobs j
  ),
  best as (
    select distinct on (codes.costing_id) codes.costing_id, units.job_id
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

  -- For linked costings, set status from the unit's work-card progress
  -- (mirrors stages.ts percents + progressToStatus() thresholds).
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
end;
$$;

-- 3) The sync entrypoint the Apps Script calls.
--    p_rows is a JSON array of { category, cash_sale_no, customer, revenue,
--    costs[], commissions[], shares[], status, notes, costing_date }.
create or replace function public.sync_costings(p_secret text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_count  int;
begin
  select value into v_secret from public.sync_config where key = 'costings_secret';
  if v_secret is null or v_secret = '' or v_secret = 'CHANGE-ME-set-a-long-random-secret' then
    raise exception 'Sync secret is not configured';
  end if;
  if p_secret is null or p_secret <> v_secret then
    raise exception 'Invalid sync secret';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'No rows provided — refusing to replace costings with an empty set';
  end if;

  -- Sheet is the source of truth: replace, then re-link. Runs in one
  -- transaction, so a failure mid-insert rolls back the delete.
  delete from public.costings;

  insert into public.costings
    (cash_sale_no, category, customer, revenue, costs, commissions, shares, notes, status, costing_date, created_at)
  select
    coalesce(r->>'cash_sale_no', ''),
    coalesce(r->>'category', ''),
    coalesce(r->>'customer', ''),
    coalesce(nullif(r->>'revenue','')::numeric, 0),
    coalesce(r->'costs', '[]'::jsonb),
    coalesce(r->'commissions', '[]'::jsonb),
    coalesce(r->'shares', '[]'::jsonb),
    coalesce(r->>'notes', ''),
    coalesce(nullif(r->>'status',''), 'In Progress'),
    nullif(r->>'costing_date','')::date,
    now() - make_interval(secs => ord::int)  -- keep sheet order (row 1 = newest)
  from jsonb_array_elements(p_rows) with ordinality as t(r, ord);

  get diagnostics v_count = row_count;

  perform public.relink_costings();

  return jsonb_build_object('ok', true, 'imported', v_count, 'at', now());
end;
$$;

-- The Apps Script authenticates with the public anon key + the secret, so anon
-- needs EXECUTE. The secret (not the key) is the real gate.
grant execute on function public.sync_costings(text, jsonb) to anon, authenticated;

-- 4) Optional: in-app "Sync sheet" button (Costing page).
--    Deploy the Apps Script as a Web App (Deploy → New deployment → Web app,
--    "Execute as: Me", "Who has access: Anyone"), then store its URL + the
--    trigger token here. get_sheet_sync() hands them to the boss-only button.
insert into public.sync_config (key, value) values
  ('webapp_url', ''),
  ('trigger_token', '')
on conflict (key) do nothing;

create or replace function public.get_sheet_sync()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_token text;
begin
  if not public.is_boss() then return null; end if; -- boss-only
  select value into v_url   from public.sync_config where key = 'webapp_url';
  select value into v_token from public.sync_config where key = 'trigger_token';
  if v_url is null or v_url = '' then return null; end if;
  return jsonb_build_object('url', v_url, 'token', coalesce(v_token, ''));
end;
$$;
grant execute on function public.get_sheet_sync() to authenticated;

-- 5) >>> SET YOUR VALUES <<<  (run these with your own values)
-- update public.sync_config set value = 'your-long-random-secret' where key = 'costings_secret';
-- For the in-app button (after deploying the Web App):
-- update public.sync_config set value = 'https://script.google.com/macros/s/XXXX/exec' where key = 'webapp_url';
-- update public.sync_config set value = 'your-trigger-token' where key = 'trigger_token';
