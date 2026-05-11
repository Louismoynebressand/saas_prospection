-- Add email_mode column to cold_email_campaigns
-- Run this in Supabase SQL Editor

ALTER TABLE cold_email_campaigns
  ADD COLUMN IF NOT EXISTS email_mode TEXT NOT NULL DEFAULT 'BALANCED';

-- Valid values: 'BALANCED' (Équilibré / professionnel) | 'SHORT_DIRECT' (Court direct / question directe)
-- Extensible: add new modes later without schema changes

COMMENT ON COLUMN cold_email_campaigns.email_mode IS
  'Email writing mode: BALANCED = multi-line professional email, SHORT_DIRECT = short direct question for first approach';
