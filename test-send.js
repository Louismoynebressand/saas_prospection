import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2];
  return acc;
}, {});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Testing email_sends insert...");
  // Try to insert a dummy record
  const { data: emailSend, error: insertError } = await supabase
    .from('email_sends')
    .insert({
      user_id: '1d62e7ea-31fa-40ea-9bf6-a0589bdc20cd', // dummy UUID
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
