-- =================================================================
-- SCHÉMA COMPLET DE LA BASE DE DONNÉES SUPABASE
-- =================================================================
-- Generated: 2026-01-26
-- Description: Schéma complet incluant toutes les tables, indexes, 
--              politiques RLS, et fonctions du système de prospection
-- =================================================================

-- -----------------------------------------------------------------
-- TABLES CORE (Authentification & Profils)
-- -----------------------------------------------------------------

-- Table: profiles (liens avec auth.users de Supabase)
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz default now(),
    email text,
    full_name text,
    avatar_url text,
    onboarding_completed boolean default false,
    company_name text,
    company_size text,
    role text
);

-- Enable RLS sur profiles
alter table public.profiles enable row level security;

-- Policies pour profiles
create policy "Users can view their own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = id);


-- -----------------------------------------------------------------
-- TABLES SUBSCRIPTION & QUOTAS
-- -----------------------------------------------------------------

-- Table: subscriptions
create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    plan_name text not null check (plan_name in ('starter', 'pro', 'enterprise')),
    status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
    started_at timestamptz default now(),
    expires_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Enable RLS sur subscriptions
alter table public.subscriptions enable row level security;

-- Policies pour subscriptions
create policy "Users can view their own subscription"
on public.subscriptions for select
using (auth.uid() = user_id);

create policy "Users can insert their own subscription"
on public.subscriptions for insert
with check (auth.uid() = user_id);

create policy "Users can update their own subscription"
on public.subscriptions for update
using (auth.uid() = user_id);


-- Table: quotas
create table if not exists public.quotas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    searches_made int not null default 0,
    searches_limit int not null default 10,
    prospects_scraped int not null default 0,
    prospects_limit int not null default 100,
    emails_verified int not null default 0,
    emails_verified_limit int not null default 50,
    cold_emails_generated int not null default 0,
    cold_emails_limit int not null default 50,
    reset_at timestamptz default (now() + interval '30 days'),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(user_id)
);

-- Enable RLS sur quotas
alter table public.quotas enable row level security;

-- Policies pour quotas
create policy "Users can view their own quotas"
on public.quotas for select
using (auth.uid() = user_id);

create policy "Users can insert their own quotas"
on public.quotas for insert
with check (auth.uid() = user_id);

create policy "Users can update their own quotas"
on public.quotas for update
using (auth.uid() = user_id);


-- -----------------------------------------------------------------
-- TABLES SEARCHES & PROSPECTS
-- -----------------------------------------------------------------

-- Table: scrape_jobs
create table if not exists public.scrape_jobs (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    user_id uuid not null,
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
    error_message text null,
    debug_id uuid null
);

-- Indexes pour scrape_jobs
create index if not exists scrape_jobs_user_id_created_at_idx on public.scrape_jobs (user_id, created_at desc);
create index if not exists scrape_jobs_status_idx on public.scrape_jobs (status);
create index if not exists scrape_jobs_city_idx on public.scrape_jobs (city);
create index if not exists scrape_jobs_query_idx on public.scrape_jobs (query);

-- Enable RLS sur scrape_jobs
alter table public.scrape_jobs enable row level security;

-- Policies pour scrape_jobs
create policy "Users can view their own scrape_jobs"
on public.scrape_jobs for select
using (auth.uid() = user_id);

create policy "Users can insert their own scrape_jobs"
on public.scrape_jobs for insert
with check (auth.uid() = user_id);

create policy "Users can update their own scrape_jobs"
on public.scrape_jobs for update
using (auth.uid() = user_id);

create policy "Users can delete their own scrape_jobs"
on public.scrape_jobs for delete
using (auth.uid() = user_id);


-- Table: scrape_prospect
create table if not exists public.scrape_prospect (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    user_id uuid not null,
    owner_own_id text,
    job_id uuid references public.scrape_jobs(id) on delete cascade,
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

-- Indexes pour scrape_prospect
create index if not exists scrape_prospect_user_id_created_at_idx on public.scrape_prospect (user_id, created_at desc);
create index if not exists scrape_prospect_job_id_idx on public.scrape_prospect (job_id);
create index if not exists scrape_prospect_owner_own_id_idx on public.scrape_prospect (owner_own_id);

-- Enable RLS sur scrape_prospect
alter table public.scrape_prospect enable row level security;

-- Policies pour scrape_prospect
create policy "Users can view their own prospects"
on public.scrape_prospect for select
using (auth.uid() = user_id);

create policy "Users can insert their own prospects"
on public.scrape_prospect for insert
with check (auth.uid() = user_id);

create policy "Users can update their own prospects"
on public.scrape_prospect for update
using (auth.uid() = user_id);

create policy "Users can delete their own prospects"
on public.scrape_prospect for delete
using (auth.uid() = user_id);


-- -----------------------------------------------------------------
-- TABLES EMAIL VERIFICATION
-- -----------------------------------------------------------------

-- Table: email_verification_jobs
create table if not exists public.email_verification_jobs (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    user_id uuid not null,
    status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
    total_emails int not null default 0,
    processed_emails int not null default 0,
    error_message text null,
    updated_at timestamptz default now()
);

-- Indexes pour email_verification_jobs
create index if not exists email_verification_jobs_user_id_idx on public.email_verification_jobs (user_id);
create index if not exists email_verification_jobs_status_idx on public.email_verification_jobs (status);

-- Enable RLS sur email_verification_jobs
alter table public.email_verification_jobs enable row level security;

-- Policies pour email_verification_jobs
create policy "Users can view their own verification jobs"
on public.email_verification_jobs for select
using (auth.uid() = user_id);

create policy "Users can insert their own verification jobs"
on public.email_verification_jobs for insert
with check (auth.uid() = user_id);

create policy "Users can update their own verification jobs"
on public.email_verification_jobs for update
using (auth.uid() = user_id);

create policy "Users can delete their own verification jobs"
on public.email_verification_jobs for delete
using (auth.uid() = user_id);


-- Table: email_verification_results
create table if not exists public.email_verification_results (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    job_id uuid not null references public.email_verification_jobs(id) on delete cascade,
    user_id uuid not null,
    email text not null,
    status text not null check (status in ('valid', 'invalid', 'unknown', 'risky')),
    score numeric,
    reason text,
    is_disposable boolean,
    is_free_provider boolean,
    raw_response jsonb
);

-- Indexes pour email_verification_results
create index if not exists email_verification_results_job_id_idx on public.email_verification_results (job_id);
create index if not exists email_verification_results_user_id_idx on public.email_verification_results (user_id);
create index if not exists email_verification_results_email_idx on public.email_verification_results (email);

-- Enable RLS sur email_verification_results
alter table public.email_verification_results enable row level security;

-- Policies pour email_verification_results
create policy "Users can view their own verification results"
on public.email_verification_results for select
using (auth.uid() = user_id);

create policy "Users can insert their own verification results"
on public.email_verification_results for insert
with check (auth.uid() = user_id);

create policy "Users can update their own verification results"
on public.email_verification_results for update
using (auth.uid() = user_id);

create policy "Users can delete their own verification results"
on public.email_verification_results for delete
using (auth.uid() = user_id);


-- -----------------------------------------------------------------
-- TABLES COLD EMAIL CAMPAIGNS
-- -----------------------------------------------------------------

-- Table: cold_email_campaigns
create table if not exists public.cold_email_campaigns (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    user_id uuid not null,
    name text not null,
    description text,
    target_audience text,
    tone text default 'professional' check (tone in ('professional', 'casual', 'friendly', 'formal')),
    language text default 'fr' check (language in ('fr', 'en')),
    status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
    total_emails int default 0,
    sent_emails int default 0,
    opened_emails int default 0,
    clicked_emails int default 0,
    replied_emails int default 0,
    updated_at timestamptz default now()
);

-- Indexes pour cold_email_campaigns
create index if not exists cold_email_campaigns_user_id_idx on public.cold_email_campaigns (user_id);
create index if not exists cold_email_campaigns_status_idx on public.cold_email_campaigns (status);

-- Enable RLS sur cold_email_campaigns
alter table public.cold_email_campaigns enable row level security;

-- Policies pour cold_email_campaigns
create policy "Users can view their own campaigns"
on public.cold_email_campaigns for select
using (auth.uid() = user_id);

create policy "Users can insert their own campaigns"
on public.cold_email_campaigns for insert
with check (auth.uid() = user_id);

create policy "Users can update their own campaigns"
on public.cold_email_campaigns for update
using (auth.uid() = user_id);

create policy "Users can delete their own campaigns"
on public.cold_email_campaigns for delete
using (auth.uid() = user_id);


-- Table: cold_email_jobs
create table if not exists public.cold_email_jobs (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    campaign_id uuid not null references public.cold_email_campaigns(id) on delete cascade,
    user_id uuid not null,
    status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
    total_to_generate int not null default 0,
    generated_count int not null default 0,
    error_message text null,
    updated_at timestamptz default now()
);

-- Enable RLS sur cold_email_jobs
alter table public.cold_email_jobs enable row level security;

-- Policies pour cold_email_jobs
create policy "Users can view their own cold email jobs"
on public.cold_email_jobs for select
using (auth.uid() = user_id);

create policy "Users can insert their own cold email jobs"
on public.cold_email_jobs for insert
with check (auth.uid() = user_id);

create policy "Users can update their own cold email jobs"
on public.cold_email_jobs for update
using (auth.uid() = user_id);

create policy "Users can delete their own cold email jobs"
on public.cold_email_jobs for delete
using (auth.uid() = user_id);


-- Table: cold_email_generations
create table if not exists public.cold_email_generations (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    job_id uuid not null references public.cold_email_jobs(id) on delete cascade,
    campaign_id uuid not null references public.cold_email_campaigns(id) on delete cascade,
    user_id uuid not null,
    prospect_id uuid references public.scrape_prospect(id) on delete set null,
    recipient_email text not null,
    recipient_name text,
    subject text not null,
    body_html text not null,
    body_text text not null,
    personalization_data jsonb,
    status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'failed', 'bounced')),
    scheduled_at timestamptz,
    sent_at timestamptz,
    opened_at timestamptz,
    clicked_at timestamptz,
    replied_at timestamptz,
    error_message text
);

-- Indexes pour cold_email_generations
create index if not exists cold_email_generations_job_id_idx on public.cold_email_generations (job_id);
create index if not exists cold_email_generations_campaign_id_idx on public.cold_email_generations (campaign_id);
create index if not exists cold_email_generations_user_id_idx on public.cold_email_generations (user_id);
create index if not exists cold_email_generations_prospect_id_idx on public.cold_email_generations (prospect_id);

-- Enable RLS sur cold_email_generations
alter table public.cold_email_generations enable row level security;

-- Policies pour cold_email_generations
create policy "Users can view their own email generations"
on public.cold_email_generations for select
using (auth.uid() = user_id);

create policy "Users can insert their own email generations"
on public.cold_email_generations for insert
with check (auth.uid() = user_id);

create policy "Users can update their own email generations"
on public.cold_email_generations for update
using (auth.uid() = user_id);

create policy "Users can delete their own email generations"
on public.cold_email_generations for delete
using (auth.uid() = user_id);


-- -----------------------------------------------------------------
-- FONCTIONS RPC & UTILITAIRES
-- -----------------------------------------------------------------

-- Fonction pour incrémenter le quota searches_made
create or replace function increment_searches_quota(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
    update public.quotas
    set searches_made = searches_made + 1,
        updated_at = now()
    where user_id = p_user_id;
end;
$$;

-- Fonction pour incrémenter le quota prospects_scraped
create or replace function increment_prospects_quota(p_user_id uuid, p_count int)
returns void
language plpgsql
security definer
as $$
begin
    update public.quotas
    set prospects_scraped = prospects_scraped + p_count,
        updated_at = now()
    where user_id = p_user_id;
end;
$$;

-- Fonction pour incrémenter le quota emails_verified
create or replace function increment_emails_verified_quota(p_user_id uuid, p_count int)
returns void
language plpgsql
security definer
as $$
begin
    update public.quotas
    set emails_verified = emails_verified + p_count,
        updated_at = now()
    where user_id = p_user_id;
end;
$$;

-- Fonction pour incrémenter le quota cold_emails_generated
create or replace function increment_cold_emails_quota(p_user_id uuid, p_count int)
returns void
language plpgsql
security definer
as $$
begin
    update public.quotas
    set cold_emails_generated = cold_emails_generated + p_count,
        updated_at = now()
    where user_id = p_user_id;
end;
$$;

-- Fonction pour vérifier si l'utilisateur a dépassé un quota
create or replace function check_quota(p_user_id uuid, p_quota_type text)
returns boolean
language plpgsql
security definer
as $$
declare
    v_made int;
    v_limit int;
begin
    case p_quota_type
        when 'searches' then
            select searches_made, searches_limit into v_made, v_limit
            from public.quotas where user_id = p_user_id;
        when 'prospects' then
            select prospects_scraped, prospects_limit into v_made, v_limit
            from public.quotas where user_id = p_user_id;
        when 'emails_verified' then
            select emails_verified, emails_verified_limit into v_made, v_limit
            from public.quotas where user_id = p_user_id;
        when 'cold_emails' then
            select cold_emails_generated, cold_emails_limit into v_made, v_limit
            from public.quotas where user_id = p_user_id;
        else
            return false;
    end case;

    return v_made < v_limit;
end;
$$;

-- Fonction pour récupérer les quotas d'un utilisateur
create or replace function get_user_quotas(p_user_id uuid)
returns table (
    searches_made int,
    searches_limit int,
    prospects_scraped int,
    prospects_limit int,
    emails_verified int,
    emails_verified_limit int,
    cold_emails_generated int,
    cold_emails_limit int,
    reset_at timestamptz
)
language plpgsql
security definer
as $$
begin
    return query
    select 
        q.searches_made,
        q.searches_limit,
        q.prospects_scraped,
        q.prospects_limit,
        q.emails_verified,
        q.emails_verified_limit,
        q.cold_emails_generated,
        q.cold_emails_limit,
        q.reset_at
    from public.quotas q
    where q.user_id = p_user_id;
end;
$$;

-- Fonction pour renouveler les quotas mensuels
create or replace function renew_monthly_quotas()
returns void
language plpgsql
security definer
as $$
begin
    update public.quotas
    set 
        searches_made = 0,
        prospects_scraped = 0,
        emails_verified = 0,
        cold_emails_generated = 0,
        reset_at = now() + interval '30 days',
        updated_at = now()
    where reset_at <= now();
end;
$$;


-- -----------------------------------------------------------------
-- REALTIME & PUBLICATION
-- -----------------------------------------------------------------

-- Enable Realtime pour les tables principales
alter publication supabase_realtime add table public.scrape_jobs;
alter publication supabase_realtime add table public.scrape_prospect;
alter publication supabase_realtime add table public.quotas;
alter publication supabase_realtime add table public.email_verification_jobs;
alter publication supabase_realtime add table public.email_verification_results;
alter publication supabase_realtime add table public.cold_email_campaigns;
alter publication supabase_realtime add table public.cold_email_jobs;
alter publication supabase_realtime add table public.cold_email_generations;


-- -----------------------------------------------------------------
-- NOTES & COMMENTAIRES
-- -----------------------------------------------------------------

-- Ce schéma inclut:
-- 1. Authentification et profils utilisateurs
-- 2. Système de subscription et quotas
-- 3. Scraping de prospects (Google Maps, etc.)
-- 4. Vérification d'emails en masse
-- 5. Génération de cold emails avec IA
-- 6. Toutes les politiques RLS pour sécuriser l'accès aux données
-- 7. Fonctions utilitaires pour gérer les quotas
-- 8. Support Realtime pour les updates en temps réel
