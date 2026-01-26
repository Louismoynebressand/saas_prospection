# Neuraflow / SaaS Super Prospect — Schéma global Supabase (schema `public`)

Généré le: **2026-01-26 22:13:19Z**

Ce document agrège les tables et colonnes de la base Supabase.

## Tables principales

### 1) `public.profiles`
- `id` (uuid, PK) - ID utilisateur
- `email` (text)
- `first_name` (text)
- `last_name` (text)
- `company_name` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 2) `public.scrape_jobs`
- `id_jobs` (int, PK) ⚠️
- `id_user` (text) ⚠️ - Devrait être uuid
- `statut` (text)
- `created_at` (timestamptz)
- autres...

### 3) `public.scrape_prospect`
- `id_prospect` (int, PK)
- `id_user` (uuid) - FK → profiles.id
- `id_jobs` (text) ⚠️ - FK logique → scrape_jobs.id_jobs (int)
- `created_at` (timestamptz)
- autres...

## ⚠️ Points d'incohérence de types

1. **scrape_jobs.id_user** : type `text` au lieu de `uuid`
2. **scrape_prospect.id_jobs** : type `text` au lieu de `int`

Ces incohérences causent les erreurs de RLS "operator does not exist: text = bigint".
