-- Politiques RLS complètes pour la table quotas
-- Inclut: SELECT, INSERT, UPDATE pour permettre toutes les opérations nécessaires

-- Supprimer les anciennes politiques si elles existent
drop policy if exists "Users can view their own quotas" on public.quotas;
drop policy if exists "Users can update their own quotas via RPC" on public.quotas;
drop policy if exists "Users can update their own quotas" on public.quotas;
drop policy if exists "Users can insert their own quotas" on public.quotas;

-- Créer les politiques complètes

-- 1. Policy SELECT: permettre aux utilisateurs de lire leurs propres quotas
create policy "Users can view their own quotas"
  on public.quotas
  for select
  using (auth.uid() = user_id);

-- 2. Policy UPDATE: permettre aux utilisateurs de mettre à jour leurs propres quotas (via RPC)
create policy "Users can update their own quotas"
  on public.quotas
  for update
  using (auth.uid() = user_id);

-- 3. Policy INSERT: permettre aux utilisateurs de créer leurs propres quotas (onboarding)
create policy "Users can insert their own quotas"
  on public.quotas
  for insert
  with check (auth.uid() = user_id);
