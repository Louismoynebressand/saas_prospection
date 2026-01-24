-- 1. Ensure public.profiles exists
create table if not exists public.profiles (
  id uuid not null references auth.users(id) on delete cascade primary key,
  first_name text,
  last_name text,
  company_name text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Enable RLS on profiles
alter table public.profiles enable row level security;

-- 3. Create policies for profiles
create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- 4. Create proper User Management Trigger Function (SECURITY DEFINER is critical!)
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public -- Secure the search path
language plpgsql
as $$
begin
  insert into public.profiles (id, first_name, last_name, company_name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'company_name',
    new.email
  );

  -- Optional: Create default subscription if table exists
  -- insert into public.subscriptions (user_id, status, plan) values (new.id, 'active', 'starter');
  
  -- Optional: Create default quotas if table exists
  -- insert into public.quotas (user_id) values (new.id);

  return new;
end;
$$;

-- 5. Drop existing trigger if it exists to avoid conflicts
drop trigger if exists on_auth_user_created on auth.users;

-- 6. Create the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Grant permissions
grant usage on schema public to anon, authenticated;
grant all on public.profiles to anon, authenticated;
grant all on public.profiles to service_role;
