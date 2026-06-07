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
  const { data, error } = await supabase.rpc('get_lead_id_type'); // if exists
  // Or just insert string "1" and see the error code
  const res = await supabase.from('email_sends').insert({ 
     user_id: '1d62e7ea-31fa-40ea-9bf6-a0589bdc20cd', 
     from_email: 'a', to_email: 'b', status: 'prepared', lead_id: 1 
  });
  console.log("Insert result:", res.error);
}

main().catch(console.error);
