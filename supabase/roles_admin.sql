-- ============================================================================
--  Role management (in-app) + self-escalation guard
-- ----------------------------------------------------------------------------
--  Lets admins promote/demote staff from the app's Staff page, and CLOSES a
--  hole: the "update own profile" policy would otherwise let a staff member set
--  their own role to admin. A trigger now blocks any role change by non-admins.
--
--  Run AFTER permissions.sql. Run ONCE in the SQL Editor. Safe to re-run.
-- ============================================================================

-- Block role changes unless the caller is an admin (covers the own-profile
-- update policy and any direct update).
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- auth.uid() is null in the SQL editor / service role (which bypass RLS
  -- anyway), so only guard changes made by an actual signed-in API user.
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Admin-only setter used by the Staff page. Refuses to remove the last admin.
create or replace function public.set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if new_role not in ('admin', 'staff') then
    raise exception 'Invalid role: %', new_role;
  end if;
  if new_role <> 'admin'
     and (select role from public.profiles where id = target) = 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Cannot remove the last admin';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;
