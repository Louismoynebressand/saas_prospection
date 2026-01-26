-- =============================================================================
-- FIX scrape_prospect RLS using helper function (FINAL VERSION)
-- =============================================================================
-- This version handles the TYPE MISMATCH:
-- - scrape_prospect.id_jobs is TEXT
-- - scrape_jobs.id_jobs is INT
-- - scrape_jobs.id_user is TEXT

-- Step 1: Create a helper function with correct types
create or replace function public.user_owns_job(p_job_id text)
returns boolean
language plpgsql
security definer
stable
as $$
begin
  -- Cast text to int for comparison with scrape_jobs.id_jobs
  return exists (
    select 1 from public.scrape_jobs 
    where id_jobs = p_job_id::int
    and id_user = auth.uid()::text
  );
exception
  when others then
    -- If cast fails, return false
    return false;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.user_owns_job to authenticated;

-- Step 2: Enable RLS on scrape_prospect
alter table public.scrape_prospect enable row level security;

-- Step 3: Drop existing policies
drop policy if exists "Users can view their own prospects" on public.scrape_prospect;
drop policy if exists "Users can insert their own prospects" on public.scrape_prospect;
drop policy if exists "Users can update their own prospects" on public.scrape_prospect;
drop policy if exists "Users can delete their own prospects" on public.scrape_prospect;

-- Step 4: Create simple policies using the helper function
create policy "Users can view their own prospects"
on public.scrape_prospect
for select
using (user_owns_job(id_jobs));

create policy "Users can insert their own prospects"
on public.scrape_prospect
for insert
with check (user_owns_job(id_jobs));

create policy "Users can update their own prospects"
on public.scrape_prospect
for update
using (user_owns_job(id_jobs));

create policy "Users can delete their own prospects"
on public.scrape_prospect
for delete
using (user_owns_job(id_jobs));

-- Step 5: Verify everything
select tablename, rowsecurity from pg_tables where tablename = 'scrape_prospect';

select schemaname, tablename, policyname, cmd 
from pg_policies 
where schemaname = 'public' 
and tablename = 'scrape_prospect';
