-- =================================================================
-- MIGRATION : Intégration Mailgun Natif (VERSION CORRIGÉE)
-- Date: 2026-04-30
-- =================================================================

-- -----------------------------------------------------------------
-- MIGRATION 1a : Rendre smtp_host/port/user/password nullable
-- pour accueillir les comptes Mailgun (qui n'ont pas de config SMTP)
-- NE CASSE PAS les comptes SMTP existants (valeurs conservées)
-- -----------------------------------------------------------------

ALTER TABLE smtp_configurations
  ALTER COLUMN smtp_host DROP NOT NULL,
  ALTER COLUMN smtp_port DROP NOT NULL,
  ALTER COLUMN smtp_user DROP NOT NULL,
  ALTER COLUMN smtp_password DROP NOT NULL;

-- -----------------------------------------------------------------
-- MIGRATION 1b : Colonnes Mailgun dans smtp_configurations
-- -----------------------------------------------------------------

ALTER TABLE smtp_configurations
  ADD COLUMN IF NOT EXISTS mailgun_domain TEXT,
  ADD COLUMN IF NOT EXISTS mailgun_region TEXT DEFAULT 'US' CHECK (mailgun_region IN ('US', 'EU')),
  ADD COLUMN IF NOT EXISTS mailgun_api_key TEXT,
  ADD COLUMN IF NOT EXISTS reply_to TEXT,
  ADD COLUMN IF NOT EXISTS daily_limit INTEGER,
  ADD COLUMN IF NOT EXISTS tracking_opens BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tracking_clicks BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS mailgun_webhook_signing_key TEXT;

-- -----------------------------------------------------------------
-- MIGRATION 2 : Table email_sends
-- Note: lead_id = UUID sans FK car scrape_prospect PK = id_prospect (bigint)
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES cold_email_campaigns(id) ON DELETE SET NULL,
  lead_id UUID,
  sending_account_id UUID REFERENCES smtp_configurations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'mailgun',
  provider_message_id TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  html TEXT,
  body_text TEXT,
  status TEXT NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'accepted', 'delivered', 'opened', 'clicked', 'failed', 'complained', 'unsubscribed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  error_message TEXT,
  raw_provider_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email_sends"
  ON email_sends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email_sends"
  ON email_sends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email_sends"
  ON email_sends FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_sends_user ON email_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_provider_msg ON email_sends(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_sends(status);

-- -----------------------------------------------------------------
-- MIGRATION 3 : Table email_events
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_send_id UUID REFERENCES email_sends(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'mailgun',
  event_type TEXT NOT NULL,
  recipient TEXT,
  provider_message_id TEXT,
  event_timestamp TIMESTAMPTZ,
  url TEXT,
  reason TEXT,
  severity TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_events_send_id ON email_events(email_send_id);
CREATE INDEX IF NOT EXISTS idx_email_events_provider_msg ON email_events(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_created ON email_events(created_at DESC);
