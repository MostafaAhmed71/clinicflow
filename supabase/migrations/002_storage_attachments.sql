-- Attachments storage bucket + policies
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists attachments_storage_select on storage.objects;
create policy attachments_storage_select on storage.objects for select
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

drop policy if exists attachments_storage_insert on storage.objects;
create policy attachments_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

drop policy if exists attachments_storage_delete on storage.objects;
create policy attachments_storage_delete on storage.objects for delete
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );
