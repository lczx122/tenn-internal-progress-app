-- ============================================================================
--  Guest role
--  Guests can only view the quotation generator (enforced in the app UI). This
--  just lets admins assign the 'guest' role and protects against demoting the
--  last admin/boss to a non-privileged role. Safe to re-run.
-- ============================================================================

create or replace function public.set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public
as $$
declare cur text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if new_role not in ('admin','staff','boss','guest') then raise exception 'Invalid role: %', new_role; end if;
  select role into cur from public.profiles where id = target;
  if (new_role = 'boss' or cur = 'boss') and not public.is_boss() then
    raise exception 'Only a boss can assign or change the boss role';
  end if;
  -- never strip the last admin/boss of their privileges (any non-priv role)
  if new_role not in ('admin','boss') and cur in ('admin','boss')
     and (select count(*) from public.profiles where role in ('admin','boss')) <= 1 then
    raise exception 'Cannot remove the last admin/boss';
  end if;
  update public.profiles set role = new_role where id = target;
end; $$;
