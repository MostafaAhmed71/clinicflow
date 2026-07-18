-- Enable Realtime for clinic queue / payment sync across doctor & secretary clients
do $$
begin
  alter publication supabase_realtime add table public.appointments;
exception
  when duplicate_object then null;
end $$;
