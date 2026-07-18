-- Platform ops: suspend clinics, subscription invoices, trial alert tracking
alter table public.tenants
  add column if not exists is_suspended boolean not null default false;

alter table public.tenants
  add column if not exists suspend_message text;

alter table public.tenants
  add column if not exists subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'past_due', 'cancelled'));

alter table public.tenants
  add column if not exists trial_alert_sent_at timestamptz;

comment on column public.tenants.is_suspended is 'When true, clinic users cannot use the app';
comment on column public.tenants.suspend_message is 'Message shown on login when suspended';
comment on column public.tenants.subscription_status is 'Commercial status independent of plan tier';
comment on column public.tenants.trial_alert_sent_at is 'Last time a trial-ending alert was recorded';

-- Backfill subscription_status from trial dates
update public.tenants
set subscription_status = case
  when trial_ends_at is null then 'active'
  when trial_ends_at >= now() then 'trial'
  else 'past_due'
end
where subscription_status = 'trial';

create table if not exists public.platform_subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan text not null check (plan in ('starter', 'professional', 'enterprise')),
  amount_egp numeric(12, 2) not null check (amount_egp >= 0),
  period_start date not null,
  period_end date not null,
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'paid', 'failed', 'cancelled')),
  payment_provider text not null default 'manual'
    check (payment_provider in ('manual', 'paymob', 'fawry')),
  provider_reference text,
  paid_at timestamptz,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists platform_sub_invoices_tenant_idx
  on public.platform_subscription_invoices (tenant_id, created_at desc);

create index if not exists platform_sub_invoices_status_idx
  on public.platform_subscription_invoices (status);

alter table public.platform_subscription_invoices enable row level security;

drop policy if exists platform_sub_invoices_sa_all on public.platform_subscription_invoices;
create policy platform_sub_invoices_sa_all on public.platform_subscription_invoices for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Clinic can read its own invoices (receipts) later
drop policy if exists platform_sub_invoices_tenant_select on public.platform_subscription_invoices;
create policy platform_sub_invoices_tenant_select on public.platform_subscription_invoices for select
  using (tenant_id = public.current_tenant_id() or public.is_super_admin());
