-- ============================================================================
--  Multiple PICs per appointment + admin-editable display names
-- ----------------------------------------------------------------------------
--  Run AFTER appointments_pic.sql. Run ONCE in the SQL Editor. Safe to re-run.
-- ============================================================================

-- 1. Appointments can have several people in charge.
alter table public.appointments
  add column if not exists assignee_ids uuid[] not null default '{}';

-- Backfill from the old single assignee.
update public.appointments
  set assignee_ids = array[assigned_to]
  where assigned_to is not null and (assignee_ids is null or assignee_ids = '{}');

create index if not exists appointments_assignees_idx
  on public.appointments using gin (assignee_ids);

-- 2. Admins can set any user's display name (so we use real staff names, not
--    the email prefix). SECURITY DEFINER + an admin check.
create or replace function public.set_full_name(target uuid, name text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if coalesce(btrim(name), '') = '' then raise exception 'Name required'; end if;
  update public.profiles set full_name = btrim(name) where id = target;
end;
$$;
