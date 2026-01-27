-- 1. Get the definition of the problematic function
select pg_get_functiondef('public.handle_new_prospect_quota'::regproc);

-- 2. Inspect the columns of the 'quotas' table (assuming that's the one being updated)
select column_name, data_type 
from information_schema.columns 
where table_schema = 'public' 
and table_name = 'quotas';
