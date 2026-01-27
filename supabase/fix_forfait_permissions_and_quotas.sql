-- 1. Fix Permissions for 'forfait' table
-- Enable RLS (if not already)
alter table public.forfait enable row level security;

-- Allow read access for authenticated users (required for the onboarding API)
create policy "Allow read access for authenticated users"
  on public.forfait for select
  to authenticated
  using (true);

-- 2. Update 'quotas' table to match 'forfait' columns
-- Add columns for 'check_email' if they don't exist
alter table public.quotas add column if not exists check_email_limit int not null default 20;
alter table public.quotas add column if not exists check_email_used int not null default 0;

-- Optional: Ensure RLS is active on quotas (should be already)
alter table public.quotas enable row level security;
