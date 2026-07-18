-- Payment status on appointments (secretary marks paid after doctor finishes)
alter table public.appointments
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'waived'));

alter table public.appointments
  add column if not exists visit_id uuid references public.visits(id) on delete set null;

create index if not exists appointments_tenant_payment_idx
  on public.appointments (tenant_id, payment_status, status);
