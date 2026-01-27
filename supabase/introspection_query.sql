-- 1. Colonnes table public.scrape_prospect
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='scrape_prospect'
order by ordinal_position;

-- 2. Colonnes table public.quotas
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='quotas'
order by ordinal_position;

-- 3. Triggers sur public.scrape_prospect
select t.tgname, t.tgfoid::regprocedure as trigger_function, pg_get_triggerdef(t.oid) as trigger_def
from pg_trigger t
where t.tgrelid = 'public.scrape_prospect'::regclass and not t.tgisinternal;
