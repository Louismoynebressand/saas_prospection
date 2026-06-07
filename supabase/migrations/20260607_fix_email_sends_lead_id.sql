ALTER TABLE email_sends ALTER COLUMN lead_id TYPE BIGINT USING lead_id::text::bigint;
