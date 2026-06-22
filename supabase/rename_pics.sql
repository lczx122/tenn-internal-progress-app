-- ============================================================================
--  Rename PICs: Winnie -> Winnie Chai, Ah Lee -> Lian Sock Lee
-- ----------------------------------------------------------------------------
--  Keeps existing assignments consistent with the updated STAFF_PICS list.
--  ('Winnie Chong' is a brand-new person — no existing data to migrate.)
--  Safe to re-run (no rows match the old names after the first run).
-- ============================================================================

-- Units: single pic + the pics[] array.
update public.jobs set pic = 'Winnie Chai'   where pic = 'Winnie';
update public.jobs set pic = 'Lian Sock Lee' where pic = 'Ah Lee';
update public.jobs set pics = array_replace(pics, 'Winnie', 'Winnie Chai')   where 'Winnie' = any(pics);
update public.jobs set pics = array_replace(pics, 'Ah Lee', 'Lian Sock Lee') where 'Ah Lee' = any(pics);

-- Staff logins (the PIC each account is mapped to).
update public.profiles set staff_pic = 'Winnie Chai'   where staff_pic = 'Winnie';
update public.profiles set staff_pic = 'Lian Sock Lee' where staff_pic = 'Ah Lee';
