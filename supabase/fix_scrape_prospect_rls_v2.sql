-- =============================================================================
-- FIX scrape_prospect RLS policies (SIMPLIFIED VERSION)
-- =============================================================================
-- This version only uses id_jobs relationship to avoid type casting issues

-- Enable RLS on scrape_prospect if not already enabled
alter table public.scrape_prospect enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Users can view their own prospects" on public.scrape_prospect;
drop policy if exists "Users can insert their own prospects" on public.scrape_prospect;
drop policy if exists "Users can update their own prospects" on public.scrape_prospect;
drop policy if exists "Users can delete their own prospects" on public.scrape_prospect;

-- =============================================================================
-- SELECT Policy: Users can view prospects from their own jobs
-- =============================================================================
create policy "Users can view their own prospects"
on public.scrape_prospect
for select
using (
    id_jobs in (
        select id_jobs from public.scrape_jobs
        where id_user = auth.uid()::text
    )
);

-- =============================================================================
-- INSERT Policy: Allow inserting prospects for user's jobs
-- =============================================================================
create policy "Users can insert their own prospects"
on public.scrape_prospect
for insert
with check (
    id_jobs in (
        select id_jobs from public.scrape_jobs
        where id_user = auth.uid()::text
    )
);

-- =============================================================================
-- UPDATE Policy: Users can update prospects from their jobs
-- =============================================================================
create policy "Users can update their own prospects"
on public.scrape_prospect
for update
using (
    id_jobs in (
        select id_jobs from public.scrape_jobs
        where id_user = auth.uid()::text
    )
);

-- =============================================================================
-- DELETE Policy: Users can delete prospects from their jobs
-- =============================================================================
create policy "Users can delete their own prospects"
on public.scrape_prospect
for delete
using (
    id_jobs in (
        select id_jobs from public.scrape_jobs
        where id_user = auth.uid()::text
    )
);

-- Verify RLS is enabled
select tablename, rowsecurity from pg_tables where tablename = 'scrape_prospect';

-- Verify policies were created
select schemaname, tablename, policyname, cmd 
from pg_policies 
where schemaname = 'public' 
and tablename = 'scrape_prospect';
