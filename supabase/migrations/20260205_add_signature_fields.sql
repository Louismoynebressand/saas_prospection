-- Add missing signature fields to cold_email_campaigns table
ALTER TABLE cold_email_campaigns 
ADD COLUMN IF NOT EXISTS signature_website_text TEXT,
ADD COLUMN IF NOT EXISTS signature_custom_link_text TEXT,
ADD COLUMN IF NOT EXISTS signature_custom_link_url TEXT,
ADD COLUMN IF NOT EXISTS signature_show_phone BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS signature_show_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS signature_show_website BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS signature_html TEXT;

COMMENT ON COLUMN cold_email_campaigns.signature_website_text IS 'Custom text for the website link in signature';
COMMENT ON COLUMN cold_email_campaigns.signature_custom_link_text IS 'Text for an optional custom link (e.g. Calendly)';
COMMENT ON COLUMN cold_email_campaigns.signature_custom_link_url IS 'URL for the custom link';
COMMENT ON COLUMN cold_email_campaigns.signature_html IS 'The full HTML of the generated signature';
