-- Allow users to update their own quotas (via RPC functions)
drop policy if exists "Users can update their own quotas via RPC" on public.quotas;
create policy "Users can update their own quotas via RPC"
  on public.quotas
  for update
  using (auth.uid() = user_id);

-- Ensure users can insert their own quotas (for onboarding)
drop policy if exists "Users can insert their own quotas" on public.quotas;
create policy "Users can insert their own quotas"
  on public.quotas
  for insert
  with check (auth.uid() = user_id);