-- Add unique constraints to allow upsert logic to work based on user_id

-- 1. For subscriptions table
alter table public.subscriptions add constraint subscriptions_user_id_key unique (user_id);

-- 2. For quotas table
alter table public.quotas add constraint quotas_user_id_key unique (user_id);
