-- Enable RLS
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- Table: searches
create table public.searches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id text not null,
  source text not null default 'google_maps',
  query text not null,
  maps_url text,
  city text,
  radius_km numeric null,
  lat numeric null,
  lng numeric null,
  max_results int not null default 20,
  deep_scan boolean not null default false,
  enrich_emails boolean not null default false,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
  result_count int null,
  error_message text null
);

-- Indexes for searches
create index searches_user_id_created_at_idx on public.searches (user_id, created_at desc);
create index searches_status_idx on public.searches (status);
create index searches_city_idx on public.searches (city);
create index searches_query_idx on public.searches (query);

-- Enable RLS on searches
alter table public.searches enable row level security;

-- Policies for searches ('demo-user' only for now)
create policy "Allow all for demo-user on searches"
on public.searches
for all
using (user_id = 'demo-user')
with check (user_id = 'demo-user');


-- Table: prospects
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id text not null,
  search_id uuid not null references public.searches(id) on delete cascade,
  full_name text null,
  company text null,
  domain text null,
  emails jsonb null,
  phones jsonb null,
  address text null,
  city text null,
  source_url text null,
  raw jsonb null
);

-- Indexes for prospects
create index prospects_user_id_created_at_idx on public.prospects (user_id, created_at desc);
create index prospects_search_id_idx on public.prospects (search_id);

-- Enable RLS on prospects
alter table public.prospects enable row level security;

-- Policies for prospects ('demo-user' only for now)
create policy "Allow all for demo-user on prospects"
on public.prospects
for all
using (user_id = 'demo-user')
with check (user_id = 'demo-user');

-- Enable Realtime for these tables
alter publication supabase_realtime add table public.searches;
alter publication supabase_realtime add table public.prospects;
