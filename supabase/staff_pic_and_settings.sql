-- ============================================================================
--  Staff → PIC mapping (personalized "my units" view)
-- ----------------------------------------------------------------------------
--  Each login can be assigned a PIC name (from the app's STAFF_PICS list) so the
--  Units list and Dashboard can default a staff member to only the units they're
--  the person-in-charge of. Admins set this in Staff & Roles.
--
--  Run ONCE in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists staff_pic text not null default '';

-- Admin-only setter (security definer; bypasses RLS, like set_role). Changing
-- staff_pic does not touch the role, so the role-guard trigger is unaffected.
create or replace function public.set_staff_pic(target uuid, pic text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.profiles set staff_pic = coalesce(pic, '') where id = target;
end; $$;

-- Note: the payment details and current announcement are stored in the existing
-- public.app_settings key-value table (keys 'payment_details' and 'announcement')
-- — no schema change needed. Announcements are posted via the `announce` edge
-- function (boss-only); the banner just reads app_settings.
