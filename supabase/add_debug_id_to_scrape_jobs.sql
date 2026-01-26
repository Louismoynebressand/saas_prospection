-- Ajouter la colonne debug_id à scrape_jobs pour le tracking des erreurs
alter table public.scrape_jobs
add column if not exists debug_id uuid;

-- Créer un index pour faciliter les recherches par debug_id
create index if not exists scrape_jobs_debug_id_idx on public.scrape_jobs (debug_id);

-- Commentaire pour documentation
comment on column public.scrape_jobs.debug_id is 'UUID unique pour le tracking et debugging des jobs';
