import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Testing email_sends insert...");
  // Try to insert a dummy record
  const { data: emailSend, error: insertError } = await supabase
    .from('email_sends')
    .insert({
      user_id: 'e694fb21-1250-4d40-8b01-52328fb87e22', // Assuming this might fail RLS if not real user, but we use anon/service key
      campaign_id: null,
      lead_id: 1,
      sending_account_id: null,
      provider: 'mailgun',
      from_email: 'test@test.com',
      to_email: 'test@test.com',
      subject: 'Test subject',
      html: '<p>Test</p>',
      status: 'prepared',
    })
    .select('id')
    .single();
    
  console.log("Insert result:", { data: emailSend, error: insertError });
}

main().catch(console.error);
