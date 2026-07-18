-- Platform medical exams catalog (shared reference data, not tenant-scoped)
-- Specialty + structured exam metadata for labs / imaging / procedures

create table if not exists public.medical_exam_specialties (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  sort_order int not null default 0
);

create table if not exists public.medical_exams (
  id uuid primary key default gen_random_uuid(),
  specialty_id text not null references public.medical_exam_specialties(id) on delete cascade,
  exam_kind text not null
    check (exam_kind in (
      'lab', 'imaging', 'endoscopy', 'functional', 'biopsy', 'cardiac', 'procedure'
    )),
  category text not null
    check (category in ('lab', 'radiology', 'functional', 'pathology')),
  name_ar text not null,
  name_en text not null,
  code text,
  requires_fasting boolean not null default false,
  result_tat_hours int,
  doctor_notes text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (specialty_id, name_en)
);

create index if not exists medical_exams_specialty_idx
  on public.medical_exams (specialty_id, category, sort_order);

create index if not exists medical_exams_code_idx
  on public.medical_exams (code)
  where code is not null;

create index if not exists medical_exams_name_en_idx
  on public.medical_exams (lower(name_en));

comment on table public.medical_exam_specialties is 'Medical specialties for exam catalog grouping';
comment on table public.medical_exams is 'Structured exam catalog: labs, imaging, endoscopy, functional tests, biopsies';
comment on column public.medical_exams.exam_kind is 'lab | imaging | endoscopy | functional | biopsy | cardiac | procedure';
comment on column public.medical_exams.category is 'lab | radiology | functional | pathology — UI grouping';
comment on column public.medical_exams.code is 'LOINC or internal ClinicFlow code (CF-*)';
comment on column public.medical_exams.result_tat_hours is 'Expected turnaround time in hours';

alter table public.medical_exam_specialties enable row level security;
alter table public.medical_exams enable row level security;

-- Readable by any authenticated clinic user; mutations via service role / migrations only
drop policy if exists medical_exam_specialties_select on public.medical_exam_specialties;
create policy medical_exam_specialties_select on public.medical_exam_specialties
  for select to authenticated
  using (true);

drop policy if exists medical_exams_select on public.medical_exams;
create policy medical_exams_select on public.medical_exams
  for select to authenticated
  using (is_active = true);

-- Optional link: store selected exam ids on lab/radiology requests (keep items jsonb for free text)
alter table public.lab_requests
  add column if not exists exam_ids uuid[] not null default '{}';

alter table public.radiology_requests
  add column if not exists exam_ids uuid[] not null default '{}';
