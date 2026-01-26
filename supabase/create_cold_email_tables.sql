-- 1. Table des Campagnes
create table if not exists public.cold_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  nom_campagne text not null,
  is_active boolean default true,
  is_default boolean default false,
  
  -- Info Client
  nom_entreprise_client text,
  site_web_client text,
  phrase_positionnement_client text,
  offre_principale_client text,
  promesse_principale text,
  benefices_secondaires jsonb default '[]'::jsonb,
  service_a_vendre text,
  
  -- Ciblage & Ton
  type_de_prospect_vise text,
  ton_souhaite text,
  vouvoiement boolean default true,
  themes_de_douleurs_autorises jsonb default '[]'::jsonb,
  mots_interdits jsonb default '[]'::jsonb,
  chiffres_autorises jsonb default '[]'::jsonb,
  
  -- Contraintes techniques
  contraintes jsonb default '{"sans_signature": true, "sans_liens": true, "min_mots": 180, "max_mots": 220}'::jsonb,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Table des Jobs
create table if not exists public.cold_email_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  campaign_id uuid not null references public.cold_email_campaigns(id) on delete cascade,
  status text not null default 'queued', -- 'queued', 'running', 'completed', 'failed'
  prospect_ids jsonb not null default '[]'::jsonb, 
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- 3. Table des Générations
create table if not exists public.cold_email_generations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.cold_email_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  campaign_id uuid not null references public.cold_email_campaigns(id) on delete cascade,
  prospect_id text not null, -- ID venant de scrape_prospect (parfois int8, parfois uuid string, donc text pour sécurité)
  
  subject text,
  message text not null,
  model_meta jsonb default '{}'::jsonb,
  
  created_at timestamptz default now()
);

-- 4. Mise à jour Quotas
alter table public.quotas 
add column if not exists cold_emails_limit int default 50,
add column if not exists cold_emails_used int default 0;

-- 5. Sécurité RLS
alter table public.cold_email_campaigns enable row level security;
alter table public.cold_email_jobs enable row level security;
alter table public.cold_email_generations enable row level security;

-- Suppression des politiques si elles existent déjà pour éviter les erreurs
drop policy if exists "Users manage their own campaigns" on public.cold_email_campaigns;
create policy "Users manage their own campaigns" on public.cold_email_campaigns
  for all using (auth.uid() = user_id);

drop policy if exists "Users manage their own jobs" on public.cold_email_jobs;
create policy "Users manage their own jobs" on public.cold_email_jobs
  for all using (auth.uid() = user_id);

drop policy if exists "Users view their own generations" on public.cold_email_generations;
create policy "Users view their own generations" on public.cold_email_generations
  for all using (auth.uid() = user_id);

-- 6. Indexes
create index if not exists idx_campaigns_user on public.cold_email_campaigns(user_id);
create index if not exists idx_jobs_user_status on public.cold_email_jobs(user_id, status);
create index if not exists idx_generations_job on public.cold_email_generations(job_id);
create index if not exists idx_generations_prospect on public.cold_email_generations(prospect_id);

-- 7. Realtime
-- On vérifie d'abord si la table est déjà dans la publication pour éviter l'erreur
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'cold_email_jobs'
  ) then
    alter publication supabase_realtime add table public.cold_email_jobs;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'cold_email_generations'
  ) then
    alter publication supabase_realtime add table public.cold_email_generations;
  end if;
end $$;
