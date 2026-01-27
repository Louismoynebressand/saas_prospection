-- 1. Ensure public.profiles exists with proper constraints
create table if not exists public.profiles (
  id uuid not null references auth.users(id) on delete cascade primary key,
  first_name text,
  last_name text,
  company_name text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Enable RLS on profiles (idempotent)
alter table public.profiles enable row level security;

-- 3. Create policies for profiles (drop detailed policies first to avoid duplicates)
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- 4. Create robust User Management Trigger Function
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, first_name, last_name, company_name, email)
  values (
    new.id,
    -- Handle potential nulls with COALESCE or safe access
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'company_name', ''),
    new.email
  );
  return new;
exception
  when others then
    -- Log error but don't block signup if possible, or raise a cleaner error
    -- For debugging, it's better to raise so we see it in Supabase logs
    raise warning 'Error in handle_new_user: %', SQLERRM;
    return new;
end;
$$;

-- 5. Drop existing trigger to ensure clean state
drop trigger if exists on_auth_user_created on auth.users;

-- 6. Re-create the trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Grant permissions (Crucial for the trigger to work)
grant usage on schema public to anon, authenticated;
grant all on public.profiles to anon, authenticated;
grant all on public.profiles to service_role;
