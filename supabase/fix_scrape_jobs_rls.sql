-- Enable RLS on scrape_jobs if not already enabled
alter table public.scrape_jobs enable row level security;

-- Allow authenticated users to insert their own jobs
create policy "Users can insert their own scrape jobs"
  on public.scrape_jobs
  for insert
  with check (id_user = auth.uid()::text);

-- Allow authenticated users to view their own jobs
create policy "Users can view their own scrape jobs"
  on public.scrape_jobs
  for select
  using (id_user = auth.uid()::text);

-- Allow authenticated users to update their own jobs (for status changes)
create policy "Users can update their own scrape jobs"
  on public.scrape_jobs
  for update
  using (id_user = auth.uid()::text);

-- Enable realtime for scrape_jobs if not already enabled
alter publication supabase_realtime add table public.scrape_jobs;
