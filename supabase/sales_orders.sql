-- ============================================================================
--  Sales Orders — extends the quotations register to also hold sales orders
-- ----------------------------------------------------------------------------
--  Adds a document type so the SAME table/builder produces both:
--    • Quotations   QT-YYMM-XXX
--    • Sales Orders SO-YYMM-XXX
--  Each type has its own independent monthly sequence. A sales order created
--  from a quotation records the quotation it came from (source_id).
--
--  Run AFTER supabase/quotations.sql. Run ONCE in the SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.quotations
  add column if not exists doc_type  text not null default 'QT';
alter table public.quotations
  add column if not exists source_id uuid references public.quotations (id);

-- The monthly sequence is now per document type, so the uniqueness must include
-- doc_type. Drop the old (yymm, seq) constraint and add the type-aware one.
alter table public.quotations drop constraint if exists quotations_yymm_seq_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quotations_type_yymm_seq_key') then
    alter table public.quotations
      add constraint quotations_type_yymm_seq_key unique (doc_type, yymm, seq);
  end if;
end $$;

create index if not exists quotations_doc_type_idx
  on public.quotations (doc_type, created_at desc);

-- Generalised creator: reserves the next sequence for the given type + month and
-- inserts the document. The advisory lock is keyed by type+month so QT and SO
-- number independently and no two saves clash.
create or replace function public.create_document(
  p_type         text,
  p_payload      jsonb,
  p_customer     text,
  p_phone        text,
  p_unit         text,
  p_prepared_by  text,
  p_categories   text,
  p_total        numeric,
  p_source       uuid default null
) returns public.quotations
language plpgsql
security definer set search_path = public
as $$
declare
  v_type text := upper(coalesce(p_type, 'QT'));
  v_yymm text := to_char(now(), 'YYMM');
  v_seq  int;
  v_row  public.quotations;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorised';
  end if;
  if v_type not in ('QT', 'SO') then
    raise exception 'Invalid document type: %', v_type;
  end if;

  perform pg_advisory_xact_lock(hashtext('tenn_doc_' || v_type || '_' || v_yymm));

  select coalesce(max(seq), 0) + 1 into v_seq
    from public.quotations where doc_type = v_type and yymm = v_yymm;

  insert into public.quotations
    (number, doc_type, source_id, yymm, seq, customer_name, customer_phone, unit,
     prepared_by, categories, total, payload, created_by)
  values
    (v_type || '-' || v_yymm || '-' || lpad(v_seq::text, 3, '0'),
     v_type, p_source, v_yymm, v_seq,
     coalesce(p_customer, ''), coalesce(p_phone, ''), coalesce(p_unit, ''),
     coalesce(p_prepared_by, ''), coalesce(p_categories, ''),
     coalesce(p_total, 0), coalesce(p_payload, '{}'::jsonb), auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

-- Keep the original create_quotation() working — now a thin wrapper so its
-- sequence also counts only QT rows (not the new SO rows).
create or replace function public.create_quotation(
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
begin
  return public.create_document('QT', p_payload, p_customer, p_phone, p_unit,
                                p_prepared_by, p_categories, p_total, null);
end;
$$;
