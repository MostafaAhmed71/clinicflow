-- ClinicFlow MVP schema + RLS
-- Shared DB multi-tenant: tenant_id on every main table

create extension if not exists "pgcrypto";

-- ========== TENANTS ==========
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  address text,
  phone text,
  working_hours jsonb default '{}'::jsonb,
  default_language text not null default 'ar' check (default_language in ('ar', 'en')),
  print_format text not null default 'a4' check (print_format in ('a4', 'thermal', 'both')),
  subscription_plan text not null default 'starter'
    check (subscription_plan in ('starter', 'professional', 'enterprise')),
  consultation_fee numeric(12, 2) default 0,
  tax_rate numeric(5, 2) default 0,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- ========== USERS (profile linked to auth.users) ==========
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('doctor', 'secretary', 'super_admin')),
  created_at timestamptz not null default now(),
  constraint users_tenant_required_unless_super_admin
    check (
      (role = 'super_admin' and tenant_id is null)
      or (role <> 'super_admin' and tenant_id is not null)
    )
);

-- ========== HELPERS (after public.users exists) ==========
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.users where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(role, '') from public.users where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- JWT custom claims for RLS
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_role text;
  user_tenant uuid;
begin
  select role, tenant_id into user_role, user_tenant
  from public.users
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';
  if user_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  end if;
  if user_tenant is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant::text));
  else
    claims := jsonb_set(claims, '{tenant_id}', 'null'::jsonb);
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- ========== PATIENTS ==========
create sequence if not exists public.patient_file_seq;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  phone text,
  national_id text,
  birth_date date,
  gender text check (gender in ('male', 'female', 'other')),
  occupation text,
  address text,
  marital_status text,
  blood_type text,
  insurance_provider text,
  emergency_contact_name text,
  emergency_contact_phone text,
  file_number integer not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, file_number)
);

create or replace function public.assign_patient_file_number()
returns trigger
language plpgsql
as $$
begin
  if new.file_number is null then
    select coalesce(max(file_number), 0) + 1
      into new.file_number
      from public.patients
     where tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;

create trigger trg_patients_file_number
before insert on public.patients
for each row execute function public.assign_patient_file_number();

create index patients_tenant_name_idx on public.patients (tenant_id, full_name);
create index patients_tenant_phone_idx on public.patients (tenant_id, phone);
create index patients_tenant_national_id_idx on public.patients (tenant_id, national_id);

-- ========== MEDICAL HISTORY ==========
create table public.medical_history (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chronic_diseases text,
  surgeries text,
  allergies text,
  hereditary_diseases text,
  smoking boolean default false,
  alcohol boolean default false,
  pregnancy_status text,
  vaccinations jsonb default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (patient_id)
);

-- ========== VISITS (needed before vital_signs FK) ==========
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.users(id),
  visit_date timestamptz not null default now(),
  chief_complaint text,
  history_of_present_illness text,
  clinical_exam text,
  diagnosis text,
  treatment_plan text,
  notes text,
  follow_up_date date,
  status text not null default 'open'
    check (status in ('open', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- ========== VITAL SIGNS ==========
create table public.vital_signs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete set null,
  blood_pressure text,
  blood_sugar text,
  weight numeric(6, 2),
  height numeric(6, 2),
  temperature numeric(4, 1),
  pulse integer,
  oxygen_saturation numeric(5, 2),
  recorded_at timestamptz not null default now()
);

-- ========== PRESCRIPTIONS ==========
create table public.prescription_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  doctor_id uuid references public.users(id),
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  template_id uuid references public.prescription_templates(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  drug_name text not null,
  dosage text,
  duration text,
  notes text
);

create table public.doctor_favorite_drugs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  doctor_id uuid not null references public.users(id) on delete cascade,
  drug_name text not null,
  dosage text,
  duration text,
  unique (doctor_id, drug_name)
);

-- ========== LAB / RADIOLOGY ==========
create table public.lab_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.radiology_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.request_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null check (type in ('lab', 'radiology')),
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ========== ATTACHMENTS ==========
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete set null,
  file_url text not null,
  file_type text not null check (file_type in ('image', 'pdf', 'lab', 'radiology', 'report')),
  uploaded_at timestamptz not null default now()
);

-- ========== APPOINTMENTS ==========
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.users(id),
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30,
  status text not null default 'waiting'
    check (status in ('waiting', 'with_doctor', 'done', 'no_show', 'cancelled')),
  created_at timestamptz not null default now()
);

create index appointments_tenant_scheduled_idx
  on public.appointments (tenant_id, scheduled_at);

-- ========== INVOICES / CASH ==========
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete set null,
  consultation_fee numeric(12, 2) not null default 0,
  discounts numeric(12, 2) not null default 0,
  services jsonb not null default '[]'::jsonb,
  total numeric(12, 2) not null default 0,
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cash_register_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null check (type in ('revenue', 'expense', 'refund')),
  amount numeric(12, 2) not null,
  description text,
  created_at timestamptz not null default now()
);

-- ========== PERMISSIONS ==========
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  module text not null,
  can_view boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  unique (user_id, module)
);

-- ========== AUDIT LOG ==========
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_tenant_created_idx on public.audit_log (tenant_id, created_at desc);

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
  eid uuid;
  uid uuid;
begin
  tid := coalesce(new.tenant_id, old.tenant_id);
  eid := coalesce(new.id, old.id);
  begin
    uid := auth.uid();
  exception when others then
    uid := null;
  end;

  insert into public.audit_log (tenant_id, user_id, action, entity_type, entity_id, meta)
  values (
    tid,
    uid,
    lower(tg_op),
    tg_table_name,
    eid,
    jsonb_build_object('at', now())
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_patients
after insert or update or delete on public.patients
for each row execute function public.write_audit_log();

create trigger audit_medical_history
after insert or update or delete on public.medical_history
for each row execute function public.write_audit_log();

create trigger audit_visits
after insert or update or delete on public.visits
for each row execute function public.write_audit_log();

create trigger audit_attachments
after insert or update or delete on public.attachments
for each row execute function public.write_audit_log();

-- ========== RLS ==========
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.patients enable row level security;
alter table public.medical_history enable row level security;
alter table public.vital_signs enable row level security;
alter table public.visits enable row level security;
alter table public.prescription_templates enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.doctor_favorite_drugs enable row level security;
alter table public.lab_requests enable row level security;
alter table public.radiology_requests enable row level security;
alter table public.request_templates enable row level security;
alter table public.attachments enable row level security;
alter table public.appointments enable row level security;
alter table public.invoices enable row level security;
alter table public.cash_register_entries enable row level security;
alter table public.permissions enable row level security;
alter table public.audit_log enable row level security;

-- Tenants
create policy tenants_select on public.tenants for select
  using (id = public.current_tenant_id() or public.is_super_admin());
create policy tenants_update on public.tenants for update
  using (id = public.current_tenant_id() or public.is_super_admin());
create policy tenants_insert on public.tenants for insert
  with check (public.is_super_admin() or true);

-- Users
create policy users_select on public.users for select
  using (
    public.is_super_admin()
    or tenant_id = public.current_tenant_id()
    or id = auth.uid()
  );
create policy users_insert on public.users for insert
  with check (
    public.is_super_admin()
    or tenant_id = public.current_tenant_id()
    or id = auth.uid()
  );
create policy users_update on public.users for update
  using (
    public.is_super_admin()
    or tenant_id = public.current_tenant_id()
    or id = auth.uid()
  );

-- Generic tenant isolation helper policies
create policy patients_tenant_all on public.patients for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy medical_history_tenant_all on public.medical_history for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy vital_signs_tenant_all on public.vital_signs for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy visits_tenant_all on public.visits for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy prescription_templates_tenant_all on public.prescription_templates for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy prescriptions_tenant_all on public.prescriptions for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy prescription_items_tenant_all on public.prescription_items for all
  using (
    exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id
        and (p.tenant_id = public.current_tenant_id() or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.prescriptions p
      where p.id = prescription_id
        and (p.tenant_id = public.current_tenant_id() or public.is_super_admin())
    )
  );

create policy doctor_favorite_drugs_tenant_all on public.doctor_favorite_drugs for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy lab_requests_tenant_all on public.lab_requests for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy radiology_requests_tenant_all on public.radiology_requests for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy request_templates_tenant_all on public.request_templates for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy attachments_tenant_all on public.attachments for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy appointments_tenant_all on public.appointments for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy invoices_tenant_all on public.invoices for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy cash_register_entries_tenant_all on public.cash_register_entries for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy permissions_tenant_all on public.permissions for all
  using (tenant_id = public.current_tenant_id() or public.is_super_admin())
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

create policy audit_log_tenant_select on public.audit_log for select
  using (tenant_id = public.current_tenant_id() or public.is_super_admin());
create policy audit_log_tenant_insert on public.audit_log for insert
  with check (tenant_id = public.current_tenant_id() or public.is_super_admin());

-- Storage bucket for attachments (run in dashboard if needed)
-- insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false);

-- ========== ONBOARDING (React + Supabase only, no separate API) ==========
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

revoke all on function public.onboard_clinic from public;
grant execute on function public.onboard_clinic to authenticated;

-- Allow authenticated user to read own profile before/after onboard
create policy users_select_self on public.users for select
  using (id = auth.uid());

-- Tighten tenants insert: only via onboard RPC / super_admin
drop policy if exists tenants_insert on public.tenants;
create policy tenants_insert on public.tenants for insert
  with check (public.is_super_admin());
