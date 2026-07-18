-- Simplify roles: clinic = doctor + secretary only; super_admin for platform

-- Convert any existing clinic_manager profiles to doctor
update public.users
set role = 'doctor'
where role = 'clinic_manager';

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('doctor', 'secretary', 'super_admin'));

-- Onboarding creates the clinic doctor (owner)
create or replace function public.onboard_clinic(
  p_clinic_name text,
  p_full_name text,
  p_default_language text default 'ar',
  p_print_format text default 'a4',
  p_phone text default null,
  p_address text default null,
  p_trial_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing_tenant uuid;
  new_tenant public.tenants%rowtype;
  user_email text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select tenant_id into existing_tenant from public.users where id = uid;
  if existing_tenant is not null then
    raise exception 'User already belongs to a clinic';
  end if;

  select email into user_email from auth.users where id = uid;

  insert into public.tenants (
    name, phone, address, default_language, print_format, trial_ends_at
  ) values (
    p_clinic_name,
    p_phone,
    p_address,
    coalesce(nullif(p_default_language, ''), 'ar'),
    coalesce(nullif(p_print_format, ''), 'a4'),
    now() + make_interval(days => greatest(7, least(coalesce(p_trial_days, 14), 14)))
  )
  returning * into new_tenant;

  insert into public.users (id, tenant_id, full_name, email, role)
  values (uid, new_tenant.id, p_full_name, coalesce(user_email, ''), 'doctor')
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    full_name = excluded.full_name,
    role = 'doctor';

  return jsonb_build_object(
    'tenant', to_jsonb(new_tenant),
    'role', 'doctor'
  );
end;
$$;

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
  manager_tenant uuid;
  manager_role text;
begin
  select tenant_id, role into manager_tenant, manager_role
  from public.users
  where id = auth.uid();

  -- Only the clinic doctor can add staff
  if manager_tenant is null or manager_role <> 'doctor' then
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
  values (p_user_id, manager_tenant, p_full_name, lower(p_email), p_role)
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role;

  return jsonb_build_object(
    'user_id', p_user_id,
    'tenant_id', manager_tenant,
    'role', p_role
  );
end;
$$;

-- Align staff_invites role check if table exists
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'staff_invites'
  ) then
    alter table public.staff_invites drop constraint if exists staff_invites_role_check;
    alter table public.staff_invites
      add constraint staff_invites_role_check
      check (role in ('doctor', 'secretary'));
  end if;
end $$;
