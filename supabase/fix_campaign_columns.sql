-- 🛠️ FIX: Expand Columns for AI Content
-- This script changes restrictive columns to TEXT to prevent "value too long" errors.

ALTER TABLE cold_email_campaigns 
    ALTER COLUMN main_promise TYPE TEXT,
    ALTER COLUMN pitch TYPE TEXT,
    ALTER COLUMN main_offer TYPE TEXT,
    ALTER COLUMN objective TYPE TEXT, -- Temporarily allow text if enum fails, or rely on mapping
    ALTER COLUMN signature_ps TYPE TEXT;

-- Verify changes
SELECT 
    column_name, 
    data_type, 
    character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'cold_email_campaigns' 
  AND column_name IN ('main_promise', 'pitch', 'main_offer', 'objective', 'signature_ps');
