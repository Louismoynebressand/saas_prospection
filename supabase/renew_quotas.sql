-- Function to renew quotas
create or replace function public.renew_monthly_quotas()
returns void
language plpgsql
security definer
as $$
declare
  sub record;
  limits jsonb;
begin
  -- Loop through active subscriptions strictly
  for sub in select * from public.subscriptions where status = 'active'
  loop
    -- Determine limits based on plan
    if sub.plan = 'starter' then
      limits := '{"scraps": 100, "deep_search": 50, "emails": 50}';
    elsif sub.plan = 'pro' then
      limits := '{"scraps": 500, "deep_search": 200, "emails": 200}';
    elsif sub.plan = 'enterprise' then
      limits := '{"scraps": 999999, "deep_search": 1000, "emails": 1000}';
    else
      limits := '{"scraps": 10, "deep_search": 0, "emails": 0}'; -- Fallback/Free?
    end if;

    -- Update or Insert Quotas
    -- Logic: If renewal date is past, reset quotas and set next renewal date
    -- Note: Ideally checking 'reset_date' < now()
    
    update public.quotas
    set 
      scraps_limit = (limits->>'scraps')::int,
      scraps_used = 0,
      deep_search_limit = (limits->>'deep_search')::int,
      deep_search_used = 0,
      emails_limit = (limits->>'emails')::int,
      emails_used = 0,
      reset_date = now() + interval '1 month',
      updated_at = now()
    where user_id = sub.user_id 
    and (reset_date < now() or reset_date is null);
    
  end loop;
end;
$$;
