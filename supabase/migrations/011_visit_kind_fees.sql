-- Visit kind pricing: new consultation vs follow-up (إعادة كشف)
alter table public.tenants
  add column if not exists follow_up_fee numeric(12, 2) default 0;

comment on column public.tenants.follow_up_fee is 'Fee for follow-up / re-visit (إعادة كشف)';

-- Snapshot on each appointment so price stays correct if clinic fees change later
alter table public.appointments
  add column if not exists visit_kind text not null default 'new_visit'
    check (visit_kind in ('new_visit', 'follow_up'));

alter table public.appointments
  add column if not exists fee_amount numeric(12, 2) not null default 0;

comment on column public.appointments.visit_kind is 'new_visit = كشف, follow_up = إعادة كشف';
comment on column public.appointments.fee_amount is 'Fee charged for this appointment (EGP)';

-- Seed follow_up_fee as half of consultation when still zero
update public.tenants
set follow_up_fee = round(coalesce(consultation_fee, 0) / 2, 2)
where coalesce(follow_up_fee, 0) = 0
  and coalesce(consultation_fee, 0) > 0;
