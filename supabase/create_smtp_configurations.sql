-- Create SMTP Configurations table
CREATE TABLE IF NOT EXISTS smtp_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'ionos', 'custom')),
    smtp_host TEXT NOT NULL,
    smtp_port INTEGER NOT NULL,
    smtp_user TEXT NOT NULL,
    smtp_password TEXT NOT NULL, -- Stored as text for MVP (recommend Vault for prod)
    from_email TEXT NOT NULL,
    from_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE smtp_configurations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own smtp configs"
    ON smtp_configurations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own smtp configs"
    ON smtp_configurations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own smtp configs"
    ON smtp_configurations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own smtp configs"
    ON smtp_configurations FOR DELETE
    USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_smtp_configs_user_id ON smtp_configurations(user_id);
