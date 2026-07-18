-- Logos bucket for clinic branding
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists logos_storage_select on storage.objects;
create policy logos_storage_select on storage.objects for select
  using (bucket_id = 'logos');

drop policy if exists logos_storage_insert on storage.objects;
create policy logos_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

drop policy if exists logos_storage_update on storage.objects;
create policy logos_storage_update on storage.objects for update
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

drop policy if exists logos_storage_delete on storage.objects;
create policy logos_storage_delete on storage.objects for delete
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- Platform settings for trial days (super_admin)
create table if not exists public.platform_settings (
  id int primary key default 1 check (id = 1),
  default_trial_days integer not null default 14 check (default_trial_days between 7 and 14),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id, default_trial_days)
values (1, 14)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_select on public.platform_settings;
create policy platform_settings_select on public.platform_settings for select
  using (true);

drop policy if exists platform_settings_insert on public.platform_settings;
create policy platform_settings_insert on public.platform_settings for insert
  with check (public.is_super_admin());

drop policy if exists platform_settings_update on public.platform_settings;
create policy platform_settings_update on public.platform_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Allow super_admin to update any tenant
drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants for update
  using (id = public.current_tenant_id() or public.is_super_admin())
  with check (id = public.current_tenant_id() or public.is_super_admin());

drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select
  using (id = public.current_tenant_id() or public.is_super_admin());

-- How to create the first super_admin (run after signing up that email in Auth):
-- insert into public.users (id, tenant_id, full_name, email, role)
-- values ('AUTH_USER_UUID', null, 'Platform Admin', 'admin@example.com', 'super_admin');
