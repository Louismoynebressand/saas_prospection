ALTER TABLE cold_email_campaigns 
ADD COLUMN IF NOT EXISTS closing_phrase TEXT DEFAULT 'Cordialement,';
