-- ============================================================================
--  Rename PICs: Winnie -> Winnie Chai, Ah Lee -> Lian Sock Lee
-- ----------------------------------------------------------------------------
--  Keeps existing assignments consistent with the updated STAFF_PICS list.
--  ('Winnie Chong' is a brand-new person — no existing data to migrate.)
--  Safe to re-run, and order-independent: the pics[] array is only touched if
--  that column exists yet (it's added by multi_pic.sql). If you run this before
--  multi_pic.sql, the single pic is renamed now and pics[] inherits the new
--  name when multi_pic.sql backfills it.
-- ============================================================================

-- Units: single pic column.
update public.jobs set pic = 'Winnie Chai'   where pic = 'Winnie';
update public.jobs set pic = 'Lian Sock Lee' where pic = 'Ah Lee';

-- Staff logins (the PIC each account is mapped to).
update public.profiles set staff_pic = 'Winnie Chai'   where staff_pic = 'Winnie';
update public.profiles set staff_pic = 'Lian Sock Lee' where staff_pic = 'Ah Lee';

-- Units: the pics[] array — only if the column exists (added by multi_pic.sql).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jobs' and column_name = 'pics'
  ) then
    update public.jobs set pics = array_replace(pics, 'Winnie', 'Winnie Chai')   where 'Winnie' = any(pics);
    update public.jobs set pics = array_replace(pics, 'Ah Lee', 'Lian Sock Lee') where 'Ah Lee'  = any(pics);
  end if;
end $$;
