-- Migration: Campaign-Prospect Management System
-- Description: Creates junction table to link prospects to campaigns with email generation/send tracking

-- Create campaign_prospects junction table
-- Links prospects to campaigns and tracks email generation/sending status

CREATE TABLE IF NOT EXISTS campaign_prospects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign keys
    campaign_id uuid NOT NULL REFERENCES cold_email_campaigns(id) ON DELETE CASCADE,
    prospect_id text NOT NULL REFERENCES scrape_prospect(id_prospect) ON DELETE CASCADE,
    
    -- Email tracking
    email_status text NOT NULL DEFAULT 'not_generated',
    -- Possible values: 'not_generated', 'generated', 'sent', 'bounced', 'replied'
    
    generated_email_subject text,
    generated_email_content text,
    
    -- Timestamps
    email_generated_at timestamptz,
    email_sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    UNIQUE(campaign_id, prospect_id),
    CHECK (email_status IN ('not_generated', 'generated', 'sent', 'bounced', 'replied'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_campaign ON campaign_prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_prospect ON campaign_prospects(prospect_id);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_status ON campaign_prospects(email_status);

-- Add comments for documentation
COMMENT ON TABLE campaign_prospects IS 'Links prospects to campaigns with email generation/send tracking';
COMMENT ON COLUMN campaign_prospects.email_status IS 'Status of email: not_generated, generated, sent, bounced, replied';
COMMENT ON COLUMN campaign_prospects.generated_email_subject IS 'AI-generated email subject for this prospect';
COMMENT ON COLUMN campaign_prospects.generated_email_content IS 'AI-generated email content for this prospect';
COMMENT ON COLUMN campaign_prospects.email_generated_at IS 'When the email was generated';
COMMENT ON COLUMN campaign_prospects.email_sent_at IS 'When the email was sent';

-- RLS Policies
ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;

-- Users can see campaign_prospects for their own campaigns
CREATE POLICY "Users can view their campaign prospects"
    ON campaign_prospects FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM cold_email_campaigns
            WHERE cold_email_campaigns.id = campaign_prospects.campaign_id
            AND cold_email_campaigns.user_id = auth.uid()
        )
    );

-- Users can insert campaign_prospects for their own campaigns
CREATE POLICY "Users can add prospects to their campaigns"
    ON campaign_prospects FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM cold_email_campaigns
            WHERE cold_email_campaigns.id = campaign_prospects.campaign_id
            AND cold_email_campaigns.user_id = auth.uid()
        )
    );

-- Users can update campaign_prospects for their own campaigns
CREATE POLICY "Users can update their campaign prospects"
    ON campaign_prospects FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM cold_email_campaigns
            WHERE cold_email_campaigns.id = campaign_prospects.campaign_id
            AND cold_email_campaigns.user_id = auth.uid()
        )
    );

-- Users can delete campaign_prospects for their own campaigns
CREATE POLICY "Users can remove prospects from their campaigns"
    ON campaign_prospects FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM cold_email_campaigns
            WHERE cold_email_campaigns.id = campaign_prospects.campaign_id
            AND cold_email_campaigns.user_id = auth.uid()
        )
    );
