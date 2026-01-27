-- Add estimated_cost column to email_verification_jobs
alter table public.email_verification_jobs 
add column if not exists estimated_cost integer default 0;

-- Ensure check_email columns exist in quotas (idempotent check)
alter table public.quotas 
add column if not exists check_email_limit integer default 20,
add column if not exists check_email_used integer default 0;
