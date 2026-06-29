-- ============================================================================
--  Sales Order ⇄ linked unit · keep the unit a mirror of its Sales Orders
-- ----------------------------------------------------------------------------
--  Run AFTER supabase/sales_orders.sql (and supabase/claims_by_category.sql for
--  the per-trade columns). Run ONCE in the SQL Editor. Safe to re-run.
--
--  A Sales Order is EXPLICITLY linked to one unit (quotations.unit_id). The unit
--  is treated as a derived mirror of every SO linked to it:
--    • INSERT a SO  → create (or reuse) the unit, link it, add its work cards,
--                     and UNARCHIVE it.
--    • UPDATE a SO  → recompute the unit's order_total / order_by_category from
--                     ALL its linked SOs (so editing a SO edits the unit too).
--    • DELETE a SO  → recompute from the SOs that remain; if NONE are left, the
--                     unit is ARCHIVED.
--  Totals and per-trade order amounts are always the SUM over the unit's linked
--  SOs — both sides pull from the same place. It never blocks the SO from saving.
-- ============================================================================

alter table public.quotations
  add column if not exists unit_id uuid references public.jobs (id);

-- true when this Sales Order created a brand-new unit, false when it attached to
-- an existing one. Lets the quote tool tell the user which happened.
alter table public.quotations
  add column if not exists unit_created boolean;

-- ---------------------------------------------------------------------------
--  Editable documents: only the creator or an admin may update a saved row.
--  (Numbering columns — number/seq/doc_type/yymm — are intentionally untouched.)
-- ---------------------------------------------------------------------------
create or replace function public.update_document(
  p_id           uuid,
  p_payload      jsonb,
  p_customer     text,
  p_phone        text,
  p_unit         text,
  p_prepared_by  text,
  p_categories   text,
  p_total        numeric
) returns public.quotations
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.quotations;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorised';
  end if;

  select * into v_row from public.quotations where id = p_id;
  if not found then
    raise exception 'Document not found';
  end if;
  if v_row.created_by is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Only the creator or an admin can edit this document';
  end if;

  update public.quotations set
    payload        = coalesce(p_payload, '{}'::jsonb),
    customer_name  = coalesce(p_customer, ''),
    customer_phone = coalesce(p_phone, ''),
    unit           = coalesce(p_unit, ''),
    prepared_by    = coalesce(p_prepared_by, ''),
    categories     = coalesce(p_categories, ''),
    total          = coalesce(p_total, 0)
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

-- The work cards a Sales Order opens are decided IN-APP (see WORK_MAP in
-- public/quotation.html) and delivered explicitly in payload.work_categories —
-- no string-guessing here. The earlier heuristic mapper is dropped.
drop function if exists public.so_work_category(text);

-- ---------------------------------------------------------------------------
--  sync_unit_totals — recompute a unit's money from ALL its linked Sales Orders.
--  The unit's order_total and per-trade order_by_category are always the SUM over
--  the SOs linked to it, so the unit and its SOs read from the same source.
--    p_archive:  0  leave is_archived alone (a plain edit)
--                1  UNARCHIVE when the unit has >= 1 linked SO (a SO was added)
--               -1  ARCHIVE when the unit has 0 linked SOs left (last SO removed)
-- ---------------------------------------------------------------------------
create or replace function public.sync_unit_totals(
  p_unit   uuid,
  p_actor  text default 'System',
  p_archive int default 0
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
  v_total numeric;
  v_cats  jsonb;
  v_was   boolean;
begin
  if p_unit is null then
    return;
  end if;

  select count(*), coalesce(sum(total), 0)
    into v_count, v_total
    from public.quotations
   where unit_id = p_unit and doc_type = 'SO';

  update public.jobs
     set order_total = v_total,
         updated_by  = p_actor
   where id = p_unit;

  -- Per-trade order = sum of each SO's payload.category_totals (work cat -> RM).
  -- Wrapped so a missing order_by_category column (claims_by_category.sql not run
  -- yet) can never abort the sync.
  begin
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
      into v_cats
      from (
        select key as k, round(sum(value::numeric), 2) as v
          from public.quotations q,
               lateral jsonb_each_text(coalesce(q.payload->'category_totals', '{}'::jsonb))
         where q.unit_id = p_unit and q.doc_type = 'SO'
         group by key
      ) s;
    update public.jobs set order_by_category = v_cats where id = p_unit;
  exception when others then
    null;
  end;

  if p_archive = 1 and v_count > 0 then
    select is_archived into v_was from public.jobs where id = p_unit;
    update public.jobs set is_archived = false where id = p_unit;
    if v_was is true then
      insert into public.job_events (job_id, type, body, author_name)
        values (p_unit, 'note', 'Unit unarchived — Sales Order linked', p_actor);
    end if;
  elsif p_archive = -1 and v_count = 0 then
    select is_archived into v_was from public.jobs where id = p_unit;
    update public.jobs set is_archived = true, order_total = 0 where id = p_unit;
    if v_was is distinct from true then
      insert into public.job_events (job_id, type, body, author_name)
        values (p_unit, 'note', 'Unit archived — no Sales Orders linked', p_actor);
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
--  On Sales Order insert / update: create or reuse a unit, link it, add the
--  work cards the document specifies, and resync the unit from all its SOs.
--  Wrapped so a failure can never roll back (and thus block) the sales order.
-- ---------------------------------------------------------------------------
create or replace function public.tg_so_create_unit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_unit_norm text;
  v_job       uuid;
  v_project   text;
  v_key       text;
  v_added     int := 0;
  v_pics      text[] := '{}';
  v_created   boolean := false;   -- did we create a new unit (vs link an existing)?
  v_actor     text;
  v_arch      int;
begin
  if new.doc_type <> 'SO' then
    return new;
  end if;

  v_actor := coalesce(nullif(new.prepared_by, ''), 'System');

  -- ---------------------------------------------------------------------
  --  Not linked yet: find or create the unit, then link it. The self-update
  --  below re-fires this trigger and runs the linked path (work cards + sync).
  -- ---------------------------------------------------------------------
  if new.unit_id is null then
    v_project   := nullif(trim(coalesce(new.payload->>'project','')), '');
    v_unit_norm := lower(regexp_replace(coalesce(new.unit,''), '[^a-z0-9]', '', 'g'));

    -- Person(s) in charge: the quote tool sends payload.pics (an array). Fall
    -- back to the preparer's name when none were ticked.
    if jsonb_typeof(new.payload->'pics') = 'array' then
      select coalesce(array_agg(value), '{}')
        into v_pics
        from jsonb_array_elements_text(new.payload->'pics')
       where trim(value) <> '';
    end if;
    if cardinality(v_pics) = 0 and coalesce(new.prepared_by,'') <> '' then
      v_pics := array[new.prepared_by];
    end if;

    -- Reuse a matching unit; otherwise create one. Two tiers:
    --   1. codes identical ignoring separators ("D-07-03" == "D0703"). This tier
    --      ALSO matches an ARCHIVED unit (active preferred) so re-adding a SO to a
    --      unit that was auto-archived reuses + unarchives it instead of forking.
    --   2. an ACTIVE code that BEGINS with this exact short code at a word
    --      boundary, for units stored with the full address ("D-07-03, Ambience…").
    --      Archived units are excluded here to avoid greedy mis-matches.
    if v_unit_norm <> '' then
      select id into v_job from public.jobs
        where lower(regexp_replace(coalesce(unit_code,''), '[^a-z0-9]', '', 'g')) = v_unit_norm
        order by is_archived asc, created_at desc
        limit 1;

      if v_job is null and length(trim(coalesce(new.unit,''))) >= 3 then
        select id into v_job from public.jobs
          where is_archived = false
            and lower(coalesce(unit_code,'')) like lower(trim(new.unit)) || '%'
            and coalesce(substring(lower(coalesce(unit_code,''))
                         from length(trim(new.unit)) + 1 for 1), '') !~ '[a-z0-9]'
          order by created_at desc
          limit 1;
      end if;
    end if;

    if v_job is null then
      insert into public.jobs
        (customer_name, phone, project, unit_code, pic, pics, order_total, updated_by)
      values
        (coalesce(nullif(trim(new.customer_name), ''), 'Sales Order ' || new.number),
         coalesce(new.customer_phone, ''),
         coalesce(v_project, 'Ambience Pulau Gadong'),
         coalesce(new.unit, ''),
         coalesce(v_pics[1], new.prepared_by, ''),
         v_pics,
         coalesce(new.total, 0),
         v_actor)
      returning id into v_job;
      v_created := true;

      insert into public.job_events (job_id, type, body, author_name)
        values (v_job, 'created',
                'Unit created from Sales Order ' || new.number, v_actor);
    else
      -- Existing unit (possibly archived): note the new SO and seed the PIC list
      -- if it didn't have one. Totals + unarchive are handled by the sync below.
      update public.jobs
         set updated_by = v_actor,
             pics       = case when cardinality(coalesce(pics, '{}')) = 0 then v_pics else pics end
       where id = v_job;

      insert into public.job_events (job_id, type, body, author_name)
        values (v_job, 'note', 'Linked Sales Order ' || new.number, v_actor);
    end if;

    -- Link the document to the unit. This UPDATE re-fires the trigger into the
    -- linked path below (new.unit_id is now set), which adds cards + syncs.
    update public.quotations
       set unit_id = v_job, unit_created = v_created
     where id = new.id;

    return new;
  end if;

  -- ---------------------------------------------------------------------
  --  Linked path: add any missing work cards and resync the unit from ALL its
  --  Sales Orders. p_archive = 1 (unarchive) when a SO was just added to this
  --  unit; 0 (leave archive alone) on a plain edit.
  -- ---------------------------------------------------------------------
  v_job := new.unit_id;

  if jsonb_typeof(new.payload->'work_categories') = 'array' then
    for v_key in select jsonb_array_elements_text(new.payload->'work_categories')
    loop
      v_key := trim(v_key);
      continue when v_key = '';
      if not exists (
        select 1 from public.job_works where job_id = v_job and category = v_key
      ) then
        insert into public.job_works (job_id, category, title, stage, updated_by)
          values (v_job, v_key, '', 'booked', v_actor);
      end if;
      v_added := v_added + 1;
    end loop;
  end if;

  -- Fallback for a document with no explicit list: one generic card.
  if v_added = 0 and not exists (
    select 1 from public.job_works where job_id = v_job and category = 'Other Services'
  ) then
    insert into public.job_works (job_id, category, title, stage, updated_by)
      values (v_job, 'Other Services', '', 'booked', v_actor);
  end if;

  if TG_OP = 'INSERT' then
    v_arch := 1;
  elsif old.unit_id is null then
    v_arch := 1;          -- the link-time re-fire: a SO was just added
  else
    v_arch := 0;          -- a plain edit: leave archive state alone
  end if;

  perform public.sync_unit_totals(v_job, v_actor, v_arch);

  return new;
exception when others then
  -- Never let unit sync block the sales order from being saved.
  raise warning 'tg_so_create_unit failed for %: %', new.number, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_so_create_unit on public.quotations;
create trigger trg_so_create_unit
  after insert or update on public.quotations
  for each row
  when (new.doc_type = 'SO')
  execute function public.tg_so_create_unit();

-- ---------------------------------------------------------------------------
--  On Sales Order delete: resync the unit from the SOs that remain. When none
--  are left the unit is archived (sync_unit_totals with p_archive = -1).
-- ---------------------------------------------------------------------------
create or replace function public.tg_so_delete_unit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.doc_type = 'SO' and old.unit_id is not null then
    perform public.sync_unit_totals(old.unit_id, 'System', -1);
  end if;
  return old;
exception when others then
  raise warning 'tg_so_delete_unit failed for %: %', old.number, sqlerrm;
  return old;
end;
$$;

drop trigger if exists trg_so_delete_unit on public.quotations;
create trigger trg_so_delete_unit
  after delete on public.quotations
  for each row
  when (old.doc_type = 'SO')
  execute function public.tg_so_delete_unit();

-- Self-heal any Sales Orders that were saved but never got a unit (e.g. an
-- earlier trigger error). The no-op update re-fires the trigger; SOs that already
-- have a unit fall straight into the linked path. Safe to run any time.
update public.quotations set unit_id = unit_id
 where doc_type = 'SO' and unit_id is null;

-- One-time backfill: resync every unit that already has linked SOs so its totals
-- and per-trade order amounts reflect the sum-based model. p_archive = 0 leaves
-- existing archive state untouched (so a completed/archived job keeps its state).
do $$
declare r record;
begin
  for r in
    select distinct unit_id from public.quotations
     where doc_type = 'SO' and unit_id is not null
  loop
    perform public.sync_unit_totals(r.unit_id, 'System', 0);
  end loop;
end $$;
