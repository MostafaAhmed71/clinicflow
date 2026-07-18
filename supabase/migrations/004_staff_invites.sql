-- Manager creates staff auth user from the app, then links profile via this RPC.
create or replace function public.link_staff_user(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_role text default 'secretary'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_tenant uuid;
  owner_role text;
begin
  select tenant_id, role into owner_tenant, owner_role
  from public.users
  where id = auth.uid();

  if owner_tenant is null or owner_role <> 'doctor' then
    raise exception 'Only the clinic doctor can add staff';
  end if;

  if p_role not in ('doctor', 'secretary') then
    raise exception 'Invalid role';
  end if;

  if exists (select 1 from public.users where id = p_user_id and tenant_id is not null) then
    raise exception 'User already belongs to a clinic';
  end if;

  if exists (select 1 from public.users where email = lower(p_email) and id <> p_user_id) then
    raise exception 'Email already registered in profiles';
  end if;

  insert into public.users (id, tenant_id, full_name, email, role)
  values (p_user_id, owner_tenant, p_full_name, lower(p_email), p_role)
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role;

  return jsonb_build_object(
    'user_id', p_user_id,
    'tenant_id', owner_tenant,
    'role', p_role
  );
end;
$$;

revoke all on function public.link_staff_user from public;
grant execute on function public.link_staff_user to authenticated;
