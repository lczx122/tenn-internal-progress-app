-- ============================================================================
--  Sales Order → auto-create linked unit + work · editable documents
-- ----------------------------------------------------------------------------
--  Run AFTER supabase/sales_orders.sql. Run ONCE in the SQL Editor. Safe to
--  re-run.
--
--  This migration:
--    1. Adds quotations.unit_id — the unit (jobs row) a Sales Order is linked to.
--    2. update_document()       — lets the document's CREATOR or an ADMIN edit a
--                                 saved quotation / sales order after creation.
--    3. On INSERT of a Sales Order, auto-creates (or reuses, when the unit code
--       matches an existing unit) a linked unit and adds one work card per
--       quoted category. It never blocks the sales order from saving.
-- ============================================================================

alter table public.quotations
  add column if not exists unit_id uuid references public.jobs (id);

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
--  On Sales Order insert: create or reuse a unit, add the work cards the
--  document specifies, and link the document to that unit. Wrapped so a
--  failure can never roll back (and thus block) the sales order itself.
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
  v_cat_totals jsonb;
  v_curr      jsonb;
begin
  if new.doc_type <> 'SO' or new.unit_id is not null then
    return new;
  end if;

  v_project    := nullif(trim(coalesce(new.payload->>'project','')), '');
  v_cat_totals := coalesce(new.payload->'category_totals', '{}'::jsonb);
  v_unit_norm := lower(regexp_replace(coalesce(new.unit,''), '[^a-z0-9]', '', 'g'));

  -- Person(s) in charge: the quote tool sends payload.pics (an array). Fall back
  -- to the preparer's name when none were ticked.
  if jsonb_typeof(new.payload->'pics') = 'array' then
    select coalesce(array_agg(value), '{}')
      into v_pics
      from jsonb_array_elements_text(new.payload->'pics')
     where trim(value) <> '';
  end if;
  if cardinality(v_pics) = 0 and coalesce(new.prepared_by,'') <> '' then
    v_pics := array[new.prepared_by];
  end if;

  -- Reuse a matching ACTIVE unit; otherwise create a new one. Two safe tiers
  -- (archived units are never matched, so a new SO always makes a fresh unit):
  --   1. the codes are identical ignoring separators ("D-07-03" == "D0703"); else
  --   2. an existing code that BEGINS with this exact short code at a word
  --      boundary, for units stored with the full address
  --      ("D-07-03, Ambience…"). The boundary check stops "D-07-03" from grabbing
  --      an unrelated "D-07-031".
  if v_unit_norm <> '' then
    select id into v_job from public.jobs
      where is_archived = false
        and lower(regexp_replace(coalesce(unit_code,''), '[^a-z0-9]', '', 'g')) = v_unit_norm
      order by created_at desc
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
       coalesce(nullif(new.prepared_by, ''), 'System'))
    returning id into v_job;

    insert into public.job_events (job_id, type, body, author_name)
      values (v_job, 'created',
              'Unit created from Sales Order ' || new.number,
              coalesce(nullif(new.prepared_by, ''), 'System'));
  else
    -- Existing unit: keep its order value in step, note the new SO, and seed the
    -- PIC list if it didn't have one yet.
    update public.jobs
       set order_total = coalesce(order_total, 0) + coalesce(new.total, 0),
           updated_by  = coalesce(nullif(new.prepared_by, ''), updated_by),
           pics        = case when cardinality(coalesce(pics, '{}')) = 0 then v_pics else pics end
     where id = v_job;

    insert into public.job_events (job_id, type, body, author_name)
      values (v_job, 'note',
              'Linked Sales Order ' || new.number,
              coalesce(nullif(new.prepared_by, ''), 'System'));
  end if;

  -- Seed / accumulate per-trade order amounts from the document's category_totals
  -- (work category -> RM). Existing keys are added to, so multiple SOs on one unit
  -- accumulate the same way order_total does. Wrapped in its own block so that a
  -- failure here (e.g. claims_by_category.sql not run yet, so order_by_category
  -- doesn't exist) can NEVER roll back the unit creation above.
  begin
    if jsonb_typeof(v_cat_totals) = 'object' then
      select coalesce(order_by_category, '{}'::jsonb) into v_curr from public.jobs where id = v_job;
      for v_key in select jsonb_object_keys(v_cat_totals) loop
        v_curr := jsonb_set(
          v_curr, array[v_key],
          to_jsonb(round(coalesce((v_curr->>v_key)::numeric, 0)
                       + coalesce((v_cat_totals->>v_key)::numeric, 0), 2)),
          true);
      end loop;
      update public.jobs set order_by_category = v_curr where id = v_job;
    end if;
  exception when others then
    raise warning 'tg_so_create_unit: category_totals skipped for %: %', new.number, sqlerrm;
  end;

  -- Add the work cards the document specifies (resolved in-app), skipping any
  -- the unit already has.
  if jsonb_typeof(new.payload->'work_categories') = 'array' then
    for v_key in select jsonb_array_elements_text(new.payload->'work_categories')
    loop
      v_key := trim(v_key);
      continue when v_key = '';
      if not exists (
        select 1 from public.job_works where job_id = v_job and category = v_key
      ) then
        insert into public.job_works (job_id, category, title, stage, updated_by)
          values (v_job, v_key, '', 'booked',
                  coalesce(nullif(new.prepared_by, ''), 'System'));
      end if;
      v_added := v_added + 1;
    end loop;
  end if;

  -- Fallback for a document with no explicit list: one generic card.
  -- Uses 'Other Services' so every category matches the quote generator + the
  -- in-app category list (src/lib/categories.ts).
  if v_added = 0 and not exists (
    select 1 from public.job_works where job_id = v_job and category = 'Other Services'
  ) then
    insert into public.job_works (job_id, category, title, stage, updated_by)
      values (v_job, 'Other Services', '', 'booked',
              coalesce(nullif(new.prepared_by, ''), 'System'));
  end if;

  update public.quotations set unit_id = v_job where id = new.id;

  return new;
exception when others then
  -- Never let unit creation block the sales order from being saved.
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

-- Self-heal any Sales Orders that were saved but never got a unit (e.g. an
-- earlier trigger error). The no-op update re-fires the trigger; SOs that already
-- have a unit return immediately. Safe to run any time.
update public.quotations set unit_id = unit_id
 where doc_type = 'SO' and unit_id is null;
