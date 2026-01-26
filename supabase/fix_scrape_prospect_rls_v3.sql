-- =============================================================================
-- FIX scrape_prospect RLS using helper function (ROBUST VERSION)
-- =============================================================================

-- Step 1: Create a helper function to check if user owns a job
-- This avoids all type casting issues in policies
create or replace function public.user_owns_job(p_job_id bigint)
returns boolean
language plpgsql
security definer
stable
as $$
begin
  return exists (
    select 1 from public.scrape_jobs 
    where id_jobs = p_job_id 
    and id_user = auth.uid()::text
  );
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
