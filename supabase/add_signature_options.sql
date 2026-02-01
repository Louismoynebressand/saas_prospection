-- Migration: Add email signature customization fields
-- Description: Adds fields for customizing email signatures with display options, custom links, and HTML storage

-- Add new columns for signature customization
ALTER TABLE cold_email_campaigns
ADD COLUMN IF NOT EXISTS signature_show_phone boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS signature_show_website boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS signature_website_text text DEFAULT 'Visitez notre site web',
ADD COLUMN IF NOT EXISTS signature_custom_link_url text,
ADD COLUMN IF NOT EXISTS signature_custom_link_text text,
ADD COLUMN IF NOT EXISTS signature_elements_order jsonb DEFAULT '["name", "title", "company", "phone", "email", "website", "custom_link", "ps"]'::jsonb,
ADD COLUMN IF NOT EXISTS signature_html text;

-- Add comments for documentation
COMMENT ON COLUMN cold_email_campaigns.signature_show_phone IS 'Whether to display phone number in email signature';
COMMENT ON COLUMN cold_email_campaigns.signature_show_website IS 'Whether to display website link in email signature';
COMMENT ON COLUMN cold_email_campaigns.signature_website_text IS 'Custom text for website link';
COMMENT ON COLUMN cold_email_campaigns.signature_custom_link_url IS 'URL for custom link (e.g., Calendly, booking page)';
COMMENT ON COLUMN cold_email_campaigns.signature_custom_link_text IS 'Display text for custom link';
COMMENT ON COLUMN cold_email_campaigns.signature_elements_order IS 'JSON array defining the order of signature elements';
COMMENT ON COLUMN cold_email_campaigns.signature_html IS 'Generated HTML for email signature';
