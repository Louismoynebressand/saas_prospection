-- Function to decrement quota safely
create or replace function public.decrement_quota(
    p_user_id uuid,
    p_quota_type text
)
returns void
language plpgsql
security definer
as $$
begin
    if p_quota_type = 'scraps' then
        update public.quotas
        set scraps_used = scraps_used + 1,
            updated_at = now()
        where user_id = p_user_id;
    elsif p_quota_type = 'deep_search' then
        update public.quotas
        set deep_search_used = deep_search_used + 1,
            updated_at = now()
        where user_id = p_user_id;
    elsif p_quota_type = 'emails' then
        update public.quotas
        set emails_used = emails_used + 1,
            updated_at = now()
        where user_id = p_user_id;
    end if;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.decrement_quota to authenticated;

-- Function to check if user has quota available
create or replace function public.check_quota(
    p_user_id uuid,
    p_quota_type text
)
returns boolean
language plpgsql
security definer
as $$
declare
    v_used int;
    v_limit int;
begin
    if p_quota_type = 'scraps' then
        select scraps_used, scraps_limit into v_used, v_limit
        from public.quotas
        where user_id = p_user_id;
    elsif p_quota_type = 'deep_search' then
        select deep_search_used, deep_search_limit into v_used, v_limit
        from public.quotas
        where user_id = p_user_id;
    elsif p_quota_type = 'emails' then
        select emails_used, emails_limit into v_used, v_limit
        from public.quotas
        where user_id = p_user_id;
    else
        return false;
    end if;
    
    return v_used < v_limit;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.check_quota to authenticated;
