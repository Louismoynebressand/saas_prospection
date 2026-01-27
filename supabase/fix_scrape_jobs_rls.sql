-- Enable RLS on scrape_jobs if not already enabled
alter table public.scrape_jobs enable row level security;

-- Allow authenticated users to insert their own jobs
drop policy if exists "Users can insert their own scrape jobs" on public.scrape_jobs;
create policy "Users can insert their own scrape jobs"
  on public.scrape_jobs
  for insert
  with check (id_user = auth.uid()::text);

-- Allow authenticated users to view their own jobs
drop policy if exists "Users can view their own scrape jobs" on public.scrape_jobs;
create policy "Users can view their own scrape jobs"
  on public.scrape_jobs
  for select
  using (id_user = auth.uid()::text);

-- Allow authenticated users to update their own jobs (for status changes)
drop policy if exists "Users can update their own scrape jobs" on public.scrape_jobs;
create policy "Users can update their own scrape jobs"
  on public.scrape_jobs
  for update
  using (id_user = auth.uid()::text);

-- Enable realtime for scrape_jobs if not already enabled
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'scrape_jobs'
  ) then
    alter publication supabase_realtime add table public.scrape_jobs;
  end if;
end $$;
