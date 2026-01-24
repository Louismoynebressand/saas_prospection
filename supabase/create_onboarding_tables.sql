-- Create subscriptions table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan text not null check (plan in ('starter', 'pro', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'cancelled', 'past_due', 'trialing')),
  start_date timestamptz default now(),
  end_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on subscriptions
alter table public.subscriptions enable row level security;

-- Policies for subscriptions
create policy "Users can view their own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Create quotas table
create table if not exists public.quotas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  scraps_limit int not null default 100,
  scraps_used int not null default 0,
  deep_search_limit int not null default 50,
  deep_search_used int not null default 0,
  emails_limit int not null default 50,
  emails_used int not null default 0,
  reset_date timestamptz default (now() + interval '1 month'),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on quotas
alter table public.quotas enable row level security;

-- Policies for quotas
create policy "Users can view their own quotas" on public.quotas
  for select using (auth.uid() = user_id);
