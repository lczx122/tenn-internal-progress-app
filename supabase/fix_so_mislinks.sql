-- ============================================================================
--  FIX: Sales Orders attaching to a SIMILAR unit (wrong block letter)
-- ----------------------------------------------------------------------------
--  ROOT CAUSE (found 10/07/26): the matcher's normalisation ran regexp_replace
--  '[^a-z0-9]' BEFORE lower(). Character classes are case-sensitive, so it
--  deleted UPPERCASE letters as if they were separators: "C-08-10" → "0810",
--  which "exact"-matched "A-08-10"/"B-08-10" (also "0810"). Every mislink so
--  far (C-03A-13→B-03-13, D-09-15→A-09-15, SO-2607-013/014) came from this.
--
--  This script, in one paste (Cmd/Ctrl+A to select ALL, then Run):
--    1. Replaces tg_so_create_unit with the letter-safe exact matcher.
--    2. Finds EVERY Sales Order whose typed unit doesn't exactly match its
--       linked unit's code, unlinks it, and relinks it through the fixed
--       matcher (reusing the true unit if it exists, else creating it).
--    3. Prints verification: what was repaired, remaining mismatches (must be
--       0 rows), and the trigger list.
--  Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Corrected matcher (identical to the current supabase/so_auto_unit.sql)
-- ----------------------------------------------------------------------------
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

  -- Intentional detach: an SO's unit_id was cleared (e.g. consolidation moved its
  -- items into a new combined SO). Resync the unit it left — do NOT recreate one.
  if tg_op = 'UPDATE' and old.unit_id is not null and new.unit_id is null then
    perform public.sync_unit_totals(old.unit_id, v_actor, -1);
    return new;
  end if;

  -- ---------------------------------------------------------------------
  --  Not linked yet: find or create the unit, then link it. The self-update
  --  below re-fires this trigger and runs the linked path (work cards + sync).
  -- ---------------------------------------------------------------------
  if new.unit_id is null then
    v_project   := nullif(trim(coalesce(new.payload->>'project','')), '');
    -- NOTE: lower() BEFORE the strip. '[^a-z0-9]' is case-sensitive, so run on the
    -- raw text it deletes UPPERCASE letters too — "C-08-10" and "B-08-10" would both
    -- normalise to "0810" and "exact" match each other (the recurring mislink bug).
    v_unit_norm := regexp_replace(lower(coalesce(new.unit,'')), '[^a-z0-9]', '', 'g');

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

    -- Reuse a unit ONLY on an EXACT code match — no fuzzy / prefix matching, so a
    -- typed "C-03A-13" can never attach to "B-03-13". A unit matches when, ignoring
    -- separators (so "D-07-03" == "D0703"), the typed code equals either:
    --   • the unit's whole code, or
    --   • the unit's code PART — the text before the first comma/space — for units
    --     stored with a full address ("D-07-03, Ambience Pulau Gadong").
    -- Active units are preferred; an archived exact match is still reused (so
    -- re-adding a SO to an auto-archived unit revives it instead of forking).
    if v_unit_norm <> '' then
      select id into v_job from public.jobs
        where regexp_replace(lower(coalesce(unit_code,'')), '[^a-z0-9]', '', 'g') = v_unit_norm
           or regexp_replace(lower(regexp_replace(coalesce(unit_code,''), '[ ,].*$', '')),
                             '[^a-z0-9]', '', 'g') = v_unit_norm
        order by is_archived asc, created_at desc
        limit 1;
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

-- ----------------------------------------------------------------------------
-- 2) Repair: relink every SO whose typed unit isn't an exact match of the unit
--    it's attached to. Snapshot first so the verification can show before/after.
-- ----------------------------------------------------------------------------
drop table if exists _so_mislinked;
create temp table _so_mislinked as
select q.id, q.number, q.unit as typed_unit,
       j.unit_code as wrong_unit, q.unit_id as wrong_unit_id
  from public.quotations q
  join public.jobs j on j.id = q.unit_id
 where q.doc_type = 'SO'
   and coalesce(trim(q.unit), '') <> ''
   and regexp_replace(lower(q.unit), '[^a-z0-9]', '', 'g') not in (
         regexp_replace(lower(coalesce(j.unit_code,'')), '[^a-z0-9]', '', 'g'),
         regexp_replace(lower(regexp_replace(coalesce(j.unit_code,''), '[ ,].*$', '')),
                        '[^a-z0-9]', '', 'g')
       );

do $$
declare r record;
begin
  for r in select * from _so_mislinked loop
    raise notice 'Relinking % — typed %, was on %', r.number, r.typed_unit, r.wrong_unit;
    -- Detach: the trigger's detach guard resyncs the wrong unit's totals from
    -- the SOs that actually belong to it (archives it if none are left).
    update public.quotations set unit_id = null where id = r.id;
    -- Re-fire the (now fixed) linker: exact match reuses the true unit,
    -- otherwise a brand-new unit is created with the SO's work cards.
    update public.quotations set unit_id = null where id = r.id;
  end loop;
end $$;

-- Also relink any SOs left detached (e.g. by the in-app mislink tripwire).
update public.quotations set unit_id = unit_id
 where doc_type = 'SO' and unit_id is null;

-- ----------------------------------------------------------------------------
-- 3) Verification — three result sets:
-- ----------------------------------------------------------------------------
-- a) What was repaired (each SO's old wrong unit → new unit).
select m.number, m.typed_unit, m.wrong_unit as was_linked_to,
       j.unit_code as now_linked_to, q.unit_created as created_new_unit
  from _so_mislinked m
  join public.quotations q on q.id = m.id
  left join public.jobs j on j.id = q.unit_id
 order by m.number;

-- b) Remaining mismatches — MUST return 0 rows.
select q.number, q.unit as typed_unit, j.unit_code as linked_unit
  from public.quotations q
  join public.jobs j on j.id = q.unit_id
 where q.doc_type = 'SO'
   and coalesce(trim(q.unit), '') <> ''
   and regexp_replace(lower(q.unit), '[^a-z0-9]', '', 'g') not in (
         regexp_replace(lower(coalesce(j.unit_code,'')), '[^a-z0-9]', '', 'g'),
         regexp_replace(lower(regexp_replace(coalesce(j.unit_code,''), '[ ,].*$', '')),
                        '[^a-z0-9]', '', 'g')
       );

-- c) Triggers on quotations — expect exactly trg_so_create_unit + trg_so_delete_unit.
select tgname from pg_trigger
 where tgrelid = 'public.quotations'::regclass and not tgisinternal
 order by tgname;
