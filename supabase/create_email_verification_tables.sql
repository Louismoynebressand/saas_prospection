-- Create table for grouping verification jobs
create table if not exists public.email_verification_jobs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  id_user uuid references auth.users(id) not null,
  status text default 'pending', -- pending, completed, failed
  total_emails integer default 0
);

-- RLS for jobs
alter table public.email_verification_jobs enable row level security;

create policy "Users can view their own verification jobs"
  on public.email_verification_jobs for select
  using (auth.uid() = id_user);

create policy "Users can insert their own verification jobs"
  on public.email_verification_jobs for insert
  with check (auth.uid() = id_user);

-- Create table for individual email results
create table if not exists public.email_verification_results (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  id_job uuid references public.email_verification_jobs(id) on delete cascade not null,
  id_user uuid references auth.users(id) not null,
  email_checked text not null,
  is_valid boolean,
  status text, -- valid, invalid, unknown, etc.
  details jsonb -- Store full JSON response if needed
);

-- RLS for results
alter table public.email_verification_results enable row level security;

create policy "Users can view their own verification results"
  on public.email_verification_results for select
  using (auth.uid() = id_user);

create policy "Users can insert their own verification results"
  on public.email_verification_results for insert
  with check (auth.uid() = id_user);

-- Add indexes for performance
create index if not exists email_verification_jobs_id_user_idx on public.email_verification_jobs(id_user);
create index if not exists email_verification_results_id_job_idx on public.email_verification_results(id_job);
create index if not exists email_verification_results_id_user_idx on public.email_verification_results(id_user);
