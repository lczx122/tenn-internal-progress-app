-- ============================================================================
--  The LUCAS role — boss privileges + unlocks the game-ified GUI (/game).
-- ----------------------------------------------------------------------------
--  One paste in the SQL Editor (Cmd/Ctrl+A to select ALL, then Run).
--  Safe to re-run. 'lucas' passes every is_boss()/is_admin() gate, so all
--  RLS-protected boss areas (costings, supplier tracker, …) keep working.
-- ============================================================================

-- Admins, bosses and Lucas pass is_admin().
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','boss','lucas')); $$;

-- Bosses and Lucas pass is_boss() — gates Costing, supplier tracker, etc.
create or replace function public.is_boss()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('boss','lucas')); $$;

-- set_role: accept 'lucas'; it is guarded exactly like 'boss' (only a boss-level
-- user may grant or take it away) and counts as privileged for the
-- never-remove-the-last-admin check.
create or replace function public.set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public
as $$
declare cur text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if new_role not in ('admin','staff','boss','guest','lucas') then raise exception 'Invalid role: %', new_role; end if;
  select role into cur from public.profiles where id = target;
  if (new_role in ('boss','lucas') or cur in ('boss','lucas')) and not public.is_boss() then
    raise exception 'Only a boss can assign or change the boss/lucas role';
  end if;
  if new_role not in ('admin','boss','lucas') and cur in ('admin','boss','lucas')
     and (select count(*) from public.profiles where role in ('admin','boss','lucas')) <= 1 then
    raise exception 'Cannot remove the last admin/boss';
  end if;
  update public.profiles set role = new_role where id = target;
end; $$;

-- Give Lucas the role.
update public.profiles set role = 'lucas'
 where id = (select id from auth.users where email = 'lczx122@gmail.com');

-- Verification: your row should read role = lucas.
select p.full_name, u.email, p.role
  from public.profiles p join auth.users u on u.id = p.id
 where u.email = 'lczx122@gmail.com';
