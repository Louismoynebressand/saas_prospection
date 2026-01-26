-- Optional: Add debug_id column for troubleshooting
-- This is optional but recommended for better error tracking

alter table public.scrape_jobs 
add column if not exists debug_id uuid;

-- Create index for fast lookups by debug_id
create index if not exists scrape_jobs_debug_id_idx 
on public.scrape_jobs(debug_id);

-- Add comment for documentation
comment on column public.scrape_jobs.debug_id is 'UUID for debugging and log correlation';
