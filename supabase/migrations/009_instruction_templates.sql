-- Patient instruction templates for discharge / exit slips
create table if not exists public.instruction_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists instruction_templates_tenant_idx
  on public.instruction_templates (tenant_id);

alter table public.instruction_templates enable row level security;

drop policy if exists instruction_templates_tenant_all on public.instruction_templates;
create policy instruction_templates_tenant_all on public.instruction_templates for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
