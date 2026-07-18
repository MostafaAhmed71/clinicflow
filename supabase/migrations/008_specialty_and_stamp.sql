-- Clinic differentiators: specialty pack + prescription stamp/signature
alter table public.tenants
  add column if not exists specialty text not null default 'general';

alter table public.tenants
  add column if not exists stamp_url text;

alter table public.tenants
  add column if not exists doctor_signature_url text;

comment on column public.tenants.specialty is 'Clinic specialty pack: general, pediatrics, dermatology, ...';
comment on column public.tenants.stamp_url is 'Clinic stamp image for printed Rx';
comment on column public.tenants.doctor_signature_url is 'Doctor signature image for printed Rx';
