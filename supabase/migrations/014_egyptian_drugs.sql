-- Egyptian drug catalog (from karem505/egyptian-drug-database, CC0)
-- Source: https://github.com/karem505/egyptian-drug-database

create extension if not exists pg_trgm;

create table if not exists public.egyptian_drugs (
  id bigserial primary key,
  commercial_name_en text not null,
  commercial_name_ar text,
  scientific_name text,
  manufacturer text,
  drug_class text,
  route text,
  price_egp numeric(12, 2),
  search_text text generated always as (
    lower(
      coalesce(commercial_name_en, '') || ' ' ||
      coalesce(commercial_name_ar, '') || ' ' ||
      coalesce(scientific_name, '') || ' ' ||
      coalesce(manufacturer, '')
    )
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists egyptian_drugs_search_trgm_idx
  on public.egyptian_drugs using gin (search_text gin_trgm_ops);

create index if not exists egyptian_drugs_name_en_idx
  on public.egyptian_drugs (lower(commercial_name_en));

create index if not exists egyptian_drugs_name_ar_idx
  on public.egyptian_drugs (commercial_name_ar);

create index if not exists egyptian_drugs_scientific_idx
  on public.egyptian_drugs (lower(scientific_name));

comment on table public.egyptian_drugs is
  'Egyptian medicines catalog (CC0) — trade names AR/EN, composition, manufacturer, class, route, EGP price';

alter table public.egyptian_drugs enable row level security;

drop policy if exists egyptian_drugs_select on public.egyptian_drugs;
create policy egyptian_drugs_select on public.egyptian_drugs
  for select to authenticated
  using (true);

-- Fast prefix/substring search helper for autocomplete
create or replace function public.search_egyptian_drugs(q text, lim int default 20)
returns setof public.egyptian_drugs
language sql
stable
security invoker
as $$
  select *
  from public.egyptian_drugs
  where
    q is not null
    and length(trim(q)) >= 2
    and (
      search_text like '%' || lower(trim(q)) || '%'
      or commercial_name_ar ilike '%' || trim(q) || '%'
    )
  order by
    case
      when lower(commercial_name_en) like lower(trim(q)) || '%' then 0
      when commercial_name_ar like trim(q) || '%' then 1
      when lower(scientific_name) like lower(trim(q)) || '%' then 2
      else 3
    end,
    commercial_name_en
  limit greatest(1, least(coalesce(lim, 20), 50));
$$;

grant execute on function public.search_egyptian_drugs(text, int) to authenticated;
