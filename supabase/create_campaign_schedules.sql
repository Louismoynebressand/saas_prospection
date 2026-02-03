-- Create Campaign Schedules Table
CREATE TABLE IF NOT EXISTS campaign_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES cold_email_campaigns(id) ON DELETE CASCADE,
    start_date TIMESTAMPTZ NOT NULL,
    daily_limit INTEGER NOT NULL DEFAULT 10,
    time_window_start TIME NOT NULL DEFAULT '08:00:00',
    time_window_end TIME NOT NULL DEFAULT '18:00:00',
    days_of_week INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}', -- 1=Monday, 7=Sunday
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'draft')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Email Queue Table
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES cold_email_campaigns(id) ON DELETE CASCADE,
    
    -- Corrected Foreign Key to scrape_prospect (BIGINT)
    prospect_id BIGINT NOT NULL REFERENCES scrape_prospect(id_prospect) ON DELETE CASCADE,
    
    schedule_id UUID REFERENCES campaign_schedules(id) ON DELETE SET NULL,
    
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped', 'cancelled')),
    priority INTEGER DEFAULT 0,
    
    scheduled_for DATE, -- Optional: if we want to pin a specific date
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint to prevent double queuing of the same prospect in the same campaign
    UNIQUE(campaign_id, prospect_id)
);

-- Enable RLS
ALTER TABLE campaign_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Simple ownership based on campaign -> user relationship would be ideal, 
-- but for MVP we might trust authenticated users if they own the campaign. 
-- Assuming cold_email_campaigns has user_id, we can join. 
-- For now, allowing all authenticated access for simplicity or strict join if needed.)

-- Policy for campaign_schedules
CREATE POLICY "Users can manage their own campaign schedules"
    ON campaign_schedules
    USING (
        EXISTS (
            SELECT 1 FROM cold_email_campaigns 
            WHERE cold_email_campaigns.id = campaign_schedules.campaign_id 
            AND cold_email_campaigns.user_id = auth.uid()
        )
    );

-- Policy for email_queue
CREATE POLICY "Users can manage their own email queue"
    ON email_queue
    USING (
        EXISTS (
            SELECT 1 FROM cold_email_campaigns 
            WHERE cold_email_campaigns.id = email_queue.campaign_id 
            AND cold_email_campaigns.user_id = auth.uid()
        )
    );

-- Indexes for performance
CREATE INDEX idx_schedules_campaign_id ON campaign_schedules(campaign_id);
CREATE INDEX idx_queue_campaign_status ON email_queue(campaign_id, status);
CREATE INDEX idx_queue_prospect_id ON email_queue(prospect_id);
