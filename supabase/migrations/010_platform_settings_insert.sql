-- Ensure default row exists (seed may have been skipped if migration ran without privileges)
insert into public.platform_settings (id, default_trial_days)
values (1, 14)
on conflict (id) do nothing;

-- Upsert from the client needs INSERT; previously only SELECT + UPDATE existed
drop policy if exists platform_settings_insert on public.platform_settings;
create policy platform_settings_insert on public.platform_settings for insert
  with check (public.is_super_admin());

drop policy if exists platform_settings_update on public.platform_settings;
create policy platform_settings_update on public.platform_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());
